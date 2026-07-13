import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import api from '../../api/axios';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, List, ShieldCheck, FileText
} from 'lucide-react';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
};

export default function AccountingLayout() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [statements, setStatements] = useState({
    summary: { totalIncome: "0", totalExpense: "0", netProfit: "0" },
    taxLiability: { totalOutputVat: "0", totalInputVat: "0", netVatPayable: "0", totalTdsPayable: "0" },
    incomeEntries: [],
    expenseEntries: []
  });

  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [loading, setLoading] = useState(true);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    try {
      const payload = {
        startDate: new Date(dateRange.startDate).toISOString(),
        endDate: new Date(dateRange.endDate + 'T23:59:59.999Z').toISOString()
      };
      
      const res = await api.get('/accounting/statements', { params: payload });
      if (res.data?.success && res.data?.data) {
        setStatements({
          summary: res.data.data.summary || { totalIncome: "0", totalExpense: "0", netProfit: "0" },
          taxLiability: res.data.data.taxLiability || { totalOutputVat: "0", totalInputVat: "0", netVatPayable: "0", totalTdsPayable: "0" },
          incomeEntries: Array.isArray(res.data.data.incomeEntries) ? res.data.data.incomeEntries : [],
          expenseEntries: Array.isArray(res.data.data.expenseEntries) ? res.data.data.expenseEntries : []
        });
      }
    } catch (err) {
      console.error('Failed to fetch statements:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/accounting/categories');
      if (res.data?.success && res.data?.data) {
        setCategories({
          income: Array.isArray(res.data.data.income) ? res.data.data.income : [],
          expense: Array.isArray(res.data.data.expense) ? res.data.data.expense : []
        });
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  useEffect(() => {
    fetchStatements();
    fetchCategories();
  }, [fetchStatements]);

  const contextPayload = {
    statements,
    categories,
    loading,
    fetchStatements,
    fetchCategories,
    dateRange,
    setDateRange
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${
      isActive ? 'text-brand-700 bg-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
    }`;

  const getIndicatorColor = (path) => {
    switch (path) {
      case 'income': return 'bg-brand-600';
      case 'expense': return 'bg-red-600';
      case 'taxes': return 'bg-blue-600';
      case 'statements': return 'bg-slate-900';
      default: return 'bg-brand-600';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Accounting & Ledgers</h1>
          <p className="text-slate-500 mt-1 font-medium">Enterprise financial reporting & tax engine</p>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg mr-2"><TrendingUp className="w-4 h-4" /></div> Total Revenue (Gross)
          </h3>
          <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
            ₹{formatCurrency(statements.summary?.totalIncome)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg mr-2"><TrendingDown className="w-4 h-4" /></div> Total Expenses
          </h3>
          <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
            ₹{formatCurrency(statements.summary?.totalExpense)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200   relative">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center relative z-10">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg mr-2"><Wallet className="w-4 h-4" /></div> Net Profit
          </h3>
          <p className={`text-4xl font-extrabold tracking-tight relative z-10 ${Number(statements.summary?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ₹{formatCurrency(statements.summary?.netProfit)}
          </p>
        </div>
      </div>

      {/* PREMIUM HORIZONTAL TABS VIA REACT ROUTER */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200  ">
        <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar bg-slate-50/50">
          <NavLink to="/accounting/income" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <Receipt className={`w-4 h-4 mr-2 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                Income Ledger
                {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${getIndicatorColor('income')}`} />}
              </>
            )}
          </NavLink>
          
          <NavLink to="/accounting/expense" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <List className={`w-4 h-4 mr-2 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                Advanced Expense Ledger
                {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${getIndicatorColor('expense')}`} />}
              </>
            )}
          </NavLink>

          <NavLink to="/accounting/taxes" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <ShieldCheck className={`w-4 h-4 mr-2 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                Taxes & Liabilities
                {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${getIndicatorColor('taxes')}`} />}
              </>
            )}
          </NavLink>

          <NavLink to="/accounting/statements" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <FileText className={`w-4 h-4 mr-2 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                Statements & Exports
                {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${getIndicatorColor('statements')}`} />}
              </>
            )}
          </NavLink>
          
          <NavLink to="/accounting/bonus-fees" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <Receipt className={`w-4 h-4 mr-2 ${isActive ? 'text-amber-500' : 'text-slate-400'}`} />
                Bonus Fees
                {isActive && <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${getIndicatorColor('bonus')}`} />}
              </>
            )}
          </NavLink>
        </div>

        {/* ACTIVE ROUTE RENDER BLOCK */}
        <div className="p-0">
          <Outlet context={contextPayload} />
        </div>
      </div>
    </div>
  );
}
