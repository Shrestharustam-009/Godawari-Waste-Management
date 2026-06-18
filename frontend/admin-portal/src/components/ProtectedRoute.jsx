import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * 
 * Intercepts requests to internal routes. If the user context is missing,
 * immediately routes them back to the /login page. If authenticated, renders
 * the child routes via <Outlet />.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  // If not authenticated, redirect to login and replace history so they 
  // can't hit "Back" to return to the protected route placeholder.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render the nested routes (AdminLayout)
  return <Outlet />;
}
