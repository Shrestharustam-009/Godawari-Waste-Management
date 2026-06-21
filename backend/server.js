// ============================================================================
// GODAWARI WASTE MANAGEMENT SYSTEM — Express Server (Production Architecture)
// ============================================================================
// Runtime     : Node.js 18+ LTS
// Framework   : Express 4.x
// ORM         : Prisma 5.x with Decimal.js precision
// Auth        : JWT (HttpOnly cookie transport) + bcrypt
// Security    : helmet, cors, rate-limiting, blacklist middleware
// ============================================================================

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const { Decimal } = require('decimal.js');

// ── Centralized modules ──
const prisma = require('./src/lib/prisma');
const { loadBlacklist } = require('./src/utils/blacklist');
const { checkAuth, authorizeRoles } = require('./src/middleware/checkAuth');

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT, 10) || 4000;

// ────────────────────────────────────────────────────────────────────────────
// 1. GLOBAL MIDDLEWARE — Security Shell
// ────────────────────────────────────────────────────────────────────────────

// Helmet: Sets critical HTTP security headers (CSP, HSTS, X-Frame, etc.)
app.use(helmet());

// CORS: Restrict to known frontend origins in production
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      process.env.CORS_ORIGIN
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,              // Required for HttpOnly cookie transport
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
}));

// Body parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Cookie parser (for JWT in HttpOnly cookies)
app.use(cookieParser());

// HPP: Prevent HTTP Parameter Pollution
app.use(hpp());

// ────────────────────────────────────────────────────────────────────────────
// 2. RATE LIMITING — Auth Route Protection
// ────────────────────────────────────────────────────────────────────────────
// Restricts authentication endpoints to 5 requests per 15-minute window
// per IP address to defend against brute-force and credential-stuffing attacks.

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,                          // Environment-driven max attempts
  standardHeaders: true,           // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,            // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For behind a reverse proxy, else fall back to IP
    return req.ip || req.connection.remoteAddress;
  },
});

// General API rate limiter (100 requests per minute per IP)
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded. Please slow down.',
  },
});

app.use('/api/', apiRateLimiter);

// ────────────────────────────────────────────────────────────────────────────
// 3. BLACKLIST — Now managed by src/utils/blacklist.js
// ────────────────────────────────────────────────────────────────────────────
// The in-memory deactivated user/customer sets are loaded at startup
// via loadBlacklist() and checked per-request via checkAuth middleware.
// See src/middleware/checkAuth.js for the intercept logic.

// ────────────────────────────────────────────────────────────────────────────
// 4. JWT SESSION ENGINE — Now managed by src/utils/token.js
// ────────────────────────────────────────────────────────────────────────────
// Access tokens: 15-minute JWT in HttpOnly/Secure/SameSite=Strict cookies
// Refresh tokens: 7-day opaque hex strings in PostgreSQL (RefreshToken model)
// See src/utils/token.js for sign/verify/cookie operations.
// See src/controllers/auth.controller.js for the full login/refresh/logout flow.

// ────────────────────────────────────────────────────────────────────────────
// 5. DECIMAL ARITHMETIC SAFETY UTILITIES
// ────────────────────────────────────────────────────────────────────────────
// These helpers ensure all financial calculations use decimal.js arithmetic.
// NEVER use native JavaScript +, -, *, / on monetary values.

/**
 * Adds two Prisma Decimal values and returns a string with 2 decimal places.
 * @param {Decimal|string|number} a
 * @param {Decimal|string|number} b
 * @returns {string} Result fixed to 2 decimal places (e.g., "1500.00")
 */
function decimalAdd(a, b) {
  return new Decimal(a.toString()).plus(new Decimal(b.toString())).toFixed(2);
}

/**
 * Subtracts b from a using decimal.js precision.
 * @param {Decimal|string|number} a
 * @param {Decimal|string|number} b
 * @returns {string} Result fixed to 2 decimal places
 */
function decimalSubtract(a, b) {
  return new Decimal(a.toString()).minus(new Decimal(b.toString())).toFixed(2);
}

/**
 * Multiplies two Decimal values.
 * @param {Decimal|string|number} a
 * @param {Decimal|string|number} b
 * @returns {string} Result fixed to 2 decimal places
 */
