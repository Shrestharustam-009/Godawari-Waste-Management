import React, { useState } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Users, 
  UserCircle, 
  Truck, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function MasterLogin() {
  const [role, setRole] = useState('ADMIN');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const roles = [
    { id: 'ADMIN', label: 'Admin', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { id: 'STAFF', label: 'Field Staff', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'CUSTOMER', label: 'Customer', icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'DRIVER', label: 'Driver', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let endpoint = '';
      let payload = {};

      // 1. DYNAMIC ENDPOINT ROUTING & 2. STRICT PAYLOAD SHAPING
      // We verified the backend routes: The auth.controller.js and auth.validator.js 
      // strictly expose /api/v1/auth/staff/login (handling Admin, Staff, Driver) 
      // and /api/v1/auth/customer/login.
      switch (role) {
        case 'ADMIN':
        case 'STAFF':
        case 'DRIVER':
          endpoint = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1/auth/staff/login';
          payload = { username: identifier, password: password };
          break;
        case 'CUSTOMER':
          endpoint = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/v1/auth/customer/login';
          payload = { customerId: identifier, password };
          break;
        default:
          throw new Error('Invalid role selected');
      }

      const response = await axios.post(
        endpoint, 
        payload,
        { withCredentials: true }
      );

      // Successfully authenticated
      const dataPayload = response.data?.data;
      const user = dataPayload?.user;
      const customer = dataPayload?.customer;

      if (response.status === 200 && (user || customer)) {
        // Determine role: if 'user' exists, use its role. If 'customer' exists, role is implicitly 'CUSTOMER'
        const role = user ? user.role : 'CUSTOMER';
        
        if (role === 'ADMIN') {
          window.location.href = import.meta.env.VITE_ADMIN_APP_URL || 'http://localhost:5173';
        } else if (role === 'STAFF') {
          window.location.href = import.meta.env.VITE_STAFF_APP_URL || 'http://localhost:5174';
        } else if (role === 'CUSTOMER') {
          // Direct hard link to customer portal dashboard to clear the master login domain context if needed
          const customerBaseUrl = import.meta.env.VITE_CUSTOMER_APP_URL || 'http://localhost:5175';
          window.location.href = customerBaseUrl.replace(/\/$/, '') + '/dashboard';
        } else if (role === 'DRIVER') {
          window.location.href = import.meta.env.VITE_DRIVER_APP_URL || 'http://localhost:5176';
        } else {
          throw new Error('Unrecognized user role returned from server.');
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      
      // 3. ZOD ERROR ARRAY PARSING
      if (err.response?.status === 400 && Array.isArray(err.response?.data?.errors)) {
        const joinedErrors = err.response.data.errors.map(e => e.message).join(' | ');
        setError(joinedErrors);
      } else {
        // Fallback for 401 Unauthorized or general network failures
        setError(
          err.response?.data?.error || 
          err.response?.data?.message || 
          'Invalid credentials or network error. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleConfig = roles.find(r => r.id === role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
        
        {/* Header Section */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
            <selectedRoleConfig.icon className={`w-8 h-8 ${selectedRoleConfig.color}`} />
          </div>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
            {selectedRoleConfig.label} Login
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Godawari Waste Management System
          </p>
        </div>

        {/* Role Selector Grid */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          {roles.map((r) => {
            const isActive = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRole(r.id);
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 focus:outline-none ${
                  isActive 
                    ? `${r.bg} ${r.border} ${r.color} shadow-sm ring-1 ring-${r.color.split('-')[1]}-500` 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <r.icon className={`w-6 h-6 mb-2 ${isActive ? r.color : 'text-slate-400'}`} />
                <span className={`text-xs font-bold ${isActive ? r.color : 'text-slate-600'}`}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-start animate-in fade-in zoom-in duration-300">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 shrink-0" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {role === 'CUSTOMER' ? 'Customer ID' : 'Username or Email'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="appearance-none relative block w-full px-4 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-colors bg-slate-50"
                placeholder={role === 'CUSTOMER' ? 'Enter Customer ID (e.g. GDW-0001)' : 'Enter system username'}
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 pr-12 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-colors bg-slate-50"
                  placeholder={role === 'CUSTOMER' ? 'Minimum 5 characters' : 'Enter your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all shadow-md ${
              loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black hover:shadow-lg'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
