// ============================================================================
// WORKER: ZERO-TOUCH BILLING ENGINE
// ============================================================================
// Runs automatically on startup, hourly, and at 01:00 AM (Asia/Kathmandu).
// Automates monthly billing for all customers according to:
//   1. GlobalSettings.billingCycleDay (default) OR
//   2. Customer.billingCycleDay (custom per customer)
//
// SMART WALLET / ADVANCE PAYMENT LOGIC:
// - Suppose customer has advanceBalance = 1000 and monthlyFee = 500:
//   On the customer's billing day (custom or global default), 500 is deducted
//   from advanceBalance, leaving advanceBalance = 500.00 and outstandingPayment = 0.00.
// - If advanceBalance = 300 and monthlyFee = 500:
//   300 is deducted from advanceBalance (leaving 0.00) and remaining 200 is
//   added to outstandingPayment.
// - If advanceBalance = 0 and monthlyFee = 500:
//   500 is added to outstandingPayment.
// ============================================================================

const cron = require('node-cron');
const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');
const NepaliDate = require('nepali-date-converter').default;
const { dateConfigMap } = require('nepali-date-converter');

// Use banker's rounding for all calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function toNepalWallDate(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const nepalTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
  return new Date(nepalTimeStr);
}

function getCalendarYMD(dateInput, calendarType) {
  const wallDate = toNepalWallDate(dateInput);
  if (calendarType === 'BS') {
    const bs = new NepaliDate(wallDate).getBS(); // { year, month: 0-11, date }
    return { year: bs.year, month: bs.month, day: bs.date };
  }
  return {
    year: wallDate.getFullYear(),
    month: wallDate.getMonth(),
    day: wallDate.getDate(),
  };
}

/**
 * Checks if a customer has already been billed for the current calendar month.
 */
function isCustomerBilledForCurrentMonth(lastBilledDate, calendarType, localNepalDate) {
  if (!lastBilledDate) return false;
  const curYMD = getCalendarYMD(localNepalDate, calendarType);
  const billedYMD = getCalendarYMD(lastBilledDate, calendarType);
  return billedYMD.year === curYMD.year && billedYMD.month === curYMD.month;
}

const bsMonths = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

