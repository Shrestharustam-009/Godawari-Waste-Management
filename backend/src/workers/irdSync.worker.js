const cron = require('node-cron');
const { runSyncJob } = require('../services/irdSync.service');

/**
 * Initializes the IRD CBMS Sync background worker.
 * Runs on a schedule to push offline transactions to the IRD.
 */
function initIrdSyncWorker() {
  console.log('[WORKER] Initializing IRD CBMS Sync Engine (Runs every 10 minutes)');
  
  // Schedule: Every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[WORKER] CRON TRIGGER: IRD Sync Job Started');
    try {
      await runSyncJob();
    } catch (error) {
      console.error('[WORKER] CRON FAILED: IRD Sync Job error:', error);
    }
  });
}

module.exports = { initIrdSyncWorker };
