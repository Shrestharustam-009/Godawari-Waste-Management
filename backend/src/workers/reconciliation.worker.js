// ============================================================================
// WORKER: WEBHOOK AUTO-RECONCILIATION (FAILSAFE)
// ============================================================================
// Runs every 15 minutes.
// Scans IncomeLedger for digital transactions stuck in 'PENDING' status for >10 mins.
// This handles dropped/failed webhooks from payment gateways (eSewa/Khalti).
// ============================================================================

const cron = require('node-cron');
const prisma = require('../lib/prisma');

/**
 * Placeholder logic representing an HTTP call to a payment gateway's status API.
 */
async function fetchGatewayStatus(referenceId) {
  // TODO: Replace with actual eSewa/Khalti SDK or HTTP call
  // Simulating a 50% success rate for demonstration purposes
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.random() > 0.5 ? 'SUCCESSFUL' : 'FAILED');
    }, 100);
  });
}

async function runReconciliation() {
  console.log(`[WORKER: RECONCILIATION] Starting webhook auto-reconciliation at ${new Date().toISOString()}`);

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. Find stuck transactions
    const pendingTransactions = await prisma.incomeLedger.findMany({
      where: {
        paymentMethod: 'DIGITAL_GATEWAY',
        status: 'PENDING',
        createdAt: { lt: tenMinutesAgo },
        referenceId: { not: null } // Must have a reference to check the gateway
      },
      take: 100 // Batch limit
    });

    if (pendingTransactions.length === 0) {
      console.log('[WORKER: RECONCILIATION] No stuck digital transactions found.');
      return;
    }

    console.log(`[WORKER: RECONCILIATION] Found ${pendingTransactions.length} pending transactions. Reconciling...`);

    let reconciledCount = 0;

    // 2. Query gateway for each and update status
    for (const tx of pendingTransactions) {
      try {
        const actualStatus = await fetchGatewayStatus(tx.referenceId);
        
        // Use a transaction if we needed to update balances based on success,
        // but since they were already recorded, we just update the status flag.
        await prisma.incomeLedger.update({
          where: { id: tx.id },
          data: { status: actualStatus }
        });

        // Log the automated fix
        await prisma.auditLog.create({
          data: {
            action: 'WEBHOOK_RECONCILED',
            entityType: 'IncomeLedger',
            entityId: tx.id.toString(),
            details: {
              referenceId: tx.referenceId,
              oldStatus: 'PENDING',
              newStatus: actualStatus,
            },
            performedById: null, // SYSTEM
            userAgent: 'WebhookAutoReconciliationWorker'
          }
        });

        reconciledCount++;
      } catch (err) {
        console.error(`[WORKER: RECONCILIATION] Failed to reconcile TX ${tx.id}:`, err.message);
      }
    }

    console.log(`[WORKER: RECONCILIATION] Completed. Reconciled ${reconciledCount} transactions.`);
  } catch (error) {
    console.error(`[WORKER: RECONCILIATION] CRITICAL ERROR during reconciliation:`, error);
  }
}

function initReconciliationWorker() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runReconciliation();
  });
  console.log('[WORKER] Webhook Auto-Reconciliation scheduled (every 15 mins).');
}

module.exports = { initReconciliationWorker, runReconciliation };
