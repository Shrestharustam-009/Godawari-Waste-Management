// ============================================================================
// AXIOS INSTANCE — Customer App
// ============================================================================
// SECURITY: withCredentials: true is MANDATORY.
// The backend issues JWTs exclusively via HttpOnly, Secure, SameSite cookies.
// Tokens are NEVER stored in localStorage or sessionStorage.
// ============================================================================

import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
