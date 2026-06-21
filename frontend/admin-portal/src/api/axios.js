import axios from 'axios';

// ============================================================================
// CENTRALIZED AXIOS INSTANCE — Security-Hardened
// ============================================================================
// - withCredentials: true ensures HttpOnly cookies are sent
// - 401 interceptor auto-refreshes expired access tokens
// - Refresh queue prevents parallel refresh storms
// ============================================================================

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ── Token refresh state (prevents parallel refresh storms) ──
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, shouldRetry = true) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (shouldRetry) {
      resolve();
    } else {
      reject(error);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401 errors, and not on auth endpoints (prevent infinite loops)
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in HttpOnly cookie — server reads it automatically
        await api.post('/auth/refresh');
        processQueue(null, true);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, false);
        // Refresh failed — force re-login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
