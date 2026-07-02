// ============================================================================
// PAYMENT CONTROLLER — HTTP Layer for Financial Collection
// ============================================================================
// This controller is a thin HTTP adapter. It:
//   1. Extracts validated data from req.body (already cleaned by Zod)
//   2. Delegates ALL business logic to paymentService.js
//   3. Formats the service response into a clean JSON envelope
//   4. Writes audit logs for every financial mutation
//
// RULE: Zero business logic lives here. If you're writing Decimal.js math
// or Prisma queries in this file, you're doing it wrong — move it to the service.
// ============================================================================

const paymentService = require('../services/payment.service');
const { writeAuditLog } = require('../utils/audit');

// ────────────────────────────────────────────────────────────────────────────
// 1. COLLECT PAYMENT — POST /api/v1/payments/collect
// ────────────────────────────────────────────────────────────────────────────
// Called by field staff via the mobile app when collecting cash/digital payment.

async function collectPayment(req, res) {
  try {
    const result = await paymentService.processFieldPayment({
      customerId: req.body.customerId,
      amountReceived: req.body.amount,
      isAdvancePayment: req.body.isAdvancePayment || false,
      staffId: req.user.id,
      idempotencyKey: req.body.idempotencyKey,
      paymentMethod: req.body.paymentMethod,
      incomeCategoryId: req.body.incomeCategoryId,
      referenceId: req.body.referenceId || null,
      note: req.body.note || null,
      paymentForStartDate: req.body.paymentForStartDate || null,
      paymentForEndDate: req.body.paymentForEndDate || null,
      bonusFee: req.body.bonusFee || null,
      bonusRemark: req.body.bonusRemark || null,
    });

    // ── Idempotent duplicate — return existing record ──
    if (result.isIdempotent) {
      return res.status(200).json({
        success: true,
        message: 'Duplicate submission detected. Returning existing record.',
        data: {
          incomeId: result.income.id,
          isIdempotent: true,
          vatBreakdown: result.vatBreakdown,
          currentBalance: result.balanceSnapshot,
        },
      });
    }

    // ── Audit log: successful payment collection ──
    await writeAuditLog({
      action: 'PAYMENT_COLLECTED',
      entityType: 'IncomeLedger',
      entityId: result.income.id,
      performedById: req.user.id,
      details: {
        customerId: req.body.customerId,
        route: result.route,
        vatBreakdown: result.vatBreakdown,
        balanceSnapshot: result.balanceSnapshot,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(201).json({
      success: true,
      message: result.route === 'ADVANCE'
        ? 'Payment collected. Excess credited to Smart Wallet.'
        : 'Payment collected successfully.',
      data: {
        incomeId: result.income.id,
        bonusIncomeId: result.bonusIncome?.id || null,
        isIdempotent: false,
        route: result.route,
        vatBreakdown: result.vatBreakdown,
        balanceSnapshot: result.balanceSnapshot,
      },
    });
  } catch (err) {
    return handlePaymentError(err, res);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. MANUAL INCOME — POST /api/v1/payments/manual
// ────────────────────────────────────────────────────────────────────────────
// Back-office manual entry by admin/staff (can be backdated).

async function recordManualIncome(req, res) {
  try {
    const result = await paymentService.processManualIncome({
      customerId: req.body.customerId,
      date: req.body.date,
      amountReceived: req.body.amount,
      isAdvancePayment: req.body.isAdvancePayment || false,
      staffId: req.user.id,
      paymentMethod: req.body.paymentMethod,
      incomeCategoryId: req.body.incomeCategoryId,
      referenceId: req.body.referenceId || null,
      note: req.body.note || null,
    });

    // ── Audit log ──
    await writeAuditLog({
      action: 'MANUAL_INCOME_RECORDED',
      entityType: 'IncomeLedger',
      entityId: result.income.id,
      performedById: req.user.id,
      details: {
        customerId: req.body.customerId,
        date: req.body.date,
        route: result.route,
        vatBreakdown: result.vatBreakdown,
        balanceSnapshot: result.balanceSnapshot,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(201).json({
      success: true,
      message: 'Manual income entry recorded successfully.',
      data: {
        incomeId: result.income.id,
        route: result.route,
        vatBreakdown: result.vatBreakdown,
        balanceSnapshot: result.balanceSnapshot,
      },
    });
  } catch (err) {
    return handlePaymentError(err, res);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. GET BALANCE — GET /api/v1/payments/balance/:customerId
// ────────────────────────────────────────────────────────────────────────────
// Returns the current financial snapshot for a customer.

async function getBalance(req, res) {
  try {
    const balance = await paymentService.getCustomerBalance(req.params.customerId);

    return res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (err) {
    if (err.code === 'CUSTOMER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }

    console.error('[PAYMENT CTRL] Get balance error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer balance.',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER — Maps service-layer error codes to HTTP responses
// ────────────────────────────────────────────────────────────────────────────

function handlePaymentError(err, res) {
  const errorMap = {
    CUSTOMER_NOT_FOUND: 404,
    CUSTOMER_INACTIVE: 403,
    CATEGORY_NOT_FOUND: 400,
    OVERPAYMENT_NOT_ALLOWED: 422,
    VAT_INTEGRITY_ERROR: 500,
  };

  const statusCode = errorMap[err.code] || 500;

  if (statusCode === 500 && !err.code) {
    // Unexpected error — log full stack, return sanitized message
    console.error('[PAYMENT CTRL] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: 'Payment processing failed due to a server error. Please retry.',
      code: 'INTERNAL_ERROR',
    });
  }

  return res.status(statusCode).json({
    success: false,
    error: err.message,
    code: err.code,
    ...(err.details && { details: err.details }),
  });
}

module.exports = {
  collectPayment,
  recordManualIncome,
  getBalance,
};
