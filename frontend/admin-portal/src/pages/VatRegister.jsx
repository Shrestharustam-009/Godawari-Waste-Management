import React, { useState, useEffect } from 'react';
import { FileText, Search, Loader2, Calendar } from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';

export default function VatRegister() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { formatDate, settings } = useSettings();
  
  // Basic date filtering
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchVatRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/accounting/vat-register', { params });
      if (res.data?.success) {
        setRecords(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch VAT register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVatRegister();
  }, []);

  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <FileText className="w-7 h-7 mr-3 text-brand-500" />
            VAT Sales Register
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Official record of all VAT-applicable sales for IRD compliance.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center shadow-sm justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Date:</span>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg h-[40px] w-full sm:w-[140px] bg-white dark:bg-slate-900/50">
              <DatePicker 
                name="startDate"
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="h-full w-full"
              />
            </div>
            <span className="text-slate-400 text-sm hidden sm:inline-block">to</span>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg h-[40px] w-full sm:w-[140px] bg-white dark:bg-slate-900/50">
              <DatePicker 
                name="endDate"
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
        <button 
          onClick={fetchVatRegister}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors h-[40px] w-full sm:w-auto"
        >
          Filter
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Invoice / Ref No</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer PAN/VAT</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Total Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Base Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">VAT Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <span className="text-slate-500 dark:text-slate-400">Loading register...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No VAT sales found for the selected period.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">REC-{rec.id}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{rec.customer?.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{rec.customer?.vatNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold text-right">Rs. {formatCurrency(rec.amount)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-right">Rs. {formatCurrency(rec.baseAmount)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-right">Rs. {formatCurrency(rec.vatAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
