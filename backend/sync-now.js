require('dotenv').config();
const { runSyncJob } = require('./src/services/irdSync.service');

async function triggerManualSync() {
  console.log("Starting manual IRD CBMS sync...");
  try {
    await runSyncJob();
    console.log("Manual sync completed successfully.");
  } catch (error) {
    console.error("Error during manual sync:", error);
  } finally {
    process.exit(0);
  }
}

triggerManualSync();
