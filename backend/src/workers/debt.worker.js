// ============================================================================
// WORKER: 15-DAY DEBT HUNTER
// ============================================================================
// Runs daily at 02:00 AM.
// Scans the customer base for accounts that have been in debt for exactly 15 days.
// Logs an alert into NotificationLog for the Admin dashboard.
// ============================================================================

const cron = require('node-cron');
const prisma = require('../lib/prisma');

async function runDebtHunter() {
  console.log(`[WORKER: DEBT HUNTER] Starting scan at ${new Date().toISOString()}`);

  try {
    const today = new Date();
    // Calculate the date exactly 15 days ago
    // Using startOfDay and endOfDay to catch any time within that day
    const fifteenDaysAgoStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15, 0, 0, 0);
    const fifteenDaysAgoEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15, 23, 59, 59, 999);

    // Find customers whose debt started exactly 15 days ago
    const customersInDebt = await prisma.customer.findMany({
      where: {
        isActive: true,
        outstandingPayment: { gt: 0 },
        debtStartDate: {
          gte: fifteenDaysAgoStart,
          lte: fifteenDaysAgoEnd,
        }
      },
      select: {
        customerId: true,
        name: true,
        phone: true,
        outstandingPayment: true,
        debtStartDate: true,
      }
    });

    if (customersInDebt.length === 0) {
      console.log('[WORKER: DEBT HUNTER] No customers hit the 15-day debt threshold today.');
      return;
    }

    console.log(`[WORKER: DEBT HUNTER] Found ${customersInDebt.length} customers at 15-day debt threshold.`);

    // Batch insert notifications
    const notifications = customersInDebt.map(customer => ({
      type: 'DEBT_WARNING_15_DAY',
      recipientId: 'SYSTEM', // Alerts go to the Admin system dashboard
      message: `Customer ${customer.name} (${customer.customerId}) has had an outstanding balance of ₹${customer.outstandingPayment.toString()} for 15 days.`,
      metadata: {
        customerId: customer.customerId,
        name: customer.name,
        phone: customer.phone,
        debtAmount: customer.outstandingPayment.toString(),
        debtStartDate: customer.debtStartDate,
      }
    }));

    await prisma.notificationLog.createMany({
      data: notifications
    });

    console.log(`[WORKER: DEBT HUNTER] Successfully logged ${notifications.length} debt warnings.`);
  } catch (error) {
    console.error(`[WORKER: DEBT HUNTER] CRITICAL ERROR during debt scan:`, error);
  }
}

function initDebtWorker() {
  // Run daily at 02:00 AM server time
  cron.schedule('0 2 * * *', () => {
    runDebtHunter();
  });
  console.log('[WORKER] 15-Day Debt Hunter scheduled (02:00 AM daily).');
}

module.exports = { initDebtWorker, runDebtHunter };
