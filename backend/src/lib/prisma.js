// ============================================================================
// PRISMA CLIENT SINGLETON
// ============================================================================
// Single shared PrismaClient instance across the entire application.
// Prevents connection pool exhaustion from multiple instantiations.
// Import this everywhere instead of creating new PrismaClient().
// ============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['error'],
});

module.exports = prisma;
