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
const NepaliDate = require('nepali-date-converter').default;
const { dateConfigMap } = require('nepali-date-converter');

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
    // CRITICAL: Get a local Date object in Kathmandu timezone.
    // If the server runs in UTC, 1:00 AM Kathmandu is 19:15 UTC (the previous day).
    const nepalTimeStr = today.toLocaleString("en-US", { timeZone: "Asia/Kathmandu" });
    const localNepalDate = new Date(nepalTimeStr);
    
    let currentDay;
    let daysInMonth;

    if (settings.calendarType === 'BS') {
      const bsDate = new NepaliDate(today);
      const bs = bsDate.getBS(); // { year, month: 0-11, date, day }
      const bsMonths = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
      const monthName = bsMonths[bs.month];
      currentDay = bs.date;
      daysInMonth = dateConfigMap[bs.year.toString()][monthName];
      console.log(`[WORKER: BILLING] Operating in BS Calendar Mode: ${bs.year}-${bs.month + 1}-${bs.date} (Days in month: ${daysInMonth})`);
    } else {
      currentDay = localNepalDate.getDate();
      daysInMonth = new Date(localNepalDate.getFullYear(), localNepalDate.getMonth() + 1, 0).getDate();
      console.log(`[WORKER: BILLING] Operating in AD Calendar Mode: ${localNepalDate.toISOString().split('T')[0]} (Days in month: ${daysInMonth})`);
    }
    
    const globalTargetDay = settings.billingCycleDay;
    
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

      // 5. Filter customers whose effective billing day is today (adjusted for short months)
      const customersToBill = customers.filter(customer => {
        const effectiveDay = customer.billingCycleDay || globalTargetDay;
        const adjustedDay = Math.min(effectiveDay, daysInMonth);
        return adjustedDay === currentDay;
      });

      if (customersToBill.length === 0) {
        cursor = customers[customers.length - 1].customerId;
        continue;
      }

      // 6. Process the batch within a transaction
      await prisma.$transaction(async (tx) => {
        for (const customer of customersToBill) {
          const baseFee = new Decimal(customer.monthlyFee.toString());
          const feeAmount = customer.increasedFee && new Decimal(customer.increasedFee.toString()).gt(0)
            ? new Decimal(customer.increasedFee.toString())
            : baseFee;

          // ── LOCK THE ROW: Prevent Race Conditions with concurrent payments ──
          const lockedRows = await tx.$queryRaw`
            SELECT "outstandingPayment"::text, "advanceBalance"::text, "debtStartDate"
            FROM "customers"
            WHERE "customerId" = ${customer.customerId}
            FOR UPDATE
          `;
          
          if (!lockedRows || lockedRows.length === 0) continue;
          
          const lockedCustomer = lockedRows[0];

          const currentAdvance = new Decimal(lockedCustomer.advanceBalance.toString());
          const currentOutstanding = new Decimal(lockedCustomer.outstandingPayment.toString());
          
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
          let newDebtStartDate = lockedCustomer.debtStartDate;
          if (newOutstanding.gt(0) && currentOutstanding.lte(0)) {
            newDebtStartDate = new Date();
          } else if (newOutstanding.lte(0)) {
            newDebtStartDate = null; // Cleared debt
          }

          // ── Update the customer balances ──
          const updateData = {
            advanceBalance: newAdvance.toFixed(2),
            outstandingPayment: newOutstanding.toFixed(2),
            lastBilledDate: today,
            debtStartDate: newDebtStartDate,
          };
          
          if (newAdvance.eq(0) && currentAdvance.gt(0)) {
            updateData.advanceStartDate = null;
            updateData.advanceEndDate = null;
          }

          await tx.customer.update({
            where: { customerId: customer.customerId },
            data: updateData
          });
          
          // ── Create a Digital Receipt in BillingLedger ──
          const monthName = new Date().toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kathmandu' });
          await tx.billingLedger.create({
            data: {
              customerId: customer.customerId,
              amount: feeAmount.toFixed(2),
              description: `Automated Monthly Waste Collection Fee - ${monthName}`,
            }
          });
          
          totalBilled++;
        }
      }, { isolationLevel: 'Serializable' });

      console.log(`[WORKER: BILLING] Billed batch of ${customersToBill.length} eligible customers (out of ${customers.length} checked).`);
      cursor = customers[customers.length - 1].customerId;
    }

    console.log(`[WORKER: BILLING] Billing cycle completed. Total customers billed: ${totalBilled}`);
  } catch (error) {
    console.error(`[WORKER: BILLING] CRITICAL ERROR during mass billing:`, error);
  }
}

function initBillingWorker() {
  // Run daily at 01:00 AM Nepal Time (Asia/Kathmandu)
  cron.schedule('0 1 * * *', () => {
    runBillingCycle();
  }, {
    timezone: "Asia/Kathmandu"
  });
  console.log('[WORKER] Billing Engine scheduled (01:00 AM daily, Asia/Kathmandu).');
}

module.exports = { initBillingWorker, runBillingCycle };
