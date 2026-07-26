const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * IRD CBMS Sync Service
 * 
 * Handles the background synchronization of billing and income ledgers
 * with the Nepal Inland Revenue Department's Central Billing Monitoring System (CBMS).
 */

const IRD_API_BASE_URL = process.env.IRD_API_BASE_URL || 'https://cbms.ird.gov.np/api/v1';
const IRD_API_USERNAME = process.env.IRD_API_USERNAME || 'mock_user';
const IRD_API_PASSWORD = process.env.IRD_API_PASSWORD || 'mock_pass';
const PAN_NUMBER = process.env.COMPANY_PAN || '000000000';

/**
 * Mocks the IRD API call for development/testing when real credentials are not present.
 */
async function mockIrdApiCall(payload) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return {
    success: true,
    message: 'Synced successfully (Mock)',
    receiptNo: `IRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };
}

/**
 * Syncs unsynced Income Ledger records to the IRD.
 */
async function syncIncomeLedgers() {
  try {
    const unsyncedRecords = await prisma.incomeLedger.findMany({
      where: {
        isSyncedWithIRD: false,
        isDeleted: false
      },
      include: {
        customer: true
      },
      take: 50 // Batch size
    });

    if (unsyncedRecords.length === 0) {
      return 0; // Nothing to sync
    }

    console.log(`[IRD SYNC] Found ${unsyncedRecords.length} unsynced income records. Syncing...`);
    
    let syncedCount = 0;

    for (const record of unsyncedRecords) {
      // 1. Prepare CBMS payload
      const payload = {
        seller_pan: PAN_NUMBER,
        buyer_pan: record.customer?.vatNumber || '',
        buyer_name: record.customer?.name || 'Unknown',
        invoice_number: `REC-${record.id}`,
        invoice_date: record.date.toISOString().split('T')[0],
        total_sales: record.amount,
        taxable_sales: record.baseAmount,
        tax_amount: record.vatAmount,
        tax_exempted_sales: record.vatAmount > 0 ? 0 : record.amount,
        isrealtime: true,
        datetimeclient: new Date().toISOString()
      };

      try {
        // 2. Send to IRD (Using Mock for now)
        // In production: 
        // const authString = Buffer.from(`${IRD_API_USERNAME}:${IRD_API_PASSWORD}`).toString('base64');
        // const rawRes = await fetch(`${IRD_API_BASE_URL}/bill`, { 
        //   method: 'POST', 
        //   headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${authString}` },
        //   body: JSON.stringify(payload)
        // });
        // const response = await rawRes.json();
        const response = await mockIrdApiCall(payload);

        if (response.success) {
          // 3. Update local record
          await prisma.$transaction(async (tx) => {
            // SET AUDIT LOG USER CONTEXT: '0' denotes the automated system worker
            await tx.$executeRaw`SET LOCAL app.current_user_id = ${'0'}`;
            
            await tx.incomeLedger.update({
              where: { id: record.id },
              data: {
                isSyncedWithIRD: true,
                irdSyncDate: new Date(),
                irdReceiptNo: response.receiptNo
              }
            });
          });
          syncedCount++;
        }
      } catch (err) {
        console.error(`[IRD SYNC] Failed to sync record REC-${record.id}:`, err.message);
        // Continue with the next record even if one fails
      }
    }
    
    return syncedCount;
  } catch (error) {
    console.error('[IRD SYNC] Fatal error in syncIncomeLedgers:', error);
    return 0;
  }
}

/**
 * CRON Job Wrapper
 * In a real application, you would call this from a node-cron job or a worker queue.
 */
async function runSyncJob() {
  console.log('[IRD SYNC] Starting background sync job...');
  const count = await syncIncomeLedgers();
  console.log(`[IRD SYNC] Sync job completed. Synced ${count} records.`);
}

module.exports = {
  syncIncomeLedgers,
  runSyncJob
};
