// ============================================================================
// CSRF PROTECTION — Origin-Based Validation Middleware
// ============================================================================
// Validates the Origin (or Referer) header on state-changing requests
// (POST, PUT, PATCH, DELETE) to ensure requests originate from allowed origins.
//
// This works in tandem with:
//   • SameSite=Strict cookies (prevents cross-origin cookie sending in prod)
//   • CORS (prevents cross-origin JS from reading responses)
//   • HttpOnly cookies (prevents JS from reading tokens)
//
// Skips safe methods (GET, HEAD, OPTIONS) as they should be side-effect-free.
// ============================================================================

/**
 * Creates a CSRF protection middleware that validates Origin/Referer headers
 * for state-changing HTTP methods.
 *
 * @param {Object} options
 * @param {string[]} options.allowedOrigins — List of trusted origins
 * @returns {Function} Express middleware
 */
function csrfProtection({ allowedOrigins = [] } = {}) {
  // Pre-filter falsy values (e.g., undefined CORS_ORIGIN env var)
  const trustedOrigins = new Set(allowedOrigins.filter(Boolean));

  return (req, res, next) => {
    // Safe methods don't change state — skip validation
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Extract origin from the Origin header, or fall back to Referer
    const origin = req.get('origin');
    const referer = req.get('referer');
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);

    // If no origin header is present, this is likely a same-origin request
    // from a non-browser client (e.g., curl, Postman, server-to-server).
    // Browser-initiated cross-origin requests ALWAYS include an Origin header.
    if (!requestOrigin) {
      return next();
    }

    // Validate that the request origin is in the trusted list
    if (trustedOrigins.has(requestOrigin)) {
      return next();
    }

    // Block the request — origin is not trusted
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: origin not allowed.',
    });
  };
}

module.exports = { csrfProtection };
