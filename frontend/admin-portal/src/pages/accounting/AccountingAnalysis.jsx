import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  UserCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import api from '../../api/axios';
import { useSettings } from '../../context/SettingsContext';
import { toBS } from '@zener/nepali-datepicker-react';

export default function AccountingAnalysis() {
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalysis();
  }, [settings?.calendarType]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const res = await api.get('/accounting/analysis');
      const fetchedData = res.data.data;
      if (fetchedData?.trendData) {
        fetchedData.trendData = fetchedData.trendData.map(item => {
          let monthLabel = item.rawMonth;
          try {
            if (settings?.calendarType === 'BS') {
              const bsObj = toBS(`${item.rawMonth}-01`);
              const nepaliMonths = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
              monthLabel = nepaliMonths[bsObj.month];
            } else {
              monthLabel = new Date(`${item.rawMonth}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short' });
            }
          } catch(e) { console.warn(e); }
          return { ...item, name: monthLabel };
        });
      }
      setData(fetchedData);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load accounting analysis data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Aggregating financial ledgers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, trendData } = data;

  const formatCurrency = (val) => {
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(kpis.totalRevenue),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Standard Expenses',
      value: formatCurrency(kpis.totalExpense - kpis.vehicleExpense - kpis.salaryExpense), // Approximation based on controller output
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-100',
    },
    {
      title: 'Vehicle Expenses',
      value: formatCurrency(kpis.vehicleExpense),
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100',
    },
    {
      title: 'Staff Salary',
      value: formatCurrency(kpis.salaryExpense),
      icon: UserCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Accounting Analysis</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Executive overview of all financial ledgers.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-800 transition-colors duration-200 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-shadow hover:shadow-md`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bgColor} ${stat.borderColor} border`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue vs Expense Bar Chart */}
        <div className="bg-white dark:bg-slate-800 transition-colors duration-200 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Revenue vs Expenses (6 Months)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet & Salary Trend Line Chart */}
        <div className="bg-white dark:bg-slate-800 transition-colors duration-200 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Vehicle vs Salary Costs (6 Months)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="Vehicle" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Salary" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
