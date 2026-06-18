// ============================================================================
// HR CONTROLLER — Fleet Map & Staff Management Data Layer
// ============================================================================
// Manages the full lifecycle of Money Collectors (STAFF role) and Truck
// Drivers (DRIVER role). All passwords are hashed via bcrypt-12. The
// deactivateUser endpoint interacts with the in-memory JWT blacklist to
// guarantee instant session severance — zero database round-trips at
// middleware intercept time.
// ============================================================================

const bcrypt = require('bcrypt');
const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');
const { addToBlacklist, removeFromBlacklist } = require('../utils/blacklist');
const { createCollectorSchema, createDriverSchema } = require('../validators/hr.validator');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const BCRYPT_ROUNDS = 12;

// ============================================================================
// 1. GET ALL STAFF (Collectors + Drivers)
// ============================================================================

async function getAllStaff(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const skip = (page - 1) * limit;
    const roleFilter = req.query.role; // Optional: 'STAFF' or 'DRIVER'

    const where = {
      role: { in: ['STAFF', 'DRIVER', 'NORMAL_EMPLOYEE'] }, // Exclude ADMIN accounts from HR roster
    };

    // Optional role filter
    if (roleFilter && ['STAFF', 'DRIVER', 'NORMAL_EMPLOYEE'].includes(roleFilter.toUpperCase())) {
      where.role = roleFilter.toUpperCase();
    }

    const [staff, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          jobTitle: true,
          isActive: true,
          vehicleId: true,
          vehicle: {
            select: {
              id: true,
              registrationNumber: true,
              type: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: staff,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[HR] getAllStaff error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve staff roster.',
    });
  }
}

// ============================================================================
// 2. CREATE COLLECTOR (STAFF role)
// ============================================================================

async function createCollector(req, res) {
  try {
    const parseResult = createCollectorSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, errors });
    }

    const { name, phone, username, password, assignedArea } = parseResult.data;

    // Check for duplicate username
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Username '${username}' is already taken.`,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role: 'STAFF',
      },
    });

    // Write audit log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'COLLECTOR_CREATED',
          entityType: 'User',
          entityId: String(user.id),
          performedById: req.user.id,
          details: { name, username, phone, assignedArea },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });
    } catch (auditErr) {
      console.error('[HR] Audit log failed:', auditErr.message);
    }

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone,
        assignedArea,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[HR] createCollector error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create collector profile.',
    });
  }
}

// ============================================================================
// 3. CREATE DRIVER (DRIVER role)
// ============================================================================

async function createDriver(req, res) {
  try {
    const parseResult = createDriverSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, errors });
    }

    const { name, phone, username, password, vehicleId } = parseResult.data;

    // Check for duplicate username
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Username '${username}' is already taken.`,
      });
    }

    // Verify vehicle exists and is active
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({
        success: false,
        error: `Vehicle with ID '${vehicleId}' not found or is inactive.`,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role: 'DRIVER',
        vehicleId,
      },
    });

    // Write audit log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'DRIVER_CREATED',
          entityType: 'User',
          entityId: String(user.id),
          performedById: req.user.id,
          details: { name, username, phone, vehicleId, vehicleReg: vehicle.registrationNumber },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });
    } catch (auditErr) {
      console.error('[HR] Audit log failed:', auditErr.message);
    }

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone,
        vehicleId: user.vehicleId,
        vehicleRegistration: vehicle.registrationNumber,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[HR] createDriver error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create driver profile.',
    });
  }
}

// ============================================================================
// 3. CREATE STAFF (NORMAL_EMPLOYEE or general)
// ============================================================================

async function createStaff(req, res) {
  try {
    const { name, phone, username, password, role, jobTitle } = req.body;

    if (!name || !role) {
      return res.status(400).json({ success: false, error: 'Name and role are required.' });
    }

    let passwordHash = null;
    let isLoginEnabled = true;

    if (role === 'NORMAL_EMPLOYEE') {
      isLoginEnabled = false;
    } else {
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required for this role.' });
      }
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(409).json({ success: false, error: `Username '${username}' is already taken.` });
      }
      passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    const user = await prisma.user.create({
      data: {
        name,
        username: isLoginEnabled ? username : null,
        passwordHash,
        role,
        jobTitle,
        isLoginEnabled,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        jobTitle: user.jobTitle,
        isLoginEnabled: user.isLoginEnabled,
      },
    });
  } catch (error) {
    console.error('[HR] createStaff error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create staff.' });
  }
}

// ============================================================================
// 4. GET STAFF PROFILE (Deep-Dive with Transaction History)
// ============================================================================

