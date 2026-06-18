// ============================================================================
// HR VALIDATORS — Zod Schemas for Staff & Driver Management
// ============================================================================
// Validates all HR payloads with sanitization against XSS, SQLi,
// and null-byte injection. Follows the same pattern as customer.validator.js.
// ============================================================================

const { z } = require('zod');

// ── Reusable text sanitizer ──
const sanitizeText = (val) => {
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/('|--|;|\/\*|\*\/|xp_|exec\s|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set)/gi, '')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// ────────────────────────────────────────────────────────────────────────────
// CREATE COLLECTOR — POST /api/v1/hr/collectors
// ────────────────────────────────────────────────────────────────────────────

const createCollectorSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(120, 'Name must not exceed 120 characters.')
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

  username: z
    .string({ required_error: 'Username is required.' })
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(60, 'Username must not exceed 60 characters.')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username may only contain letters, numbers, dots, underscores, and hyphens.'
    ),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must not exceed 128 characters.'),

  assignedArea: z
    .string({ required_error: 'Assigned area is required.' })
    .trim()
    .min(2, 'Area must be at least 2 characters.')
    .max(100, 'Area must not exceed 100 characters.')
    .transform(sanitizeText),
}).strict();

// ────────────────────────────────────────────────────────────────────────────
// CREATE DRIVER — POST /api/v1/hr/drivers
// ────────────────────────────────────────────────────────────────────────────

const createDriverSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(120, 'Name must not exceed 120 characters.')
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

  username: z
    .string({ required_error: 'Username is required.' })
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(60, 'Username must not exceed 60 characters.')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username may only contain letters, numbers, dots, underscores, and hyphens.'
    ),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must not exceed 128 characters.'),

  vehicleId: z
    .number({ required_error: 'Vehicle ID is required.' })
    .int('Vehicle ID must be an integer.')
    .positive('Vehicle ID must be a positive integer.'),
}).strict();

module.exports = {
  createCollectorSchema,
  createDriverSchema,
};
