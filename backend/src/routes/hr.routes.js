// ============================================================================
// HR ROUTES — Fleet Map & Staff Management API Layer
// ============================================================================
// All routes require ADMIN authentication via checkAuth + authorizeRoles.
// Mounted at: /api/v1/hr
// ============================================================================

const express = require('express');
const router = express.Router();

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
