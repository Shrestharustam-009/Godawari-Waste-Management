import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, Calendar, Receipt, List } from 'lucide-react';
import DatePicker from '../../components/DatePicker';
import { useSettings } from '../../context/SettingsContext';

export default function StatementsExports() {
  const { statements, dateRange, setDateRange } = useOutletContext();
  const { formatDate } = useSettings();

  const handleExportCSV = (type) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === 'income') {
      csvContent += "Date,Main Category,Sub-Category,Base Revenue,Output VAT (13%),Total Amount,Notes\n";
      if (Array.isArray(statements?.incomeEntries)) {
        statements.incomeEntries.forEach(tx => {
          const date = formatDate(tx.date);
          const row = `"${date}","${tx.categoryName}","${tx.subCategory}","${tx.baseAmount}","${tx.vatAmount}","${tx.amount}","${(tx.note||'').replace(/"/g, '""')}"`;
          csvContent += row + "\n";
        });
      }
    } else if (type === 'expense') {
      csvContent += "Date,Category,Sub-Category,Total Amount,Input VAT,Withheld TDS,Net Payout,Notes\n";
      if (Array.isArray(statements?.expenseEntries)) {
        statements.expenseEntries.forEach(tx => {
          const date = formatDate(tx.date);
          const row = `"${date}","${tx.categoryName}","${tx.subCategory}","${tx.amount}","${tx.inputVat}","${tx.tdsAmount}","${tx.netPayable}","${(tx.note||'').replace(/"/g, '""')}"`;
          csvContent += row + "\n";
        });
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${type}_ledger_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 bg-slate-50 min-h-[400px] flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 text-slate-700 shadow-inner">
          <Download className="w-10 h-10" />
        </div>
        <h3 className="text-3xl font-bold text-slate-900 mb-3">Export Statements</h3>
        <p className="text-slate-500 mb-10 max-w-md text-lg">Generate comma-separated CSV files for Excel, QuickBooks, or your external accountant based on the selected date range.</p>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 mb-10 w-full max-w-md shadow-sm">
          <div className="flex flex-1 items-center px-4 py-3 bg-white rounded-xl text-sm text-slate-700 shadow-sm border border-slate-200 w-full focus-within:ring-2 focus-within:ring-brand-500">
            <Calendar className="w-5 h-5 mr-3 text-brand-500" />
            <DatePicker 
              name="startDate"
              value={dateRange.startDate} 
              onChange={e => setDateRange({...dateRange, startDate: e.target.value})} 
              className="bg-transparent border-none p-0 outline-none w-full font-bold text-slate-700 focus:ring-0" 
            />
          </div>
          <span className="text-slate-400 font-bold px-2 hidden sm:block">TO</span>
          <div className="flex flex-1 items-center px-4 py-3 bg-white rounded-xl text-sm text-slate-700 shadow-sm border border-slate-200 w-full focus-within:ring-2 focus-within:ring-brand-500">
            <DatePicker 
              name="endDate"
              value={dateRange.endDate} 
              onChange={e => setDateRange({...dateRange, endDate: e.target.value})} 
              className="bg-transparent border-none p-0 outline-none w-full font-bold text-slate-700 focus:ring-0" 
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button onClick={() => handleExportCSV('income')} className="flex-1 flex items-center justify-center px-6 py-4 bg-brand-50 hover:bg-brand-100 text-brand-700 border-2 border-brand-200 hover:border-brand-300 rounded-xl font-bold text-base transition-all shadow-sm">
            <Receipt className="w-5 h-5 mr-2" /> Export Income
          </button>
          <button onClick={() => handleExportCSV('expense')} className="flex-1 flex items-center justify-center px-6 py-4 bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 hover:border-red-300 rounded-xl font-bold text-base transition-all shadow-sm">
            <List className="w-5 h-5 mr-2" /> Export Expense
          </button>
        </div>
      </div>
    </div>
  );
}
