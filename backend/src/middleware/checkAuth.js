// ============================================================================
// checkAuth.js — Master Authentication & Authorization Middleware (Hardened)
// ============================================================================
// SECURITY LAYERS:
//   1. ACCESS TOKEN EXTRACTION from HttpOnly cookie
//   2. TOKEN VERIFICATION (signature + expiration)
//   3. IN-MEMORY BLACKLIST check (fast path)
//   4. LIVE DATABASE VERIFICATION (30s cache) — ensures deactivated accounts
//      are rejected even if the in-memory blacklist is stale
//   5. ROLE AUTHORIZATION via authorizeRoles() factory
// ============================================================================

const { verifyAccessToken, clearAccessCookie } = require('../utils/token');
const { isBlacklisted } = require('../utils/blacklist');
const prisma = require('../lib/prisma');

// ── Live status cache: { `${type}:${id}` → { isActive, isLoginEnabled, expiresAt } } ──
const statusCache = new Map();
const CACHE_TTL_MS = 30_000; // 30 seconds

async function verifyActiveStatus(type, id) {
  const cacheKey = `${type}:${id}`;
  const cached = statusCache.get(cacheKey);
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  let status = { isActive: false, isLoginEnabled: false };

  try {
    if (type === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(id, 10) },
        select: { isActive: true, isLoginEnabled: true },
      });
      if (user) {
        status = { isActive: user.isActive, isLoginEnabled: user.isLoginEnabled };
      }
    } else if (type === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { customerId: String(id) },
        select: { isActive: true },
      });
      if (customer) {
        status = { isActive: customer.isActive, isLoginEnabled: true };
      }
    }
  } catch (err) {
    console.error(`[AUTH] DB status check failed for ${cacheKey}:`, err.message);
    // On DB failure, deny access (fail-closed)
    return { isActive: false, isLoginEnabled: false };
  }

  status.expiresAt = Date.now() + CACHE_TTL_MS;
  statusCache.set(cacheKey, status);
  return status;
}

// Export for use by deactivation/reactivation flows to invalidate cache
function invalidateStatusCache(type, id) {
  statusCache.delete(`${type}:${id}`);
}

async function checkAuth(req, res, next) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No access token found.',
      code: 'NO_TOKEN',
    });
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    clearAccessCookie(res);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired. Please refresh your session.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid access token.',
      code: 'TOKEN_INVALID',
    });
  }

  // ── Fast path: in-memory blacklist ──
  if (isBlacklisted(decoded.type, decoded.id)) {
    clearAccessCookie(res);
    return res.status(401).json({
      success: false,
      error: 'Account has been deactivated. Contact system administrator.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  // ── CRITICAL: Live DB verification (cached 30s) ──
  const status = await verifyActiveStatus(decoded.type, decoded.id);
  
  if (!status.isActive) {
    clearAccessCookie(res);
    return res.status(401).json({
      success: false,
      error: 'Account has been deactivated. Contact system administrator.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  if (decoded.type === 'user' && !status.isLoginEnabled) {
    clearAccessCookie(res);
    return res.status(401).json({
      success: false,
      error: 'Login has been disabled for this account.',
      code: 'LOGIN_DISABLED',
    });
  }

  req.user = decoded;
  next();
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'NO_AUTH',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
}

function staffOnly(req, res, next) {
  if (!req.user || req.user.type !== 'user') {
    return res.status(403).json({
      success: false,
      error: 'This endpoint is restricted to internal staff.',
      code: 'STAFF_ONLY',
    });
  }
  next();
}

function customerOnly(req, res, next) {
  if (!req.user || req.user.type !== 'customer') {
    return res.status(403).json({
      success: false,
      error: 'This endpoint is restricted to customer portal users.',
      code: 'CUSTOMER_ONLY',
    });
  }
  next();
}

module.exports = {
  checkAuth,
  authorizeRoles,
  staffOnly,
  customerOnly,
  invalidateStatusCache,
};
