// ============================================================================
// AUTH CONTROLLER — Staff + Customer Login, Token Rotation, Logout
// ============================================================================
// Handles the complete authentication lifecycle:
//
//   1. Staff Login   — username + bcrypt password → access token (cookie) + refresh token (DB)
//   2. Customer Login — phone + 4-digit PIN → access token (cookie) + refresh token (DB)
//   3. Token Refresh  — valid refresh token → new 15-min access token + rotated refresh token
//   4. Logout         — clear access cookie + revoke refresh token from DB
//   5. Session Info    — decode current session (no DB hit)
//
// SECURITY INVARIANTS:
//   • Access tokens are NEVER sent in response body — cookie-only transport
//   • Refresh tokens are rotated on every use (one-time-use defense)
//   • Failed login attempts are audit-logged with IP for forensics
//   • Deactivated accounts are rejected even if credentials are valid
// ============================================================================

const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { writeAuditLog } = require('../utils/audit');
const {
  signAccessToken,
  setAccessCookie,
  clearAccessCookie,
  generateRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
} = require('../utils/token');
const { getIO } = require('../sockets/socketSetup');

// ────────────────────────────────────────────────────────────────────────────
// 1. STAFF LOGIN — POST /api/v1/auth/staff/login
// ────────────────────────────────────────────────────────────────────────────

