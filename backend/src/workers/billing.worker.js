// ============================================================================
// WORKER: ZERO-TOUCH BILLING ENGINE
// ============================================================================
// Runs daily at 01:00 AM (Asia/Kathmandu).
// Automates monthly billing for all customers according to:
//   1. GlobalSettings.billingCycleDay (default) OR
//   2. Customer.billingCycleDay (custom per customer)
//
// LOGIC:
// 1. Fetch current monthly settings (calendarType: 'BS' | 'AD', billingCycleDay: 1-28).
// 2. Determine current date and day in Nepal Time (Asia/Kathmandu).
// 3. For each active customer:
//    - Determine effective billing day: (customer.billingCycleDay || globalTargetDay).
//    - Adjust for short months: adjustedDay = Math.min(effectiveDay, daysInMonth).
//    - Eligibility Check:
//        a) Current day of month has reached or passed customer's billing day (currentDay >= adjustedDay).
//        b) Customer has NOT yet been billed for the current month!
// 4. For eligible customers:
//    - Deduct fee from advanceBalance (Smart Wallet) if available.
//    - Remaining fee is added to outstandingPayment (increases Outstanding Due).
//    - Update debtStartDate if they just went into debt.
//    - Set lastBilledDate to current date.
//    - Create an invoice entry in BillingLedger.
// ============================================================================

const cron = require('node-cron');
const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');
const NepaliDate = require('nepali-date-converter').default;
const { dateConfigMap } = require('nepali-date-converter');

// Use banker's rounding for all calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Checks if a customer has already been billed for the current calendar month.
 */
function isCustomerBilledForCurrentMonth(lastBilledDate, calendarType, localNepalDate) {
  if (!lastBilledDate) return false;
  const billedDate = new Date(lastBilledDate);

  if (calendarType === 'BS') {
    const curBs = new NepaliDate(localNepalDate).getBS();
    const billedBs = new NepaliDate(billedDate).getBS();
    return billedBs.year === curBs.year && billedBs.month === curBs.month;
  } else {
    return (
      billedDate.getFullYear() === localNepalDate.getFullYear() &&
      billedDate.getMonth() === localNepalDate.getMonth()
    );
  }
}

/**
 * Executes the mass billing job.
 * @param {Object} options
 * @param {boolean} options.forceAll - If true, bills all unbilled customers regardless of trigger day
 * @returns {Promise<{ totalBilled: number, totalAmount: Decimal, details: Array }>}
 */
