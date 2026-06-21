// ============================================================================
// WORKER: ZERO-TOUCH BILLING ENGINE
// ============================================================================
// Runs daily at 01:00 AM.
// Automates mass billing for all 4,500+ customers based on the GlobalSettings
// billingCycleDay.
//
// LOGIC:
// 1. Fetch current monthly fee and billing day.
// 2. Adjust target billing day for months shorter than the configured day.
// 3. If today is the target billing day, fetch all active customers who haven't been billed today.
// 4. For each customer, deduct the fee from their advanceBalance (Smart Wallet) first.
// 5. If advanceBalance is insufficient, add the remaining fee to outstandingPayment.
// 6. Update lastBilledDate and debtStartDate (if they just went into debt).
// 7. Wrap each batch in an ACID transaction.
//
// ACCOUNTING NOTE: This engine operates on a Cash-Basis. It does NOT create
// IncomeLedger records because no actual cash is collected here. IncomeLedger
// records are ONLY created when physical cash or digital payments are received
// (e.g., during field collection or advance wallet top-ups).
// ============================================================================

const cron = require('node-cron');
const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');

// Use banker's rounding for all calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Executes the mass billing job.
 */
async function runBillingCycle() {
  console.log(`[WORKER: BILLING] Starting zero-touch billing engine at ${new Date().toISOString()}`);

  try {
    // 1. Fetch Global Settings
    const settings = await prisma.globalSettings.findFirst();
    if (!settings) {
      console.error('[WORKER: BILLING] Global settings missing. Aborting billing cycle.');
      return;
    }

    const today = new Date();
    const currentDay = today.getDate();
    
    // 2. Adjust target billing day for shorter months (e.g., Feb, Apr, Jun, Sep, Nov)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const targetBillingDay = Math.min(settings.billingCycleDay, daysInMonth);
    
    // 3. Only run if today matches the target billing day
    if (currentDay !== targetBillingDay) {
      console.log(`[WORKER: BILLING] Today (day ${currentDay}) is not the target billing day (day ${targetBillingDay}). Skipping.`);
      return;
    }

    const feeAmount = new Decimal(settings.monthlyFeeAmount.toString());
    
    // Calculate the start of today to check lastBilledDate (idempotency check)
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 4. Process customers in batches of 500 to prevent memory/lock issues
    let cursor = null;
    const BATCH_SIZE = 500;
    let totalBilled = 0;

    while (true) {
      const customers = await prisma.customer.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { customerId: cursor } : undefined,
        where: {
          isActive: true,
          // Don't bill if they were already billed today (idempotency check)
          OR: [
            { lastBilledDate: null },
            { lastBilledDate: { lt: startOfToday } }
          ]
        },
        orderBy: { customerId: 'asc' }
      });

      if (customers.length === 0) break;

      // 5. Process the batch within a transaction
      await prisma.$transaction(async (tx) => {
        for (const customer of customers) {
          const currentAdvance = new Decimal(customer.advanceBalance.toString());
          const currentOutstanding = new Decimal(customer.outstandingPayment.toString());
          
          let newAdvance = currentAdvance;
          let newOutstanding = currentOutstanding;

          // ── Smart Wallet deduction logic ──
          if (currentAdvance.gte(feeAmount)) {
            // Fully covered by advance wallet
            newAdvance = currentAdvance.minus(feeAmount);
          } else if (currentAdvance.gt(0)) {
            // Partially covered by advance
            const remainingFee = feeAmount.minus(currentAdvance);
            newAdvance = new Decimal('0.00');
            newOutstanding = currentOutstanding.plus(remainingFee);
          } else {
            // No advance at all — full amount added to debt
            newOutstanding = currentOutstanding.plus(feeAmount);
          }

          // Determine if they just went into debt
          let newDebtStartDate = customer.debtStartDate;
          if (newOutstanding.gt(0) && currentOutstanding.lte(0)) {
            newDebtStartDate = new Date();
          } else if (newOutstanding.lte(0)) {
            newDebtStartDate = null; // Cleared debt
          }

          // ── Update the customer balances ──
          await tx.customer.update({
            where: { customerId: customer.customerId },
            data: {
              advanceBalance: newAdvance.toFixed(2),
              outstandingPayment: newOutstanding.toFixed(2),
              lastBilledDate: today,
              debtStartDate: newDebtStartDate,
            }
          });
          
          totalBilled++;
        }
      }, { isolationLevel: 'Serializable' });

      console.log(`[WORKER: BILLING] Billed batch of ${customers.length} customers.`);
      cursor = customers[customers.length - 1].customerId;
    }

    console.log(`[WORKER: BILLING] Billing cycle completed. Total customers billed: ${totalBilled}`);
  } catch (error) {
    console.error(`[WORKER: BILLING] CRITICAL ERROR during mass billing:`, error);
  }
}

function initBillingWorker() {
  // Run daily at 01:00 AM server time
  cron.schedule('0 1 * * *', () => {
    runBillingCycle();
  });
  console.log('[WORKER] Billing Engine scheduled (01:00 AM daily).');
}

module.exports = { initBillingWorker, runBillingCycle };
