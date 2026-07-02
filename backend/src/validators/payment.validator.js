// ============================================================================
// PAYMENT VALIDATORS — Zod Schemas for Income/Payment Endpoints
// ============================================================================
// Critical defense layer for all monetary input.
//
// KEY DESIGN DECISION: Payment amounts are accepted ONLY as strings, never
// as raw JSON numbers. This prevents JavaScript's floating-point coercion
// from corrupting values before they reach decimal.js.
//
// Example attack vector prevented:
//   { "amount": 500.005 }  ← JSON parser might round to 500.00 or 500.01
//   { "amount": "500.005" } ← String is preserved, regex rejects 3 decimals
// ============================================================================

const { z } = require('zod');
const { Decimal } = require('decimal.js');
const { sanitizeText } = require('../utils/sanitize');

// ────────────────────────────────────────────────────────────────────────────
// Log Payment (Field Collection) — POST /api/v1/income/collect
// ────────────────────────────────────────────────────────────────────────────

const collectPaymentSchema = z.object({
  customerId: z
    .string({ required_error: 'Customer ID is required.' })
    .trim()
    .min(1, 'Customer ID cannot be empty.')
    .max(30, 'Customer ID must not exceed 30 characters.')
    // Only allow alphanumeric + hyphens (e.g., "GDW-0001")
    .regex(
      /^[A-Za-z0-9-]+$/,
      'Customer ID may only contain letters, numbers, and hyphens.'
    ),

  amount: z
    .string({ required_error: 'Payment amount is required.' })
    // Accept ONLY string amounts — never raw numbers
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Amount must be a string in decimal format (e.g., "500.00"). Max 8 integer digits, 2 decimal places.'
    )
    .refine(
      (val) => {
        try {
          const d = new Decimal(val);
          // Minimum 1 paisa (0.01), maximum ~1 crore
          return d.gte('0.01') && d.lte('99999999.99');
        } catch {
          return false;
        }
      },
      { message: 'Amount must be between ₹0.01 and ₹99,999,999.99.' }
    ),

  paymentMethod: z
    .enum(['CASH', 'DIGITAL_GATEWAY'], {
      errorMap: () => ({ message: 'Payment method must be CASH or DIGITAL_GATEWAY.' }),
    }),

  incomeCategoryId: z
    .number({ required_error: 'Income category ID is required.' })
    .int('Category ID must be an integer.')
    .positive('Category ID must be a positive integer.'),

  idempotencyKey: z
    .string()
    .trim()
    .max(128, 'Idempotency key must not exceed 128 characters.')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Idempotency key may only contain letters, numbers, hyphens, and underscores.'
    )
    .optional(),

  referenceId: z
    .string()
    .trim()
    .max(128, 'Reference ID must not exceed 128 characters.')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Reference ID may only contain letters, numbers, hyphens, and underscores.'
    )
    .optional(),

  isAdvancePayment: z
    .boolean()
    .default(false),

  note: z
    .string()
    .trim()
    .max(1000, 'Note must not exceed 1,000 characters.')
    .transform(sanitizeText)
    .optional(),

  paymentForStartDate: z.preprocess((arg) => (arg === '' || arg === null ? undefined : arg), z.coerce.date().optional()),
  paymentForEndDate: z.preprocess((arg) => (arg === '' || arg === null ? undefined : arg), z.coerce.date().optional()),

  bonusFee: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Bonus amount must be a string in decimal format.'
    )
    .optional(),

  bonusRemark: z
    .string()
    .trim()
    .max(500, 'Bonus remark must not exceed 500 characters.')
    .transform(sanitizeText)
    .optional(),
}).strict();

// ────────────────────────────────────────────────────────────────────────────
// Manual Income Entry — POST /api/v1/income/manual
// ────────────────────────────────────────────────────────────────────────────

const manualIncomeSchema = z.object({
  customerId: z
    .string({ required_error: 'Customer ID is required.' })
    .trim()
    .min(1, 'Customer ID cannot be empty.')
    .max(30, 'Customer ID must not exceed 30 characters.')
    .regex(/^[A-Za-z0-9-]+$/, 'Customer ID may only contain letters, numbers, and hyphens.'),

  date: z
    .string({ required_error: 'Transaction date is required.' })
    .datetime({ message: 'Date must be a valid ISO 8601 datetime string.' }),

  amount: z
    .string({ required_error: 'Amount is required.' })
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Amount must be a string in decimal format (e.g., "500.00").'
    )
    .refine(
      (val) => {
        try {
          const d = new Decimal(val);
          return d.gte('0.01') && d.lte('99999999.99');
        } catch {
          return false;
        }
      },
      { message: 'Amount must be between ₹0.01 and ₹99,999,999.99.' }
    ),

  paymentMethod: z
    .enum(['CASH', 'DIGITAL_GATEWAY'], {
      errorMap: () => ({ message: 'Payment method must be CASH or DIGITAL_GATEWAY.' }),
    }),

  incomeCategoryId: z
    .number({ required_error: 'Income category ID is required.' })
    .int('Category ID must be an integer.')
    .positive('Category ID must be a positive integer.'),

  referenceId: z
    .string()
    .trim()
    .max(128, 'Reference ID must not exceed 128 characters.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Reference ID format is invalid.')
    .optional(),

  note: z
    .string()
    .trim()
    .max(1000, 'Note must not exceed 1,000 characters.')
    .transform(sanitizeText)
    .optional(),
}).strict();

module.exports = {
  collectPaymentSchema,
  manualIncomeSchema,
};
