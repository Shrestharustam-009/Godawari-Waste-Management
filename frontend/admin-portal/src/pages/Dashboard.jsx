import React, { useState, useEffect } from 'react';
import { useDate } from '../context/DateContext';
import api from '../api/axios';
import { io } from 'socket.io-client';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Wallet,
  Loader2,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================
const StatCard = ({ title, value, icon: Icon, valueColor, isLive }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-36 relative overflow-hidden">
    <div className="flex justify-between items-start">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      <div className={`p-2 rounded-lg bg-slate-50 ${isLive ? 'animate-pulse' : ''}`}>
        <Icon className={`w-5 h-5 ${valueColor}`} />
      </div>
    </div>
    <div className="mt-4">
      <p className={`text-3xl font-bold tracking-tight ${valueColor}`}>
        ₹ {value}
      </p>
    </div>
    {/* Decorative background glow */}
    <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 blur-xl bg-current ${valueColor}`} />
  </div>
);

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================
export default function Dashboard() {
  const { formatSystemDate } = useDate();

  const [kpis, setKpis] = useState({
    totalIncome: '0.00',
    totalExpenses: '0.00',
    netProfit: '0.00',
    totalCollectedToday: '0.00',
  });
  
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. Fetch Initial Data via Axios
    const fetchDashboardData = async () => {
      try {
        const [kpiRes, feedRes] = await Promise.all([
          api.get('/admin/dashboard/kpis'),
          api.get('/admin/dashboard/live-feed')
        ]);

        if (kpiRes.data.success) {
          // Format safely just in case, though backend sends decimal strings
          setKpis({
            totalIncome: Number(kpiRes.data.data.totalIncome).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            totalExpenses: Number(kpiRes.data.data.totalExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            netProfit: Number(kpiRes.data.data.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            totalCollectedToday: Number(kpiRes.data.data.totalCollectedToday).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          });
        }
        
        if (feedRes.data.success) {
          setFeed(feedRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Unable to load dashboard data. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // 2. Establish WebSocket Connection (via Vite proxy — same origin)
    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Connected to real-time operations feed');
      // Join the global map updates / operations room
      socket.emit('join_map'); 
    });

    // Listen for new transactions
    socket.on('live_collection_update', (transaction) => {
      // Prepend to the feed array so it appears at the top instantly
      setFeed((prevFeed) => [transaction, ...prevFeed]);
      
      // Also optimistic update of the 'Collected Today' KPI if it's an income
      // This is a complex optimistic update; for absolute safety we could refetch KPIs,
      // but modifying state directly keeps it instant.
      if (transaction.type === 'INCOME') {
        setKpis(prev => {
          const currentTodayStr = prev.totalCollectedToday.replace(/,/g, '');
          const newToday = Number(currentTodayStr) + Number(transaction.amount);
          
          const currentTotalStr = prev.totalIncome.replace(/,/g, '');
          const newTotal = Number(currentTotalStr) + Number(transaction.amount);
          
          return {
            ...prev,
            totalCollectedToday: newToday.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            totalIncome: newTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          };
        });
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-500" />
          <p>Loading real-time analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-2xl flex items-start text-red-700">
        <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Real-time financial and operational metrics</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Total Income" 
          value={kpis.totalIncome} 
          icon={TrendingUp} 
          valueColor="text-green-600" 
        />
        <StatCard 
          title="Total Expenses" 
          value={kpis.totalExpenses} 
          icon={TrendingDown} 
          valueColor="text-red-600" 
        />
        <StatCard 
          title="Net Profit" 
          value={kpis.netProfit} 
          icon={Wallet} 
          valueColor="text-blue-600" 
        />
        <StatCard 
          title="Collected Today" 
          value={kpis.totalCollectedToday} 
          icon={Activity} 
          valueColor="text-brand-600" 
          isLive={true} 
        />
      </div>

      {/* Operations Feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-brand-500 animate-pulse" />
            Live Operations Feed
          </h2>
          <span className="text-xs font-medium bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full border border-brand-200">
            Real-Time Sync Active
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {feed.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              No recent transactions found.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {feed.map((tx, index) => {
                const isIncome = !tx.type || tx.type === 'INCOME'; // Default to income if missing type
                return (
                  <li key={tx.id || index} className="px-4 py-4 hover:bg-slate-50 transition-colors rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${isIncome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {tx.customerName || 'General Entry'}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center text-xs text-slate-500">
                              <User className="w-3 h-3 mr-1" />
                              {tx.collectedBy}
                            </span>
                            <span className="flex items-center text-xs text-slate-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatSystemDate(tx.date)}
                            </span>
                            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {tx.paymentMethod}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'} ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
