import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';
import { TrendingUp, Loader2, Plus, Tag, Search, Download, RotateCcw } from 'lucide-react';
import DatePicker from '../../components/DatePicker';
import { generateInvoiceHTML, generateSalesReturnHTML } from '../../lib/printTemplates';
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
  const inputClass = "w-full bg-white dark:bg-slate-800 transition-colors duration-200 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-shadow";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 rounded-xl shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <Tag className="w-5 h-5 mr-2 text-brand-600" /> Add Main Category
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category Name</label>
            <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputClass} placeholder="e.g. Recyclable Sales" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description (Optional)</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 transition-colors duration-200 border hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:bg-slate-900/50 rounded-xl">Cancel</button>
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
  const inputClass = "w-full bg-white dark:bg-slate-800 transition-colors duration-200 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 rounded-xl shadow-xl w-full max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-brand-100 bg-brand-50 dark:bg-brand-900/20">
          <h2 className="text-xl font-bold text-brand-900 dark:text-brand-100 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-brand-600" /> Log Manual Income</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50 dark:bg-slate-900/50">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Gross Amount (₹)</label>
            <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Main Category</label>
            <select required value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className={inputClass}>
              <option value="">Select Category</option>
              {Array.isArray(categories?.income) && categories.income.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sub-Category (Optional)</label>
            <input type="text" value={form.subCategory} onChange={e => setForm({...form, subCategory: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Transaction Date</label>
            <div className={`h-[42px] border border-slate-200 dark:border-slate-700 rounded-lg  bg-slate-50 dark:bg-slate-900/50 focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white dark:bg-slate-800 transition-colors duration-200`}>
              <DatePicker required name="transactionDate" value={form.transactionDate} onChange={e => setForm({...form, transactionDate: e.target.value})} className="h-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 transition-colors duration-200 border hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800/50 rounded-xl">Cancel</button>
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
  
  // Sales Return State
  const [returnTx, setReturnTx] = useState({ isOpen: false, tx: null, reason: '' });
  const [returnLoading, setReturnLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [filterType, setFilterType] = useState('ALL'); // ALL | MANUAL_ENTRY | FIELD_APP
  const [searchQuery, setSearchQuery] = useState('');
  const { settings, formatDate } = useSettings();

  // Track which original invoices have already been returned
  const returnedRefIds = useMemo(() => {
    return new Set(
      entries
        .filter(e => e.isSalesReturn && e.returnRefId)
        .map(e => Number(e.returnRefId))
    );
  }, [entries]);

  const handlePrint = async (tx) => {
    const isReturn = tx.isSalesReturn || Number(tx.amount) < 0;
    const html = isReturn 
      ? generateSalesReturnHTML(tx, settings, formatDate) 
      : generateInvoiceHTML(tx, settings, formatDate);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Only increment print count for regular tax invoices, AFTER user completes print dialog
    if (!isReturn) {
      printWindow.onafterprint = async () => {
        try {
          await api.post(`/accounting/income/${tx.id}/print`);
          fetchStatements(); // Refresh to update print count
        } catch (err) {
          console.error('Failed to update print count', err);
        }
      };
    }
  };

  const handleSalesReturn = async () => {
    if (!returnTx.tx?.id || !returnTx.reason.trim()) return;
    setReturnLoading(true);
    try {
      const res = await api.post(`/accounting/income/${returnTx.tx.id}/return`, {
        reason: returnTx.reason.trim()
      });
      if (res.data?.success) {
        setToastMessage({ type: 'success', text: `Sales Return processed successfully for REC-${returnTx.tx.id}. Credit Note created.` });
        setReturnTx({ isOpen: false, tx: null, reason: '' });
        fetchStatements();
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error('Sales Return failed:', err);
      setToastMessage({ type: 'error', text: err.response?.data?.error || 'Failed to process Sales Return.' });
    } finally {
      setReturnLoading(false);
    }
  };

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
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchType;

      const recordIdStr = String(tx.id || '');
      const recFormatted = `rec-${tx.id || ''}`.toLowerCase();
      const returnRefFormatted = tx.returnRefId ? `rec-${tx.returnRefId}`.toLowerCase() : '';
      const customerName = (tx.customer?.name || '').toLowerCase();
      const customerId = (tx.customer?.customerId || '').toLowerCase();
      const category = (tx.categoryName || '').toLowerCase();
      const subCat = (tx.subCategory || '').toLowerCase();
      const dateStr = formatDate(tx.date).toLowerCase();
      const note = (tx.note || '').toLowerCase();
      const reason = (tx.returnReason || '').toLowerCase();
      const method = (tx.paymentMethod || '').toLowerCase();

      const matchSearch = 
        recordIdStr.includes(q) ||
        recFormatted.includes(q) ||
        returnRefFormatted.includes(q) ||
        customerName.includes(q) ||
        customerId.includes(q) ||
        category.includes(q) ||
        subCat.includes(q) ||
        dateStr.includes(q) ||
        note.includes(q) ||
        reason.includes(q) ||
        method.includes(q);

      return matchType && matchSearch;
    });
  }, [entries, filterType, searchQuery, formatDate]);

  const handleResetFilter = () => {
    setSearchQuery('');
    setFilterType('ALL');
    const resetRange = {
      startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    };
    setDateRange(resetRange);
  };

  const exportCSV = () => {
    const headers = ['Invoice No', 'Date', 'Source', 'Customer Name', 'Customer ID', 'Main Category', 'Sub-Category', 'Base Revenue', 'VAT Amount', 'Total Amount', 'Payment Method', 'Notes'];
    const rows = filteredEntries.map(tx => [
      tx.isSalesReturn ? `CN-${tx.id}` : `REC-${tx.id}`,
      formatDate(tx.date),
      tx.source === 'FIELD_APP' ? 'Field Collection' : 'Manual Income',
      `"${(tx.customer?.name || '').replace(/"/g, '""')}"`,
      `"${(tx.customer?.customerId || '').replace(/"/g, '""')}"`,
      `"${(tx.categoryName || '').replace(/"/g, '""')}"`,
      `"${(tx.subCategory || '-').replace(/"/g, '""')}"`,
      tx.baseAmount,
      tx.vatAmount,
      tx.amount,
      tx.paymentMethod || '-',
      `"${(tx.note || '').replace(/"/g, '""')}"`
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Income Ledger</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track all revenue streams and dynamic output VAT.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCategoryModal(true)} className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 transition-colors duration-200 border hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </button>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Log Income
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 transition-colors duration-200 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50 space-y-4">
          
          {/* Top Sub-Row: Source Tabs & Export CSV */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap items-center bg-slate-200/60 dark:bg-slate-900/70 p-1 rounded-xl w-full sm:w-auto">
              {[
                { key: 'ALL', label: 'All Collections' },
                { key: 'FIELD_APP', label: 'Field Staff' },
                { key: 'MANUAL_ENTRY', label: 'Manual Income' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterType(tab.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-none ${
                    filterType === tab.key
                      ? 'bg-white dark:bg-slate-800 shadow text-brand-600 dark:text-brand-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={exportCSV}
              disabled={loading || filteredEntries.length === 0}
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50 w-full sm:w-auto"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Export CSV
            </button>
          </div>

          {/* Main Filter Grid (Styled exactly like Sales Register) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-2 border-t border-slate-200 dark:border-slate-700/50">
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Search Invoice / Customer
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search REC-ID, customer, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                From Date
              </label>
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg h-[38px] bg-white dark:bg-slate-900 flex items-center px-2.5 shadow-sm">
                <DatePicker
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="h-full w-full text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                To Date
              </label>
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg h-[38px] bg-white dark:bg-slate-900 flex items-center px-2.5 shadow-sm">
                <DatePicker
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="h-full w-full text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchStatements}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition shadow-sm h-[38px]"
              >
                <Filter className="w-3.5 h-3.5 mr-1" />
                Filter
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg h-[38px] flex items-center justify-center bg-white dark:bg-slate-800"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" /></div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-5 py-3.5">Invoice No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Customer / Category</th>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5 text-right">Base Revenue</th>
                <th className="px-5 py-3.5 text-right text-emerald-600">VAT (13%)</th>
                <th className="px-5 py-3.5 text-right font-extrabold text-slate-900 dark:text-white">Total Amount</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors bg-white dark:bg-slate-800">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {tx.isSalesReturn ? (
                        <div>
                          <span className="font-bold font-mono text-amber-600 dark:text-amber-400 text-xs">CN-{tx.id}</span>
                          {tx.returnRefId && (
                            <div className="text-[10px] text-slate-400 font-mono">Ref: REC-{tx.returnRefId}</div>
                          )}
                        </div>
                      ) : (
                        <span className="font-bold font-mono text-brand-600 dark:text-brand-400 text-xs">
                          REC-{tx.id}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs font-medium">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-slate-900 dark:text-white font-medium text-xs">
                        {tx.customer?.name || tx.categoryName}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
                        <span>{tx.customer?.name ? tx.categoryName : (tx.subCategory !== '-' ? tx.subCategory : '')}</span>
                        {tx.customer?.customerId && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-slate-500 dark:text-slate-400 font-mono">
                            {tx.customer.customerId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        tx.source === 'FIELD_APP' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {tx.source === 'FIELD_APP' ? 'Field' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-600 dark:text-slate-400 text-xs">
                      Rs. {formatCurrency(tx.baseAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-emerald-600 text-xs">
                      {Number(tx.vatAmount) > 0 ? `Rs. ${formatCurrency(tx.vatAmount)}` : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white text-xs">
                      Rs. {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handlePrint(tx)}
                          className="text-xs font-semibold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors inline-flex items-center shadow-sm"
                        >
                          Print {tx.printCount > 0 && !tx.isSalesReturn ? `(${tx.printCount})` : ''}
                        </button>

                        {tx.isSalesReturn ? (
                          <span className="text-[11px] font-bold px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-700">
                            Credit Note (फिर्ता)
                          </span>
                        ) : returnedRefIds.has(tx.id) ? (
                          <span className="text-[11px] font-semibold px-2 py-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700">
                            Voided (फिर्ता भइसकेको)
                          </span>
                        ) : Number(tx.amount) > 0 ? (
                          <button 
                            onClick={() => setReturnTx({ isOpen: true, tx, reason: '' })}
                            className="text-xs font-semibold px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 dark:text-rose-300 rounded-md transition-colors inline-flex items-center border border-rose-200 dark:border-rose-800 shadow-sm"
                            title="Issue Sales Return (Credit Note)"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="text-center py-16 text-slate-400 dark:text-slate-500 font-medium bg-white dark:bg-slate-800 transition-colors duration-200">No income entries found matching criteria.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2 duration-300 ${toastMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'}`}>
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-xs uppercase underline ml-4">Dismiss</button>
        </div>
      )}

      {/* Sales Return Confirmation Modal */}
      {returnTx.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setReturnTx({ isOpen: false, tx: null, reason: '' })}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Issue Sales Return (Credit Note)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receipt: REC-{returnTx.tx?.id} • Amount: ₹{formatCurrency(returnTx.tx?.amount)}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200 mb-4">
              <strong>IRD Compliance Notice:</strong> This action will NOT delete the original invoice. It will create a compensating Credit Note, reverse customer dues/advance, and add to Schedule 9.
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Reason for Return (Mandatory) *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Billed wrong customer, double collection, customer requested refund..."
                value={returnTx.reason}
                onChange={(e) => setReturnTx(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full text-sm p-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={returnLoading}
                onClick={() => setReturnTx({ isOpen: false, tx: null, reason: '' })}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!returnTx.reason.trim() || returnLoading}
                onClick={handleSalesReturn}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 inline-flex items-center shadow-sm transition"
              >
                {returnLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      <LogIncomeModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchStatements} categories={categories} />
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={fetchCategories} type="INCOME" />
    </div>
  );
}
