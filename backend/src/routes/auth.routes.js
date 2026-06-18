// ============================================================================
// AUTH ROUTES — /api/v1/auth
// ============================================================================
// Route definitions for the authentication lifecycle.
// Zod validation runs BEFORE controllers via the validate() middleware.
// Rate limiting is applied at the server.js mount point, not here.
// ============================================================================

const express = require('express');
const router = express.Router();

// ── Middleware ──
const { validate } = require('../middleware/validate');
const { checkAuth } = require('../middleware/checkAuth');

// ── Validators ──
const {
  staffLoginSchema,
  customerLoginSchema,
  refreshTokenSchema,
  logoutSchema,
} = require('../validators/auth.validator');

// ── Controller ──
const authController = require('../controllers/auth.controller');

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required, rate-limited at mount point)
// ────────────────────────────────────────────────────────────────────────────

// Staff login — POST /api/v1/auth/staff/login
router.post(
  '/staff/login',
  validate(staffLoginSchema),
  authController.staffLogin
);

// Customer portal login — POST /api/v1/auth/customer/login
router.post(
  '/customer/login',
  validate(customerLoginSchema),
  authController.customerLogin
);

// Silent token refresh — POST /api/v1/auth/refresh
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refreshAccessToken
);

// ────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require valid access token)
// ────────────────────────────────────────────────────────────────────────────

// Logout — POST /api/v1/auth/logout
// checkAuth is optional here — logout should work even with expired tokens
router.post(
  '/logout',
  validate(logoutSchema),
  (req, res, next) => {
    // Attempt to decode the token but don't block if it fails
    // This allows logout to clear cookies even with expired tokens
    const { verifyAccessToken } = require('../utils/token');
    const token = req.cookies?.accessToken;
    if (token) {
      try {
        req.user = verifyAccessToken(token);
      } catch {
        // Token expired or invalid — still allow logout to proceed
        req.user = null;
      }
    }
    next();
  },
  authController.logout
);

// Current session info — GET /api/v1/auth/me
router.get(
  '/me',
  checkAuth,
  authController.getSession
);

module.exports = router;
