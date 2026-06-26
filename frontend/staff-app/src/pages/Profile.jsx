import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext'; // 👈 Connected to global tracking brain
import api from '../services/api';
import NepaliDate from 'nepali-date-converter';
import {
  User, MapPin, LogOut, Loader2, Radio, RadioOff,
  IndianRupee, Activity, Shield, Clock, Truck
} from 'lucide-react';

// ============================================================================
// PROFILE & LIVE TRACKING INTERFACE
// ============================================================================

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── Pulling background tracking states from Global Context ──
  const { isTracking, lastCoords, startTracking, stopTracking } = useTracking();

  // ── Today's Stats ──
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Logout ──
  const [loggingOut, setLoggingOut] = useState(false);

  // ────────────────────────────────────────────────────────────────────────
  // Fetch today's collection stats from the 7-day history endpoint
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTodayStats = async () => {
      try {
        const res = await api.get('/accounting/income/history');
        if (res.data?.success) {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

          const todayTxns = res.data.data.filter(tx => {
            const txDate = new Date(tx.date).toISOString().split('T')[0];
            return txDate === todayStr;
          });

          const total = todayTxns.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
          setTodayTotal(total);
          setTodayCount(todayTxns.length);
        }
      } catch (err) {
        console.error('Failed to fetch today stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchTodayStats();
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // UI Interaction Handlers (Connected to Global Background Tracking)
  // ────────────────────────────────────────────────────────────────────────
  const handleStartShift = () => {
    startTracking(); 
  };

  const handleEndShift = () => {
    stopTracking();  
  };

  // ────────────────────────────────────────────────────────────────────────
  // Logout Handler
  // ────────────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    stopTracking(); // Ensure they are wiped from the admin map when they log out
    await logout();
    navigate('/login');
  };

  const formatCurrency = (val) =>
    Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-24 min-h-screen">
      {/* ── Profile Header ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 pt-8 pb-10 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center">
            <User className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{user?.name || user?.username || 'Staff'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                user?.role === 'DRIVER' 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                <Shield className="w-3 h-3" />
                {user?.role === 'DRIVER' ? 'Truck Driver' : 'Collector'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Profile Details Card ── */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 grid grid-cols-2 gap-y-4 gap-x-4 text-sm mt-2 mb-2">
          <div><span className="text-slate-400 text-xs block mb-0.5 uppercase tracking-wider font-bold">Username</span> <span className="font-semibold">{user?.username || '—'}</span></div>
          <div><span className="text-slate-400 text-xs block mb-0.5 uppercase tracking-wider font-bold">Status</span> <span className={`font-bold ${user?.isActive ? 'text-emerald-400' : 'text-red-400'}`}>{user?.isActive ? 'Active' : 'Inactive'}</span></div>
          
          {user?.vehicle && (
            <div className="col-span-2">
              <span className="text-slate-400 text-xs block mb-0.5 uppercase tracking-wider font-bold">Vehicle Assigned</span> 
              <span className="font-semibold">{user.vehicle.registrationNumber} ({user.vehicle.type})</span>
            </div>
          )}
          
          {user?.createdAt && (
            <div className="col-span-2">
              <span className="text-slate-400 text-xs block mb-0.5 uppercase tracking-wider font-bold">Joined Date</span> 
              <span className="font-semibold">{new NepaliDate(new Date(user.createdAt)).format('YYYY-MM-DD')} (BS)</span>
            </div>
          )}
        </div>

        {/* ── Today's Stats Grid / Driver Dashboard ── */}
        {user?.role === 'DRIVER' ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Truck className="w-3 h-3" /> Assigned Vehicle
              </p>
              <p className="text-xl font-black text-emerald-400 truncate max-w-full">
                {user?.vehicle ? user.vehicle.registrationNumber : 'No Vehicle Assigned'}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-white/50" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> Collected Today
              </p>
              {statsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mt-1" />
              ) : (
                <p className="text-xl font-black text-emerald-400">₹{formatCurrency(todayTotal)}</p>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Transactions
              </p>
              {statsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-400 mt-1" />
              ) : (
                <p className="text-xl font-black text-blue-400">{todayCount}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Tracking Engine Card ── */}
      <div className="px-4 -mt-5 relative z-10">
        <div className={`rounded-2xl p-5 shadow-lg border transition-all duration-500 ${
          isTracking
            ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-colors ${
                isTracking ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {isTracking ? <Radio className="w-5 h-5 animate-pulse" /> : <RadioOff className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">
                  {isTracking ? 'Shift Active — Streaming' : 'Location Tracking'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isTracking
                    ? 'GPS coordinates are being shared with HQ'
                    : 'Start your shift to broadcast your location'}
                </p>
              </div>
            </div>
          </div>

          {/* Live Coordinates Display */}
          {isTracking && lastCoords && (
            <div className="bg-emerald-100/50 rounded-xl p-3 mb-4 border border-emerald-200/50 flex items-center gap-3">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="text-xs font-mono text-emerald-800">
                <span>{lastCoords.lat.toFixed(6)}</span>
                <span className="text-emerald-400 mx-1">•</span>
                <span>{lastCoords.lng.toFixed(6)}</span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <Clock className="w-3 h-3" /> LIVE
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={isTracking ? handleEndShift : handleStartShift}
            className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md ${
              isTracking
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
            }`}
          >
            {isTracking ? (
              <><RadioOff className="w-5 h-5" /> End Shift</>
            ) : (
              <><Radio className="w-5 h-5" /> Start Shift — Stream Location</>
            )}
          </button>
        </div>
      </div>

      {/* ── Logout Section ── */}
      <div className="px-4 mt-6">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 active:bg-red-100 transition-all disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <><LogOut className="w-5 h-5" /> Log Out</>
          )}
        </button>
      </div>
    </div>
  );
}