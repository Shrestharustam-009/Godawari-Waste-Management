import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';
import { Truck, Loader2, Plus, Tag, Search, Download } from 'lucide-react';
import DatePicker from '../../components/DatePicker';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function AddCategoryModal({ isOpen, onClose, onSuccess, type }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.post('/accounting/categories', { 
        name: form.name, 
        description: form.description, 
        type 
      });
      if (res.data?.success) {
        setForm({ name: '', description: '' });
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const inputClass = "w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Tag className="w-5 h-5 mr-2 text-orange-600" /> Add Fleet Category
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category Name (e.g. Fuel, Repairs)</label>
            <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputClass} placeholder="e.g. Diesel" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border hover:bg-slate-50 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogVehicleExpenseModal({ isOpen, onClose, onSuccess, categories }) {
  const [form, setForm] = useState({ 
    vehicleId: '', amount: '', categoryId: '', subCategory: '', transactionDate: new Date().toISOString().split('T')[0], notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setForm({ vehicleId: '', amount: '', categoryId: '', subCategory: '', transactionDate: new Date().toISOString().split('T')[0], notes: '' });
      
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
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const payload = {
        vehicleId: Number(form.vehicleId),
        amount: Number(form.amount),
        vehicleExpenseCategoryId: Number(form.categoryId),
        date: new Date(form.transactionDate).toISOString(),
        notes: form.notes,
      };
      
      const res = await api.post('/accounting/expenses/vehicle', payload);
      if (res.data?.success) {
        setForm({ vehicleId: '', amount: '', categoryId: '', subCategory: '', transactionDate: new Date().toISOString().split('T')[0], notes: '' });
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log vehicle expense');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const inputClass = "w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-orange-100 bg-orange-50">
          <h2 className="text-xl font-bold text-orange-900 flex items-center"><Truck className="w-5 h-5 mr-2 text-orange-600" /> Log Fleet Expense</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Vehicle</label>
              <select required value={form.vehicleId} onChange={e => setForm({...form, vehicleId: e.target.value})} className={inputClass}>
                <option value="">Select a Vehicle...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.vehicleId} {v.registrationNumber ? `(${v.registrationNumber})` : ''} - {v.type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount (₹)</label>
              <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fleet Cost Bucket (Category)</label>
            <select required value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className={inputClass}>
              <option value="">Select Category</option>
              {Array.isArray(categories?.vehicleExpense) && categories.vehicleExpense.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {/* Sub-category removed as it's not supported in VehicleExpenseLedger */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Transaction Date</label>
            <div className={`h-[42px] border border-slate-200 rounded-lg  bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white`}>
              <DatePicker required name="transactionDate" value={form.transactionDate} onChange={e => setForm({...form, transactionDate: e.target.value})} className="h-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes / Invoice Number</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Vehicle Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VehicleExpenses() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState({ vehicleExpense: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const { formatDate } = useSettings();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/expenses/vehicle');
      if (res.data?.success) {
        // Filter locally by date range since the endpoint returns all
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate + 'T23:59:59.999Z');
        
        const filtered = (res.data.data || []).filter(tx => {
          const txDate = new Date(tx.date);
          return txDate >= start && txDate <= end;
        });
        setEntries(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/accounting/categories');
      if (res.data?.success) {
        setCategories({ vehicleExpense: res.data.data.vehicleExpense || [] });
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchEntries();
    fetchCategories();
  }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(tx => {
      const q = searchQuery.toLowerCase();
      return (
        tx.categoryName.toLowerCase().includes(q) || 
        formatDate(tx.date).toLowerCase().includes(q) ||
        String(tx.vehicleId).includes(q) ||
        tx.registrationNumber.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, formatDate]);

  const exportCSV = () => {
    const headers = ['Date', 'Vehicle ID', 'Registration', 'Category', 'Amount', 'Notes'];
    const rows = filteredEntries.map(tx => [
      formatDate(tx.date),
      tx.vehicleId,
      tx.registrationNumber,
      tx.categoryName,
      tx.amount,
      `"${tx.note || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Vehicle_Expenses_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vehicle & Fleet Expenses</h1>
          <p className="text-slate-500 mt-1">Specialized ledger for tracking fleet operational costs.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCategoryModal(true)} className="inline-flex items-center px-4 py-2 bg-white border hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </button>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Log Vehicle Expense
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
          
          {/* Top Row: Search and Export */}
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-end">
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by ID, Reg No or category..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            
            <button onClick={exportCSV} className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm shadow-sm transition-all w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" /> Export
            </button>
          </div>

          {/* Bottom Row: Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start gap-3 pt-3 border-t border-slate-200/60 w-full">
            <span className="text-sm font-semibold text-slate-500 mb-1 sm:mb-0">Filter Date:</span>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="border border-slate-300 rounded-lg h-[40px] w-full sm:w-[150px]">
                <DatePicker name="startDate" value={dateRange.startDate} onChange={e => setDateRange({...dateRange, startDate: e.target.value})} className="h-full w-full" />
              </div>
              <span className="text-slate-400 text-sm hidden sm:inline-block">to</span>
              <div className="border border-slate-300 rounded-lg h-[40px] w-full sm:w-[150px]">
                <DatePicker name="endDate" value={dateRange.endDate} onChange={e => setDateRange({...dateRange, endDate: e.target.value})} className="h-full w-full" />
              </div>
            </div>
          </div>

        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" /></div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Vehicle ID</th>
                <th className="px-6 py-4">Reg No</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right font-extrabold text-slate-900">Amount</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">{formatDate(tx.date)}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">#{tx.vehicleId}</td>
                    <td className="px-6 py-4 text-slate-900 font-medium">{tx.registrationNumber}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-medium">{tx.categoryName}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">₹{formatCurrency(tx.amount)}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs italic max-w-xs truncate">{tx.note}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400 font-medium bg-white">No vehicle expenses found.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <LogVehicleExpenseModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchEntries} categories={categories} />
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={fetchCategories} type="VEHICLE_EXPENSE" />
    </div>
  );
}
