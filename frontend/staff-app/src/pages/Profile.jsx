import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { io } from 'socket.io-client';
import NoSleep from 'nosleep.js';
import {
  User, MapPin, LogOut, Loader2, Radio, RadioOff,
  IndianRupee, Activity, Shield, Clock
} from 'lucide-react';

// ============================================================================
// PROFILE & LIVE TRACKING ENGINE
// ============================================================================

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── Shift / Tracking State ──
  const [isTracking, setIsTracking] = useState(false);
  const [lastCoords, setLastCoords] = useState(null);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const noSleepRef = useRef(null);

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
  // Initialize NoSleep instance once
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    return () => {
      // Cleanup on unmount
      if (noSleepRef.current) {
        noSleepRef.current.disable();
      }
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // Start / Stop Tracking
  // ────────────────────────────────────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    // 1. Enable screen wake lock
    try {
      noSleepRef.current?.enable();
    } catch (err) {
      console.warn('NoSleep enable failed:', err);
    }

    // 2. Initialize Socket.IO connection
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Profile] Socket connected for GPS streaming');
    });

    socketRef.current = socket;

    // 3. Start watching position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLastCoords({ lat: latitude, lng: longitude });

        // Emit location to backend
        if (socketRef.current?.connected) {
          socketRef.current.emit('live_staff_location', {
            staffId: user?.id,
            name: user?.username || user?.name,
            role: user?.role,
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString(),
          });
        }
      },
      (error) => {
        console.error('Geolocation error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    watchIdRef.current = watchId;
    setIsTracking(true);
  }, [user]);

  const stopTracking = useCallback(() => {
    // 1. Clear geolocation watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // 2. Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // 3. Disable wake lock
    try {
      noSleepRef.current?.disable();
    } catch (err) {
      console.warn('NoSleep disable failed:', err);
    }

    setIsTracking(false);
    setLastCoords(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // Logout Handler
  // ────────────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    stopTracking();
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
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Shield className="w-3 h-3" />
                {user?.role || 'STAFF'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Today's Stats Grid ── */}
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
            onClick={isTracking ? stopTracking : startTracking}
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
