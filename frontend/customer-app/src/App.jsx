import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import api from './api/axios';
import MasterLogin from './pages/MasterLogin';
import Dashboard from './pages/Dashboard';
import Tracking from './pages/Tracking';

// ============================================================================
// AUTH CONTEXT — Session state derived from HttpOnly cookie (Security-Hardened)
// ============================================================================

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data.data?.type === 'customer') {
        setCustomer(res.data.data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setCustomer(null);
      }
    } catch {
      setIsAuthenticated(false);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (customerId, password) => {
    const res = await api.post('/auth/customer/login', { customerId, password });
    if (res.data?.success) {
      setCustomer(res.data.data.customer);
      setIsAuthenticated(true);
      // SECURITY: Refresh token is set as HttpOnly cookie by the server.
      // No localStorage storage needed.
      return { success: true };
    }
    return { success: false, error: 'Login failed.' };
  };

  const logout = async () => {
    try {
      // Server reads refresh token from HttpOnly cookie
      await api.post('/auth/logout');
    } catch {
      // Logout should always succeed from the user's perspective
    } finally {
      // SECURITY: No localStorage cleanup needed
      setIsAuthenticated(false);
      setCustomer(null);
    }
  };

  return (
    <AuthContext.Provider value={{ customer, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// PROTECTED ROUTE GUARD
// ============================================================================

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// ============================================================================
// APP ROOT
// ============================================================================

export default function App() {
  return (
    <AuthProvider>
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative">
        <Routes>
          <Route path="/" element={<MasterLogin />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tracking"
            element={
              <ProtectedRoute>
                <Tracking />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
