// ============================================================================
// WORKER INITIALIZATION (Entry Point) — Security-Hardened
// ============================================================================
// Guards: Workers only run if ENABLE_WORKERS is not explicitly 'false'.
// This prevents workers from running in test/CI environments.
// ============================================================================

const { initBillingWorker } = require('./billing.worker');
const { initDebtWorker } = require('./debt.worker');
const { initReconciliationWorker } = require('./reconciliation.worker');

function startBackgroundWorkers() {
  // SECURITY GUARD: Allow disabling workers via environment variable
  if (process.env.ENABLE_WORKERS === 'false') {
    console.log('[WORKER] Background workers DISABLED via ENABLE_WORKERS=false.');
    return;
  }

  // GUARD: Only run workers on the primary instance in multi-instance deployments
  if (process.env.WORKER_INSTANCE_ID && process.env.WORKER_INSTANCE_ID !== '1') {
    console.log(`[WORKER] Skipping worker init (instance ${process.env.WORKER_INSTANCE_ID} is not primary).`);
    return;
  }

  console.log('──────────────────────────────────────────────────────────────');
  console.log('⚙️  INITIALIZING BACKGROUND AUTOMATION ENGINE');
  console.log('──────────────────────────────────────────────────────────────');
  
  initBillingWorker();          // Zero-Touch Billing Engine (01:00 AM daily)
  initDebtWorker();             // 15-Day Debt Hunter (02:00 AM daily)
  initReconciliationWorker();   // Webhook Auto-Reconciliation (every 15 mins)
  
  console.log('──────────────────────────────────────────────────────────────');
}

module.exports = { startBackgroundWorkers };
