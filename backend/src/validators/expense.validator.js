// ============================================================================
// EXPENSE VALIDATORS — Zod Schemas for Expense Ledger Endpoints
// ============================================================================
// Rigorous input sanitization to prevent:
//   ✓ XSS via malicious script tags in text notes
//   ✓ SQL injection vectors hidden in string fields
//   ✓ Negative/zero/malformed amounts
//   ✓ Type coercion attacks (strings where numbers expected)
// ============================================================================

const { z } = require('zod');
const { Decimal } = require('decimal.js');
const { sanitizeText } = require('../utils/sanitize');

// ────────────────────────────────────────────────────────────────────────────
// Create Expense — POST /api/v1/expenses
// ────────────────────────────────────────────────────────────────────────────

const createExpenseSchema = z.object({
  date: z
    .string({ required_error: 'Expense date is required.' })
    .datetime({ message: 'Date must be a valid ISO 8601 datetime string.' }),

  amount: z
    .string({ required_error: 'Amount is required.' })
    // Enforce valid decimal format: 1-8 digits, optional 1-2 decimal places
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Amount must be a valid decimal number (e.g., "1500.00"). Max 8 integer digits, max 2 decimal places.'
    )
    // Verify it's a positive, non-zero amount using decimal.js
    .refine(
      (val) => {
        try {
          const d = new Decimal(val);
          return d.gt(0) && d.lte(99999999.99);
        } catch {
          return false;
        }
      },
      { message: 'Amount must be a positive number between 0.01 and 99,999,999.99.' }
    ),

  expenseCategoryId: z
    .number({ required_error: 'Expense category ID is required.' })
    .int('Category ID must be an integer.')
    .positive('Category ID must be a positive integer.'),

  subCategory: z
    .string({ required_error: 'Sub-category is required.' })
    .trim()
    .min(2, 'Sub-category must be at least 2 characters.')
    .max(100, 'Sub-category must not exceed 100 characters.')
    .transform(sanitizeText),

  note: z
    .string({ required_error: 'Note is required.' })
    .trim()
    .min(3, 'Note must be at least 3 characters.')
    .max(2000, 'Note must not exceed 2,000 characters.')
    .transform(sanitizeText),

  vehicleId: z
    .number()
    .int('Vehicle ID must be an integer.')
    .positive('Vehicle ID must be a positive integer.')
    .nullish(), // Allows null or undefined
}).strict();

// ────────────────────────────────────────────────────────────────────────────
// Update Expense — PUT /api/v1/expenses/:id
// ────────────────────────────────────────────────────────────────────────────

const updateExpenseSchema = z.object({
  date: z
    .string()
    .datetime({ message: 'Date must be a valid ISO 8601 datetime string.' })
    .optional(),

  amount: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Amount must be a valid decimal number (e.g., "1500.00").'
    )
    .refine(
      (val) => {
        try {
          const d = new Decimal(val);
          return d.gt(0) && d.lte(99999999.99);
        } catch {
          return false;
        }
      },
      { message: 'Amount must be a positive number between 0.01 and 99,999,999.99.' }
    )
    .optional(),

  expenseCategoryId: z
    .number()
    .int('Category ID must be an integer.')
    .positive('Category ID must be a positive integer.')
    .optional(),

  subCategory: z
    .string()
    .trim()
    .min(2, 'Sub-category must be at least 2 characters.')
    .max(100, 'Sub-category must not exceed 100 characters.')
    .transform(sanitizeText)
    .optional(),

  note: z
    .string()
    .trim()
    .min(3, 'Note must be at least 3 characters.')
    .max(2000, 'Note must not exceed 2,000 characters.')
    .transform(sanitizeText)
    .optional(),

  vehicleId: z
    .number()
    .int('Vehicle ID must be an integer.')
    .positive('Vehicle ID must be a positive integer.')
    .nullish(),
}).strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update.' }
  );

module.exports = {
  createExpenseSchema,
  updateExpenseSchema,
};
