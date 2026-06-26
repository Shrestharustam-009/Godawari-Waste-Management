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
  resetCustomerPassword,
  updateCustomer,
  getLatestDriverLocations
} = require('../controllers/customer.controller');

// ── RBAC is now applied per-route to allow field staff to search ──
// router.use(authorizeRoles('ADMIN'));

// ────────────────────────────────────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ────────────────────────────────────────────────────────────────────────────

// GET /api/v1/customers/latest-locations
// Returns live driver coordinates for the customer map (strictly hides staff)
router.get('/latest-locations', authorizeRoles('CUSTOMER', 'ADMIN'), getLatestDriverLocations);

// GET /api/v1/customers?page=1&limit=50&area=Godawari
// Returns paginated customer roster with optional area filter
router.get('/', authorizeRoles('ADMIN', 'STAFF', 'DRIVER'), getAllCustomers);

// POST /api/v1/customers
// Creates a new customer record (Zod-validated)
router.post('/', authorizeRoles('ADMIN'), createCustomer);

// POST /api/v1/customers/:customerId/reset-password
// Resets the customer's password
router.post('/:customerId/reset-password', authorizeRoles('ADMIN'), resetCustomerPassword);

// PUT /api/v1/customers/:customerId
// Updates the customer's details and monthly fee
router.put('/:customerId', authorizeRoles('ADMIN'), updateCustomer);

// GET /api/v1/customers/:customerId
// Returns full customer profile with itemized transaction history
router.get('/:customerId', authorizeRoles('ADMIN', 'STAFF', 'DRIVER', 'CUSTOMER'), getCustomerProfile);

module.exports = router;
