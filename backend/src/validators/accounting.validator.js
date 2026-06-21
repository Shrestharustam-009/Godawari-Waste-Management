// ============================================================================
// ACCOUNTING VALIDATORS — Security-Hardened
// ============================================================================

const { z } = require('zod');
const { Decimal } = require('decimal.js');

const sanitizeText = (val) => {
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/('|--|;\/\*|\*\/|xp_|exec\s|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set)/gi, '')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(100).transform(sanitizeText),
  description: z.string().max(255).transform(sanitizeText).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'VEHICLE_EXPENSE']),
}).strict();

const logManualIncomeSchema = z.object({
  amount: z
    .string({ required_error: 'Amount is required.' })
    .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Amount must be a decimal string (e.g., "500.00").')
    .refine(
      (val) => { try { const d = new Decimal(val); return d.gt(0) && d.lte(99999999.99); } catch { return false; } },
      { message: 'Amount must be between 0.01 and 99,999,999.99.' }
    ),
  categoryId: z.number().int().positive('Invalid category ID'),
  subCategory: z.string().max(100).transform(sanitizeText).optional(),
  date: z.string().datetime({ message: 'Invalid date format. Must be ISO 8601' }),
  notes: z.string().transform(sanitizeText).optional(),
  customerId: z.string().max(30).regex(/^[A-Za-z0-9-]+$/, 'Invalid customer ID format.').optional(),
  includesVat: z.boolean(),
  vatRate: z.number().min(0).max(100),
}).strict();

const logExpenseSchema = z.object({
  amount: z
    .string({ required_error: 'Amount is required.' })
    .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Amount must be a decimal string (e.g., "1500.00").')
    .refine(
      (val) => { try { const d = new Decimal(val); return d.gt(0) && d.lte(99999999.99); } catch { return false; } },
      { message: 'Amount must be between 0.01 and 99,999,999.99.' }
    ),
  categoryId: z.number().int().positive('Invalid category ID'),
  subCategory: z.string().min(1, 'SubCategory is required').max(100).transform(sanitizeText),
  date: z.string().datetime({ message: 'Invalid date format. Must be ISO 8601' }),
  notes: z.string().min(1, 'Notes are required for expense logging').transform(sanitizeText),
  includesInputVat: z.boolean(),
  vatRate: z.number().min(0).max(100),
  tdsRate: z.enum(['0', '1', '1.5', '10']),
}).strict();

const getFinancialStatementsSchema = z.object({
  startDate: z.string().datetime({ message: 'Invalid start date format.' }),
  endDate: z.string().datetime({ message: 'Invalid end date format.' }),
}).strict();

module.exports = {
  createCategorySchema,
  logManualIncomeSchema,
  logExpenseSchema,
  getFinancialStatementsSchema,
};