async function runBillingCycle(options = {}) {
  const { forceAll = false } = options;
  console.log(`[WORKER: BILLING] Starting billing engine at ${new Date().toISOString()} (forceAll: ${forceAll})`);

  try {
    // 1. Fetch Global Settings
    const settings = await prisma.globalSettings.findFirst();
    if (!settings) {
      console.error('[WORKER: BILLING] Global settings missing. Aborting billing cycle.');
      return { totalBilled: 0, totalAmount: new Decimal(0), details: [] };
    }

    const today = new Date();
    // CRITICAL: All date evaluations MUST be in Nepal Time (Asia/Kathmandu)
    const nepalTimeStr = today.toLocaleString("en-US", { timeZone: "Asia/Kathmandu" });
    const localNepalDate = new Date(nepalTimeStr);

    let currentDay;
    let daysInMonth;
    let periodName = '';

    const bsMonths = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

    if (settings.calendarType === 'BS') {
      const bsDate = new NepaliDate(localNepalDate);
      const bs = bsDate.getBS(); // { year, month: 0-11, date, day }
      const monthName = bsMonths[bs.month];
      currentDay = bs.date;
      daysInMonth = dateConfigMap[bs.year.toString()] ? dateConfigMap[bs.year.toString()][monthName] : 30;
      periodName = `${monthName} ${bs.year} (BS)`;
      console.log(`[WORKER: BILLING] Operating in BS Calendar Mode: ${bs.year}-${bs.month + 1}-${bs.date} (${periodName}, Days in month: ${daysInMonth})`);
    } else {
      currentDay = localNepalDate.getDate();
      daysInMonth = new Date(localNepalDate.getFullYear(), localNepalDate.getMonth() + 1, 0).getDate();
      const adMonthName = localNepalDate.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kathmandu' });
      periodName = `${adMonthName} ${localNepalDate.getFullYear()} (AD)`;
      console.log(`[WORKER: BILLING] Operating in AD Calendar Mode: ${localNepalDate.toISOString().split('T')[0]} (${periodName}, Days in month: ${daysInMonth})`);
    }

    const globalTargetDay = settings.billingCycleDay || 1;

    // 2. Process active customers in batches
    let cursor = null;
    const BATCH_SIZE = 500;
    let totalBilled = 0;
    let totalBilledAmount = new Decimal('0.00');
    const billedDetails = [];

    while (true) {
      const customers = await prisma.customer.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { customerId: cursor } : undefined,
        where: {
          isActive: true,
        },
        orderBy: { customerId: 'asc' }
      });

      if (customers.length === 0) break;

      // 3. Filter customers who are due for billing
      const customersToBill = customers.filter(customer => {
        // Already billed for current month? Skip!
        const alreadyBilled = isCustomerBilledForCurrentMonth(customer.lastBilledDate, settings.calendarType, localNepalDate);
        if (alreadyBilled) return false;

        // If forceAll is requested, bill anyone unbilled this month
        if (forceAll) return true;

        // Target day: customer custom billing day OR global default
        const effectiveDay = customer.billingCycleDay || globalTargetDay;
        const adjustedDay = Math.min(effectiveDay, daysInMonth);

        // Bill if today has reached or passed the trigger day
        return currentDay >= adjustedDay;
      });

      if (customersToBill.length === 0) {
        cursor = customers[customers.length - 1].customerId;
        continue;
      }

      // 4. Process the batch within an ACID transaction
      await prisma.$transaction(async (tx) => {
        for (const customer of customersToBill) {
          const baseFee = new Decimal(customer.monthlyFee.toString());
          const feeAmount = customer.increasedFee && new Decimal(customer.increasedFee.toString()).gt(0)
            ? new Decimal(customer.increasedFee.toString())
            : baseFee;

          // LOCK THE ROW to prevent concurrent balance drift
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

          // Smart Wallet Deduction Logic
          if (currentAdvance.gte(feeAmount)) {
            // Fully covered by advance wallet
            newAdvance = currentAdvance.minus(feeAmount);
          } else if (currentAdvance.gt(0)) {
            // Partially covered by advance wallet
            const remainingFee = feeAmount.minus(currentAdvance);
            newAdvance = new Decimal('0.00');
            newOutstanding = currentOutstanding.plus(remainingFee);
          } else {
            // No advance wallet — full amount added to outstanding due
            newOutstanding = currentOutstanding.plus(feeAmount);
          }

          // Track debt start date if customer just went into debt
          let newDebtStartDate = lockedCustomer.debtStartDate;
          if (newOutstanding.gt(0) && currentOutstanding.lte(0)) {
            newDebtStartDate = localNepalDate;
          } else if (newOutstanding.lte(0)) {
            newDebtStartDate = null;
          }

          // Update customer record
          const updateData = {
            advanceBalance: newAdvance.toFixed(2),
            outstandingPayment: newOutstanding.toFixed(2),
            lastBilledDate: localNepalDate,
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

          // Create an invoice record in BillingLedger
          await tx.billingLedger.create({
            data: {
              customerId: customer.customerId,
              amount: feeAmount.toFixed(2),
              description: `Automated Monthly Waste Collection Fee - ${periodName}`,
            }
          });

          totalBilled++;
          totalBilledAmount = totalBilledAmount.plus(feeAmount);
          billedDetails.push({
            customerId: customer.customerId,
            name: customer.name,
            feeAmount: feeAmount.toFixed(2),
            previousDue: currentOutstanding.toFixed(2),
            newDue: newOutstanding.toFixed(2),
          });
        }
      }, { isolationLevel: 'Serializable' });

      console.log(`[WORKER: BILLING] Successfully billed batch of ${customersToBill.length} customers.`);
      cursor = customers[customers.length - 1].customerId;
    }

    console.log(`[WORKER: BILLING] Billing cycle completed. Total customers billed: ${totalBilled}, Total Fee: Rs. ${totalBilledAmount.toFixed(2)}`);
    return {
      totalBilled,
      totalAmount: totalBilledAmount.toFixed(2),
      details: billedDetails,
    };
  } catch (error) {
    console.error(`[WORKER: BILLING] CRITICAL ERROR during mass billing:`, error);
    throw error;
  }
}

function initBillingWorker() {
  // Run daily at 01:00 AM Nepal Time (Asia/Kathmandu)
  cron.schedule('0 1 * * *', () => {
    runBillingCycle().catch(err => {
      console.error('[WORKER: BILLING] Scheduled job error:', err);
    });
  }, {
    timezone: "Asia/Kathmandu"
  });
  console.log('[WORKER] Billing Engine scheduled (01:00 AM daily, Asia/Kathmandu).');
}

module.exports = { initBillingWorker, runBillingCycle, isCustomerBilledForCurrentMonth };
