import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldCheck, Calculator } from 'lucide-react';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

export default function TaxesLiabilities() {
  const { statements, loading } = useOutletContext();

  const tdsBreakdown = useMemo(() => {
    let sst1 = 0;
    let contract15 = 0;
    let rent10 = 0;

    if (Array.isArray(statements?.expenseEntries)) {
      statements.expenseEntries.forEach(tx => {
        const rate = String(tx.tdsRate || '0');
        const amt = Number(tx.tdsAmount || 0);
        if (rate === '1') sst1 += amt;
        else if (rate === '1.5') contract15 += amt;
        else if (rate === '10') rent10 += amt;
      });
    }

    return { sst1, contract15, rent10 };
  }, [statements]);

  if (loading) {
    return <div className="p-16 flex justify-center"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="p-8 bg-slate-950">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <ShieldCheck className="w-7 h-7 mr-3 text-emerald-400" /> 
            Tax Compliance Engine
          </h2>
          <p className="text-slate-400 mt-1">Real-time audit view of calculated liabilities for the selected period.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <p className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wide flex items-center">
            <Calculator className="w-4 h-4 mr-2" /> Output VAT (13%)
          </p>
          <p className="text-4xl font-extrabold text-white tracking-tight">₹{formatCurrency(statements.taxLiability?.totalOutputVat)}</p>
          <p className="text-slate-500 text-sm mt-3 border-t border-slate-800 pt-3">Collected from gross income</p>
        </div>
        
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <p className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wide flex items-center">
            <Calculator className="w-4 h-4 mr-2" /> Input VAT
          </p>
          <p className="text-4xl font-extrabold text-white tracking-tight">₹{formatCurrency(statements.taxLiability?.totalInputVat)}</p>
          <p className="text-slate-500 text-sm mt-3 border-t border-slate-800 pt-3">Paid on deductible expenses</p>
        </div>
        
        <div className="bg-blue-950/30 p-6 rounded-xl border border-blue-900/50 relative overflow-hidden">
          <p className="text-blue-300 text-xs font-bold mb-2 uppercase tracking-wide relative z-10">Net VAT Payable</p>
          <p className="text-4xl font-extrabold text-blue-400 tracking-tight relative z-10">₹{formatCurrency(statements.taxLiability?.netVatPayable)}</p>
          <p className="text-blue-400/60 text-sm mt-3 border-t border-blue-900/50 pt-3 relative z-10">Output VAT minus Input VAT</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full opacity-10 blur-2xl bg-blue-400" />
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">TDS Liabilities Breakdown</h3>
          <span className="px-4 py-1.5 bg-orange-500/10 text-orange-400 font-bold rounded-lg border border-orange-500/20">
            Total: ₹{formatCurrency(statements.taxLiability?.totalTdsPayable)}
          </span>
        </div>
        <div className="p-0 overflow-x-auto w-full">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-6 py-4 border-b border-slate-800">Tax Category</th>
                <th className="px-6 py-4 border-b border-slate-800">Rate applied</th>
                <th className="px-6 py-4 border-b border-slate-800 text-right">Withheld Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 text-slate-300 font-medium">Supply of Goods (SST)</td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded text-xs font-bold">1.0%</span></td>
                <td className="px-6 py-4 text-right font-bold text-white">₹{formatCurrency(tdsBreakdown.sst1)}</td>
              </tr>
              <tr className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 text-slate-300 font-medium">Services & Contracts</td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded text-xs font-bold">1.5%</span></td>
                <td className="px-6 py-4 text-right font-bold text-white">₹{formatCurrency(tdsBreakdown.contract15)}</td>
              </tr>
              <tr className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 text-slate-300 font-medium">Rent & Lease</td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded text-xs font-bold">10.0%</span></td>
                <td className="px-6 py-4 text-right font-bold text-white">₹{formatCurrency(tdsBreakdown.rent10)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
