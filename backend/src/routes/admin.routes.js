// ============================================================================
// ADMIN ANALYTICS ROUTES — /api/v1/admin
// ============================================================================
// Strict RBAC protection: Only users with the 'ADMIN' role can access these.
// ============================================================================

const express = require('express');
const router = express.Router();

const { authorizeRoles } = require('../middleware/checkAuth');
const adminController = require('../controllers/admin.controller');

// ── Strict RBAC Middleware applied to ALL routes in this file ──
router.use(authorizeRoles('ADMIN'));

// ────────────────────────────────────────────────────────────────────────────
// DASHBOARD ENDPOINTS
// ────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard/kpis
// Returns Total Income, Total Expenses, Net Profit, and Today's Collection
router.get('/dashboard/kpis', adminController.getDashboardKPIs);

// GET /api/v1/admin/dashboard/live-feed
// Returns the 50 most recent successful transactions
router.get('/dashboard/live-feed', adminController.getLiveOperationsFeed);

// GET /api/v1/admin/staff/:staffId/daily-collection
// Returns the total cash collected today by a specific staff member
router.get('/staff/:staffId/daily-collection', adminController.getStaffDailyCollection);

module.exports = router;