async function staffLogin(req, res) {
  const { username, password } = req.body;

  try {
    // ── Fetch user by username ──
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    // ── Generic error for both "user not found" and "wrong password"
    //    to prevent username enumeration attacks ──
    if (!user) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_FAILED',
        entityType: 'User',
        entityId: 'UNKNOWN',
        details: { username, reason: 'User not found' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // ── Reject deactivated accounts BEFORE password check ──
    if (!user.isActive) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_BLOCKED',
        entityType: 'User',
        entityId: user.id,
        details: { reason: 'Account deactivated' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        success: false,
        error: 'Account has been deactivated. Contact system administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // ── Secure password comparison (bcrypt, constant-time) ──
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        details: { reason: 'Invalid password' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // ── Sign 15-minute access token and set HttpOnly cookie ──
    const accessToken = signAccessToken({
      id: user.id,
      role: user.role,
      type: 'user',
      username: user.username,
      name: user.name,
    });
    setAccessCookie(res, accessToken);

    // ── Generate 7-day refresh token and persist in DB ──
    const refreshToken = await generateRefreshToken({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // ── Audit log: successful login ──
    await writeAuditLog({
      action: 'STAFF_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      performedById: user.id,
      details: { role: user.role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // ── Live Notification Engine: Emit system alert ──
    try {
      const io = getIO();
      io.to('admin_room').emit('system_alert', {
        type: 'LOGIN',
        message: `${user.name} (${user.role}) just logged into the system.`,
        timestamp: new Date()
      });
    } catch (socketErr) {
      console.warn('[AUTH] Socket broadcast failed (non-fatal):', socketErr.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
        refreshToken, // Client stores this for silent renewal
      },
    });
  } catch (err) {
    console.error('[AUTH] Staff login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Login failed due to a server error. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. CUSTOMER LOGIN — POST /api/v1/auth/customer/login
// ────────────────────────────────────────────────────────────────────────────
// Customer Portal gate: Phone number + 4-digit PIN.
// The PIN is bcrypt-hashed in the database (pinHash field).

async function customerLogin(req, res) {
  const { phone, pin } = req.body;

  try {
    // ── Normalize phone: strip +977 prefix if present ──
    const normalizedPhone = phone.replace(/^\+977/, '');

    // ── Look up customer by phone number ──
    const customer = await prisma.customer.findFirst({
      where: { phone: normalizedPhone },
      select: {
        customerId: true,
        name: true,
        phone: true,
        pinHash: true,
        assignedArea: true,
        isActive: true,
      },
    });

    // ── Generic error to prevent phone enumeration ──
    if (!customer) {
      await writeAuditLog({
        action: 'CUSTOMER_LOGIN_FAILED',
        entityType: 'Customer',
        entityId: 'UNKNOWN',
        details: { phone: normalizedPhone, reason: 'Phone not registered' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid phone number or PIN.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // ── Reject deactivated customers ──
    if (!customer.isActive) {
      await writeAuditLog({
        action: 'CUSTOMER_LOGIN_BLOCKED',
        entityType: 'Customer',
        entityId: customer.customerId,
        details: { reason: 'Account deactivated' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        success: false,
        error: 'Account has been deactivated. Contact the waste management office.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // ── Secure PIN comparison (bcrypt, constant-time) ──
    // The 4-digit PIN is stored as a bcrypt hash with salt rounds = 10.
    const isPinValid = await bcrypt.compare(pin, customer.pinHash);

    if (!isPinValid) {
      await writeAuditLog({
        action: 'CUSTOMER_LOGIN_FAILED',
        entityType: 'Customer',
        entityId: customer.customerId,
        details: { reason: 'Invalid PIN' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid phone number or PIN.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // ── Sign 15-minute access token ──
    const accessToken = signAccessToken({
      id: customer.customerId,
      role: 'CUSTOMER',
      type: 'customer',
      name: customer.name,
    });
    setAccessCookie(res, accessToken);

    // ── Generate 7-day refresh token ──
    const refreshToken = await generateRefreshToken({
      customerId: customer.customerId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // ── Audit log: successful customer login ──
    await writeAuditLog({
      action: 'CUSTOMER_LOGIN_SUCCESS',
      entityType: 'Customer',
      entityId: customer.customerId,
      details: { area: customer.assignedArea },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(200).json({
      success: true,
      data: {
        customer: {
          customerId: customer.customerId,
          name: customer.name,
          phone: customer.phone,
          assignedArea: customer.assignedArea,
        },
        refreshToken,
      },
    });
  } catch (err) {
    console.error('[AUTH] Customer login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Login failed due to a server error. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. TOKEN REFRESH — POST /api/v1/auth/refresh
// ────────────────────────────────────────────────────────────────────────────
// Silent access token renewal using a valid refresh token.
//
// SECURITY: The refresh token is ROTATED on every use (old deleted, new issued).
// If an attacker replays a stolen refresh token after the legitimate user
// has already used it, the replay will fail because the old token is gone.

async function refreshAccessToken(req, res) {
  const { refreshToken: rawRefreshToken } = req.body;

  try {
    // ── Validate the refresh token against the database ──
    const record = await validateRefreshToken(rawRefreshToken);

    if (!record) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token. Please log in again.',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // ── Determine the principal (User or Customer) ──
    let tokenPayload;
    let rotationParams;

    if (record.user) {
      tokenPayload = {
        id: record.user.id,
        role: record.user.role,
        type: 'user',
        username: record.user.username,
        name: record.user.name,
      };
      rotationParams = { userId: record.user.id };
    } else if (record.customer) {
      tokenPayload = {
        id: record.customer.customerId,
        role: 'CUSTOMER',
        type: 'customer',
        name: record.customer.name,
      };
      rotationParams = { customerId: record.customer.customerId };
    } else {
      // Orphaned refresh token — clean it up
      await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
      return res.status(401).json({
        success: false,
        error: 'Session is invalid. Please log in again.',
        code: 'ORPHANED_TOKEN',
      });
    }

    // ── Issue new 15-minute access token ──
    const newAccessToken = signAccessToken(tokenPayload);
    setAccessCookie(res, newAccessToken);

    // ── Rotate refresh token (delete old, issue new) ──
    const newRefreshToken = await rotateRefreshToken(rawRefreshToken, {
      ...rotationParams,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(200).json({
      success: true,
      data: {
        refreshToken: newRefreshToken,
        // Access token is in the HttpOnly cookie — NOT in the response body
      },
    });
  } catch (err) {
    console.error('[AUTH] Token refresh error:', err);
    return res.status(500).json({
      success: false,
      error: 'Token refresh failed. Please log in again.',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. LOGOUT — POST /api/v1/auth/logout
// ────────────────────────────────────────────────────────────────────────────
// Clears the access token cookie AND revokes the refresh token from the DB.
// If refreshToken is provided, only that token is revoked.
// If not provided, ALL refresh tokens for the user are revoked (full logout).

async function logout(req, res) {
  try {
    const { refreshToken: rawRefreshToken } = req.body;

    // ── Clear the access token cookie ──
    clearAccessCookie(res);

    if (rawRefreshToken) {
      // Revoke the specific refresh token
      await prisma.refreshToken.deleteMany({
        where: { token: rawRefreshToken },
      });
    } else if (req.user) {
      // No specific token provided — revoke ALL tokens for this user
      if (req.user.type === 'user') {
        await revokeAllRefreshTokens({ userId: req.user.id });
      } else if (req.user.type === 'customer') {
        await revokeAllRefreshTokens({ customerId: req.user.id });
      }
    }

    // ── Audit log ──
    if (req.user) {
      await writeAuditLog({
        action: req.user.type === 'user' ? 'STAFF_LOGOUT' : 'CUSTOMER_LOGOUT',
        entityType: req.user.type === 'user' ? 'User' : 'Customer',
        entityId: req.user.id,
        performedById: req.user.type === 'user' ? req.user.id : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('[AUTH] Logout error:', err);
    // Still clear cookie even if DB operation fails
    clearAccessCookie(res);
    return res.status(200).json({
      success: true,
      message: 'Logged out (session cookie cleared).',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. SESSION INFO — GET /api/v1/auth/me
// ────────────────────────────────────────────────────────────────────────────
// Returns the decoded session payload without a database round-trip.
// Requires a valid access token (checkAuth middleware must run first).

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

module.exports = {
  staffLogin,
  customerLogin,
  refreshAccessToken,
  logout,
  getSession,
};
