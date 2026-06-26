import axios from 'axios';

// ============================================================================
// AXIOS INSTANCE — Staff App (Security-Hardened)
// ============================================================================

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, shouldRetry = true) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (shouldRetry) resolve();
    else reject(error);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null, true);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, false);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // If the backend explicitly revoked the session (deactivated, disabled, or invalid token)
    if (
      error.response?.status === 401 &&
      ['ACCOUNT_DEACTIVATED', 'LOGIN_DISABLED', 'TOKEN_INVALID', 'ORPHANED_TOKEN'].includes(error.response?.data?.code)
    ) {
      window.location.href = '/login?error=' + error.response.data.code;
    }

    return Promise.reject(error);
  }
);

export default api;
