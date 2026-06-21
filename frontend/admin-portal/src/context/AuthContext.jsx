import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate session on mount via server check (NOT localStorage)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success && res.data.data) {
          setUser(res.data.data);
        }
      } catch (err) {
        // Access token expired or invalid — user will need to re-login
        // The axios interceptor will attempt auto-refresh first
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/staff/login', { username, password });
      
      if (response.data.success) {
        // Both access + refresh tokens are set as HttpOnly cookies by the server.
        // We only store non-sensitive UI display data in React state (NOT localStorage).
        const userData = response.data.data.user;
        setUser(userData);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Network error. Please try again.' 
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setUser(null);
      // SECURITY: No localStorage cleanup needed — tokens are only in HttpOnly cookies
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
