// ============================================================================
// RUN BILLING CYCLE SCRIPT (MANUAL / CATCH-UP EXECUTION)
// ============================================================================
// Usage on server:
//   node scripts/run_billing_now.js
//   node scripts/run_billing_now.js --force-all
// ============================================================================

const { runBillingCycle } = require('../src/workers/billing.worker');
const prisma = require('../src/lib/prisma');

async function main() {
  const forceAll = process.argv.includes('--force-all');

  console.log('====================================================');
  console.log('🚀 EXECUTING ZERO-TOUCH BILLING ENGINE NOW');
  console.log('====================================================');
  if (forceAll) {
    console.log('⚡ MODE: FORCE-ALL (Billing all unbilled customers regardless of trigger day)');
  } else {
    console.log('📅 MODE: STANDARD (Billing customers whose trigger day <= today)');
  }
  console.log('====================================================\n');

  const result = await runBillingCycle({ forceAll });

  console.log('\n====================================================');
  console.log('🎉 BILLING RUN COMPLETE');
  console.log('====================================================');
  console.log(`• Total Customers Billed : ${result.totalBilled}`);
  console.log(`• Total Billed Revenue   : Rs. ${result.totalAmount}`);

  if (result.details && result.details.length > 0) {
    console.log('\nSample of customers billed:');
    result.details.slice(0, 10).forEach((c, idx) => {
      console.log(`  ${idx + 1}. [${c.customerId}] ${c.name}: Fee Rs.${c.feeAmount} (Due: Rs.${c.previousDue} -> Rs.${c.newDue})`);
    });
    if (result.details.length > 10) {
      console.log(`  ... and ${result.details.length - 10} more customers.`);
    }
  } else {
    console.log('ℹ️  No customers were due for billing (all eligible customers already billed for this month).');
  }
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error executing billing cycle:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
