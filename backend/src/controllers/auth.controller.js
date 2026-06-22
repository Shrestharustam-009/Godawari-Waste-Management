// ============================================================================
// AUTH CONTROLLER — Login, Refresh, Logout, Session (Security-Hardened)
// ============================================================================
// SECURITY CHANGES:
//   1. Refresh tokens delivered via HttpOnly cookie — NEVER in response body
//   2. /refresh reads token from cookie — NEVER from request body
//   3. Logout clears both access + refresh cookies
//   4. isLoginEnabled check on staff login
// ============================================================================

const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { writeAuditLog } = require('../utils/audit');
const {
  signAccessToken,
  setAccessCookie,
  clearAccessCookie,
  setRefreshCookie,
  clearRefreshCookie,
  generateRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
} = require('../utils/token');

// Safe socket getter — never crash if socket not initialized
function safeGetIO() {
  try {
    return require('../sockets/socketSetup').getIO();
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// 1. STAFF LOGIN
// ════════════════════════════════════════════════════════════════════════

async function staffLogin(req, res) {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true, name: true, username: true, passwordHash: true,
        role: true, isActive: true, isLoginEnabled: true,
      },
    });

    if (!user) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_FAILED', entityType: 'User', entityId: 'UNKNOWN',
        details: { username, reason: 'User not found' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Invalid username or password.', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.isActive) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_BLOCKED', entityType: 'User', entityId: user.id,
        details: { reason: 'Account deactivated' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Account has been deactivated. Contact system administrator.', code: 'ACCOUNT_DEACTIVATED' });
    }

    // SECURITY FIX: Check isLoginEnabled
    if (!user.isLoginEnabled) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_BLOCKED', entityType: 'User', entityId: user.id,
        details: { reason: 'Login disabled' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Login has been disabled for this account.', code: 'LOGIN_DISABLED' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_FAILED', entityType: 'User', entityId: user.id,
        details: { reason: 'Invalid password' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Invalid username or password.', code: 'INVALID_CREDENTIALS' });
    }

    // Issue access token → HttpOnly cookie
    const accessToken = signAccessToken({ id: user.id, role: user.role, type: 'user', username: user.username, name: user.name });
    setAccessCookie(res, accessToken);

    // Issue refresh token → HttpOnly cookie (NOT in response body)
    const refreshToken = await generateRefreshToken({ userId: user.id, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    setRefreshCookie(res, refreshToken);

    await writeAuditLog({
      action: 'STAFF_LOGIN_SUCCESS', entityType: 'User', entityId: user.id,
      performedById: user.id, details: { role: user.role },
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });

    // Broadcast login event to admins
    const io = safeGetIO();
    if (io) {
      io.to('admin_room').emit('system_alert', {
        type: 'LOGIN',
        message: `${user.name} (${user.role}) just logged into the system.`,
        timestamp: new Date(),
      });
    }

    // SECURITY: Refresh token is NOT returned in body — it's in the cookie
    return res.status(200).json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, username: user.username, role: user.role },
      },
    });

  } catch (err) {
    console.error('[AUTH] Staff login error:', err);
    return res.status(500).json({ success: false, error: 'Login failed due to a server error.', code: 'INTERNAL_ERROR' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// 2. CUSTOMER LOGIN
// ════════════════════════════════════════════════════════════════════════

async function customerLogin(req, res) {
  const { phone, password } = req.body;

  try {
    const normalizedPhone = phone.replace(/^\+977/, '');
    const customer = await prisma.customer.findFirst({
      where: { phone: normalizedPhone },
      select: { customerId: true, name: true, phone: true, pinHash: true, assignedArea: true, isActive: true },
    });

    if (!customer) {
      await writeAuditLog({
        action: 'CUSTOMER_LOGIN_FAILED', entityType: 'Customer', entityId: 'UNKNOWN',
        details: { phone: normalizedPhone, reason: 'Phone not registered' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Invalid phone number or password.', code: 'INVALID_CREDENTIALS' });
    }

    if (!customer.isActive) {
      await writeAuditLog({
        action: 'CUSTOMER_LOGIN_BLOCKED', entityType: 'Customer', entityId: customer.customerId,
        details: { reason: 'Account deactivated' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Account has been deactivated.', code: 'ACCOUNT_DEACTIVATED' });
    }

    const isPasswordValid = await bcrypt.compare(password, customer.pinHash);
    if (!isPasswordValid) {
      await writeAuditLog({
        action: 'CUSTOMER_LOGIN_FAILED', entityType: 'Customer', entityId: customer.customerId,
        details: { reason: 'Invalid Password' },
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
      return res.status(401).json({ success: false, error: 'Invalid phone number or password.', code: 'INVALID_CREDENTIALS' });
    }
    // bf7a26c5

    const accessToken = signAccessToken({ id: customer.customerId, role: 'CUSTOMER', type: 'customer', name: customer.name });
    setAccessCookie(res, accessToken);

    const refreshToken = await generateRefreshToken({ customerId: customer.customerId, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    setRefreshCookie(res, refreshToken);

    await writeAuditLog({
      action: 'CUSTOMER_LOGIN_SUCCESS', entityType: 'Customer', entityId: customer.customerId,
      details: { area: customer.assignedArea },
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });

    return res.status(200).json({
      success: true,
      data: {
        customer: { customerId: customer.customerId, name: customer.name, phone: customer.phone, assignedArea: customer.assignedArea },
      },
    });

  } catch (err) {
    console.error('[AUTH] Customer login error:', err);
    return res.status(500).json({ success: false, error: 'Login failed due to a server error.', code: 'INTERNAL_ERROR' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// 3. TOKEN REFRESH — reads refresh token from HttpOnly cookie
// ════════════════════════════════════════════════════════════════════════

async function refreshAccessToken(req, res) {
  // SECURITY: Read refresh token from cookie, NOT from body
  const rawRefreshToken = req.cookies?.refreshToken;

  if (!rawRefreshToken) {
    return res.status(401).json({ success: false, error: 'No refresh token provided.', code: 'NO_REFRESH_TOKEN' });
  }

  try {
    const record = await validateRefreshToken(rawRefreshToken);
    if (!record) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token.', code: 'INVALID_REFRESH_TOKEN' });
    }

    let tokenPayload, rotationParams;

    if (record.user) {
      tokenPayload = { id: record.user.id, role: record.user.role, type: 'user', username: record.user.username, name: record.user.name };
      rotationParams = { userId: record.user.id };
    } else if (record.customer) {
      tokenPayload = { id: record.customer.customerId, role: 'CUSTOMER', type: 'customer', name: record.customer.name };
      rotationParams = { customerId: record.customer.customerId };
    } else {
      await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, error: 'Session is invalid.', code: 'ORPHANED_TOKEN' });
    }

    // Issue new access token
    const newAccessToken = signAccessToken(tokenPayload);
    setAccessCookie(res, newAccessToken);

    // Rotate refresh token (one-time use defense)
    const newRefreshToken = await rotateRefreshToken(rawRefreshToken, { ...rotationParams, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({ success: true, message: 'Session refreshed successfully.' });

  } catch (err) {
    console.error('[AUTH] Token refresh error:', err);
    return res.status(500).json({ success: false, error: 'Token refresh failed.', code: 'INTERNAL_ERROR' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// 4. LOGOUT — clears both cookies, revokes tokens
// ════════════════════════════════════════════════════════════════════════

async function logout(req, res) {
  try {
    // Read refresh token from cookie
    const rawRefreshToken = req.cookies?.refreshToken;

    // Clear both cookies immediately
    clearAccessCookie(res);
    clearRefreshCookie(res);

    if (rawRefreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: rawRefreshToken } });
    } else if (req.user) {
      // Fallback: revoke all tokens for this user
      if (req.user.type === 'user') await revokeAllRefreshTokens({ userId: req.user.id });
      else if (req.user.type === 'customer') await revokeAllRefreshTokens({ customerId: req.user.id });
    }

    if (req.user) {
      await writeAuditLog({
        action: req.user.type === 'user' ? 'STAFF_LOGOUT' : 'CUSTOMER_LOGOUT',
        entityType: req.user.type === 'user' ? 'User' : 'Customer',
        entityId: req.user.id,
        performedById: req.user.type === 'user' ? req.user.id : null,
        ipAddress: req.ip, userAgent: req.get('User-Agent'),
      });
    }

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[AUTH] Logout error:', err);
    clearAccessCookie(res);
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out (session cookies cleared).' });
  }
}

// ════════════════════════════════════════════════════════════════════════
// 5. SESSION INFO
// ════════════════════════════════════════════════════════════════════════

async function getSession(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user.id,
      role: req.user.role,
      type: req.user.type,
      ...(req.user.username && { username: req.user.username }),
      ...(req.user.name && { name: req.user.name }),
      issuedAt: new Date(req.user.iat * 1000).toISOString(),
      expiresAt: new Date(req.user.exp * 1000).toISOString(),
    },
  });
}

module.exports = { staffLogin, customerLogin, refreshAccessToken, logout, getSession };
