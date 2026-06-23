// ============================================================================
// TOKEN UTILITIES — JWT & Refresh Token Operations (Security-Hardened)
// ============================================================================
// ACCESS TOKENS:  Short-lived JWTs in HttpOnly/Secure/SameSite=Strict cookies
// REFRESH TOKENS: 512-bit hex strings in HttpOnly cookies + PostgreSQL
// ============================================================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

// ── SECURITY: Fail-fast if JWT_SECRET is missing or default ──
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
if (!ACCESS_TOKEN_SECRET || ACCESS_TOKEN_SECRET === 'CHANGE_ME_IN_PRODUCTION_IMMEDIATELY') {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET is not set or is using the default placeholder. Refusing to start in production.');
    process.exit(1);
  } else {
    console.warn('[SECURITY WARNING] JWT_SECRET is using the default placeholder. Set a strong secret for production.');
  }
}

const EFFECTIVE_SECRET = ACCESS_TOKEN_SECRET || 'DEV_ONLY_INSECURE_SECRET_DO_NOT_USE_IN_PROD';
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_BYTES = 64;
const REFRESH_TOKEN_TTL_DAYS = 7;

// ── Access Token Cookie Config ──
const ACCESS_COOKIE_NAME = 'accessToken';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION || process.env.FORCE_SECURE_COOKIES === 'true',
  sameSite: IS_PRODUCTION ? 'strict' : 'lax',
  maxAge: parseInt(process.env.COOKIE_MAX_AGE_MS, 10) || 900000, // 15 min default
  path: '/',
};

// ── Refresh Token Cookie Config ──
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION || process.env.FORCE_SECURE_COOKIES === 'true',
  sameSite: IS_PRODUCTION ? 'strict' : 'lax',
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth', // Only sent to auth endpoints
};

// ════════════════════════════════════════════════════════════════════════
// ACCESS TOKEN OPERATIONS
// ════════════════════════════════════════════════════════════════════════

function signAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      role: payload.role,
      type: payload.type,
      ...(payload.username && { username: payload.username }),
      ...(payload.name && { name: payload.name }),
    },
    EFFECTIVE_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, EFFECTIVE_SECRET);
}

function setAccessCookie(res, token) {
  res.cookie(ACCESS_COOKIE_NAME, token, ACCESS_COOKIE_OPTIONS);
}

function clearAccessCookie(res) {
  const { maxAge, ...clearOptions } = ACCESS_COOKIE_OPTIONS;
  res.clearCookie(ACCESS_COOKIE_NAME, clearOptions);
}

// ════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN OPERATIONS (now cookie-based)
// ════════════════════════════════════════════════════════════════════════

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  const { maxAge, ...clearOptions } = REFRESH_COOKIE_OPTIONS;
  res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);
}

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

async function validateRefreshToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const record = await prisma.refreshToken.findUnique({
    where: { token: rawToken },
    include: {
      user: { select: { id: true, username: true, name: true, role: true, isActive: true, isLoginEnabled: true, vehicleId: true } },
      customer: { select: { customerId: true, name: true, phone: true, isActive: true } },
    },
  });

  if (!record) return null;

  // Expired token — clean up
  if (new Date() > record.expiresAt) {
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    return null;
  }

  // Deactivated account checks
  if (record.user && (!record.user.isActive || !record.user.isLoginEnabled)) return null;
  if (record.customer && !record.customer.isActive) return null;

  return record;
}

async function rotateRefreshToken(oldToken, { userId = null, customerId = null, ipAddress = null, userAgent = null }) {
  await prisma.refreshToken.deleteMany({ where: { token: oldToken } });
  return generateRefreshToken({ userId, customerId, ipAddress, userAgent });
}

async function revokeAllRefreshTokens({ userId = null, customerId = null }) {
  const where = {};
  if (userId) where.userId = userId;
  if (customerId) where.customerId = customerId;
  const result = await prisma.refreshToken.deleteMany({ where });
  return result.count;
}

async function purgeExpiredRefreshTokens() {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  setAccessCookie,
  clearAccessCookie,
  setRefreshCookie,
  clearRefreshCookie,
  ACCESS_COOKIE_NAME,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
  generateRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  purgeExpiredRefreshTokens,
};