async function getStaffProfile(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        vehicleId: true,
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            type: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        incomeEntries: {
          where: { isDeleted: false },
          orderBy: { date: 'desc' },
          take: 200, // Cap at 200 most recent transactions
          select: {
            id: true,
            date: true,
            amount: true,
            baseAmount: true,
            vatAmount: true,
            paymentMethod: true,
            source: true,
            status: true,
            note: true,
            createdAt: true,
            customer: {
              select: {
                customerId: true,
                name: true,
                assignedArea: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `Staff member with ID '${userId}' not found.`,
      });
    }

    // Calculate daily collection total (today's successful entries)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dailyAgg = await prisma.incomeLedger.aggregate({
      where: {
        collectedById: userId,
        isDeleted: false,
        status: 'SUCCESSFUL',
        date: { gte: todayStart, lte: todayEnd },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const dailyCollectionTotal = new Decimal(dailyAgg._sum.amount || 0).toFixed(2);
    const dailyTransactionCount = dailyAgg._count.id || 0;

    // Format transaction Decimals to strings
    const transactions = user.incomeEntries.map((tx) => ({
      id: tx.id,
      date: tx.date,
      amount: tx.amount.toString(),
      baseAmount: tx.baseAmount.toString(),
      vatAmount: tx.vatAmount.toString(),
      paymentMethod: tx.paymentMethod,
      source: tx.source,
      status: tx.status,
      note: tx.note,
      createdAt: tx.createdAt,
      customer: tx.customer,
    }));

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        vehicle: user.vehicle,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        dailySummary: {
          collectionTotal: dailyCollectionTotal,
          transactionCount: dailyTransactionCount,
        },
        transactions,
      },
    });
  } catch (error) {
    console.error('[HR] getStaffProfile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve staff profile.',
    });
  }
}

// ============================================================================
// 5. DEACTIVATE USER — The Kill Switch
// ============================================================================
// Flips isActive to false in PostgreSQL, purges all refresh tokens for the
// user, and IMMEDIATELY adds them to the in-memory blacklist. This means
// the very next API request from their browser — even if they hold a valid
// 15-minute access token — will be rejected by checkAuth middleware with
// zero database lookups (O(1) Set.has() check).

async function deactivateUser(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format.',
      });
    }

    // Prevent self-deactivation
    if (req.user.id === userId) {
      return res.status(403).json({
        success: false,
        error: 'You cannot deactivate your own account.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User with ID '${userId}' not found.`,
      });
    }

    // Prevent deactivating another ADMIN
    if (user.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Cannot deactivate an ADMIN account via this endpoint.',
      });
    }

    if (!user.isActive) {
      return res.status(409).json({
        success: false,
        error: `User '${user.name}' is already deactivated.`,
      });
    }

    // Atomic: flip isActive + purge refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);

    // ── INSTANT JWT BLACKLIST — The critical step ──
    // After this line, the deactivated user's access token is dead
    // at the middleware layer. No need to wait for token expiration.
    addToBlacklist('user', userId);

    // Write audit trail
    try {
      await prisma.auditLog.create({
        data: {
          action: 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: String(userId),
          performedById: req.user.id,
          details: { deactivatedUser: user.name, role: user.role },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });
    } catch (auditErr) {
      console.error('[HR] Audit log failed:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `User '${user.name}' has been deactivated. All active sessions have been terminated.`,
    });
  } catch (error) {
    console.error('[HR] deactivateUser error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate user.',
    });
  }
}

// ============================================================================
// 6. REACTIVATE USER — Reverse Kill Switch
// ============================================================================

async function reactivateUser(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User with ID '${userId}' not found.`,
      });
    }

    if (user.isActive) {
      return res.status(409).json({
        success: false,
        error: `User '${user.name}' is already active.`,
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    // Remove from in-memory blacklist
    removeFromBlacklist('user', userId);

    // Write audit trail
    try {
      await prisma.auditLog.create({
        data: {
          action: 'USER_REACTIVATED',
          entityType: 'User',
          entityId: String(userId),
          performedById: req.user.id,
          details: { reactivatedUser: user.name, role: user.role },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });
    } catch (auditErr) {
      console.error('[HR] Audit log failed:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `User '${user.name}' has been reactivated. They may log in again.`,
    });
  } catch (error) {
    console.error('[HR] reactivateUser error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reactivate user.',
    });
  }
}

// ============================================================================
// 7. RESET PASSWORD (Sudo-Protected)
// ============================================================================

async function resetStaffPassword(req, res) {
  try {
    const { sudoPassword } = req.body;
    const userId = parseInt(req.params.id, 10);

    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) return res.status(401).json({ success: false, error: 'Admin not found.' });

    const isPasswordValid = await bcrypt.compare(sudoPassword, admin.passwordHash);
    if (!isPasswordValid) return res.status(403).json({ success: false, error: 'Sudo authentication failed.' });

    const staff = await prisma.user.findUnique({ where: { id: userId } });
    if (!staff || !staff.isLoginEnabled) {
      return res.status(404).json({ success: false, error: 'Staff member not found or login is not enabled.' });
    }

    // Generate 8-char random alphanumeric password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let newPassword = '';
    for (let i = 0; i < 8; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Terminate existing sessions
    await prisma.refreshToken.deleteMany({ where: { userId } });
    addToBlacklist('user', userId);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully.',
      data: { newPassword },
    });
  } catch (error) {
    console.error('[HR] resetStaffPassword error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
}

module.exports = {
  getAllStaff,
  createCollector,
  createDriver,
  createStaff,
  getStaffProfile,
  deactivateUser,
  reactivateUser,
  resetStaffPassword,
};
