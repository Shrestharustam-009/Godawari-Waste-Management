import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, History, IndianRupee, Printer, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import Invoice from '../components/Invoice';

export default function Recent() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTxToPrint, setSelectedTxToPrint] = useState(null);
  const [isPOSPrint, setIsPOSPrint] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatDate } = useSettings();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/accounting/income/history');
        if (res.data?.success) {
          setTransactions(res.data.data);
        }
      } catch (err) {
        setError('Failed to load transaction history.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = (tx, isPOS = false) => {
    setSelectedTxToPrint(tx);
    setIsPOSPrint(isPOS);
    // Wait briefly for React to render the Invoice component with the selected tx data
    setTimeout(() => {
      window.print();
      setSelectedTxToPrint(null); // Cleanup after print dialog closes
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-24 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 flex items-center z-10 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 mr-2 text-slate-500 active:bg-slate-100 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Recent Collections</h1>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <History className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">7-Day History</h2>
            <p className="text-xs text-slate-500">Your recent field collections.</p>
          </div>
        </div>

        {error && <div className="text-red-500 text-sm text-center mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-3 pb-6">
            {transactions.map((tx) => (
              <div 
                key={tx.id}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">
                    {tx.customer?.name || 'Unknown Customer'}
                  </h3>
                  <p className="text-xs text-slate-500 mb-1">{tx.customerId}</p>
                  <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                </div>
                
                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex bg-emerald-50 rounded overflow-hidden divide-x divide-emerald-100">
                      <button 
                        onClick={() => handlePrint(tx, true)}
                        className="px-2 py-1.5 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                        title="Print POS Receipt"
                      >
                        <Receipt className="w-3.5 h-3.5" /> POS
                      </button>
                      <button 
                        onClick={() => handlePrint(tx, false)}
                        className="px-2 py-1.5 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                        title="Print A4 Invoice"
                      >
                        <Printer className="w-3.5 h-3.5" /> A4
                      </button>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">
                      {tx.paymentMethod}
                    </span>
                  </div>
                  <span className="text-lg font-black text-emerald-600 flex items-center">
                    <IndianRupee className="w-4 h-4 mr-0.5" />
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center mt-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-700 font-bold mb-1">No recent transactions</h3>
            <p className="text-slate-400 text-sm">You haven't logged any collections in the last 7 days.</p>
          </div>
        )}
      </div>

      {/* Hidden Invoice Component for Printing */}
      {selectedTxToPrint && (
        <Invoice 
          customer={selectedTxToPrint.customer}
          staffName={user?.name || user?.username}
          amount={selectedTxToPrint.amount}
          date={selectedTxToPrint.date}
          receiptNo={`REC-${selectedTxToPrint.id}`}
          paymentForStartDate={selectedTxToPrint.paymentForStartDate}
          paymentForEndDate={selectedTxToPrint.paymentForEndDate}
          baseAmount={selectedTxToPrint.baseAmount}
          vatAmount={selectedTxToPrint.vatAmount}
          isPOS={isPOSPrint}
        />
      )}
    </div>
  );
}
