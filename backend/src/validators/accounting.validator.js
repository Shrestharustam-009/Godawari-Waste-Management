const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters").max(100),
  description: z.string().max(255).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'VEHICLE_EXPENSE'])
});

const logManualIncomeSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  categoryId: z.number().int().positive("Invalid category ID"),
  subCategory: z.string().max(100).optional(),
  date: z.string().datetime({ message: "Invalid date format. Must be ISO 8601" }),
  notes: z.string().optional(),
  // Manual income may optionally link to a customer. If not provided, the controller handles it.
  customerId: z.string().max(30).optional(),
  includesVat: z.boolean(),
  vatRate: z.number().min(0).max(100)
});

const logExpenseSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  categoryId: z.number().int().positive("Invalid category ID"),
  subCategory: z.string().min(1, "SubCategory is required").max(100),
  date: z.string().datetime({ message: "Invalid date format. Must be ISO 8601" }),
  notes: z.string().min(1, "Notes are required for expense logging"),
  includesInputVat: z.boolean(),
  vatRate: z.number().min(0).max(100),
  tdsRate: z.enum(['0', '1', '1.5', '10'])
});

const getFinancialStatementsSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid start date format." }),
  endDate: z.string().datetime({ message: "Invalid end date format." })
});

module.exports = {
  createCategorySchema,
  logManualIncomeSchema,
  logExpenseSchema,
  getFinancialStatementsSchema
};
