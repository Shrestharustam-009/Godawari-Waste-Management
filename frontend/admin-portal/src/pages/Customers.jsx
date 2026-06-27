import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Wallet,
  TrendingUp,
  Clock,
  User,
  Phone,
  MapPin,
  Hash,
  Lock,
  IndianRupee,
  KeyRound,
  CheckCircle2,
  Calendar,
  Download,
  FileText,
  ArrowRight,
} from 'lucide-react';
import DatePicker from '../components/DatePicker';
import invoiceHeaderImg from '../assets/company_logo.png';

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
        <p className="text-slate-400 text-sm mb-4">{message}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/30">{error}</div>}
          <input type="password" required autoFocus value={sudoPassword} onChange={e => setSudoPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Enter Admin Password" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-amber-500 text-slate-900 rounded-xl font-bold disabled:opacity-50 flex justify-center items-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// ADD CUSTOMER MODAL
// ============================================================================
function AddCustomerModal({ isOpen, onClose, onSuccess }) {
  const [form, setForm] = useState({
    customerId: '',
    name: '',
    phone: '',
    assignedArea: '',
    password: '',
    monthlyFee: '500.00',
    billingCycleDay: '',
    outstandingPayment: '0.00',
    dueStartDate: '',
    dueEndDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Clean phone if empty
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      payload.billingCycleDay = form.billingCycleDay !== '' ? parseInt(form.billingCycleDay, 10) : undefined;

      const res = await api.post('/customers', payload);
      if (res.data.success) {
        onSuccess(res.data.data);
        setForm({ customerId: '', name: '', phone: '', assignedArea: '', password: '', monthlyFee: '500.00', billingCycleDay: '', outstandingPayment: '0.00', dueStartDate: '', dueEndDate: '' });
        onClose();
      }
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setError(serverErrors.map((e) => e.message).join(', '));
      } else {
        setError(err.response?.data?.error || 'Failed to create customer.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = 'w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Add New Customer</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md flex items-start">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer ID</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="customerId" value={form.customerId} onChange={handleChange} placeholder="GDW-0001" required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="name" value={form.name} onChange={handleChange} placeholder="Ram Bahadur" required className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="9841234567" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Area</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="assignedArea" value={form.assignedArea} onChange={handleChange} placeholder="Godawari Ward-7" required className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Fee (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="monthlyFee" value={form.monthlyFee} onChange={handleChange} placeholder="500.00" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle Day (Optional)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" min="1" max="28" name="billingCycleDay" value={form.billingCycleDay} onChange={handleChange} placeholder="e.g. 1" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="password" value={form.password} onChange={handleChange} placeholder="Minimum 5 characters" required className={inputClass} type={showPassword ? 'text' : 'password'} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Starting Debt (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="outstandingPayment" value={form.outstandingPayment} onChange={handleChange} placeholder="0.00" className={inputClass} />
              </div>
            </div>
          </div>

          {Number(form.outstandingPayment) > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Debt From Date</label>
                <div className="relative border border-slate-200 rounded-lg bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white overflow-hidden flex">
                  <div className="flex items-center justify-center pl-3 pr-2 border-r border-slate-200 bg-white">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <DatePicker name="dueStartDate" value={form.dueStartDate} onChange={handleChange} className="flex-1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Debt To Date</label>
                <div className="relative border border-slate-200 rounded-lg bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white overflow-hidden flex">
                  <div className="flex items-center justify-center pl-3 pr-2 border-r border-slate-200 bg-white">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <DatePicker name="dueEndDate" value={form.dueEndDate} onChange={handleChange} className="flex-1" />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <><Loader2 className="animate-spin w-4 h-4 mr-2" /> Creating...</> : <><Plus className="w-4 h-4 mr-2" /> Create Customer</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// EDIT CUSTOMER MODAL
// ============================================================================
function EditCustomerModal({ isOpen, onClose, customer, onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    assignedArea: '',
    monthlyFee: '',
    billingCycleDay: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [sudoConfig, setSudoConfig] = useState({ isOpen: false, error: null });

  useEffect(() => {
    if (customer && isOpen) {
      setForm({
        name: customer.name || '',
        phone: customer.phone || '',
        assignedArea: customer.assignedArea || '',
        monthlyFee: customer.monthlyFee || '500.00',
        billingCycleDay: customer.billingCycleDay || '',
        isActive: customer.isActive ?? true,
      });
      setError(null);
    }
  }, [customer, isOpen]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    setSudoConfig({ isOpen: true, error: null });
  };

  const handleSudoConfirm = async (sudoPassword) => {
    setSudoConfig(prev => ({ ...prev, error: null }));
    setLoading(true);

    try {
      const payload = {
        ...form,
        billingCycleDay: form.billingCycleDay !== '' ? parseInt(form.billingCycleDay, 10) : null,
        sudoPassword
      };
      if (!payload.phone) delete payload.phone;

      const res = await api.put(`/customers/${customer.customerId}`, payload);
      if (res.data.success) {
        onSuccess(res.data.data);
        setSudoConfig({ isOpen: false, error: null });
        onClose();
      }
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setError(serverErrors.map((e) => e.message).join(' | '));
        setSudoConfig({ isOpen: false, error: null });
      } else {
        setSudoConfig(prev => ({ ...prev, error: err.response?.data?.error || 'Failed to update customer.' }));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customer) return null;

  const inputClass = 'w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={sudoConfig.isOpen ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Edit Customer: {customer.customerId}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleInitialSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md flex items-start">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="name" value={form.name} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Area</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="assignedArea" value={form.assignedArea} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Fee (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="monthlyFee" value={form.monthlyFee} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle Day (Optional)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" min="1" max="28" name="billingCycleDay" value={form.billingCycleDay} onChange={handleChange} placeholder="Global default" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="isActive" name="isActive" checked={form.isActive} onChange={handleChange} className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500" />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Account Active</label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <><Loader2 className="animate-spin w-4 h-4 mr-2" /> Saving...</> : 'Save Changes'}
          </button>
        </form>
      </div>

      <SudoModal
        isOpen={sudoConfig.isOpen}
        onClose={() => setSudoConfig({ isOpen: false, error: null })}
        onConfirm={handleSudoConfirm}
        loading={loading}
        error={sudoConfig.error}
        title="Confirm Edit Action"
        message={`Enter master admin password to confirm updates to ${customer?.name}'s account.`}
      />
    </div>
  );
}

// ============================================================================
// CUSTOMER PROFILE SLIDE-OVER
// ============================================================================
function CustomerProfile({ customerId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { formatDate } = useSettings();

  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    setError(null);

    api.get(`/customers/${customerId}`)
      .then((res) => {
        if (res.data.success) setProfile(res.data.data);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load profile.');
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const filteredTransactions = React.useMemo(() => {
    if (!profile || !profile.transactions) return [];
    
    let filtered = [...profile.transactions];
    const now = new Date();
    
    if (dateFilter === 'all') return filtered;
    
    if (dateFilter === 'custom') {
      if (customStart) {
        const start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(tx => new Date(tx.date) >= start);
      }
      if (customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(tx => new Date(tx.date) <= end);
      }
      return filtered;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const filterDate = new Date(startOfToday);

    if (dateFilter === 'today') {
      filtered = filtered.filter(tx => new Date(tx.date) >= filterDate);
    } else if (dateFilter === 'last7') {
      filterDate.setDate(filterDate.getDate() - 7);
      filtered = filtered.filter(tx => new Date(tx.date) >= filterDate);
    } else if (dateFilter === 'last14') {
      filterDate.setDate(filterDate.getDate() - 14);
      filtered = filtered.filter(tx => new Date(tx.date) >= filterDate);
    } else if (dateFilter === 'thisMonth') {
      filterDate.setDate(1);
      filtered = filtered.filter(tx => new Date(tx.date) >= filterDate);
    } else if (dateFilter === 'lastMonth') {
      filterDate.setMonth(filterDate.getMonth() - 1);
      filterDate.setDate(1);
      const endOfLastMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 0, 23, 59, 59, 999);
      filtered = filtered.filter(tx => new Date(tx.date) >= filterDate && new Date(tx.date) <= endOfLastMonth);
    } else if (dateFilter === 'last3Months') {
      filterDate.setMonth(filterDate.getMonth() - 3);
      filterDate.setDate(1);
      filtered = filtered.filter(tx => new Date(tx.date) >= filterDate);
    }
    
    return filtered;
  }, [profile, dateFilter, customStart, customEnd]);

  // ── Export CSV Handler ──
  const handleExportCSV = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return;

    const headers = ['Transaction ID', 'Method', 'Source', 'Collected By', 'Date', 'VAT Amount (INR)', 'Amount (INR)', 'Note'];
    const rows = filteredTransactions.map(tx => [
      tx.id || 'N/A',
      tx.paymentMethod,
      tx.source,
      tx.staffName || 'Admin',
      formatDate(tx.date),
      tx.vatAmount || '0.00',
      tx.amount,
      tx.note || ''
    ]);

    const csvContent = [
      `Customer Statement for ${profile.name} (${profile.customerId})`,
      `Outstanding Due,₹${profile.outstandingPayment}`,
      `Smart Wallet Balance,₹${profile.advanceBalance || 0}`,
      [], // Empty spacer row
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Statement_${profile.customerId}_${profile.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── View/Print Plain HTML Statement Document ──
  const handleViewStatement = () => {
    if (!profile) return;

    let totalPayments = 0;
    let totalVat = 0;
    let totalCharges = 0;

    const printWindow = window.open('', '_blank');
    const txRows = (filteredTransactions || []).map(tx => {
      if (tx.type === 'CHARGE') {
        totalCharges += Number(tx.amount) || 0;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-size: 13px; color: #1e293b;">${formatDate(tx.date)}</td>
            <td style="padding: 12px; font-size: 13px; color: #475569; font-family: monospace;">#${tx.id || 'N/A'}</td>
            <td style="padding: 12px; font-size: 13px; color: #475569;">System Billing - Monthly Fee</td>
            <td style="padding: 12px; font-size: 13px; color: #64748b;">System</td>
            <td style="padding: 12px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626;">-₹${Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }
      totalPayments += Number(tx.amount) || 0;
      totalVat += Number(tx.vatAmount) || 0;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-size: 13px; color: #1e293b;">${formatDate(tx.date)}</td>
          <td style="padding: 12px; font-size: 13px; color: #475569; font-family: monospace;">#${tx.id || 'N/A'}</td>
          <td style="padding: 12px; font-size: 13px; color: #475569;">${tx.paymentMethod} · ${tx.source}</td>
          <td style="padding: 12px; font-size: 13px; color: #64748b;">${tx.collectedBy}</td>
          <td style="padding: 12px; text-align: right;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Subtotal: ₹${(Number(tx.amount) - Number(tx.vatAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">VAT (13%): ₹${Number(tx.vatAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 13px; font-weight: bold; color: #16a34a; border-top: 1px dashed #cbd5e1; padding-top: 4px;">Total: +₹${Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement_${profile.customerId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #334155; }
            .header-image { width: 100%; max-height: 160px; object-fit: contain; margin-bottom: 20px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .meta-box { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print { .no-print { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer;">Print / Download PDF</button>
            <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer;">Close</button>
          </div>
          <img src="${invoiceHeaderImg}" alt="Header" class="header-image" />
          <div class="header">
            <div>
              <h1 style="margin: 0; font-size: 24px; color: #0f172a;">ACCOUNT STATEMENT</h1>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Generated on ${formatDate(new Date().toISOString())}</p>
            </div>
            <div style="text-align: right;">
              <h3 style="margin: 0; color: #1e293b;">${profile.name}</h3>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">ID: ${profile.customerId} · ${profile.assignedArea}</p>
            </div>
          </div>
          <div class="meta-box">
            <div>
              <span style="font-size: 12px; color: #64748b; font-weight: bold;">Outstanding Balance</span>
              <h2 style="margin: 4px 0 0 0; color: #dc2626;">₹${Number(profile.outstandingPayment).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 12px; color: #64748b; font-weight: bold;">Smart Wallet Balance</span>
              <h2 style="margin: 4px 0 0 0; color: #16a34a;">₹${Number(profile.advanceBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>
          <h3>Transaction Records</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Method & Source</th>
                <th>Collected By</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${txRows || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8;">No transactions found.</td></tr>'}
            </tbody>
            ${filteredTransactions.length > 0 ? `
              <tfoot style="background: #f8fafc; border-top: 2px solid #e2e8f0;">
                <tr>
                  <td colspan="4" style="padding: 12px; text-align: right; font-weight: bold; color: #475569;">Total Billed (Charges):</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold; color: #dc2626;">-₹${totalCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: 12px; text-align: right; font-weight: bold; color: #475569;">Subtotal (from Payments):</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold; color: #1e293b;">+₹${(totalPayments - totalVat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: 12px; text-align: right; font-weight: bold; color: #475569;">VAT (13%):</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold; color: #1e293b;">+₹${totalVat.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: 12px; text-align: right; font-weight: bold; color: #0f172a; font-size: 14px;">Total Amount Received:</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold; color: #16a34a; font-size: 14px;">+₹${totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
          <div class="footer">
            <p>This is a system-generated financial summary report statement documentation sheet.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!customerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Customer Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        )}

        {error && (
          <div className="m-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {profile && (
          <div className="p-6 space-y-6">
            {/* Identity Card */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                  {profile.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{profile.name}</h3>
                  <p className="text-sm text-slate-500">{profile.customerId} · {profile.assignedArea}</p>
                </div>
              </div>
              <div className="text-slate-600 text-sm space-y-1">
                <p>Registered: {formatDate(profile.createdAt)}</p>
                <p>Billing Cycle: <span className="font-medium text-slate-800">{profile.billingCycleDay ? `Day ${profile.billingCycleDay}` : 'Global Default'}</span></p>
                {Number(profile.outstandingPayment) > 0 && profile.dueStartDate && profile.dueEndDate && (
                  <p className="text-amber-600 font-medium">
                    Historical Debt Period: {formatDate(profile.dueStartDate)} — {formatDate(profile.dueEndDate)}
                  </p>
                )}
              </div>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Outstanding Due</p>
                <p className={`text-2xl font-bold ${Number(profile.outstandingPayment) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  ₹{Number(profile.outstandingPayment).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Smart Wallet</p>
                <p className={`text-2xl font-bold ${Number(profile.advanceBalance) > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                  ₹{Number(profile.advanceBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Transaction History (The Ledger Container) */}
            <div className="space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center shrink-0">
                  <Clock className="w-4 h-4 mr-2 text-emerald-500" />
                  Transaction History ({filteredTransactions.length || 0})
                </h4>

                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:border-emerald-300 transition-colors">
                    <div className="pl-3 pr-2 text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="text-xs bg-transparent py-2 pr-3 font-semibold text-slate-700 outline-none cursor-pointer hover:text-emerald-600 transition-colors"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="last7">Last 7 Days</option>
                      <option value="last14">Last 14 Days</option>
                      <option value="thisMonth">This Month</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="last3Months">Last 3 Months</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {dateFilter === 'custom' && (
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm hover:border-emerald-300 transition-colors">
                      <input 
                        type="date" 
                        value={customStart} 
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="text-xs font-medium text-slate-600 bg-transparent outline-none p-1 cursor-pointer"
                      />
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <input 
                        type="date" 
                        value={customEnd} 
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="text-xs font-medium text-slate-600 bg-transparent outline-none p-1 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Statements Action Buttons Trigger Toolbar */}
                  {filteredTransactions.length > 0 && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
                      <button
                        onClick={handleViewStatement}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm border border-slate-200 active:scale-95"
                        title="Print PDF Statement"
                      >
                        <FileText className="w-4 h-4 text-sky-500" />
                        <span className="hidden sm:inline">Statement</span>
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(!filteredTransactions || filteredTransactions.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  No transactions recorded for this period.
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredTransactions.map((tx) => {
                    if (tx.type === 'CHARGE') {
                      return (
                        <li key={tx.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  System Billing
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-slate-500 font-medium">
                                    {formatDate(tx.date)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-orange-600">
                                -₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]" title={tx.description}>
                                {tx.description}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={tx.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-green-100 text-green-600">
                              <TrendingUp className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {tx.paymentMethod} · {tx.source}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500 flex items-center">
                                  <User className="w-3 h-3 mr-1" /> {tx.collectedBy}
                                </span>
                                <p className="text-xs text-slate-500 font-medium">
                                  {formatDate(tx.date)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-600">
                              +₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              VAT: ₹{Number(tx.vatAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        {tx.note && <p className="mt-2 text-xs text-slate-500 italic border-t border-slate-200 pt-2">{tx.note}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CUSTOMERS PAGE
// ============================================================================
export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Slide-over state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Sudo Password Reset State
  const [sudoConfig, setSudoConfig] = useState({ isOpen: false, customerId: null });
  const [sudoLoading, setSudoLoading] = useState(false);
  const [sudoError, setSudoError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const fetchCustomers = useCallback(async (page = 1, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: pagination.limit };
      if (search) params.search = search;

      const res = await api.get('/customers', { params });
      if (res.data.success) {
        setCustomers(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      setError('Failed to load customer roster.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchCustomers(1, searchQuery);
  }, [searchQuery]);

  const handlePageChange = (newPage) => {
    fetchCustomers(newPage, searchQuery);
  };

  const handleAddSuccess = (newCustomer) => {
    setCustomers((prev) => [newCustomer, ...prev]);
    setPagination((prev) => ({ ...prev, totalCount: prev.totalCount + 1 }));
  };

  const handleEditSuccess = (updatedCustomer) => {
    setCustomers((prev) => prev.map((c) => (c.customerId === updatedCustomer.customerId ? { ...c, ...updatedCustomer } : c)));
    setSuccessToast('Customer updated successfully');
  };

  // ── Reset Password Handler ──
  const handleResetPasswordConfirm = async (sudoPassword) => {
    try {
      setSudoError('');
      const res = await api.post(`/customers/${sudoConfig.customerId}/reset-password`, { sudoPassword });
      if (res.data.success) {
        setSuccessToast(`Temporary Password: ${res.data.data.newPassword}`);
        setSudoConfig({ isOpen: false, customerId: null });
      }
    } catch (err) {
      setSudoError(err.response?.data?.error || 'Password reset failed.');
    } finally {
      setSudoLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
          <p className="text-slate-500 mt-1">{pagination.totalCount.toLocaleString()} registered customers</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Customer
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by Phone or Customer ID (e.g. 984... or GDW-...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
          Page {pagination.page} of {pagination.totalPages || 1}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer ID</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Area</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Outstanding Due</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Smart Wallet</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Loading customers...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No customers found.</p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const outstanding = Number(c.outstandingPayment);
                  const advance = Number(c.advanceBalance);
                  return (
                    <tr key={c.customerId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{c.customerId}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-4 text-slate-600">{c.assignedArea}</td>
                      <td className="px-6 py-4 text-slate-600">{c.phone || <span className="text-slate-300 italic">—</span>}</td>
                      <td className={`px-6 py-4 text-right font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        ₹{outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold ${advance > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                        ₹{advance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedCustomerId(c.customerId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => { setEditingCustomer(c); setShowEditModal(true); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setSudoConfig({ isOpen: true, customerId: c.customerId })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-sm text-slate-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="text-sm font-medium text-slate-700 px-2">{pagination.page}</span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Customer Modal */}
      <EditCustomerModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingCustomer(null); }}
        customer={editingCustomer}
        onSuccess={handleEditSuccess}
      />

      {/* Customer Profile Slide-Over */}
      <CustomerProfile
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />

      {sudoConfig.isOpen && (
        <SudoModal 
          isOpen={sudoConfig.isOpen} 
          onClose={() => setSudoConfig({ isOpen: false, customerId: null })}
          onConfirm={handleResetPasswordConfirm} 
          loading={sudoLoading}
          error={sudoError}
          title="Reset Customer Password" 
          message="Enter master admin password to generate a temporary password for this customer." 
        />
      )}

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