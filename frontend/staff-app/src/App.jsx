import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackingProvider } from './context/TrackingContext'; 
import MobileLayout from './components/MobileLayout';
import Login from './pages/Login';
import Search from './pages/Search';
import Collection from './pages/Collection';
import Recent from './pages/Recent';
import Profile from './pages/Profile';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* 🧠 Placed here so tracking stays completely alive across all pages and layouts */}
        <TrackingProvider> 
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><MobileLayout /></ProtectedRoute>}>
              <Route index element={<Search />} />
              <Route path="collection/:customerId" element={<Collection />} />
              <Route path="recent" element={<Recent />} />
              <Route path="profile" element={<Profile />} /> 
            </Route>
          </Routes>
        </TrackingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}