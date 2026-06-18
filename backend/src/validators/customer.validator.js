// ============================================================================
// CUSTOMER VALIDATORS — Zod Schemas for Customer Management Endpoints
// ============================================================================
// Sanitizes all text inputs against XSS, SQLi, and null-byte injection.
// Financial fields (outstandingPayment) are accepted ONLY as strings to
// prevent JavaScript float coercion before they reach Decimal.js.
// ============================================================================

const { z } = require('zod');
const { Decimal } = require('decimal.js');

// ── Reusable text sanitizer (mirrors payment.validator.js) ──
const sanitizeText = (val) => {
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/('|--|;|\/\*|\*\/|xp_|exec\s|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set)/gi, '')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// ────────────────────────────────────────────────────────────────────────────
// CREATE CUSTOMER — POST /api/v1/customers
// ────────────────────────────────────────────────────────────────────────────

const createCustomerSchema = z.object({
  customerId: z
    .string({ required_error: 'Customer ID is required.' })
    .trim()
    .min(1, 'Customer ID cannot be empty.')
    .max(30, 'Customer ID must not exceed 30 characters.')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'Customer ID may only contain letters, numbers, and hyphens (e.g., "GDW-0001").'
    ),

  name: z
    .string({ required_error: 'Customer name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(150, 'Name must not exceed 150 characters.')
    .transform(sanitizeText),

  phone: z
    .string({ required_error: 'Phone number is required.' })
    .trim()
    .min(7, 'Phone number must be at least 7 digits.')
    .max(15, 'Phone number must not exceed 15 characters.')
    .regex(
      /^[0-9+\-() ]+$/,
      'Phone number may only contain digits, +, -, (, ), and spaces.'
    ),

  pin: z
    .string({ required_error: 'A 4-digit PIN is required.' })
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),

  assignedArea: z
    .string({ required_error: 'Assigned area is required.' })
    .trim()
    .min(2, 'Area must be at least 2 characters.')
    .max(100, 'Area must not exceed 100 characters.')
    .transform(sanitizeText),

  outstandingPayment: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Outstanding payment must be a string in decimal format (e.g., "500.00").'
    )
    .refine(
      (val) => {
        try {
          const d = new Decimal(val);
          return d.gte('0.00') && d.lte('99999999.99');
        } catch {
          return false;
        }
      },
      { message: 'Outstanding payment must be between ₹0.00 and ₹99,999,999.99.' }
    )
    .optional()
    .default('0.00'),
}).strict();

module.exports = {
  createCustomerSchema,
};
