// ============================================================================
// PAYMENT ROUTES — /api/v1/payments
// ============================================================================
// All routes require authentication (checkAuth applied at server.js mount).
// Zod validation runs BEFORE controller logic via validate() middleware.
// ============================================================================

const express = require('express');
const router = express.Router();

// ── Middleware ──
const { validate } = require('../middleware/validate');
const { authorizeRoles, staffOnly } = require('../middleware/checkAuth');

// ── Validators ──
const {
  collectPaymentSchema,
  manualIncomeSchema,
} = require('../validators/payment.validator');

// ── Controller ──
const paymentController = require('../controllers/payment.controller');

// ────────────────────────────────────────────────────────────────────────────
// FIELD COLLECTION — POST /api/v1/payments/collect
// ────────────────────────────────────────────────────────────────────────────
// Who: ADMIN, STAFF, DRIVER (field operators)
// What: Records a real-time cash/digital payment collected from a customer
// Validation: collectPaymentSchema (Zod) → strips XSS, enforces string amounts

router.post(
  '/collect',
  staffOnly,
  validate(collectPaymentSchema),
  paymentController.collectPayment
);

// ────────────────────────────────────────────────────────────────────────────
// MANUAL ENTRY — POST /api/v1/payments/manual
// ────────────────────────────────────────────────────────────────────────────
// Who: ADMIN, STAFF only (back-office operators)
// What: Records a manually entered income (can be backdated)
// Validation: manualIncomeSchema (Zod)

router.post(
  '/manual',
  staffOnly,
  authorizeRoles('ADMIN', 'STAFF'),
  validate(manualIncomeSchema),
  paymentController.recordManualIncome
);

// ────────────────────────────────────────────────────────────────────────────
// GET BALANCE — GET /api/v1/payments/balance/:customerId
// ────────────────────────────────────────────────────────────────────────────
// Who: Any authenticated internal user
// What: Returns outstanding + advance balance for a customer

router.get(
  '/balance/:customerId',
  staffOnly,
  paymentController.getBalance
);

module.exports = router;
