import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';
import { UserCircle, Loader2, Plus, Search, Download } from 'lucide-react';
import DatePicker from '../../components/DatePicker';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function LogSalaryModal({ isOpen, onClose, onSuccess, customDeductions }) {
  const [form, setForm] = useState({ 
    staffId: '', transactionDate: new Date().toISOString().split('T')[0], 
    basicPay: '', notes: ''
  });
  const [deductionsInput, setDeductionsInput] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setForm({ staffId: '', transactionDate: new Date().toISOString().split('T')[0], basicPay: '', notes: '' });
      setDeductionsInput({});
      
      const fetchStaff = async () => {
        try {
          const res = await api.get('/hr/staff?limit=200');
          if (res.data?.success) {
            setStaffList(res.data.data);
          }
        } catch (err) {
          console.error('Failed to fetch staff:', err);
        }
      };
      fetchStaff();
    }
  }, [isOpen]);

  useEffect(() => {
    if (form.basicPay && customDeductions?.length > 0) {
      const basic = Number(form.basicPay) || 0;
      const initial = {};
      customDeductions.forEach(d => {
        initial[d.name] = (basic * (Number(d.percentage) / 100)).toFixed(2);
      });
      setDeductionsInput(initial);
    } else if (!form.basicPay) {
      setDeductionsInput({});
    }
  }, [form.basicPay, customDeductions]);

  const handleDeductionChange = (name, val) => {
    setDeductionsInput(prev => ({ ...prev, [name]: val }));
  };

  const calculateNet = () => {
    const basic = Number(form.basicPay) || 0;
    let totalDed = 0;
    Object.values(deductionsInput).forEach(v => {
      totalDed += Number(v) || 0;
    });
    return basic - totalDed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const dedArray = Object.keys(deductionsInput).map(k => ({
        name: k,
        amount: Number(deductionsInput[k] || 0)
      }));

      const payload = {
        staffId: Number(form.staffId),
        date: new Date(form.transactionDate).toISOString(),
        basicPay: Number(form.basicPay),
        deductions: dedArray,
        note: form.notes,
      };
      
      const res = await api.post('/accounting/salary', payload);
      if (res.data?.success) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log salary');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const inputClass = "w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col my-8" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-blue-100 bg-blue-50 shrink-0">
          <h2 className="text-xl font-bold text-blue-900 flex items-center"><UserCircle className="w-5 h-5 mr-2 text-blue-600" /> Log Staff Salary</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50 overflow-y-auto">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Staff Member</label>
              <select required value={form.staffId} onChange={e => setForm({...form, staffId: e.target.value})} className={inputClass}>
                <option value="">Select a Staff Member...</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role}) - #{s.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Date</label>
              <div className={`h-[42px] border border-slate-200 rounded-lg  bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white`}>
                <DatePicker required name="transactionDate" value={form.transactionDate} onChange={e => setForm({...form, transactionDate: e.target.value})} className="h-full" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Basic Pay (₹)</label>
            <input type="number" step="0.01" required value={form.basicPay} onChange={e => setForm({...form, basicPay: e.target.value})} className={inputClass} />
          </div>

          {customDeductions?.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Dynamic Deductions</h3>
              <div className="grid grid-cols-2 gap-4">
                {customDeductions.map(d => (
                  <div key={d.name}>
                    <label className="block text-xs font-bold text-red-600 mb-1">{d.name} ({d.percentage}%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={deductionsInput[d.name] !== undefined ? deductionsInput[d.name] : ''} 
                      onChange={e => handleDeductionChange(d.name, e.target.value)} 
                      className={`${inputClass} border-red-200 focus:ring-red-500`} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">Calculated Net Pay (₹)</label>
            <input type="text" value={formatCurrency(calculateNet())} readOnly className={`${inputClass} bg-slate-200 font-bold text-slate-900`} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes (Optional)</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputClass} rows={2}></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Salary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffSalary() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [entries, setEntries] = useState([]);
  const [customDeductions, setCustomDeductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const { formatDate } = useSettings();

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/system/settings');
      if (res.data?.success) {
        setCustomDeductions(res.data.data.customDeductions || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/salary');
      if (res.data?.success) {
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

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(tx => {
      const q = searchQuery.toLowerCase();
      return (
        tx.staffName.toLowerCase().includes(q) || 
        formatDate(tx.date).toLowerCase().includes(q) ||
        tx.role.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, formatDate]);

  // Aggregate all unique deduction names from entries to build dynamic table headers & CSV columns
  const dynamicDeductionNames = useMemo(() => {
    const names = new Set();
    filteredEntries.forEach(tx => {
      if (Array.isArray(tx.deductions)) {
        tx.deductions.forEach(d => names.add(d.name));
      }
    });
    return Array.from(names);
  }, [filteredEntries]);

  const exportCSV = () => {
    const headers = ['Date', 'Staff Name', 'Role', 'Basic Pay', ...dynamicDeductionNames, 'Net Pay', 'Notes'];
    
    const rows = filteredEntries.map(tx => {
      const dedMap = {};
      if (Array.isArray(tx.deductions)) {
        tx.deductions.forEach(d => { dedMap[d.name] = d.amount; });
      }

      const dedCols = dynamicDeductionNames.map(name => dedMap[name] || '0.00');

      return [
        formatDate(tx.date),
        tx.staffName,
        tx.role,
        tx.basicPay,
        ...dedCols,
        tx.netPay,
        `"${tx.note || ''}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Staff_Salary_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Salary Ledger</h1>
          <p className="text-slate-500 mt-1">Dedicated ledger for payroll and dynamic deductions.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4 mr-2" /> Log Salary
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
                placeholder="Search staff name..." 
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
                <th className="px-6 py-4">Staff Name</th>
                <th className="px-6 py-4 text-right">Basic Pay</th>
                {dynamicDeductionNames.map(name => (
                  <th key={name} className="px-6 py-4 text-right text-red-600">{name}</th>
                ))}
                <th className="px-6 py-4 text-right font-extrabold text-slate-900">Net Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(tx => {
                  const dedMap = {};
                  if (Array.isArray(tx.deductions)) {
                    tx.deductions.forEach(d => { dedMap[d.name] = d.amount; });
                  }
                  
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-bold">{tx.staffName}</div>
                        <div className="text-slate-500 text-xs uppercase tracking-wider">{tx.role}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">
                        ₹{formatCurrency(tx.basicPay)}
                      </td>
                      {dynamicDeductionNames.map(name => (
                        <td key={name} className="px-6 py-4 text-right font-medium text-red-600">
                          -₹{formatCurrency(dedMap[name] || '0')}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right font-bold text-slate-900 text-base">₹{formatCurrency(tx.netPay)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={5 + dynamicDeductionNames.length} className="text-center py-16 text-slate-400 font-medium bg-white">No salary entries found.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <LogSalaryModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchEntries} customDeductions={customDeductions} />
    </div>
  );
}
