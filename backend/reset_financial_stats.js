// ============================================================================
// RESET FINANCIAL STATS SCRIPT (FOR FRESH PRODUCTION LAUNCH)
// ============================================================================
// Clears test income/billing/expense ledgers and resets the invoice counter to #1.
// PRESERVES: All Customer profiles, dues & wallet balances, Staff accounts,
//            Vehicles, Chart of Accounts, and System Settings.
//
// Usage on server:
//   node reset_financial_stats.js
// ============================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const resetCustomerBalances = process.argv.includes('--reset-customer-balances');

  console.log('----------------------------------------------------');
  console.log('🔄 STARTING FINANCIAL STATS & TEST LEDGER RESET');
  console.log('----------------------------------------------------');

  // 1. Show Current Counts & Totals
  const currentIncome = await prisma.incomeLedger.aggregate({
    _sum: { amount: true },
    _count: { id: true },
    where: { isDeleted: false, status: 'SUCCESSFUL' },
  });

  const currentExpenses = await prisma.expenseLedger.aggregate({
    _sum: { amount: true },
    _count: { id: true },
    where: { isDeleted: false },
  });

  const customerCount = await prisma.customer.count();

  console.log(`Current Total Income   : Rs. ${currentIncome._sum.amount || '0.00'} (${currentIncome._count.id} records)`);
  console.log(`Current Total Expenses : Rs. ${currentExpenses._sum.amount || '0.00'} (${currentExpenses._count.id} records)`);
  console.log(`Total Customers in DB  : ${customerCount} (All customer profiles and balances will be preserved)\n`);

  // 2. Clear Income Ledger & Restart Identity (Invoice # restarts at 1)
  console.log('🧹 Clearing income_ledger (restarting invoice counter to 1)...');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE income_ledger RESTART IDENTITY CASCADE;`);
  console.log('✅ income_ledger reset successfully.');

  // 3. Clear Billing Ledger & Restart Identity
  console.log('🧹 Clearing billing_ledger...');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE billing_ledger RESTART IDENTITY CASCADE;`);
  console.log('✅ billing_ledger reset successfully.');

  // 4. Clear Expense & Salary Ledgers if any test entries exist
  console.log('🧹 Clearing test expense & salary ledgers...');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE expense_ledger, vehicle_expense_ledger, salary_ledger RESTART IDENTITY CASCADE;`);
  console.log('✅ Expense and salary ledgers reset successfully.');

  // 5. Customer Balances (Preserved unless specifically requested)
  if (resetCustomerBalances) {
    console.log('🧹 Resetting all customer outstanding dues & advance wallet balances to 0.00...');
    await prisma.customer.updateMany({
      data: {
        outstandingPayment: 0.00,
        advanceBalance: 0.00,
        dueStartDate: null,
        dueEndDate: null,
        advanceStartDate: null,
        advanceEndDate: null,
        debtStartDate: null,
        lastBilledDate: null,
      },
    });
    console.log('✅ Customer balances reset to 0.00.');
  } else {
    console.log('🛡️  Customer dues and wallet balances PRESERVED (no changes to customer balances).');
  }

  console.log('\n----------------------------------------------------');
  console.log('🎉 RESET COMPLETE!');
  console.log('• Total Income is now : Rs. 0.00');
  console.log('• Total Expenses      : Rs. 0.00');
  console.log('• Net Profit is now   : Rs. 0.00');
  console.log('• Next Invoice/Bill   : REC-0001 (Invoice #1)');
  console.log('• Customer Profiles   : Untouched & Safe');
  console.log('----------------------------------------------------');
}

main()
  .catch((err) => {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
