// ============================================================================
// SYSTEM CONTROLLER — Global Settings & Sudo-Protected Configuration
// ============================================================================
// Manages the singleton GlobalSettings row. The getSettings endpoint is a
// simple read. The updateSettings endpoint enforces SUDO-MODE: the admin
// must re-enter their password before any system mutation is committed.
//
// SECURITY MODEL:
//   1. checkAuth verifies the JWT access token.
//   2. authorizeRoles('ADMIN') restricts to admin-only.
//   3. sudoPassword re-authentication verifies the admin knows the password
//      for the account that OWNS the current session — not just any password.
//      This defends against stolen-session attacks where an attacker has the
//      cookie but doesn't know the original password.
// ============================================================================

const bcrypt = require('bcrypt');
const { Decimal } = require('decimal.js');
const prisma = require('../lib/prisma');
const { updateSettingsSchema } = require('../validators/system.validator');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ── Safe defaults if no row exists yet ──
const DEFAULTS = {
  billingCycleDay: 1,
};

// ============================================================================
// 1. GET SETTINGS — Read current global configuration
// ============================================================================

async function getSettings(req, res) {
  try {
    // GlobalSettings is a singleton — always fetch id: 1
    let settings = await prisma.globalSettings.findFirst({
      orderBy: { id: 'asc' },
    });

    // If the table is empty (first run), return safe defaults
    if (!settings) {
      return res.status(200).json({
        success: true,
        data: {
          id: null,
          billingCycleDay: DEFAULTS.billingCycleDay,
          calendarType: 'AD',
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: settings.id,
        billingCycleDay: settings.billingCycleDay,
        calendarType: settings.calendarType,
        isBonusFeeEnabled: settings.isBonusFeeEnabled,
        customDeductions: settings.customDeductions,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('[SYSTEM] getSettings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve system settings.',
    });
  }
}

// ============================================================================
// 2. UPDATE SETTINGS — Sudo-Protected Mutation
// ============================================================================

async function updateSettings(req, res) {
  try {
    // ── Step 1: Validate payload via Zod ──
    const parseResult = updateSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, errors });
    }

    const { sudoPassword, billingCycleDay, calendarType, isBonusFeeEnabled } = parseResult.data;

    // ── Step 2: SUDO RE-AUTHENTICATION ──
    // Fetch the current admin's password hash from the database.
    // req.user.id is populated by checkAuth middleware from the JWT.
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true, name: true, role: true },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Authenticated admin account not found in database.',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    // Compare the provided sudo password against the stored hash
    const isPasswordValid = await bcrypt.compare(sudoPassword, admin.passwordHash);
    if (!isPasswordValid) {
      console.warn(`[SYSTEM] SUDO FAILED: Admin "${admin.name}" (ID: ${admin.id}) provided incorrect sudo password.`);

      // Write a security audit log for the failed attempt
      try {
        await prisma.auditLog.create({
          data: {
            action: 'SUDO_AUTH_FAILED',
            entityType: 'GlobalSettings',
            entityId: 'system',
            performedById: req.user.id,
            details: { reason: 'Incorrect sudo password during settings update attempt.' },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          },
        });
      } catch (auditErr) {
        console.error('[SYSTEM] Audit log failed:', auditErr.message);
      }

      return res.status(403).json({
        success: false,
        error: 'Sudo authentication failed. The password you entered is incorrect.',
        code: 'SUDO_DENIED',
      });
    }

    // ── Step 3: SUDO PASSED — Apply the update ──
    // Upsert: create if no row exists, update if it does
    const existingSettings = await prisma.globalSettings.findFirst({
      orderBy: { id: 'asc' },
    });

    let updatedSettings;

    if (existingSettings) {
      updatedSettings = await prisma.globalSettings.update({
        where: { id: existingSettings.id },
        data: {
          billingCycleDay,
          ...(calendarType && { calendarType }),
          ...(typeof isBonusFeeEnabled === 'boolean' && { isBonusFeeEnabled }),
        },
      });
    } else {
      updatedSettings = await prisma.globalSettings.create({
        data: {
          billingCycleDay,
          calendarType: calendarType || 'AD',
          ...(typeof isBonusFeeEnabled === 'boolean' && { isBonusFeeEnabled }),
        },
      });
    }

    // ── Step 4: Write success audit trail ──
    try {
      await prisma.auditLog.create({
        data: {
          action: 'SYSTEM_SETTINGS_UPDATED',
          entityType: 'GlobalSettings',
          entityId: String(updatedSettings.id),
          performedById: req.user.id,
          details: {
            adminName: admin.name,
            newBillingCycleDay: billingCycleDay,
            previousBillingCycleDay: existingSettings ? existingSettings.billingCycleDay : DEFAULTS.billingCycleDay,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });
    } catch (auditErr) {
      console.error('[SYSTEM] Audit log failed:', auditErr.message);
    }

    console.log(`[SYSTEM] Settings updated by Admin "${admin.name}" (ID: ${admin.id}). Cycle Day: ${billingCycleDay}`);

    return res.status(200).json({
      success: true,
      message: 'System settings updated successfully.',
      data: {
        id: updatedSettings.id,
        billingCycleDay: updatedSettings.billingCycleDay,
        calendarType: updatedSettings.calendarType,
        customDeductions: updatedSettings.customDeductions,
      },
    });
  } catch (error) {
    console.error('[SYSTEM] updateSettings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update system settings.',
    });
  }
}

