// ============================================================================
// SYSTEM SETTINGS VALIDATORS — Zod Schemas for Global Configuration
// ============================================================================
// Validates the sudo-protected updateSettings payload. The sudoPassword
// field is required for re-authentication before any system mutation.
// ============================================================================

const { z } = require('zod');
const { Decimal } = require('decimal.js');

const updateSettingsSchema = z.object({
  sudoPassword: z
    .string({ required_error: 'Sudo password is required to modify system settings.' })
    .min(1, 'Sudo password cannot be empty.'),

  monthlyFeeAmount: z
    .string({ required_error: 'Monthly fee amount is required.' })
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Monthly fee must be a decimal string (e.g., "500.00").'
    )
    .refine(
      (val) => {
        try {
          const d = new Decimal(val);
          return d.gt('0') && d.lte('99999999.99');
        } catch {
          return false;
        }
      },
      { message: 'Monthly fee must be between ₹0.01 and ₹99,999,999.99.' }
    ),

  billingCycleDay: z
    .number({ required_error: 'Billing cycle day is required.' })
    .int('Billing cycle day must be an integer.')
    .min(1, 'Billing cycle day cannot be less than 1.')
    .max(28, 'Billing cycle day cannot be greater than 28.'),

  calendarType: z
    .enum(['AD', 'BS'], { invalid_type_error: 'Calendar type must be AD or BS.' })
    .optional(),
}).strict();

module.exports = {
  updateSettingsSchema,
};
