import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data.data) {
        setUser(res.data.data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const res = await api.post('/auth/staff/login', { username, password });
      if (res.data?.success) {
        setUser(res.data.data.user);
        setIsAuthenticated(true);
        // SECURITY: Refresh token is set as HttpOnly cookie by the server.
        // No localStorage storage needed.
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Invalid username or password.' 
      };
    }
  };

  const logout = async () => {
    try {
      // Server reads refresh token from HttpOnly cookie
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // SECURITY: No localStorage cleanup for tokens
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};
