import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Phone, KeyRound, Loader2, Recycle, ShieldCheck, Eye, EyeOff } from 'lucide-react';

// ============================================================================
// CUSTOMER LOGIN — Phone + Password
// ============================================================================

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [customerId, setCustomerId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // If already authenticated, redirect immediately
  if (isAuthenticated) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!customerId.trim() || !password.trim()) {
      setError('Please enter both Customer ID and password.');
      return;
    }

    if (password.length < 5) {
      setError('Password must be at least 5 characters.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(customerId.trim(), password);
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(result.error || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid Customer ID or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-900 via-emerald-800 to-slate-900">

      {/* ── Top Branding Section ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400/30 flex items-center justify-center mb-6 shadow-lg shadow-emerald-900/30">
          <Recycle className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight text-center">
          Godawari Waste
        </h1>
        <p className="text-emerald-300/80 text-sm font-medium mt-2 text-center max-w-xs">
          Customer Self-Service Portal
        </p>
      </div>

      {/* ── Login Form Card ── */}
      <div className="px-5 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/20 p-6 space-y-5">

          {/* Welcome Text */}
          <div className="text-center pb-2">
            <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Log in to check your outstanding dues, view your payment history, and track Smart Wallet auto-deductions.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Customer ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="e.g. GDW-0001"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-emerald-950 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 5 characters"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Log In</>
              )}
            </button>
          </form>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] text-slate-400 font-semibold">
              Secured with HttpOnly Encryption
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