function getMonthBounds(year, month0Indexed, calendarType) {
  if (calendarType === 'BS') {
    const monthName = bsMonths[month0Indexed];
    const days = dateConfigMap[year.toString()] ? dateConfigMap[year.toString()][monthName] : 30;
    const startBs = new NepaliDate(year, month0Indexed, 1);
    const endBs = new NepaliDate(year, month0Indexed, days);
    const sAd = startBs.getAD();
    const eAd = endBs.getAD();
    const mm = String(month0Indexed + 1).padStart(2, '0');
    const dd = String(days).padStart(2, '0');
    return {
      days,
      monthName,
      startDate: new Date(Date.UTC(sAd.year, sAd.month, sAd.date)),
      endDate: new Date(Date.UTC(eAd.year, eAd.month, eAd.date)),
      rangeStr: `${year}-${mm}-01 — ${year}-${mm}-${dd} (BS)`,
    };
  }
  const days = new Date(year, month0Indexed + 1, 0).getDate();
  const adMonthName = new Date(Date.UTC(year, month0Indexed, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const mm = String(month0Indexed + 1).padStart(2, '0');
  const dd = String(days).padStart(2, '0');
  return {
    days,
    monthName: adMonthName,
    startDate: new Date(Date.UTC(year, month0Indexed, 1)),
    endDate: new Date(Date.UTC(year, month0Indexed, days)),
    rangeStr: `${year}-${mm}-01 — ${year}-${mm}-${dd} (AD)`,
  };
}

function addMonthsToYM(year, month0Indexed, offsetMonths) {
  const total = year * 12 + month0Indexed + offsetMonths;
  return { year: Math.floor(total / 12), month: total % 12 };
}

/**
 * Backfills missing From/To period dates and BillingLedger descriptions
 * for customers who already received an automated bill in the current month.
 */
async function backfillCurrentMonthPeriods({
  now,
  calendarType,
  periodStartDate,
  periodEndDate,
  periodRangeStr,
  customerId,
}) {
  try {
    const windowStart = new Date(periodStartDate.getTime() - 24 * 60 * 60 * 1000);
    const recentEntries = await prisma.billingLedger.findMany({
      where: {
        date: { gte: windowStart },
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: {
          select: {
            customerId: true,
            isActive: true,
            outstandingPayment: true,
            advanceBalance: true,
            monthlyFee: true,
            increasedFee: true,
            dueStartDate: true,
            dueEndDate: true,
            advanceStartDate: true,
            advanceEndDate: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const curMonthEntries = recentEntries.filter((e) =>
      isCustomerBilledForCurrentMonth(e.date, calendarType, now)
    );
    if (curMonthEntries.length === 0) return;

    const curYMD = getCalendarYMD(now, calendarType);
    const updatedCustomers = new Set();

    for (const entry of curMonthEntries) {
      if (entry.description && !entry.description.includes('Period:')) {
        const nextDesc = `${entry.description} | Period: ${periodRangeStr}`.slice(0, 255);
        await prisma.billingLedger.update({
          where: { id: entry.id },
          data: { description: nextDesc },
        });
      }

      const cust = entry.customer;
      if (!cust || !cust.isActive || updatedCustomers.has(cust.customerId)) continue;
      updatedCustomers.add(cust.customerId);

      const updateData = {};
      const outBal = new Decimal(cust.outstandingPayment.toString());
      const advBal = new Decimal(cust.advanceBalance.toString());

      if (outBal.gt(0) && (!cust.dueStartDate || !cust.dueEndDate)) {
        updateData.dueStartDate = cust.dueStartDate || periodStartDate;
        updateData.dueEndDate = cust.dueEndDate || periodEndDate;
      }

      if (advBal.gt(0) && (!cust.advanceStartDate || !cust.advanceEndDate)) {
        const baseFee = new Decimal(cust.monthlyFee.toString());
        const feeAmount = cust.increasedFee && new Decimal(cust.increasedFee.toString()).gt(0)
          ? new Decimal(cust.increasedFee.toString())
          : baseFee;
        const remainingMonths = feeAmount.gt(0)
          ? Math.max(1, Math.ceil(advBal.dividedBy(feeAmount).toNumber()))
          : 1;
        const endYM = addMonthsToYM(curYMD.year, curYMD.month, remainingMonths - 1);
        const endBounds = getMonthBounds(endYM.year, endYM.month, calendarType);

        updateData.advanceStartDate = cust.advanceStartDate || periodStartDate;
        updateData.advanceEndDate = cust.advanceEndDate || endBounds.endDate || periodEndDate;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({
          where: { customerId: cust.customerId },
          data: updateData,
        });
      }
    }
  } catch (err) {
    console.warn('[WORKER: BILLING] Period backfill warning:', err.message);
  }
}

/**
 * Checks if a customer was newly registered in the current month AFTER the billing day had already passed.
 * Prevents charging a newly created customer on Day 28 for a Day 1 billing cycle that passed before they joined.
 */
function wasCreatedAfterBillingDayThisMonth(createdAt, calendarType, curYMD, adjustedDay) {
  if (!createdAt) return false;
  const createdYMD = getCalendarYMD(createdAt, calendarType);
  if (createdYMD.year === curYMD.year && createdYMD.month === curYMD.month) {
    return createdYMD.day > adjustedDay;
  }
  return false;
}

/**
 * Executes the mass or targeted billing job.
 * @param {Object} options
 * @param {boolean} options.forceAll - If true, bills all unbilled customers regardless of trigger day
 * @param {string|null} options.customerId - Optional single customerId to evaluate immediately
 * @returns {Promise<{ totalBilled: number, totalAmount: string, details: Array }>}
 */
async function runBillingCycle(options = {}) {
  const { forceAll = false, customerId = null } = options;
  console.log(`[WORKER: BILLING] Starting billing engine at ${new Date().toISOString()} (forceAll: ${forceAll}, customerId: ${customerId || 'ALL'})`);

  try {
    // 1. Fetch Global Settings
    const settings = await prisma.globalSettings.findFirst({ orderBy: { id: 'asc' } });
    if (!settings) {
      console.error('[WORKER: BILLING] Global settings missing. Aborting billing cycle.');
      return { totalBilled: 0, totalAmount: '0.00', details: [] };
    }

    const now = new Date();
    const curYMD = getCalendarYMD(now, settings.calendarType);
    const currentDay = curYMD.day;
    const {
      days: daysInMonth,
      monthName,
      startDate: periodStartDate,
      endDate: periodEndDate,
      rangeStr: periodRangeStr,
    } = getMonthBounds(curYMD.year, curYMD.month, settings.calendarType);
    const periodName = `${monthName} ${curYMD.year} (${settings.calendarType === 'BS' ? 'BS' : 'AD'})`;

    console.log(
      `[WORKER: BILLING] Operating in ${settings.calendarType} Calendar Mode: ${curYMD.year}-${curYMD.month + 1}-${curYMD.day} (${periodName}, Period: ${periodRangeStr}, Days in month: ${daysInMonth})`
    );

    const globalTargetDay = settings.billingCycleDay || 1;

    // 1b. Backfill missing From/To period dates & descriptions for customers already billed this month
    await backfillCurrentMonthPeriods({
      now,
      calendarType: settings.calendarType,
      periodStartDate,
      periodEndDate,
      periodRangeStr,
      customerId,
    });

    // 2. Process active customers in batches
    let cursor = null;
    const BATCH_SIZE = 500;
    let totalBilled = 0;
    let totalBilledAmount = new Decimal('0.00');
    const billedDetails = [];

    while (true) {
      const whereClause = {
        isActive: true,
        customerId: customerId ? customerId : { not: 'MANUAL_ENTRY' },
      };

      const customers = await prisma.customer.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { customerId: cursor } : undefined,
        where: whereClause,
        include: {
          billingEntries: {
            orderBy: { date: 'desc' },
            take: 1,
            select: { date: true },
          },
        },
        orderBy: { customerId: 'asc' }
      });

      if (customers.length === 0) break;

      // 3. Filter customers who are due for billing
      const customersToBill = customers.filter(customer => {
        // Use the actual latest BillingLedger entry date if present; if billing_ledger was reset, do not block on stale lastBilledDate
        const effectiveLastBilled = customer.billingEntries?.[0]?.date || null;
        const alreadyBilled = isCustomerBilledForCurrentMonth(effectiveLastBilled, settings.calendarType, now);
        if (alreadyBilled) return false;

        // If forceAll is requested, bill anyone unbilled this month
        if (forceAll) return true;

        // Target day: customer custom billing day OR global default
        const effectiveDay = customer.billingCycleDay || globalTargetDay;
        const adjustedDay = Math.min(effectiveDay, daysInMonth);

        // Must have reached or passed the billing day in the current month
        if (currentDay < adjustedDay) return false;

        // If today IS the exact billing day, always bill!
        if (currentDay === adjustedDay) return true;

        // If currentDay > adjustedDay (catch-up mode), only bill if customer existed on or before adjustedDay
        if (wasCreatedAfterBillingDayThisMonth(customer.createdAt, settings.calendarType, curYMD, adjustedDay)) {
          return false;
        }

        return true;
      });

      if (customersToBill.length === 0) {
        if (customerId) break;
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
            SELECT "outstandingPayment"::text, "advanceBalance"::text, "debtStartDate",
                   "dueStartDate", "dueEndDate", "advanceStartDate", "advanceEndDate"
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
          let billingDescription = `Automated Monthly Fee - ${periodName} | Period: ${periodRangeStr} | Added ₹${feeAmount.toFixed(2)} to Outstanding Due`;

          // Smart Wallet Deduction Logic
          if (currentAdvance.gte(feeAmount)) {
            // Fully covered by advance wallet (e.g. Advance 1000 - Fee 500 = 500 left)
            newAdvance = currentAdvance.minus(feeAmount);
            billingDescription = `Automated Monthly Fee - ${periodName} | Period: ${periodRangeStr} | Deducted ₹${feeAmount.toFixed(2)} from Smart Wallet`;
          } else if (currentAdvance.gt(0)) {
            // Partially covered by advance wallet
            const remainingFee = feeAmount.minus(currentAdvance);
            newAdvance = new Decimal('0.00');
            newOutstanding = currentOutstanding.plus(remainingFee);
            billingDescription = `Automated Monthly Fee - ${periodName} | Period: ${periodRangeStr} | ₹${currentAdvance.toFixed(2)} from Wallet, ₹${remainingFee.toFixed(2)} added to Due`;
          } else {
            // No advance wallet — full amount added to outstanding due
            newOutstanding = currentOutstanding.plus(feeAmount);
          }

          billingDescription = billingDescription.slice(0, 255);

          // Track debt start date if customer just went into debt
          let newDebtStartDate = lockedCustomer.debtStartDate;
          if (newOutstanding.gt(0) && currentOutstanding.lte(0)) {
            newDebtStartDate = now;
          } else if (newOutstanding.lte(0)) {
            newDebtStartDate = null;
          }

          // Update customer record
          const updateData = {
            advanceBalance: newAdvance.toFixed(2),
            outstandingPayment: newOutstanding.toFixed(2),
            lastBilledDate: now,
            debtStartDate: newDebtStartDate,
          };

          // Maintain Due From/To Date for Outstanding Due
          if (newOutstanding.gt(0)) {
            if (currentOutstanding.lte(0) || !lockedCustomer.dueStartDate) {
              updateData.dueStartDate = periodStartDate;
              updateData.dueEndDate = periodEndDate;
            } else {
              updateData.dueEndDate = periodEndDate;
            }
          } else {
            updateData.dueStartDate = null;
            updateData.dueEndDate = null;
          }

          // Maintain Advance From/To Date for Smart Wallet
          if (newAdvance.gt(0)) {
            if (!lockedCustomer.advanceStartDate) {
              updateData.advanceStartDate = periodStartDate;
            }
            if (!lockedCustomer.advanceEndDate) {
              const remainingMonths = feeAmount.gt(0)
                ? Math.max(1, Math.ceil(newAdvance.dividedBy(feeAmount).toNumber()))
                : 1;
              const endYM = addMonthsToYM(curYMD.year, curYMD.month, remainingMonths - 1);
              const endBounds = getMonthBounds(endYM.year, endYM.month, settings.calendarType);
              updateData.advanceEndDate = endBounds.endDate || periodEndDate;
            }
          } else if (currentAdvance.gt(0)) {
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
              date: now,
              amount: feeAmount.toFixed(2),
              description: billingDescription,
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
            previousAdvance: currentAdvance.toFixed(2),
            newAdvance: newAdvance.toFixed(2),
          });
        }
      }, { isolationLevel: 'Serializable' });

      console.log(`[WORKER: BILLING] Successfully billed batch of ${customersToBill.length} customers.`);
      if (customerId) break;
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
  // 1. Run daily at 00:05 AM and 01:00 AM Nepal Time (Asia/Kathmandu)
  cron.schedule('5 0 * * *', () => {
    runBillingCycle().catch(err => console.error('[WORKER: BILLING] 00:05 job error:', err));
  }, { timezone: 'Asia/Kathmandu' });

  cron.schedule('0 1 * * *', () => {
    runBillingCycle().catch(err => console.error('[WORKER: BILLING] 01:00 job error:', err));
  }, { timezone: 'Asia/Kathmandu' });

  // 2. Also run hourly check (safe & idempotent due to BillingLedger monthly check)
  cron.schedule('0 * * * *', () => {
    runBillingCycle().catch(err => console.error('[WORKER: BILLING] Hourly job error:', err));
  }, { timezone: 'Asia/Kathmandu' });

  // 3. Run once shortly after server startup to catch up immediately
  setTimeout(() => {
    runBillingCycle().catch(err => console.error('[WORKER: BILLING] Startup catch-up error:', err));
  }, 5000);

  console.log('[WORKER] Billing Engine scheduled (Startup + Hourly + 00:05 & 01:00 AM Asia/Kathmandu).');
}

module.exports = { initBillingWorker, runBillingCycle, isCustomerBilledForCurrentMonth };
