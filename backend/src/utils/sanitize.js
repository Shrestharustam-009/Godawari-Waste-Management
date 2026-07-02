// ============================================================================
// SANITIZE — Centralized Text Sanitization Utility
// ============================================================================
// Loop-based sanitizer that replaces patterns until the string stabilizes.
// This prevents "incomplete multi-character sanitization" attacks where
// nested payloads like <scr<script>ipt> survive a single-pass replace.
// ============================================================================

/**
 * Repeatedly applies a regex replacement until the string no longer changes.
 * This neutralizes nested/overlapping attack payloads that single-pass
 * .replace() would miss.
 *
 * @param {string} str   — The input string to sanitize
 * @param {RegExp} pattern — The regex pattern to match (must have 'g' flag)
 * @param {string} replacement — The replacement string (usually '')
 * @returns {string} The fully sanitized string
 */
function replaceUntilStable(str, pattern, replacement) {
  let prev;
  do {
    prev = str;
    str = str.replace(pattern, replacement);
  } while (str !== prev);
  return str;
}

/**
 * Sanitizes freeform text input against XSS, SQL injection, and null-byte attacks.
 * Uses loop-based replacement to prevent bypass via nested payloads.
 *
 * @param {string} val — The raw user input string
 * @returns {string} The sanitized string
 */
function sanitizeText(val) {
  return replaceUntilStable(
    replaceUntilStable(
      val,
      /<[^>]*>/g,
      ''
    ),
    /('|--|;|\/\*|\*\/|xp_|exec\s|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set)/gi,
    ''
  )
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { sanitizeText };
