/**
 * ============================================================================
 * SEED ADMIN ACCOUNT
 * ============================================================================
 * Utility script to inject the master ADMIN account into the Godawari WMS
 * PostgreSQL database. It hashes the password securely using bcrypt.
 * ============================================================================
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('──────────────────────────────────────────────────────────────');
  console.log('🛡️  INITIALIZING MASTER ADMIN ACCOUNT SEED');
  console.log('──────────────────────────────────────────────────────────────');

  const username = 'rustamshrestha0123@gmail.com';
  const plainPassword = 'rustam25';

  try {
    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.log(`[WARN] User '${username}' already exists. Skipping insertion.`);
      return;
    }

    // 2. Hash the password
    const saltRounds = 12;
    console.log(`[SYS] Hashing password with bcrypt (Rounds: ${saltRounds})...`);
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // 3. Insert into database
    console.log(`[DB] Inserting ADMIN record into PostgreSQL...`);
    const admin = await prisma.user.create({
      data: {
        name: 'Rustam Shrestha',
        username: username,
        passwordHash: passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('──────────────────────────────────────────────────────────────');
    console.log('✅ MASTER ADMIN CREATED SUCCESSFULLY');
    console.log(`ID       : ${admin.id}`);
    console.log(`Name     : ${admin.name}`);
    console.log(`Username : ${admin.username}`);
    console.log(`Role     : ${admin.role}`);
    console.log('──────────────────────────────────────────────────────────────');

  } catch (error) {
    console.error('❌ FATAL ERROR during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