function decimalMultiply(a, b) {
  return new Decimal(a.toString()).times(new Decimal(b.toString())).toFixed(2);
}

/**
 * Compares two Decimal values.
 * @param {Decimal|string|number} a
 * @param {Decimal|string|number} b
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
function decimalCompare(a, b) {
  return new Decimal(a.toString()).comparedTo(new Decimal(b.toString()));
}

// ────────────────────────────────────────────────────────────────────────────
// 6. AUDIT LOGGING HELPER
// ────────────────────────────────────────────────────────────────────────────

/**
 * Writes an append-only audit log entry.
 * @param {Object} params
 * @param {string} params.action - e.g., "LOGIN", "PAYMENT_COLLECTED"
 * @param {string} params.entityType - e.g., "Customer", "IncomeLedger"
 * @param {string} params.entityId - Primary key of affected entity
 * @param {number|null} params.performedById - User ID who performed the action
 * @param {Object|null} params.details - JSON payload (before/after snapshot)
 * @param {string|null} params.ipAddress - Request originating IP
 * @param {string|null} params.userAgent - Client user agent string
 */
async function writeAuditLog({ action, entityType, entityId, performedById = null, details = null, ipAddress = null, userAgent = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId: String(entityId),
        performedById,
        details,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Audit logging failures must NEVER crash the main flow
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 7. HEALTH CHECK ENDPOINT
// ────────────────────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 8. ROUTE MOUNTING — Modular Router Architecture
// ────────────────────────────────────────────────────────────────────────────
// Each domain (auth, customers, income, expenses, fleet, reports) will have
// its own route file in /routes and controller in /controllers.
//
// Apply authRateLimiter ONLY to authentication routes.
// Apply authenticateJWT + blacklistGuard to ALL protected routes.

// ── Auth Routes (rate-limited, public) ──
app.use('/api/v1/auth', authRateLimiter, require('./src/routes/auth.routes'));

// ── Protected Routes (checkAuth handles JWT verification + blacklist) ──
app.use('/api/v1/payments', checkAuth, require('./src/routes/payment.routes'));
app.use('/api/v1/admin', checkAuth, require('./src/routes/admin.routes'));
app.use('/api/v1/customers', checkAuth, require('./src/routes/customer.routes'));
app.use('/api/v1/accounting', checkAuth, require('./src/routes/accounting.routes'));
app.use('/api/v1/hr', checkAuth, require('./src/routes/hr.routes'));
// app.use('/api/v1/income',     checkAuth, require('./src/routes/income.routes'));
// app.use('/api/v1/expenses',   checkAuth, require('./src/routes/expense.routes'));
// app.use('/api/v1/fleet',      checkAuth, require('./src/routes/fleet.routes'));
// app.use('/api/v1/reports',    checkAuth, require('./src/routes/report.routes'));
app.use('/api/v1/system', checkAuth, require('./src/routes/system.routes'));
// app.use('/api/v1/audit',      checkAuth, authorizeRoles('ADMIN'), require('./src/routes/audit.routes'));

// ────────────────────────────────────────────────────────────────────────────
// 9. EXAMPLE: PAYMENT COLLECTION WITH DECIMAL PRECISION
// ────────────────────────────────────────────────────────────────────────────
// This demonstrates how to safely handle financial transactions using
// Prisma's native Decimal type with decimal.js arithmetic.

app.post('/api/demo/collect-payment', checkAuth, async (req, res) => {
  const { customerId, amount, paymentMethod, idempotencyKey, incomeCategoryId } = req.body;

  // ── Validate amount is a proper decimal string ──
  let paymentAmount;
  let baseRevenue;
  let vatAmount;
  try {
    paymentAmount = new Decimal(amount);
    if (paymentAmount.lte(0)) throw new Error('Amount must be positive');
    
    // Nepal VAT: 13% inclusive
    const VAT_RATE = new Decimal('1.13');
    baseRevenue = paymentAmount.dividedBy(VAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    vatAmount = paymentAmount.minus(baseRevenue);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid payment amount.' });
  }

  try {
    // ── Idempotency check: prevent duplicate field submissions ──
    if (idempotencyKey) {
      const existing = await prisma.incomeLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate submission. This payment has already been recorded.',
          existingId: existing.id,
        });
      }
    }

    // ── Atomic transaction: record payment + update customer balance ──
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current customer balance
      const customer = await tx.customer.findUniqueOrThrow({
        where: { customerId },
        select: { outstandingPayment: true, advanceBalance: true },
      });

      // 2. Calculate new outstanding balance using decimal.js — NOT native JS math
      //    This prevents: 600.00 - 500.00 = 599.98 (floating-point ghost)
      const currentOutstanding = new Decimal(customer.outstandingPayment.toString());
      const currentAdvance = new Decimal(customer.advanceBalance.toString());

      let newOutstanding;
      let newAdvance = currentAdvance;

      if (paymentAmount.gte(currentOutstanding)) {
        // Payment covers full outstanding → excess goes to advance (Smart Wallet)
        const excess = paymentAmount.minus(currentOutstanding);
        newOutstanding = new Decimal('0.00');
        newAdvance = currentAdvance.plus(excess);
      } else {
        // Partial payment → reduce outstanding
        newOutstanding = currentOutstanding.minus(paymentAmount);
      }

      // 3. Update customer balance (stored as Decimal in DB)
      await tx.customer.update({
        where: { customerId },
        data: {
          outstandingPayment: newOutstanding.toFixed(2),
          advanceBalance: newAdvance.toFixed(2),
        },
      });

      // 4. Record income ledger entry
      const income = await tx.incomeLedger.create({
        data: {
          date: new Date(),
          amount: paymentAmount.toFixed(2),
          baseAmount: baseRevenue.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          paymentMethod: paymentMethod || 'CASH',
          source: 'FIELD_APP',
          idempotencyKey: idempotencyKey || null,
          customerId,
          collectedById: req.user.id,
          incomeCategoryId: incomeCategoryId || 1,
        },
      });

      return { income, newOutstanding, newAdvance };
    });

    // ── Write audit trail ──
    await writeAuditLog({
      action: 'PAYMENT_COLLECTED',
      entityType: 'IncomeLedger',
      entityId: result.income.id,
      performedById: req.user.id,
      details: {
        customerId,
        amount: paymentAmount.toFixed(2),
        newOutstanding: result.newOutstanding.toFixed(2),
        newAdvance: result.newAdvance.toFixed(2),
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: {
        incomeId: result.income.id,
        amountCollected: paymentAmount.toFixed(2),
        newOutstandingBalance: result.newOutstanding.toFixed(2),
        newAdvanceBalance: result.newAdvance.toFixed(2),
      },
    });
  } catch (err) {
    console.error('[PAYMENT] Collection failed:', err.message);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed. Please retry.',
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 10. GLOBAL ERROR HANDLER
// ────────────────────────────────────────────────────────────────────────────

// 404 — Unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 500 — Unexpected errors (sanitized in production)
app.use((err, req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 11. SERVER STARTUP
// ────────────────────────────────────────────────────────────────────────────

const http = require('http');
const { startBackgroundWorkers } = require('./src/workers');
const { initSocketServer } = require('./src/sockets/socketSetup');

async function startServer() {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log('[DB] PostgreSQL connection established via Prisma.');

    // Load deactivated users + customers into memory blacklist
    await loadBlacklist();
    
    // Initialize scheduled cron jobs
    startBackgroundWorkers();

    // Wrap Express app with native HTTP server to support WebSockets
    const server = http.createServer(app);
    
    // Initialize WebSocket server
    initSocketServer(server);

    // Start Express + WebSocket Server
    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║   GODAWARI WASTE MANAGEMENT SYSTEM                         ║
║   Server running on port ${String(PORT).padEnd(5)}                            ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(15)}                      ║
║   Decimal precision: ENABLED (decimal.js)                  ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('[STARTUP FATAL]', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// ── Graceful shutdown handler ──
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  await prisma.$disconnect();
  console.log('[DB] Prisma disconnected.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ── Launch ──
startServer();

// ── Export for testing ──
module.exports = { app, prisma, decimalAdd, decimalSubtract, decimalMultiply, decimalCompare };
