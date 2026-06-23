import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';
import { TrendingUp, Loader2, Plus, Tag, Search, Download } from 'lucide-react';
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
  const inputClass = "w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-shadow";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Tag className="w-5 h-5 mr-2 text-brand-600" /> Add Main Category
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category Name</label>
            <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputClass} placeholder="e.g. Recyclable Sales" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border hover:bg-slate-50 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogIncomeModal({ isOpen, onClose, onSuccess, categories }) {
  const [form, setForm] = useState({ 
    amount: '', categoryId: '', subCategory: '', transactionDate: new Date().toISOString().split('T')[0], notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const payload = {
        amount: Number(form.amount),
        categoryId: Number(form.categoryId),
        subCategory: form.subCategory,
        date: new Date(form.transactionDate).toISOString(),
        notes: form.notes,
      };
      
      const res = await api.post('/accounting/income', payload);
      if (res.data?.success) {
        setForm({ amount: '', categoryId: '', subCategory: '', transactionDate: new Date().toISOString().split('T')[0], notes: '' });
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log income');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const inputClass = "w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-brand-100 bg-brand-50">
          <h2 className="text-xl font-bold text-brand-900 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-brand-600" /> Log Manual Income</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gross Amount (₹)</label>
            <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Main Category</label>
            <select required value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className={inputClass}>
              <option value="">Select Category</option>
              {Array.isArray(categories?.income) && categories.income.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sub-Category (Optional)</label>
            <input type="text" value={form.subCategory} onChange={e => setForm({...form, subCategory: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Date</label>
            <div className={`h-[42px] border border-slate-200 rounded-lg overflow-hidden bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white`}>
              <DatePicker required name="transactionDate" value={form.transactionDate} onChange={e => setForm({...form, transactionDate: e.target.value})} className="h-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IncomeLedger() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState({ income: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const [filterType, setFilterType] = useState('ALL'); // ALL | MANUAL_ENTRY | FIELD_APP
  const [searchQuery, setSearchQuery] = useState('');
  const { formatDate } = useSettings();

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    try {
      const payload = {
        startDate: new Date(dateRange.startDate).toISOString(),
        endDate: new Date(dateRange.endDate + 'T23:59:59.999Z').toISOString()
      };
      const res = await api.get('/accounting/statements', { params: payload });
      if (res.data?.success) {
        setEntries(res.data.data.incomeEntries || []);
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
        setCategories({ income: res.data.data.income || [] });
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchStatements();
    fetchCategories();
  }, [fetchStatements]);

  const filteredEntries = useMemo(() => {
    return entries.filter(tx => {
      const matchType = filterType === 'ALL' ? true : tx.source === filterType;
      const q = searchQuery.toLowerCase();
      const matchSearch = tx.categoryName.toLowerCase().includes(q) || formatDate(tx.date).toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [entries, filterType, searchQuery, formatDate]);

  const exportCSV = () => {
    const headers = ['Date', 'Source', 'Main Category', 'Sub-Category', 'Base Revenue', 'VAT Amount', 'Total Amount', 'Notes'];
    const rows = filteredEntries.map(tx => [
      formatDate(tx.date),
      tx.source,
      tx.categoryName,
      tx.subCategory || '-',
      tx.baseAmount,
      tx.vatAmount,
      tx.amount,
      `"${tx.note || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Income_Ledger_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Income Ledger</h1>
          <p className="text-slate-500 mt-1">Track all revenue streams and dynamic output VAT.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCategoryModal(true)} className="inline-flex items-center px-4 py-2 bg-white border hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </button>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Log Income
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          
          <div className="flex items-center bg-slate-200/50 p-1 rounded-lg">
            {['ALL', 'MANUAL_ENTRY', 'FIELD_APP'].map(type => (
              <button 
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${filterType === type ? 'bg-white shadow text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {type === 'ALL' ? 'All' : type === 'MANUAL_ENTRY' ? 'Manual Income' : 'Field Income'}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search category or date..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full md:w-64 pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="border border-slate-300 rounded-lg overflow-hidden h-[38px] w-[130px]">
                <DatePicker name="startDate" value={dateRange.startDate} onChange={e => setDateRange({...dateRange, startDate: e.target.value})} className="h-full" />
              </div>
              <span className="text-slate-400 text-sm">to</span>
              <div className="border border-slate-300 rounded-lg overflow-hidden h-[38px] w-[130px]">
                <DatePicker name="endDate" value={dateRange.endDate} onChange={e => setDateRange({...dateRange, endDate: e.target.value})} className="h-full" />
              </div>
            </div>
            <button onClick={exportCSV} className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm shadow-sm transition-all">
              <Download className="w-4 h-4 mr-2" /> Export
            </button>
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
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Base Revenue</th>
                <th className="px-6 py-4 text-right text-emerald-600">Output VAT</th>
                <th className="px-6 py-4 text-right font-extrabold text-slate-900">Total Amount</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">{formatDate(tx.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${tx.source === 'FIELD_APP' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                        {tx.source === 'FIELD_APP' ? 'Field' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-medium">{tx.categoryName}</div>
                      <div className="text-slate-500 text-xs">{tx.subCategory !== '-' ? tx.subCategory : ''}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">₹{formatCurrency(tx.baseAmount)}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      {Number(tx.vatAmount) > 0 ? `+₹${formatCurrency(tx.vatAmount)} (13%)` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">₹{formatCurrency(tx.amount)}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs italic max-w-xs truncate">{tx.note}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium bg-white">No income entries found matching criteria.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <LogIncomeModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchStatements} categories={categories} />
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={fetchCategories} type="INCOME" />
    </div>
  );
}
