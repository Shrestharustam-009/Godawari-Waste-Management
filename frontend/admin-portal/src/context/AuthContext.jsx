import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Backend should ideally have a /auth/me endpoint.
        // If it doesn't, we assume no session on hard reload and force login,
        // or check localStorage for a user object (but rely on HttpOnly cookie for auth).
        const storedUser = localStorage.getItem('gwms_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Session restore failed');
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
        // The HttpOnly cookie is automatically set by the browser.
        // We just store the non-sensitive UI user data.
        const userData = response.data.data.user;
        const refreshToken = response.data.data.refreshToken;
        setUser(userData);
        localStorage.setItem('gwms_user', JSON.stringify(userData));
        localStorage.setItem('gwms_refresh_token', refreshToken);
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
      localStorage.removeItem('gwms_user');
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
