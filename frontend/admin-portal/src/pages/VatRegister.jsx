import React, { useState, useEffect } from 'react';
import { FileText, Search, Loader2, Download, Printer, RotateCcw, Filter } from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';
import { generateVatRegisterHTML } from '../lib/printTemplates';

export default function VatRegister() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { formatDate, settings } = useSettings();
  
  // Filter States
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchVatRegister = async (filterOverrides) => {
    setLoading(true);
    setError(null);
    try {
      const filters = filterOverrides || {
        startDate,
        endDate,
        search
      };

      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();

      const res = await api.get('/accounting/vat-register', { params });
      if (res.data?.success) {
        setRecords(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch VAT register:', err);
      setError('Failed to fetch VAT register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVatRegister();
  }, []);

  const handleApplyFilter = (e) => {
    e?.preventDefault();
    fetchVatRegister();
  };

  const handleResetFilter = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    fetchVatRegister({ startDate: '', endDate: '', search: '' });
  };

  // Totals Calculation
  const totalAmount = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalBase = records.reduce((sum, r) => sum + Number(r.baseAmount || 0), 0);
  const totalVat = records.reduce((sum, r) => sum + Number(r.vatAmount || 0), 0);

  // ── Print Register (Schedule 8) ──
  const handlePrintRegister = () => {
    const html = generateVatRegisterHTML({
      records,
      startDate,
      endDate,
      settings,
      formatDate,
      totalAmount,
      totalBase,
      totalVat
    });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Export CSV for Monthly VAT Filing ──
  const handleExportCSV = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "S.N.,Date,Invoice / Ref No,Customer Name,Customer PAN/VAT,Total Sales (Rs),Taxable Base (Rs),VAT 13% (Rs),IRD Status,IRD Sync Code\n";
    records.forEach((rec, idx) => {
      const row = [
        `"${idx + 1}"`,
        `"${formatDate(rec.date)}"`,
        `"REC-${rec.id}"`,
        `"${(rec.customer?.name || 'Cash Customer').replace(/"/g, '""')}"`,
        `"${rec.customer?.vatNumber || '-'}"`,
        `"${Number(rec.amount || 0).toFixed(2)}"`,
        `"${Number(rec.baseAmount || 0).toFixed(2)}"`,
        `"${Number(rec.vatAmount || 0).toFixed(2)}"`,
        `"${rec.isSyncedWithIRD ? 'Synced' : 'Pending'}"`,
        `"${rec.irdReceiptNo || '-'}"`
      ].join(',');
      csv += row + "\n";
    });
    csv += `"Total",,,,,"${totalAmount.toFixed(2)}","${totalBase.toFixed(2)}","${totalVat.toFixed(2)}",,\n`;

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_register_schedule_8_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <FileText className="w-7 h-7 mr-3 text-brand-500" />
            SALES REGISTER / बिक्री खाता (अनुसूची - ८)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Official sales book compliant with Nepal VAT Rules 2053 (Rule 23(1)(च) - Schedule 8) for IRD tax filing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={loading || records.length === 0}
            className="flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 shadow-sm"
          >
            <Download className="w-4 h-4 mr-2 text-slate-500" />
            Export CSV
          </button>
          <button
            onClick={handlePrintRegister}
            disabled={loading || records.length === 0}
            className="flex items-center px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Register (अनुसूची ८)
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <form onSubmit={handleApplyFilter} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Search Invoice / Customer
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search REC-ID, customer, PAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
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
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
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
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="h-full w-full text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition shadow-sm h-[38px]"
            >
              <Filter className="w-3.5 h-3.5 mr-1" />
              Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg h-[38px] flex items-center justify-center"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Main Register Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">S.N.</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date (मिति)</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Invoice No</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer PAN</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Total Amount (Rs)</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Taxable Base (Rs)</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">VAT (13%) (Rs)</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">IRD Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">IRD Sync Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <span className="text-slate-500 dark:text-slate-400">Loading sales register...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-rose-500 dark:text-rose-400">
                    {error}
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No sales records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                records.map((rec, idx) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs text-center">{idx + 1}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-mono text-xs font-semibold">REC-{rec.id}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{rec.customer?.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">{rec.customer?.vatNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold text-right">Rs. {formatCurrency(rec.amount)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-right">Rs. {formatCurrency(rec.baseAmount)}</td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-medium text-right">Rs. {formatCurrency(rec.vatAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      {rec.isSyncedWithIRD ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {rec.irdReceiptNo || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Grand Totals Footer */}
            {records.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-900/80 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-xs">
                <tr>
                  <td colSpan="5" className="px-4 py-3 text-right uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Grand Total (जम्मा कुल योग):
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-mono text-sm">
                    Rs. {formatCurrency(totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                    Rs. {formatCurrency(totalBase)}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-mono">
                    Rs. {formatCurrency(totalVat)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

