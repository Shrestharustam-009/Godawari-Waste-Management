// ============================================================================
// SYSTEM ROUTES — Global Settings API Layer (Sudo-Protected)
// ============================================================================
// All routes require ADMIN authentication via checkAuth + authorizeRoles.
// The updateSettings endpoint additionally requires sudo re-authentication
// at the controller level (bcrypt password comparison).
// Mounted at: /api/v1/system
// ============================================================================

const express = require('express');
const router = express.Router();

const {
  getSettings,
  updateSettings,
  updateDeductions,
  addVehicle,
  getAllVehicles
} = require('../controllers/system.controller');

const { authorizeRoles } = require('../middleware/checkAuth');

// ── Read current configuration ──
// Open to all authenticated users so staff app can fetch calendarType, etc.
router.get('/settings', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), getSettings);

// ── Sudo-protected mutation ──
router.put('/settings', authorizeRoles('ADMIN'), updateSettings);
router.put('/deductions', authorizeRoles('ADMIN'), updateDeductions);
router.post('/vehicles', authorizeRoles('ADMIN'), addVehicle);
router.get('/vehicles', authorizeRoles('ADMIN'), getAllVehicles);

module.exports = router;
