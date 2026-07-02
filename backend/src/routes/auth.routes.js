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

// ── Rate limiter specifically for token refresh (prevent abuse) ──
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // 30 refresh attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many refresh attempts. Please try again later.' },
});

// ── PUBLIC ROUTES ──
router.post('/staff/login', validate(staffLoginSchema), authController.staffLogin);
router.post('/customer/login', validate(customerLoginSchema), authController.customerLogin);

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
