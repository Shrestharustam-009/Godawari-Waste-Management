// ============================================================================
// CUSTOMER VALIDATORS — Zod Schemas for Customer Management Endpoints
// ============================================================================
// Sanitizes all text inputs against XSS, SQLi, and null-byte injection.
// Financial fields (outstandingPayment) are accepted ONLY as strings to
// prevent JavaScript float coercion before they reach Decimal.js.
// ============================================================================

const { z } = require('zod');
const { Decimal } = require('decimal.js');
const { sanitizeText } = require('../utils/sanitize');

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
    .string()
    .trim()
    .regex(
      /^[0-9+\-() ]*$/,
      'Phone number may only contain digits, +, -, (, ), and spaces.'
    )
    .transform(val => val === '' ? null : val)
    .optional()
    .nullable(),

  password: z
    .string({ required_error: 'A password is required.' })
    .min(5, 'Password must be greater than 4 characters.'),

  assignedArea: z
    .string({ required_error: 'Assigned area is required.' })
    .trim()
    .min(2, 'Area must be at least 2 characters.')
    .max(100, 'Area must not exceed 100 characters.')
    .transform(sanitizeText),

  monthlyFee: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Monthly fee must be a string in decimal format (e.g., "500.00").'
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
      { message: 'Monthly fee must be between ₹0.00 and ₹99,999,999.99.' }
    )
    .optional()
    .default('500.00'),

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

  billingCycleDay: z
    .number()
    .int('Billing cycle day must be an integer.')
    .min(1, 'Billing cycle day cannot be less than 1.')
    .max(28, 'Billing cycle day cannot be greater than 28.')
    .nullable()
    .optional(),

  dueStartDate: z.preprocess((arg) => (arg === '' || arg === null ? undefined : arg), z.coerce.date().optional()),
  dueEndDate: z.preprocess((arg) => (arg === '' || arg === null ? undefined : arg), z.coerce.date().optional()),
}).strict();

const updateCustomerSchema = z.object({
  newCustomerId: z
    .string()
    .trim()
    .min(1, 'Customer ID cannot be empty.')
    .max(30, 'Customer ID must not exceed 30 characters.')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'Customer ID may only contain letters, numbers, and hyphens (e.g., "GDW-0001").'
    )
    .optional(),

  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(150, 'Name must not exceed 150 characters.')
    .transform(sanitizeText)
    .optional(),

  phone: z
    .string()
    .trim()
    .regex(
      /^[0-9+\-() ]*$/,
      'Phone number may only contain digits, +, -, (, ), and spaces.'
    )
    .transform(val => val === '' ? null : val)
    .optional()
    .nullable(),

  sudoPassword: z
    .string({ required_error: 'Admin password is required to save changes.' })
    .min(1, 'Admin password cannot be empty.'),

  assignedArea: z
    .string()
    .trim()
    .min(2, 'Area must be at least 2 characters.')
    .max(100, 'Area must not exceed 100 characters.')
    .transform(sanitizeText)
    .optional(),

  monthlyFee: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Monthly fee must be a string in decimal format (e.g., "500.00").'
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
      { message: 'Monthly fee must be between ₹0.00 and ₹99,999,999.99.' }
    )
    .optional(),
    
  billingCycleDay: z
    .number()
    .int('Billing cycle day must be an integer.')
    .min(1, 'Billing cycle day cannot be less than 1.')
    .max(28, 'Billing cycle day cannot be greater than 28.')
    .nullable()
    .optional(),

  outstandingPayment: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Starting debt must be a string in decimal format (e.g., "500.00").'
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
      { message: 'Starting debt must be between ₹0.00 and ₹99,999,999.99.' }
    )
    .optional(),
    
  dueStartDate: z.preprocess((arg) => (arg === '' ? null : arg), z.coerce.date().nullable().optional()),
  dueEndDate: z.preprocess((arg) => (arg === '' ? null : arg), z.coerce.date().nullable().optional()),

  isActive: z.boolean().optional(),
}).strict();

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
};
