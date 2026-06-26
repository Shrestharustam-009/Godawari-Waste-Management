import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { MapPin, ArrowLeft, Loader2, AlertTriangle, Recycle } from 'lucide-react';
import CustomerMap from '../components/CustomerMap';
import api from '../api/axios';

export default function Tracking() {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const customerId = customer?.customerId || customer?.id;
        if (!customerId) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          return;
        }

        const res = await api.get(`/customers/${customerId}`);
        if (res.data?.success) {
          setProfile(res.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load your account data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [customer]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500 font-medium">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 text-sm text-red-600 font-bold underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 px-5 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        
        <div className="relative z-10">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-emerald-200 hover:text-white transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-300" /> Live Tracking
          </h1>
          <p className="text-emerald-200/80 text-sm font-medium mt-1">
            Tracking for {profile?.name} • Area: {profile?.assignedArea}
          </p>
        </div>
      </div>

      <div className="px-4 mt-2">
        <CustomerMap />
      </div>
    </div>
  );
}
