// ============================================================================
// TOKEN UTILITIES — JWT Access + Refresh Token Lifecycle
// ============================================================================
// Access Token  : 15-minute JWT, transported in HttpOnly/Secure/SameSite cookie
// Refresh Token : 7-day opaque hex string, stored in PostgreSQL (RefreshToken model)
//
// This module is the SINGLE SOURCE OF TRUTH for all token operations.
// Controllers call these helpers — they never touch jwt.sign() directly.
// ============================================================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

// ── Environment-driven secrets ──
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_IMMEDIATELY';
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_TOKEN_BYTES = 64;           // 512-bit random hex
const REFRESH_TOKEN_TTL_DAYS = 7;         // 7-day rotation cycle

// ── Cookie configuration for access token transport ──
const ACCESS_COOKIE_NAME = 'accessToken';
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,                         // Inaccessible to document.cookie
  secure: process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true',  // HTTPS only in prod
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // 'lax' in dev for cross-port cookies
  maxAge: parseInt(process.env.COOKIE_MAX_AGE_MS, 10) || 7200000,
  path: '/',
};

// ============================================================================
// ACCESS TOKEN OPERATIONS
// ============================================================================

/**
 * Signs a short-lived JWT access token.
 *
 * @param {Object} payload — Must contain: { id, role, type }
 *   - id: userId (Int) or customerId (String)
 *   - role: 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER'
 *   - type: 'user' | 'customer' (discriminator for blacklist checks)
 * @returns {string} Signed JWT string
 */
function signAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      role: payload.role,
      type: payload.type,
      // Include username/name for audit trail without DB lookup
      ...(payload.username && { username: payload.username }),
      ...(payload.name && { name: payload.name }),
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

/**
 * Verifies and decodes an access token.
 *
 * @param {string} token — Raw JWT string
 * @returns {Object} Decoded payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
}

/**
 * Sets the access token as an HttpOnly cookie on the response.
 *
 * @param {Object} res — Express response
 * @param {string} token — Signed JWT
 */
function setAccessCookie(res, token) {
  res.cookie(ACCESS_COOKIE_NAME, token, ACCESS_COOKIE_OPTIONS);
}

/**
 * Clears the access token cookie.
 *
 * @param {Object} res — Express response
 */
function clearAccessCookie(res) {
  // Express v5 deprecates maxAge for clearCookie; strip it from options
  const { maxAge, ...clearOptions } = ACCESS_COOKIE_OPTIONS;
  res.clearCookie(ACCESS_COOKIE_NAME, clearOptions);
}

// ============================================================================
// REFRESH TOKEN OPERATIONS
// ============================================================================

/**
 * Generates a cryptographically secure opaque refresh token,
 * persists it in PostgreSQL linked to a User or Customer,
 * and returns the raw hex string to be sent to the client.
 *
 * @param {Object} params
 * @param {number|null} params.userId — Set for staff/admin/driver login
 * @param {string|null} params.customerId — Set for customer portal login
 * @param {string|null} params.ipAddress — Request originating IP
 * @param {string|null} params.userAgent — Client user agent
 * @returns {Promise<string>} The raw refresh token hex string
 */
async function generateRefreshToken({ userId = null, customerId = null, ipAddress = null, userAgent = null }) {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  await prisma.refreshToken.create({
    data: {
      token: rawToken,
      userId,
      customerId,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return rawToken;
}

/**
 * Validates a refresh token against the database.
 * Returns the stored record if valid; null if expired/missing.
 * Also verifies the linked user/customer is still active.
 *
 * @param {string} rawToken — The hex refresh token from the client
 * @returns {Promise<Object|null>} The RefreshToken record with user/customer, or null
 */
async function validateRefreshToken(rawToken) {
  const record = await prisma.refreshToken.findUnique({
    where: { token: rawToken },
    include: {
      user: { select: { id: true, username: true, name: true, role: true, isActive: true } },
      customer: { select: { customerId: true, name: true, phone: true, isActive: true } },
    },
  });

  if (!record) return null;

  // Check expiration
  if (new Date() > record.expiresAt) {
    // Clean up expired token
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    return null;
  }

  // Check if linked account is still active
  if (record.user && !record.user.isActive) return null;
  if (record.customer && !record.customer.isActive) return null;

  return record;
}

/**
 * Rotates a refresh token: deletes the old one and issues a new one.
 * This prevents refresh token replay attacks.
 *
 * @param {string} oldToken — The current refresh token to invalidate
 * @param {Object} params — Same params as generateRefreshToken
 * @returns {Promise<string>} The new refresh token
 */
async function rotateRefreshToken(oldToken, { userId = null, customerId = null, ipAddress = null, userAgent = null }) {
  // Delete old token (if it exists)
  await prisma.refreshToken.deleteMany({ where: { token: oldToken } });

  // Issue new one
  return generateRefreshToken({ userId, customerId, ipAddress, userAgent });
}

/**
 * Revokes all refresh tokens for a given user or customer.
 * Called on logout, password change, or account deactivation.
 *
 * @param {Object} params
 * @param {number|null} params.userId
 * @param {string|null} params.customerId
 * @returns {Promise<number>} Count of deleted tokens
 */
async function revokeAllRefreshTokens({ userId = null, customerId = null }) {
  const where = {};
  if (userId) where.userId = userId;
  if (customerId) where.customerId = customerId;

  const result = await prisma.refreshToken.deleteMany({ where });
  return result.count;
}

/**
 * Purges all expired refresh tokens from the database.
 * Call this periodically (e.g., daily cron) to keep the table clean.
 *
 * @returns {Promise<number>} Count of purged tokens
 */
async function purgeExpiredRefreshTokens() {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Access token
  signAccessToken,
  verifyAccessToken,
  setAccessCookie,
  clearAccessCookie,
  ACCESS_COOKIE_NAME,
  ACCESS_COOKIE_OPTIONS,

  // Refresh token
  generateRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  purgeExpiredRefreshTokens,
};
