import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import { io } from 'socket.io-client';
import {
  MapPin, Users, Truck, UserPlus, Eye, ShieldOff, ShieldCheck,
  Loader2, Plus, ChevronDown, X, Phone, Lock, Hash, Map as MapIcon,
  Activity, DollarSign, Calendar, KeyRound, CheckCircle2, AlertCircle
} from 'lucide-react';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import ReactDOMServer from 'react-dom/server';

// import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// import markerIcon from 'leaflet/dist/images/marker-icon.png';
// import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// // Overwrite Leaflet's broken default icon paths
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconUrl: markerIcon,
//   iconRetinaUrl: markerIcon2x,
//   shadowUrl: markerShadow,
// });

// ============================================================================
// CUSTOM LEAFLET MARKER ICONS
// ============================================================================

const createIcon = (color) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 32px; height: 32px; border-radius: 50%; 
    background: ${color}; border: 3px solid white; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -20],
});

const driverIconHtml = ReactDOMServer.renderToString(
  <div style={{ backgroundColor: '#10b981', border: '2px solid white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
    <Truck size={18} color="white" />
  </div>
);

const driverIcon = L.divIcon({
  html: driverIconHtml,
  className: 'custom-leaflet-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});
const collectorIcon = createIcon('#2563eb'); // Blue for collectors

// ============================================================================
// LEAFLET FIX: Default icon path workaround for bundlers
// ============================================================================

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ============================================================================
// MAP AUTO-FIT COMPONENT
// ============================================================================

function MapAutoFit({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers, map]);
  return null;
}

// ============================================================================
// SUDO MODAL
// ============================================================================
function SudoModal({ isOpen, onClose, onConfirm, loading, error, title, message }) {
  const [sudoPassword, setSudoPassword] = useState('');
  useEffect(() => { if (isOpen) setSudoPassword(''); }, [isOpen]);
  const handleSubmit = (e) => { e.preventDefault(); if (sudoPassword) onConfirm(sudoPassword); };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-2">{title || 'Sudo Required'}</h2>
        <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">{message}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/30">{error}</div>}
          <input type="password" required autoFocus value={sudoPassword} onChange={e => setSudoPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Enter Admin Password" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-amber-500 text-slate-900 dark:text-white rounded-xl font-bold disabled:opacity-50 flex justify-center items-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// ADD EMPLOYEE MODAL (Unified)
// ============================================================================

function AddEmployeeModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', phone: '', username: '', password: '', role: 'STAFF', jobTitle: '', vehicleId: '', assignedArea: '' });
  const [isNormal, setIsNormal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    if (isOpen && form.role === 'DRIVER') {
      const fetchVehicles = async () => {
        try {
          const res = await api.get('/system/vehicles');
          if (res.data?.success) {
            setVehicles(res.data.data);
          }
        } catch (err) {
          console.error('Failed to fetch vehicles:', err);
        }
      };
      fetchVehicles();
    }
  }, [isOpen, form.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      let payload;
      let endpoint;

      if (isNormal) {
        endpoint = '/hr/staff';
        payload = {
          name: form.name,
          phone: form.phone,
          jobTitle: form.jobTitle,
          role: 'NORMAL_EMPLOYEE'
        };
      } else if (form.role === 'DRIVER') {
        endpoint = '/hr/drivers';
        payload = {
          name: form.name,
          phone: form.phone,
          username: form.username,
          password: form.password,
          vehicleId: Number(form.vehicleId)
        };
      } else {
        endpoint = '/hr/collectors';
        payload = {
          name: form.name,
          phone: form.phone,
          username: form.username,
          password: form.password,
          assignedArea: form.assignedArea
        };
      }
      
      const res = await api.post(endpoint, payload);
      
      if (res.data?.success) {
        alert(`Employee "${form.name}" created successfully!`);
        setForm({ name: '', phone: '', username: '', password: '', role: 'STAFF', jobTitle: '', vehicleId: '', assignedArea: '' });
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const inputClass = "w-full bg-white dark:bg-slate-800 transition-colors duration-200 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 rounded-xl shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-indigo-100 bg-indigo-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-indigo-900 flex items-center"><UserPlus className="w-5 h-5 mr-2" /> Add Employee</h2>
          <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded-lg"><X className="w-5 h-5 text-indigo-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <input type="checkbox" id="normalEmp" checked={isNormal} onChange={e => setIsNormal(e.target.checked)} className="w-4 h-4 text-indigo-600" />
            <label htmlFor="normalEmp" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Normal Employee (No System Login)</label>
          </div>

          {!isNormal && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">System Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className={inputClass}>
                <option value="STAFF">Money Collector</option>
                <option value="DRIVER">Truck Driver</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
              <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Mobile Number</label>
              <input type="text" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={inputClass} placeholder="98XXXXXXXX" />
            </div>
          </div>

          {isNormal ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Job Title</label>
              <input type="text" required value={form.jobTitle} onChange={e => setForm({...form, jobTitle: e.target.value})} className={inputClass} placeholder="e.g. Sweeper" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
                <input type="text" required value={form.username} onChange={e => setForm({...form, username: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                <input type="password" required minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className={inputClass} />
              </div>
              {form.role === 'DRIVER' && (
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Assigned Vehicle</label>
                  <select required value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})} className={inputClass}>
                    <option value="">Select a Vehicle...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.vehicleId} {v.registrationNumber ? `(${v.registrationNumber})` : ''} - {v.type}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.role === 'STAFF' && (
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Assigned Area</label>
                  <input type="text" required value={form.assignedArea} onChange={e => setForm({...form, assignedArea: e.target.value})} className={inputClass} placeholder="e.g. Godawari Ward 7" />
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 transition-colors duration-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800/50 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



// ============================================================================
// STAFF PROFILE SLIDE-OVER
// ============================================================================

function StaffProfilePanel({ isOpen, onClose, staffId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { formatDate } = useSettings();

  useEffect(() => {
    if (!isOpen || !staffId) return;
    setLoading(true); setError(null);
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/hr/staff/${staffId}`);
        if (res.data?.success) {
          setProfile(res.data.data);
        }
      } catch (err) {
        console.error('Fetch profile error:', err);
        setError(err.response?.data?.error || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isOpen, staffId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 w-full max-w-xl h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center"><Eye className="w-5 h-5 mr-2" /> Staff Profile</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {loading && <div className="p-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" /></div>}
        {error && <div className="p-6 text-red-600 bg-red-50 m-6 rounded-lg border border-red-100">{error}</div>}

        {!loading && !error && profile && (
          <div className="p-6 space-y-6">
            {/* Identity Card */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${profile.role === 'DRIVER' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                  {profile.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{profile.name}</h3>
                  <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider mt-1 ${profile.role === 'DRIVER' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {profile.role === 'DRIVER' ? 'Truck Driver' : 'Money Collector'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400 dark:text-slate-500 font-medium">Username:</span> <span className="text-slate-700 dark:text-slate-300 font-semibold">{profile.username}</span></div>
                <div><span className="text-slate-400 dark:text-slate-500 font-medium">Status:</span> <span className={`font-bold ${profile.isActive ? 'text-emerald-600' : 'text-red-600'}`}>{profile.isActive ? 'Active' : 'Inactive'}</span></div>
                {profile.vehicle && (
                  <div className="col-span-2"><span className="text-slate-400 dark:text-slate-500 font-medium">Vehicle:</span> <span className="text-slate-700 dark:text-slate-300 font-semibold">{profile.vehicle.registrationNumber} ({profile.vehicle.type})</span></div>
                )}
                <div className="col-span-2"><span className="text-slate-400 dark:text-slate-500 font-medium">Joined:</span> <span className="text-slate-700 dark:text-slate-300 font-semibold">{formatDate(profile.createdAt)}</span></div>
              </div>
            </div>

            {/* ── COLLECTOR ONLY SECTIONS ── */}
            {profile.role !== 'DRIVER' && (
              <>
                {/* Daily Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center"><DollarSign className="w-3 h-3 mr-1" /> Today's Collection</p>
                    <p className="text-2xl font-extrabold text-emerald-800">₹{formatCurrency(profile.dailySummary?.collectionTotal)}</p>
                  </div>
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center"><Activity className="w-3 h-3 mr-1" /> Transactions</p>
                    <p className="text-2xl font-extrabold text-blue-800">{profile.dailySummary?.transactionCount || 0}</p>
                  </div>
                </div>

                {/* Transaction Ledger */}
                <div>
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Recent Transaction History</h4>
                  {Array.isArray(profile.transactions) && profile.transactions.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {profile.transactions.map(tx => (
                        <div key={tx.id} className="bg-white dark:bg-slate-800 transition-colors duration-200 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:border-slate-700 transition-colors flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Collected: ₹{formatCurrency(tx.amount)}</p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{formatDate(tx.date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{formatDate(tx.date)}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tx.status === 'SUCCESSFUL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{tx.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-lg">No transactions recorded yet.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT: FleetHR
// ============================================================================



function MapController({ targetCoords }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo([targetCoords.lat, targetCoords.lng], 19, { animate: true, duration: 1 });
    }
  }, [targetCoords, map]);
  return null;
}

export default function FleetHR() {
  // ── Staff Roster State ──
  const { user } = useAuth(); 
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });

  // ── Modal States ──
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [profilePanelId, setProfilePanelId] = useState(null);

  // Sudo Password Reset State
  const [sudoConfig, setSudoConfig] = useState({ isOpen: false, staffId: null });
  const [sudoLoading, setSudoLoading] = useState(false);
  const [sudoError, setSudoError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // ── Live Map State ──
  const [driverMarkers, setDriverMarkers] = useState({});
  const [staffMarkers, setStaffMarkers] = useState({});
  const [mapConnected, setMapConnected] = useState(false);
  const [focusedCoords, setFocusedCoords] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [mapFeedback, setMapFeedback] = useState(null);
  const feedbackTimeoutRef = useRef(null);

  const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 min with no ping = considered offline
  const hasInitialFitRef = useRef(false);
  // ── Deactivation Loading ──
  const [deactivatingId, setDeactivatingId] = useState(null);

  const dropdownRef = useRef(null);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch Staff Roster ──
  const fetchStaff = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/hr/staff', { params: { page, limit: 20 } });
      if (res.data?.success) {
        setStaff(Array.isArray(res.data.data) ? res.data.data : []);
        setPagination(res.data.pagination || { page: 1, totalPages: 1, totalCount: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);


  useEffect(() => {
    const fetchInitialLocations = async () => {
      try {
        console.log("[FleetHR] Fetching initial map footprints from database...");
        const res = await api.get('/hr/latest-locations');
        if (res.data?.success) {
          console.log("Database hydration successful! Active pins loaded:", res.data);
          if (res.data.staff) setStaffMarkers(res.data.staff);
          if (res.data.drivers) setDriverMarkers(res.data.drivers);
        } else {
          console.warn("[FleetHR] Failed to load locations from database:", res.data?.message);
        }
      } catch (error) {
        console.error("[FleetHR] Network error downloading initial map pins:", error);
      }
    };

    // Only run this if an authenticated admin user is present
    if (user) {
      fetchInitialLocations();
    }
  }, [user]); // Fires the moment the admin securely logs in

  // ── Socket.IO: Live GPS Feed ──
 useEffect(() => {
  // 1. Guard: Just check if the user is logged in. Cookies handle the actual token!
  if (!user) {
    // console.log('[FleetHR] No user found, skipping socket initialization.');
    return;
  }

 

  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const socket = io(backendUrl, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[FleetHR] Map socket successfully connected! Sending join_admin...');
    setMapConnected(true);
    socket.emit('join_admin'); // Emitting join_admin matches your admin network profile
  });

  socket.on('disconnect', () => {
    console.log('[FleetHR] Map socket disconnected.');
    setMapConnected(false);
  });

  socket.on('connect_error', (err) => {
    console.error('[FleetHR] Map socket connection error:', err.message);
    setMapConnected(false);
  });

  // LIVE COURIER/DRIVER CHANNEL
  socket.on('live_driver_location', (data) => {
    // console.log("📥 Driver location received:", data);
    setDriverMarkers(prev => ({
      ...prev,
      [data.vehicleId]: { lat: data.lat, lng: data.lng, vehicleId: data.vehicleId, timestamp: data.timestamp },
     }));
  });

  // LIVE COLLECTOR/STAFF CHANNEL
  socket.on('live_staff_location', (data) => {
    // console.log("MATCH! Frontend successfully caught staff event data:", data);
    setStaffMarkers((prevMarkers) => ({
      ...prevMarkers,
      [data.staffId]: data 
    }));
  });

  // CLEANUP CHANNELS (Removes markers instantly when shift ends)
  
  // 1. Staff goes offline
  socket.on('staff_went_offline', (data) => {
    console.log(`🧹 Removing staff pin from admin map: ${data.staffId}`);
    setStaffMarkers(prev => {
      const next = { ...prev };
      delete next[data.staffId];
      return next;
    });
  });

  // 2. Driver goes offline
  socket.on('driver_went_offline', (data) => {
    console.log(`Removing driver vehicle pin from admin map: ${data.vehicleId}`);
    setDriverMarkers(prev => {
      const next = { ...prev };
      delete next[data.vehicleId];
      return next;
    });
  });



  // 2. Clean up everything when the user leaves the page
  return () => { 
    console.log('[FleetHR] Cleaning up and disconnecting map socket...');
    socket.disconnect(); 
  };
}, [user]);


useEffect(() => {
  const interval = setInterval(() => {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    setDriverMarkers(prev => {
      const next = {};
      for (const [id, m] of Object.entries(prev)) {
        if (new Date(m.timestamp).getTime() >= cutoff) next[id] = m;
      }
      return next;
    });
    setStaffMarkers(prev => {
      const next = {};
      for (const [id, m] of Object.entries(prev)) {
        if (new Date(m.timestamp).getTime() >= cutoff) next[id] = m;
      }
      return next;
    });
  }, 30000);
  return () => clearInterval(interval);
}, []);

  // ── Deactivate Handler ──
  const handleDeactivate = async (userId, userName) => {
    if (!window.confirm(`⚠️ CONFIRM: Deactivate "${userName}"? This will instantly terminate all their active sessions.`)) return;
    setDeactivatingId(userId);
    try {
      const res = await api.patch(`/hr/staff/${userId}/deactivate`);
      if (res.data?.success) {
        alert(res.data.message);
        fetchStaff(pagination.page);
      }
    } catch (err) {
      console.error('Deactivate error:', err);
      alert(err.response?.data?.error || 'Deactivation failed.');
    } finally {
      setDeactivatingId(null);
    }
  };

  // ── Reactivate Handler ──
  const handleReactivate = async (userId, userName) => {
    if (!window.confirm(`Reactivate "${userName}"? They will be able to log in again.`)) return;
    setDeactivatingId(userId);
    try {
      const res = await api.patch(`/hr/staff/${userId}/reactivate`);
      if (res.data?.success) {
        alert(res.data.message);
        fetchStaff(pagination.page);
      }
    } catch (err) {
      console.error('Reactivate error:', err);
      alert(err.response?.data?.error || 'Reactivation failed.');
    } finally {
      setDeactivatingId(null);
    }
  };

  // ── Reset Password Handler ──
  const handleResetPasswordConfirm = async (sudoPassword) => {
    setSudoLoading(true); setSudoError(null);
    try {
      const res = await api.post(`/hr/staff/${sudoConfig.staffId}/reset-password`, { sudoPassword });
      if (res.data?.success) {
        setSuccessToast(`Temporary Password: ${res.data.data.newPassword}`);
        setSudoConfig({ isOpen: false, staffId: null });
      }
    } catch (err) {
      setSudoError(err.response?.data?.error || 'Password reset failed.');
    } finally {
      setSudoLoading(false);
    }
  };


  // ── Aggregate all markers for map bounds ──
  const allMapMarkers = [
    ...Object.values(driverMarkers),
    ...Object.values(staffMarkers),
  ].filter(m => !isNaN(Number(m.lat)) && !isNaN(Number(m.lng)));

  const filteredStaff = Array.isArray(staff) 
  ? staff.filter(emp => 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.username.toLowerCase().includes(searchTerm.toLowerCase())
    ) 
  : [];

  // Godawari, Nepal coordinates
  const godawariCenter = [27.5935, 85.3876];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Fleet Map & HR</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Live GPS tracking • Staff management • Session control</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowEmployeeModal(true)}
            className="inline-flex items-center px-5 py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Add Employee
          </button>
        </div>
      </div>

      {/* ── TOP HALF: LIVE MAP ── */}
      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700  ">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex flex-wrap items-center">
            <MapIcon className="w-4 h-4 mr-2 text-emerald-600" /> Live Fleet Map
            {focusedCoords && (
              <button 
                onClick={() => setFocusedCoords(null)}
                className="ml-3 px-3 py-1 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors flex items-center"
              >
                <X className="w-3 h-3 mr-1" /> Clear Focus
              </button>
            )}
          </h2>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Driver ({Object.keys(driverMarkers).length})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Collector ({Object.keys(staffMarkers).length})</span>
          </div>
        </div>
        <div style={{ height: '400px' }}>
          <MapContainer
            center={godawariCenter}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <MapController targetCoords={focusedCoords} />

            {allMapMarkers.length > 0 && !focusedCoords && <MapAutoFit markers={allMapMarkers} />}

            {Object.values(driverMarkers).map(m => {
              if (isNaN(Number(m.lat)) || isNaN(Number(m.lng))) return null;
              
              // Look up the matching employee to get their name/username
              const employee = staff.find(s => s.role === 'DRIVER' && String(s.vehicleId) === String(m.vehicleId));

              return (
                <Marker key={`driver-${m.vehicleId}`} position={[m.lat, m.lng]} icon={driverIcon}>
                  <Popup>
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                          {employee?.name?.charAt(0) || '?'}
                        </span>
                        <strong className="text-emerald-700">
                          {employee ? employee.name : `Driver #${m.vehicleId}`}
                        </strong>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-2">
                        @{employee?.username || 'n/a'}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        🚛 Vehicle #{m.vehicleId}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 border-t pt-1">
                        Last ping: {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {Object.values(staffMarkers).map(m => {
              if (isNaN(Number(m.lat)) || isNaN(Number(m.lng))) return null;

              // Look up the matching employee to get their name/username
              const employee = staff.find(s => s.id === m.staffId);
              
              return (
                <Marker key={`staff-${m.staffId}`} position={[m.lat, m.lng]} icon={collectorIcon}>
                  <Popup>
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                          {employee?.name?.charAt(0) || '?'}
                        </span>
                        <strong className="text-blue-700">
                          {employee ? employee.name : `Collector #${m.staffId}`}
                        </strong>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-2">
                        @{employee?.username || 'n/a'}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 border-t pt-1">
                        Last seen: {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

     

      {/* ── BOTTOM HALF: HR ROSTER TABLE ── */}
      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700  ">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center">
              <Users className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" /> Employee Roster
            </h2>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
              {pagination.totalCount} employees • Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              placeholder="Search by name or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-full sm:max-w-md"
            />
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {filteredStaff.length} employees found
            </span>
          </div>
        </div>

        {loading && <div className="p-12 text-center"><Loader2 className="w-7 h-7 animate-spin text-brand-500 mx-auto" /></div>}

        {!loading && (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
               {mapFeedback && (
                    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[1000] px-6 py-3 bg-amber-500 text-white text-sm font-bold rounded-full shadow-xl flex items-center animate-bounce">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      {mapFeedback}
                    </div>
                  )}
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assignment</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
          {filteredStaff.length > 0 ? (
            filteredStaff.map(emp => (
              <tr key={emp.id} className={`transition-colors ${emp.isActive ? 'bg-white dark:bg-slate-800 transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:bg-slate-900/50/80' : 'bg-red-50/30'}`}>
                {/* Username Column */}
                <td className="px-6 py-4">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                    @{emp.username}
                  </span>
                </td>

        {/* Name Column */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${emp.role === 'DRIVER' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
              {emp.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
            </div>
          </div>
        </td>

        {/* Role Column */}
        <td className="px-6 py-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${emp.role === 'DRIVER' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {emp.role === 'DRIVER' ? 'Driver' : 'Collector'}
          </span>
        </td>

        {/* Assignment Column */}
        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium text-sm">
          {emp.vehicle ? `🚛 ${emp.vehicle.registrationNumber}` : '—'}
        </td>

        {/* Status Column */}
        <td className="px-6 py-4">
          {emp.isActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold"><ShieldCheck className="w-3 h-3" /> Active</span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold"><ShieldOff className="w-3 h-3" /> Inactive</span>
          )}
        </td>

        {/* Actions Column */}
        <td className="px-6 py-4">
          <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    // 1. Safely default to empty objects if the markers aren't loaded yet
                    const safeDriverMarkers = driverMarkers || {};
                    const safeStaffMarkers = staffMarkers || {};
                    
                    // 2. Find the specific marker safely (matching Strings)
                    let marker = null;
                    if (emp.role === 'DRIVER') {
                      marker = safeDriverMarkers[String(emp.vehicleId)] || 
                               Object.values(safeDriverMarkers).find(m => String(m.vehicleId) === String(emp.vehicleId));
                    } else {
                      marker = safeStaffMarkers[emp.id];
                    }

                    // 3. Check staleness before focusing
                    const cutoff = Date.now() - 3 * 60 * 1000; // STALE_THRESHOLD_MS (3 mins)
                    const isOnline = marker && marker.timestamp && new Date(marker.timestamp).getTime() >= cutoff;

                    if (isOnline && marker.lat && marker.lng) {
                      setFocusedCoords({ lat: marker.lat, lng: marker.lng });
                    } else {
                      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
                      setMapFeedback(`@${emp.username} is currently offline or their location is stale.`);
                      feedbackTimeoutRef.current = setTimeout(() => setMapFeedback(null), 3000);
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 mr-1" /> Focus
                </button>
                          
            <button
              onClick={() => setProfilePanelId(emp.id)}
              className="inline-flex items-center px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
            >
              <Eye className="w-3.5 h-3.5 mr-1" /> View
            </button>
            
            {emp.isLoginEnabled && emp.isActive && (
              <button
                onClick={() => setSudoConfig({ isOpen: true, staffId: emp.id })}
                className="inline-flex items-center px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Pwd
              </button>
            )}

            {emp.isActive ? (
              <button
                onClick={() => handleDeactivate(emp.id, emp.name)}
                disabled={deactivatingId === emp.id}
                className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {deactivatingId === emp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ShieldOff className="w-3.5 h-3.5 mr-1" /> Deactivate</>}
              </button>
            ) : (
              <button
                onClick={() => handleReactivate(emp.id, emp.name)}
                disabled={deactivatingId === emp.id}
                className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {deactivatingId === emp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Reactivate</>}
              </button>
            )}
          </div>
        </td>
      </tr>
    ))
          ) : (
            <tr>
              <td colSpan={6} className="text-center py-16 text-slate-400 dark:text-slate-500 font-medium">No results found.</td>
            </tr>
          )}
        </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchStaff(pagination.page - 1)}
              className="px-4 py-2 bg-white dark:bg-slate-800 transition-colors duration-200 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchStaff(pagination.page + 1)}
              className="px-4 py-2 bg-white dark:bg-slate-800 transition-colors duration-200 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <AddEmployeeModal isOpen={showEmployeeModal} onClose={() => setShowEmployeeModal(false)} onSuccess={() => fetchStaff(1)} />
      <StaffProfilePanel isOpen={!!profilePanelId} onClose={() => setProfilePanelId(null)} staffId={profilePanelId} />
      <SudoModal 
        isOpen={sudoConfig.isOpen} 
        onClose={() => setSudoConfig({ isOpen: false, staffId: null })} 
        onConfirm={handleResetPasswordConfirm} 
        loading={sudoLoading} 
        error={sudoError} 
        title="Reset Password" 
        message="Enter master admin password to generate a temporary password for this employee." 
      />
      {successToast && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl font-bold z-50 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6" />
          {successToast}
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-emerald-600 rounded-lg ml-2"><X className="w-5 h-5"/></button>
        </div>
      )}
    </div>
  );
}
