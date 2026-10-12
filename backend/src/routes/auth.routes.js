// ============================================================================
// AUTH ROUTES — Security-Hardened
// ============================================================================

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { validate } = require('../middleware/validate');
const { checkAuth } = require('../middleware/checkAuth');
const { staffLoginSchema, customerLoginSchema, logoutSchema } = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');

// ── Rate limiter specifically for logins (brute-force defense) ──
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 50,
  skipSuccessfulRequests: true, // Only failed login attempts count against the limit!
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many failed login attempts. Please try again after 15 minutes.' },
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress,
});

// ── Rate limiter specifically for token refresh (prevent abuse) ──
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,                  // 60 refresh attempts per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many refresh attempts. Please try again later.' },
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress,
});

// ── PUBLIC ROUTES ──
router.post('/staff/login', loginRateLimiter, validate(staffLoginSchema), authController.staffLogin);
router.post('/customer/login', loginRateLimiter, validate(customerLoginSchema), authController.customerLogin);

// Refresh: no body validation needed — token comes from HttpOnly cookie
router.post('/refresh', refreshRateLimiter, authController.refreshAccessToken);

// ── PROTECTED ROUTES ──
router.post('/logout', (req, res, next) => {
  const { verifyAccessToken, getAccessCookie } = require('../utils/token');
  const token = getAccessCookie(req);
  if (token) {
    try { req.user = verifyAccessToken(token); } catch { req.user = null; }
  }
  next();
}, authController.logout);

router.get('/me', checkAuth, authController.getSession);

module.exports = router;
