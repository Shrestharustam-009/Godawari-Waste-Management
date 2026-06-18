// ============================================================================
// CRON WORKER: 15-DAY DEBT HUNTER
// ============================================================================
// Runs daily at 00:01 AM. Scans the database for any Customer whose
// lastPaymentDate is exactly 15 days ago AND outstandingDue > 0.
//
// Triggers:
// 1. A database Notification record (if schema supports it).
// 2. A live socket 'system_alert' to the admin_room.
// ============================================================================

const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { getIO } = require('../sockets/socketSetup');

function initDebtHunter() {
  // Run every day at 00:01 AM
  cron.schedule('1 0 * * *', async () => {
    console.log('[WORKER] 15-Day Debt Hunter starting...');

    try {
      // Calculate the date exactly 15 days ago (ignoring time)
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 15);
      
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      // Query customers who match the debt criteria
      const defaultingCustomers = await prisma.customer.findMany({
        where: {
          debtStartDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          outstandingPayment: {
            gt: 0,
          },
          isActive: true,
        },
        select: {
          customerId: true,
          name: true,
          outstandingPayment: true,
        },
      });

      if (defaultingCustomers.length === 0) {
        console.log('[WORKER] No 15-day debt thresholds crossed today.');
        return;
      }

      console.log(`[WORKER] Found ${defaultingCustomers.length} defaulting customers.`);

      // Prepare the Socket.IO instance
      let io;
      try {
        io = getIO();
      } catch (err) {
        console.warn('[WORKER] Socket.IO not initialized. Skipping live alerts.');
      }

      // Process each defaulting customer
      for (const customer of defaultingCustomers) {
        const message = `Customer ${customer.name} has crossed the 15-day debt threshold with an outstanding balance of ₹${customer.outstandingPayment}.`;

        // Emit live system alert to admins
        if (io) {
          io.to('admin_room').emit('system_alert', {
            type: 'FINANCIAL_WARNING',
            message: message,
            customerId: customer.customerId,
            timestamp: new Date()
          });
        }

        // Ideally, here we would also insert into a Notification table:
        // await prisma.notification.create({ ... })
      }

      console.log('[WORKER] 15-Day Debt Hunter finished successfully.');
    } catch (error) {
      console.error('[WORKER] Error executing 15-Day Debt Hunter:', error);
    }
  });

  console.log('[WORKER] 15-Day Debt Hunter cron scheduled (00:01 AM daily).');
}

module.exports = initDebtHunter;
