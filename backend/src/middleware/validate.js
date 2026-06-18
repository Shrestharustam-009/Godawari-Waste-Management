// ============================================================================
// VALIDATION MIDDLEWARE — Zod Schema Enforcement Layer
// ============================================================================
// This middleware factory wraps any Zod schema and enforces it against
// the request body (or params/query) BEFORE the controller runs.
//
// If validation fails, the request is immediately rejected with a clean
// 400 response listing every field-level error — no controller code executes.
// ============================================================================

const { ZodError } = require('zod');

/**
 * Creates an Express middleware that validates req[source] against a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema — The Zod schema to validate against
 * @param {'body'|'query'|'params'} [source='body'] — Which part of the request to validate
 * @returns {Function} Express middleware
 *
 * @example
 *   const { createExpenseSchema } = require('../validators/expense.validator');
 *   router.post('/expenses', validate(createExpenseSchema), controller.create);
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      // .parse() throws ZodError on failure, returns cleaned data on success
      const parsed = schema.parse(req[source]);

      // IMPORTANT: Replace req[source] with the parsed+sanitized output.
      // This ensures downstream code only sees validated, typed data.
      req[source] = parsed;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Map Zod issues into a clean, frontend-friendly error response
        const fieldErrors = err.errors.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
          ...(issue.expected && { expected: issue.expected }),
          ...(issue.received && { received: issue.received }),
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed. Check the errors array for details.',
          code: 'VALIDATION_ERROR',
          errors: fieldErrors,
        });
      }

      // Unexpected error — pass to global error handler
      next(err);
    }
  };
}

module.exports = { validate };
