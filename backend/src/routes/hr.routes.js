// ============================================================================
// HR ROUTES — Fleet Map & Staff Management API Layer
// ============================================================================
// All routes require ADMIN authentication via checkAuth + authorizeRoles.
// Mounted at: /api/v1/hr
// ============================================================================

const express = require('express');
const router = express.Router();
//  1. ADD PRISMA CLIENT IMPORTS AT THE TOP
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  getAllStaff,
  createCollector,
  createDriver,
  createStaff,
  getStaffProfile,
  deactivateUser,
  reactivateUser,
  resetStaffPassword,
} = require('../controllers/hr.controller');

const { authorizeRoles } = require('../middleware/checkAuth');

// All HR routes require ADMIN privileges
router.use(authorizeRoles('ADMIN'));

// ── Staff Roster ──
router.get('/staff', getAllStaff);

// ── Live Map Hydration (Survives Refresh) ──
router.get('/latest-locations', async (req, res) => {
  try {
    // Fetch snapshots from both tables concurrently (Filter out anything older than 3 minutes)
    const cutoff = new Date(Date.now() - 3 * 60 * 1000);
    const [staffRows, driverRows] = await Promise.all([
      prisma.latestStaffLocation.findMany({ where: { updatedAt: { gte: cutoff } } }),
      prisma.latestDriverLocation.findMany({ where: { updatedAt: { gte: cutoff } } })
    ]);
    
    // Structure Staff Map Dictionary
    const staffData = {};
    staffRows.forEach(loc => {
      staffData[loc.staffId] = {
        staffId: loc.staffId,
        lat: loc.lat,
        lng: loc.lng,
        timestamp: loc.updatedAt
      };
    });

    // Structure Driver Map Dictionary
    const driverData = {};
    driverRows.forEach(loc => {
      driverData[loc.vehicleId] = {
        vehicleId: loc.vehicleId,
        lat: loc.lat,
        lng: loc.lng,
        timestamp: loc.updatedAt
      };
    });

    res.json({ 
      success: true, 
      staff: staffData, 
      drivers: driverData 
    });
  } catch (err) {
    console.error('[API ERROR] Failed to hydrate map networks:', err.message);
    res.status(500).json({ success: false, message: 'Server Error loading locations' });
  }
});

// ── Profile Creation ──
router.post('/collectors', createCollector);
router.post('/drivers', createDriver);
router.post('/staff', createStaff);

// ── Staff Deep-Dive ──
router.get('/staff/:id', getStaffProfile);

// ── Account Lifecycle ──
router.patch('/staff/:id/deactivate', deactivateUser);
router.patch('/staff/:id/reactivate', reactivateUser);
router.post('/staff/:id/reset-password', resetStaffPassword);

module.exports = router;