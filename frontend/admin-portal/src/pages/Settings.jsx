import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Settings as SettingsIcon, Lock, Shield, Loader2, Calendar,
  DollarSign, AlertTriangle, CheckCircle2, X, KeyRound, Truck, Users, Plus, Trash2
} from 'lucide-react';

const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ============================================================================
// SUDO VERIFICATION MODAL
// ============================================================================

function SudoModal({ isOpen, onClose, onConfirm, loading, error, title, message }) {
  const [sudoPassword, setSudoPassword] = useState('');

  useEffect(() => {
    if (isOpen) setSudoPassword('');
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sudoPassword.trim()) return;
    onConfirm(sudoPassword);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700/50 text-center relative">
          <button onClick={onClose} className="absolute right-4 top-4 p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{title || 'Sudo Verification Required'}</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
            {message || 'You are about to modify system settings. Re-enter your admin password to confirm.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">Authentication Failed</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Master Admin Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <KeyRound className="w-4 h-4 text-slate-500" />
              </div>
              <input
                type="password"
                required
                autoFocus
                value={sudoPassword}
                onChange={e => setSudoPassword(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                placeholder="Enter your password to proceed"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 text-sm font-semibold text-slate-400 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !sudoPassword.trim()}
              className="flex-1 px-5 py-3 text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Shield className="w-4 h-4" /> Confirm & Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
      <div className="h-10 bg-slate-200 rounded-xl w-64" />
      <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-8">
        <div className="space-y-3"><div className="h-4 bg-slate-200 rounded w-40" /><div className="h-12 bg-slate-100 rounded-xl" /></div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({ billingCycleDay: 1, updatedAt: null, customDeductions: [] });
  const [formState, setFormState] = useState({ billingCycleDay: 1 });
  const [deductions, setDeductions] = useState([]);
  
  // Fleet State
  const [vehicleId, setVehicleId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Compactor');

  const [loading, setLoading] = useState(true);
  const [sudoConfig, setSudoConfig] = useState({ isOpen: false, action: null, title: '', message: '' });
  const [sudoLoading, setSudoLoading] = useState(false);
  const [sudoError, setSudoError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/settings');
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setSettings({
          billingCycleDay: data.billingCycleDay ?? 1,
          updatedAt: data.updatedAt,
          customDeductions: data.customDeductions || []
        });
        setFormState({
          billingCycleDay: data.billingCycleDay ?? 1,
          calendarType: data.calendarType || 'AD',
        });
        setDeductions(data.customDeductions || []);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const openSudo = (action, title, message) => {
    setSudoError(null);
    setSudoConfig({ isOpen: true, action, title, message });
  };

  const handleSudoConfirm = async (sudoPassword) => {
    setSudoLoading(true);
    setSudoError(null);
    try {
      if (sudoConfig.action === 'SAVE_GENERAL') {
        await api.put('/system/settings', {
          billingCycleDay: Number(formState.billingCycleDay),
          calendarType: formState.calendarType,
          sudoPassword,
        });
        setSuccessMessage('System settings updated successfully.');
      } else if (sudoConfig.action === 'SAVE_DEDUCTIONS') {
        await api.put('/system/deductions', { deductions, sudoPassword });
        setSuccessMessage('Payroll deductions updated successfully.');
      } else if (sudoConfig.action === 'ADD_VEHICLE') {
        await api.post('/system/vehicles', { vehicleId, registrationNumber, type: vehicleType, sudoPassword });
        setSuccessMessage('Vehicle added successfully.');
        setVehicleId(''); setRegistrationNumber(''); setVehicleType('Compactor');
      }
      setSudoConfig({ ...sudoConfig, isOpen: false });
      fetchSettings();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSudoError(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Operation failed.');
    } finally {
      setSudoLoading(false);
    }
  };

  const handleAddDeduction = () => setDeductions([...deductions, { name: '', percentage: 0 }]);
  const handleDeductionChange = (index, field, value) => {
    const newDeds = [...deductions];
    newDeds[index][field] = field === 'percentage' ? Number(value) : value;
    setDeductions(newDeds);
  };
  const handleRemoveDeduction = (index) => setDeductions(deductions.filter((_, i) => i !== index));

  const hasGeneralChanges = Number(formState.billingCycleDay) !== Number(settings.billingCycleDay) || formState.calendarType !== settings.calendarType;
  const hasDeductionChanges = JSON.stringify(deductions) !== JSON.stringify(settings.customDeductions);

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-xl"><SettingsIcon className="w-7 h-7 text-slate-600" /></div>
          System Settings
        </h1>
        <p className="text-slate-500 mt-2 font-medium ml-14">Global configurations for billing, payroll, and fleet.</p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-4 rounded-xl text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-auto p-1 hover:bg-emerald-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">Billing & Revenue Engine</h2>
        </div>
        <div className="p-8 space-y-8">
          <div>
            <label className="flex items-center text-sm font-bold text-slate-700 mb-2.5">
              <Calendar className="w-4 h-4 mr-2 text-blue-500" /> Billing Cycle Trigger Day
            </label>
            <select value={formState.billingCycleDay} onChange={e => setFormState({ ...formState, billingCycleDay: Number(e.target.value) })} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 focus:ring-2 focus:ring-brand-500 outline-none">
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => <option key={day} value={day}>Day {day} of every month</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center text-sm font-bold text-slate-700 mb-2.5">
              <Calendar className="w-4 h-4 mr-2 text-purple-500" /> Default Calendar Type
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFormState({ ...formState, calendarType: 'AD' })}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${formState.calendarType === 'AD' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                English (AD)
              </button>
              <button
                type="button"
                onClick={() => setFormState({ ...formState, calendarType: 'BS' })}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${formState.calendarType === 'BS' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Nepali (BS)
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => openSudo('SAVE_GENERAL', 'Update Settings', 'Verify admin password to change global settings.')} disabled={!hasGeneralChanges} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-2"><Lock className="w-4 h-4"/> Save Configurations</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500"/> Dynamic Payroll Deductions</h2>
          <p className="text-sm text-slate-500 mt-1">Configure global percentage deductions (like TDS, SSF) mapped automatically in the Salary Ledger.</p>
        </div>
        <div className="p-8 space-y-4">
          {deductions.map((ded, i) => (
            <div key={i} className="flex items-center gap-4">
              <input type="text" placeholder="Deduction Name (e.g. TDS)" value={ded.name} onChange={e => handleDeductionChange(i, 'name', e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-brand-500 outline-none" />
              <input type="number" step="0.1" placeholder="%" value={ded.percentage} onChange={e => handleDeductionChange(i, 'percentage', e.target.value)} className="w-32 bg-white border border-slate-300 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-brand-500 outline-none" />
              <button onClick={() => handleRemoveDeduction(i)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-5 h-5"/></button>
            </div>
          ))}
          <button onClick={handleAddDeduction} className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl"><Plus className="w-4 h-4"/> Add Deduction Rule</button>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button onClick={() => openSudo('SAVE_DEDUCTIONS', 'Update Deductions', 'Verify admin password to change payroll deductions.')} disabled={!hasDeductionChanges} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-2"><Lock className="w-4 h-4"/> Save Deductions</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Truck className="w-5 h-5 text-emerald-500"/> Fleet Management</h2>
          <p className="text-sm text-slate-500 mt-1">Register new vehicles into the system database.</p>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <input type="text" placeholder="Internal ID (e.g. V-1)" value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-brand-500 outline-none" />
            <input type="text" placeholder="Reg. Number (Optional)" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-brand-500 outline-none" />
            <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="Compactor">Compactor</option>
              <option value="Tipper">Tipper</option>
              <option value="Tractor">Tractor</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button onClick={() => openSudo('ADD_VEHICLE', 'Add Vehicle', 'Verify admin password to register new vehicle.')} disabled={!vehicleId} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-2"><Lock className="w-4 h-4"/> Register Vehicle</button>
          </div>
        </div>
      </div>

      <SudoModal isOpen={sudoConfig.isOpen} onClose={() => setSudoConfig({ ...sudoConfig, isOpen: false })} onConfirm={handleSudoConfirm} loading={sudoLoading} error={sudoError} title={sudoConfig.title} message={sudoConfig.message} />
    </div>
  );
}
