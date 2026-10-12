import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Loader2, Download, Printer } from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';
import { generateSalesReturnHTML, generateSalesReturnRegisterHTML } from '../lib/printTemplates';

export default function SalesReturns() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { settings, formatDate } = useSettings();
  
  const handlePrint = (tx) => {
    const html = generateSalesReturnHTML(tx, settings, formatDate);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Basic date filtering
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const totalBase = records.reduce((sum, r) => sum + Math.abs(Number(r.baseAmount || 0)), 0);
  const totalVat = records.reduce((sum, r) => sum + Math.abs(Number(r.vatAmount || 0)), 0);
  const totalRefund = records.reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0);

  const handleExportCSV = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "S.N.,Date,Credit Note No,Ref Invoice No,Customer Name,Customer PAN,Reason for Return,Taxable Base (Rs),VAT 13% (Rs),Total Refund (Rs)\n";
    records.forEach((rec, idx) => {
      const row = [
        `"${idx + 1}"`,
        `"${formatDate(rec.date)}"`,
        `"CN-${rec.id}"`,
        `"REC-${rec.returnRefId}"`,
        `"${(rec.customer?.name || 'Cash Customer').replace(/"/g, '""')}"`,
        `"${rec.customer?.vatNumber || '-'}"`,
        `"${(rec.returnReason || '').replace(/"/g, '""')}"`,
        `"${Math.abs(Number(rec.baseAmount || 0)).toFixed(2)}"`,
        `"${Math.abs(Number(rec.vatAmount || 0)).toFixed(2)}"`,
        `"${Math.abs(Number(rec.amount || 0)).toFixed(2)}"`
      ].join(',');
      csv += row + "\n";
    });
    csv += `"Total",,,,,,,"${totalBase.toFixed(2)}","${totalVat.toFixed(2)}","${totalRefund.toFixed(2)}"\n`;

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_return_register_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintRegister = () => {
    const html = generateSalesReturnRegisterHTML({
      records,
      startDate,
      endDate,
      settings,
      formatDate,
      totalBase,
      totalVat,
      totalRefund
    });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/accounting/sales-returns', { params });
      if (res.data?.success) {
        setRecords(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch Sales Returns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <RefreshCcw className="w-7 h-7 mr-3 text-red-500" />
            Sales Return Register (बिक्री फिर्ता खाता - अनुसूची ९)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Official IRD Form No. 9 record of all voided invoices, credit notes, and VAT reversals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            title="Download CSV / Excel"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button 
            onClick={handlePrintRegister}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            title="Print Official IRD Register"
          >
            <Printer className="w-4 h-4" /> Print Register
          </button>
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
          onClick={fetchReturns}
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
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Return No</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ref Invoice</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">PAN/VAT</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Reason</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Taxable Base</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">VAT (13%)</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Total Refund</th>
                <th className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <span className="text-slate-500 dark:text-slate-400">Loading register...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No sales returns found for the selected period.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(rec.date)}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium">CN-{rec.id}</td>
                    <td className="px-3 py-3 text-blue-600 dark:text-blue-400 font-medium">REC-{rec.returnRefId}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium">{rec.customer?.name}</td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{rec.customer?.vatNumber || '-'}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[180px]" title={rec.returnReason}>{rec.returnReason}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 text-right">Rs. {formatCurrency(Math.abs(rec.baseAmount))}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 text-right">Rs. {formatCurrency(Math.abs(rec.vatAmount))}</td>
                    <td className="px-3 py-3 text-red-600 dark:text-red-400 font-semibold text-right">Rs. {formatCurrency(Math.abs(rec.amount))}</td>
                    <td className="px-3 py-3 text-center">
                      <button 
                        onClick={() => handlePrint(rec)}
                        className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
                      >
                        Print Note
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {records.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan="6" className="px-3 py-3 text-slate-800 dark:text-slate-200 uppercase text-right">
                    Total (जम्मा योग):
                  </td>
                  <td className="px-3 py-3 text-slate-800 dark:text-slate-200 text-right">
                    Rs. {formatCurrency(totalBase)}
                  </td>
                  <td className="px-3 py-3 text-slate-800 dark:text-slate-200 text-right">
                    Rs. {formatCurrency(totalVat)}
                  </td>
                  <td className="px-3 py-3 text-red-600 dark:text-red-400 font-bold text-right">
                    Rs. {formatCurrency(totalRefund)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
