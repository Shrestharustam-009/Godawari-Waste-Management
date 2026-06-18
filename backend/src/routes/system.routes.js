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

// All system routes require ADMIN privileges
router.use(authorizeRoles('ADMIN'));

// ── Read current configuration ──
router.get('/settings', getSettings);

// ── Sudo-protected mutation ──
router.put('/settings', updateSettings);
router.put('/deductions', updateDeductions);
router.post('/vehicles', addVehicle);
router.get('/vehicles', getAllVehicles);

module.exports = router;
