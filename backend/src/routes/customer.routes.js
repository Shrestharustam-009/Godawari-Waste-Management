// ============================================================================
// CUSTOMER ROUTES — /api/v1/customers
// ============================================================================
// All routes are protected by checkAuth (JWT + blacklist) at the server.js level.
// Additionally, authorizeRoles('ADMIN') is applied to all routes in this file.
// ============================================================================

const express = require('express');
const router = express.Router();

const { authorizeRoles } = require('../middleware/checkAuth');
const {
  getAllCustomers,
  createCustomer,
  getCustomerProfile,
  resetCustomerPin,
} = require('../controllers/customer.controller');

// ── RBAC is now applied per-route to allow field staff to search ──
// router.use(authorizeRoles('ADMIN'));

// ────────────────────────────────────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ────────────────────────────────────────────────────────────────────────────

// GET /api/v1/customers?page=1&limit=50&area=Godawari
// Returns paginated customer roster with optional area filter
router.get('/', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), getAllCustomers);

// POST /api/v1/customers
// Creates a new customer record (Zod-validated)
router.post('/', authorizeRoles('ADMIN'), createCustomer);

// POST /api/v1/customers/:customerId/reset-pin
// Resets the customer's PIN
router.post('/:customerId/reset-pin', authorizeRoles('ADMIN'), resetCustomerPin);

// GET /api/v1/customers/:customerId
// Returns full customer profile with itemized transaction history
router.get('/:customerId', authorizeRoles('ADMIN', 'STAFF', 'DRIVER', 'CUSTOMER'), getCustomerProfile);

module.exports = router;