// ============================================================================
// 3. UPDATE DEDUCTIONS — Sudo-Protected Mutation
// ============================================================================

async function updateDeductions(req, res) {
  try {
    const { sudoPassword, deductions } = req.body;

    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) return res.status(401).json({ success: false, error: 'Admin not found.' });

    const isPasswordValid = await bcrypt.compare(sudoPassword, admin.passwordHash);
    if (!isPasswordValid) return res.status(403).json({ success: false, error: 'Sudo authentication failed.' });

    const existingSettings = await prisma.globalSettings.findFirst({ orderBy: { id: 'asc' } });
    
    let updatedSettings;
    if (existingSettings) {
      updatedSettings = await prisma.globalSettings.update({
        where: { id: existingSettings.id },
        data: { customDeductions: deductions },
      });
    } else {
      updatedSettings = await prisma.globalSettings.create({
        data: { customDeductions: deductions },
      });
    }

    return res.status(200).json({ success: true, data: { customDeductions: updatedSettings.customDeductions } });
  } catch (error) {
    console.error('[SYSTEM] updateDeductions error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update deductions.' });
  }
}

// ============================================================================
// 4. ADD VEHICLE — Sudo-Protected Fleet Registration
// ============================================================================

async function addVehicle(req, res) {
  try {
    const { sudoPassword, vehicleId, registrationNumber, type } = req.body;

    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) return res.status(401).json({ success: false, error: 'Admin not found.' });

    const isPasswordValid = await bcrypt.compare(sudoPassword, admin.passwordHash);
    if (!isPasswordValid) return res.status(403).json({ success: false, error: 'Sudo authentication failed.' });

    if (!vehicleId || !type) return res.status(400).json({ success: false, error: 'vehicleId and type are required.' });

    const existing = await prisma.vehicle.findUnique({ where: { vehicleId } });
    if (existing) return res.status(409).json({ success: false, error: 'Vehicle ID already exists.' });

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleId,
        registrationNumber: registrationNumber || null,
        type,
      }
    });

    return res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    console.error('[SYSTEM] addVehicle error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add vehicle.' });
  }
}

// ============================================================================
// 5. GET ALL VEHICLES
// ============================================================================

async function getAllVehicles(req, res) {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: vehicles });
  } catch (error) {
    console.error('[SYSTEM] getAllVehicles error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve vehicles.' });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  updateDeductions,
  addVehicle,
  getAllVehicles
};
