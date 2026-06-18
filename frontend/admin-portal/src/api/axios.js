import axios from 'axios';

// ============================================================================
// CENTRALIZED AXIOS INSTANCE
// ============================================================================
// CRITICAL SECURITY REQUIREMENT:
// `withCredentials: true` ensures that the browser attaches the HttpOnly 
// JWT cookies on every request. If this is missing, the backend will reject
// the request with a 401 Unauthorized.
// ============================================================================

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Optionally: Add response interceptor to handle global 401s (e.g. redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server explicitly responds with 401 Unauthorized, we might want
    // to emit an event or clear local state. AuthContext handles its own logic.
    return Promise.reject(error);
  }
);

export default api;
