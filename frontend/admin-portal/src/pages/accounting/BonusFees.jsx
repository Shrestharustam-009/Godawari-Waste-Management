import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Search, Loader2, Calendar, Receipt, Download, FileText } from 'lucide-react';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

export default function BonusFees() {
  const [bonusFees, setBonusFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBonusFees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/bonus-fees');
      if (res.data?.success) {
        setBonusFees(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch bonus fees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBonusFees();
  }, []);

  const filteredData = bonusFees.filter(fee => 
    fee.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fee.customerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fee.collectedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fee.remark?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBonusAmount = filteredData.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-500" />
            Festival Bonus Fees
          </h2>
          <p className="text-slate-500 text-sm mt-1">Review all extra tips and bonuses collected from customers.</p>
        </div>
        
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FileText className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Total Bonus Collected</p>
            <p className="text-xl font-black text-slate-900">₹ {formatCurrency(totalBonusAmount)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by customer, collector, or remark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Remark</th>
                <th className="px-6 py-4 font-semibold">Collected By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading bonus fees...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <Receipt className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-600">No bonus fees found.</p>
                    <p className="text-sm mt-1">Try adjusting your search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {formatDate(fee.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{fee.customer}</div>
                      <div className="text-xs text-slate-500">{fee.customerId}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-amber-600 whitespace-nowrap">
                      ₹ {formatCurrency(fee.amount)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={fee.remark}>
                      {fee.remark}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                        {fee.collectedBy}
                      </span>
                    </td>
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
