import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, UserCircle, Loader2, QrCode, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../services/api';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  useEffect(() => {
    let scanner = null;
    if (showScanner) {
      // Clean UI Overlay for camera
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      scanner.render(
        (decodedText) => {
          setQuery(decodedText);
          setShowScanner(false);
          scanner.clear();
        },
        (err) => {
          // ignore continuous scan errors
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [showScanner]);

  const performSearch = async (searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/customers?search=${encodeURIComponent(searchQuery)}`);
      if (res.data?.success) {
        setResults(res.data.data || []);
      }
    } catch (err) {
      setError('Failed to fetch customers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) performSearch(query);
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0 border-b border-slate-100">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all"
            placeholder="Search ID, Name or Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <div className="flex gap-2 mt-3">
          <button 
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl font-medium transition-colors"
          >
            <QrCode className="w-5 h-5" /> Scan QR
          </button>
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="p-4 flex justify-between items-center bg-black text-white">
            <h2 className="font-bold">Scan Customer QR</h2>
            <button onClick={() => setShowScanner(false)} className="p-2 bg-white/20 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black">
            <div id="reader" className="w-full max-w-sm bg-white rounded-xl overflow-hidden"></div>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto bg-slate-50">
        {error && <div className="text-red-500 text-sm text-center mb-4">{error}</div>}
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {results.length > 0 ? (
              results.map((customer) => (
                <div 
                  key={customer.customerId}
                  onClick={() => navigate(`/collection/${customer.customerId}`)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 active:scale-95 transition-transform cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-10 h-10 text-slate-300" />
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">{customer.name}</h3>
                        <p className="text-xs text-slate-500">{customer.customerId} • {customer.phone}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">{customer.assignedArea}</span>
                    <div className="text-right">
                      {Number(customer.outstandingPayment) > 0 ? (
                        <span className="text-sm font-bold text-red-600">Debt: ₹{formatCurrency(customer.outstandingPayment)}</span>
                      ) : Number(customer.advanceBalance) > 0 ? (
                        <span className="text-sm font-bold text-emerald-600">Advance: ₹{formatCurrency(customer.advanceBalance)}</span>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">Settled</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              query && !loading && (
                <div className="text-center py-10 text-slate-400">
                  <p>No customers found.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
