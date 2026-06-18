// ============================================================================
// IN-MEMORY BLACKLIST — User & Customer Deactivation Interceptor
// ============================================================================
// Two separate Sets track deactivated User IDs (integers) and Customer IDs
// (strings). These are loaded from PostgreSQL at server startup and updated
// in real-time whenever an admin deactivates/reactivates an account.
//
// PERFORMANCE: Set.has() is O(1). Even with 10,000 entries, this check adds
// sub-microsecond latency per request — far faster than a DB lookup.
//
// SCALING NOTE: For multi-instance deployments, replace these Sets with
// Redis pub/sub or a shared cache layer so all processes stay synchronized.
// ============================================================================

const prisma = require('../lib/prisma');

// ── Two separate sets: Users use integer IDs, Customers use string IDs ──
const deactivatedUserIds = new Set();
const deactivatedCustomerIds = new Set();

/**
 * Loads all deactivated Users AND Customers into their respective Sets.
 * Called once at server startup, and again whenever an account status changes.
 */
async function loadBlacklist() {
  try {
    const [inactiveUsers, inactiveCustomers] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: false },
        select: { id: true },
      }),
      prisma.customer.findMany({
        where: { isActive: false },
        select: { customerId: true },
      }),
    ]);

    deactivatedUserIds.clear();
    deactivatedCustomerIds.clear();

    inactiveUsers.forEach((u) => deactivatedUserIds.add(u.id));
    inactiveCustomers.forEach((c) => deactivatedCustomerIds.add(c.customerId));

    console.log(
      `[BLACKLIST] Loaded ${deactivatedUserIds.size} deactivated user(s) ` +
      `and ${deactivatedCustomerIds.size} deactivated customer(s) into memory.`
    );
  } catch (err) {
    console.error('[BLACKLIST] Failed to load blacklist:', err.message);
  }
}

/**
 * Checks if a given principal is blacklisted.
 *
 * @param {string} type — 'user' or 'customer'
 * @param {number|string} id — User ID (int) or Customer ID (string)
 * @returns {boolean}
 */
function isBlacklisted(type, id) {
  if (type === 'user') return deactivatedUserIds.has(id);
  if (type === 'customer') return deactivatedCustomerIds.has(id);
  return false;
}

/**
 * Adds an ID to the blacklist (called when admin deactivates an account).
 *
 * @param {string} type — 'user' or 'customer'
 * @param {number|string} id
 */
function addToBlacklist(type, id) {
  if (type === 'user') deactivatedUserIds.add(id);
  if (type === 'customer') deactivatedCustomerIds.add(id);
}

/**
 * Removes an ID from the blacklist (called when admin reactivates an account).
 *
 * @param {string} type — 'user' or 'customer'
 * @param {number|string} id
 */
function removeFromBlacklist(type, id) {
  if (type === 'user') deactivatedUserIds.delete(id);
  if (type === 'customer') deactivatedCustomerIds.delete(id);
}

module.exports = {
  loadBlacklist,
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  // Expose sets for testing/debugging only
  _deactivatedUserIds: deactivatedUserIds,
  _deactivatedCustomerIds: deactivatedCustomerIds,
};
