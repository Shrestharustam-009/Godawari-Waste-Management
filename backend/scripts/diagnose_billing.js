// ============================================================================
// BILLING ENGINE DIAGNOSTIC SCRIPT
// ============================================================================
// Run on server: node scripts/diagnose_billing.js
// ============================================================================

const prisma = require('../src/lib/prisma');
const NepaliDate = require('nepali-date-converter').default;
const { dateConfigMap } = require('nepali-date-converter');

async function diagnose() {
  console.log('====================================================');
  console.log('🔍 ZERO-TOUCH BILLING ENGINE DIAGNOSIS');
  console.log('====================================================\n');

  // 1. Settings
  const settings = await prisma.globalSettings.findFirst();
  console.log('1. GLOBAL SETTINGS:');
  console.log('   • Calendar Type     :', settings?.calendarType || 'NOT SET (defaults to AD)');
  console.log('   • Billing Cycle Day :', settings?.billingCycleDay ?? 'NOT SET (defaults to 1)');
  console.log('   • Bonus Fee Enabled :', settings?.isBonusFeeEnabled);
  console.log('');

  // 2. Date and Time Check
  const now = new Date();
  const nepalTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
  const localNepalDate = new Date(nepalTimeStr);
  const bsDate = new NepaliDate(localNepalDate);
  const bs = bsDate.getBS();
  const bsMonths = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
  const monthName = bsMonths[bs.month];
  const daysInMonth = dateConfigMap[bs.year.toString()] ? dateConfigMap[bs.year.toString()][monthName] : 30;

  console.log('2. CURRENT SYSTEM DATES:');
  console.log('   • Server Clock (UTC)    :', now.toISOString());
  console.log('   • Nepal Local Time      :', nepalTimeStr);
  console.log(`   • Bikram Sambat (BS)    : ${bs.year}-${String(bs.month + 1).padStart(2, '0')}-${String(bs.date).padStart(2, '0')} (${monthName})`);
  console.log(`   • Current Day of Month  : ${settings?.calendarType === 'BS' ? bs.date : localNepalDate.getDate()}`);
  console.log(`   • Total Days in Month   : ${daysInMonth}`);
  console.log('');

  // 3. Customer Ledger Statistics
  const totalActive = await prisma.customer.count({ where: { isActive: true } });
  const billedAtLeastOnce = await prisma.customer.count({ where: { isActive: true, lastBilledDate: { not: null } } });
  const neverBilled = await prisma.customer.count({ where: { isActive: true, lastBilledDate: null } });
  const withDebt = await prisma.customer.count({ where: { isActive: true, outstandingPayment: { gt: 0 } } });
  const withAdvance = await prisma.customer.count({ where: { isActive: true, advanceBalance: { gt: 0 } } });
  const billingLedgerTotal = await prisma.billingLedger.count();

  console.log('3. CUSTOMER BASE SUMMARY:');
  console.log('   • Active Customers      :', totalActive);
  console.log('   • Billed At Least Once  :', billedAtLeastOnce);
  console.log('   • Never Billed          :', neverBilled);
  console.log('   • Currently in Debt     :', withDebt);
  console.log('   • With Smart Wallet Adv :', withAdvance);
  console.log('   • BillingLedger Records :', billingLedgerTotal);
  console.log('');

  // 4. Sample Customer Check (DM-495 if exists)
  const sampleCust = await prisma.customer.findFirst({
    where: { OR: [{ customerId: 'DM-495' }, { name: { contains: 'कृष्ण' } }] }
  });

  if (sampleCust) {
    console.log('4. SAMPLE CUSTOMER (DM-495 / कृष्ण शाह):');
    console.log('   • Customer ID      :', sampleCust.customerId);
    console.log('   • Name             :', sampleCust.name);
    console.log('   • Monthly Fee      :', sampleCust.monthlyFee.toString());
    console.log('   • Increased Fee    :', sampleCust.increasedFee ? sampleCust.increasedFee.toString() : 'None');
    console.log('   • Outstanding Due  : Rs.', sampleCust.outstandingPayment.toString());
    console.log('   • Advance Balance  : Rs.', sampleCust.advanceBalance.toString());
    console.log('   • Billing Cycle Day:', sampleCust.billingCycleDay || `Global Default (${settings?.billingCycleDay || 1})`);
    console.log('   • Registered At    :', sampleCust.createdAt);
    console.log('   • Last Billed Date :', sampleCust.lastBilledDate || 'NEVER BILLED');
    console.log('   • Due Start Date   :', sampleCust.dueStartDate);
    console.log('   • Due End Date     :', sampleCust.dueEndDate);
  } else {
    console.log('4. SAMPLE CUSTOMER (DM-495): Not found in local DB.');
  }

  console.log('\n====================================================');
  console.log('💡 WHY OUTSTANDING DUES MIGHT NOT BE INCREASING:');
  console.log('====================================================');
  
  const currentDay = settings?.calendarType === 'BS' ? bs.date : localNepalDate.getDate();
  const targetDay = settings?.billingCycleDay || 1;

  if (currentDay !== targetDay) {
    console.log(`⚠️  Today is Day ${currentDay}, but the billing cycle is configured for Day ${targetDay}.`);
    console.log(`   The worker ONLY triggers on Day ${targetDay} of the month at 01:00 AM.`);
    console.log(`   Customers who register after Day ${targetDay} will not be billed until next month's Day ${targetDay}.`);
  }

  if (billingLedgerTotal === 0) {
    console.log(`⚠️  BillingLedger has 0 records! This indicates the automated billing worker has NEVER successfully run.`);
  }

  console.log('====================================================\n');
}

diagnose()
  .catch((e) => {
    console.error('Diagnostic error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
