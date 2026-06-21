// ============================================================================
// DATABASE SEED — Initial Data for Godawari WMS
// ============================================================================
// Run with: npm run prisma:seed
// Or:       npx prisma db seed
// ============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Global Settings (Singleton) ──
  const settings = await prisma.globalSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      monthlyFeeAmount: 500.00,
      billingCycleDay: 1,
    },
  });
  console.log('✅ GlobalSettings:', settings);

  // ── 2. Default Admin User ──
  const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!defaultAdminPassword) {
    throw new Error('ADMIN_DEFAULT_PASSWORD must be set in environment for seeding.');
  }
  const adminPasswordHash = await bcrypt.hash(defaultAdminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'System Administrator',
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin User:', { id: admin.id, username: admin.username });

  // ── 3. Income Categories ──
  const incomeCategories = [
    { name: 'Monthly Collection Fee', description: 'Regular monthly waste collection subscription fee' },
    { name: 'Advance Payment', description: 'Advance payments credited to Smart Wallet' },
    { name: 'Penalty Fee', description: 'Late payment penalties' },
    { name: 'Special Collection', description: 'One-time special waste pickup charges' },
  ];

  for (const cat of incomeCategories) {
    await prisma.incomeCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ Income Categories: ${incomeCategories.length} seeded`);

  // ── 4. Expense Categories ──
  const expenseCategories = [
    { name: 'Fuel', description: 'Diesel, petrol, and CNG for fleet vehicles' },
    { name: 'Vehicle Maintenance', description: 'Repairs, servicing, and spare parts' },
    { name: 'Salaries & Wages', description: 'Staff and driver payroll' },
    { name: 'Equipment', description: 'Bins, gloves, uniforms, and operational tools' },
    { name: 'Administrative', description: 'Office rent, utilities, stationery' },
    { name: 'Miscellaneous', description: 'Uncategorized operational expenses' },
  ];

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ Expense Categories: ${expenseCategories.length} seeded`);

  // ── 5. Sample Vehicle ──
  const vehicle = await prisma.vehicle.upsert({
    where: { registrationNumber: 'BA-1-KHA-1234' },
    update: {},
    create: {
      registrationNumber: 'BA-1-KHA-1234',
      type: 'Compactor',
      isActive: true,
    },
  });
  console.log('✅ Sample Vehicle:', { id: vehicle.id, reg: vehicle.registrationNumber });

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
