// ============================================================================
// AUDIT LOGGING UTILITY
// ============================================================================
// Centralized append-only audit log writer.
// Imported by controllers to record security and business events.
// Failures are caught silently — audit logs must NEVER crash main flows.
// ============================================================================

const prisma = require('../lib/prisma');

/**
 * Writes an append-only audit log entry to the database.
 *
 * @param {Object} params
 * @param {string} params.action       — e.g., 'STAFF_LOGIN', 'CUSTOMER_LOGIN', 'PAYMENT_COLLECTED'
 * @param {string} params.entityType   — e.g., 'User', 'Customer', 'IncomeLedger'
 * @param {string} params.entityId     — Primary key of the affected entity
 * @param {number|null} params.performedById — User ID who triggered the action (null for customer actions)
 * @param {Object|null} params.details — JSON payload (before/after diff, metadata)
 * @param {string|null} params.ipAddress
 * @param {string|null} params.userAgent
 */
async function writeAuditLog({
  action,
  entityType,
  entityId,
  performedById = null,
  details = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId: String(entityId),
        performedById,
        details,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Audit log failures must NEVER propagate to the caller
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

module.exports = { writeAuditLog };
