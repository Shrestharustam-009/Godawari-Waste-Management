// ============================================================================
// checkAuth.js — Master Authentication & Authorization Middleware
// ============================================================================
// This middleware intercepts EVERY protected API request and enforces:
//
// 1. ACCESS TOKEN EXTRACTION — Reads the JWT from the HttpOnly cookie.
// 2. TOKEN VERIFICATION — Validates signature + expiration (15-min window).
// 3. BLACKLIST INTERCEPT — Checks the in-memory blacklist BEFORE processing.
//    If an admin has set isActive=false on a User or Customer, this middleware
//    instantly drops the request with 401, overriding the unexpired token.
// 4. ROLE AUTHORIZATION — Optional role-gating via authorizeRoles() factory.
//
// Attack surface covered:
//   ✓ Stolen/expired tokens → rejected at step 2
//   ✓ Deactivated accounts with live tokens → rejected at step 3
//   ✓ Privilege escalation attempts → rejected at step 4
// ============================================================================

const { verifyAccessToken, clearAccessCookie } = require('../utils/token');
const { isBlacklisted } = require('../utils/blacklist');

/**
 * Primary authentication middleware.
 *
 * Extracts the JWT access token from the HttpOnly cookie, verifies it,
 * checks the decoded principal against the in-memory deactivation blacklist,
 * and populates `req.user` on success.
 *
 * req.user shape:
 *   {
 *     id: number | string,   // userId (int) or customerId (string)
 *     role: string,           // 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER'
 *     type: string,           // 'user' | 'customer'
 *     username?: string,      // Staff/admin username (if present)
 *     name?: string,          // Display name (if present)
 *     iat: number,            // Issued-at timestamp
 *     exp: number,            // Expiration timestamp
 *   }
 */
function checkAuth(req, res, next) {
  // ── Step 1: Extract token from HttpOnly cookie ──
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No access token found.',
      code: 'NO_TOKEN',
    });
  }

  // ── Step 2: Verify JWT signature and expiration ──
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    // Clear the invalid/expired cookie so the client doesn't resend it
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

  // ── Step 3: BLACKLIST INTERCEPT ──
  // This is the critical "instant-deactivation" check.
  // Even if the 15-minute token is still valid, a deactivated account
  // is rejected here with ZERO database round-trips (in-memory Set lookup).
  if (isBlacklisted(decoded.type, decoded.id)) {
    clearAccessCookie(res);
    return res.status(401).json({
      success: false,
      error: 'Account has been deactivated. Contact system administrator.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  // ── Step 4: Populate req.user for downstream handlers ──
  req.user = decoded;
  next();
}

/**
 * Role-based authorization middleware factory.
 *
 * Usage:
 *   router.get('/admin-only', checkAuth, authorizeRoles('ADMIN'), handler);
 *   router.get('/staff-area', checkAuth, authorizeRoles('ADMIN', 'STAFF'), handler);
 *
 * @param  {...string} allowedRoles — One or more of: 'ADMIN', 'STAFF', 'DRIVER', 'CUSTOMER'
 * @returns {Function} Express middleware
 */
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

/**
 * Convenience middleware: restricts to internal staff only (ADMIN, STAFF, DRIVER).
 * Rejects CUSTOMER-type tokens.
 */
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

/**
 * Convenience middleware: restricts to customer portal users only.
 * Rejects User-type tokens.
 */
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
};
