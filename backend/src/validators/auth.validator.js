// ============================================================================
// AUTH VALIDATORS — Zod Schemas for Authentication Endpoints
// ============================================================================
// Strict input validation for all auth payloads.
// These schemas run BEFORE controller logic via the validate() middleware.
// ============================================================================

const { z } = require('zod');

// ────────────────────────────────────────────────────────────────────────────
// Staff Login — POST /api/v1/auth/staff/login
// ────────────────────────────────────────────────────────────────────────────

const staffLoginSchema = z.object({
  username: z
    .string({ required_error: 'Username is required.' })
    .trim()
    .min(2, 'Username must be at least 2 characters.')
    .max(60, 'Username must not exceed 60 characters.')
    // Strip any HTML/script tags to prevent stored XSS
    .transform((val) => val.replace(/<[^>]*>/g, '')),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must not exceed 128 characters.'),
}).strict(); // Reject any extra fields not in the schema

// ────────────────────────────────────────────────────────────────────────────
// Customer Login — POST /api/v1/auth/customer/login
// ────────────────────────────────────────────────────────────────────────────

const customerLoginSchema = z.object({
  phone: z
    .string({ required_error: 'Phone number is required.' })
    .trim()
    // Nepal mobile: 98XXXXXXXX or +97798XXXXXXXX (10 or 14 chars)
    .regex(
      /^(\+977)?9[78]\d{8}$/,
      'Invalid phone number format. Expected: 98XXXXXXXX or +97798XXXXXXXX.'
    ),

  pin: z
    .string({ required_error: 'PIN is required.' })
    // Enforce exactly 4 digits — no letters, no spaces, no symbols
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),
}).strict();

// ────────────────────────────────────────────────────────────────────────────
// Token Refresh — POST /api/v1/auth/refresh
// ────────────────────────────────────────────────────────────────────────────

const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required.' })
    .trim()
    // Refresh tokens are 128-char hex strings (64 bytes → 128 hex chars)
    .regex(/^[a-f0-9]{128}$/, 'Invalid refresh token format.'),
}).strict();

// ────────────────────────────────────────────────────────────────────────────
// Logout — POST /api/v1/auth/logout
// ────────────────────────────────────────────────────────────────────────────

const logoutSchema = z.object({
  refreshToken: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{128}$/, 'Invalid refresh token format.')
    .optional(), // Refresh token is optional on logout (cookie-only logout is valid)
}).strict();

module.exports = {
  staffLoginSchema,
  customerLoginSchema,
  refreshTokenSchema,
  logoutSchema,
};
