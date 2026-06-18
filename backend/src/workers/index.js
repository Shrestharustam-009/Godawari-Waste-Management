// ============================================================================
// WORKER INITIALIZATION (Entry Point)
// ============================================================================
// This file aggregates all background jobs and initializes them.
// It should be required in server.js AFTER the database connection is verified.
// ============================================================================

const { initBillingWorker } = require('./billing.worker');
const { initDebtWorker } = require('./debt.worker');
const { initReconciliationWorker } = require('./reconciliation.worker');
const initDebtHunter = require('./debtHunter');

/**
 * Boots up all scheduled cron jobs for the background engine.
 */
function startBackgroundWorkers() {
  console.log('──────────────────────────────────────────────────────────────');
  console.log('⚙️  INITIALIZING BACKGROUND AUTOMATION ENGINE');
  console.log('──────────────────────────────────────────────────────────────');
  
  initBillingWorker();
  initDebtWorker();
  initReconciliationWorker();
  initDebtHunter();
  
  console.log('──────────────────────────────────────────────────────────────');
}

module.exports = { startBackgroundWorkers };
