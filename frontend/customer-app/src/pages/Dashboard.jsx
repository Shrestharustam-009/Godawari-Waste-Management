import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../api/axios';
import {
  Loader2, LogOut, Wallet, AlertTriangle,
  IndianRupee, Clock, CheckCircle2, XCircle,
  CreditCard, Recycle, FileText, Download, KeyRound, MapPin, ArrowRight
} from 'lucide-react';
import invoiceHeaderImg from '../assets/invoice-header.png';

// ============================================================================
// CUSTOMER FINANCIAL DASHBOARD
// ============================================================================

export default function Dashboard() {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // The backend resolves the customer from the HttpOnly cookie session.
        // We use the customerId from the auth context to fetch the full profile.
        const customerId = customer?.customerId || customer?.id;
        if (!customerId) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          return;
        }

        const res = await api.get(`/customers/${customerId}`);
        if (res.data?.success) {
          setProfile(res.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load your account data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [customer]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const formatCurrency = (val) =>
    Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) return;

    // Define CSV headers
    const headers = ['Transaction ID', 'Amount (Rs)', 'Date', 'Time', 'Status', 'Payment Method'];
    
    // Map transactions data into rows safely
    const rows = transactions.map(tx => [
      tx.id || 'N/A',
      tx.amount || 0,
      tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : 'N/A',
      tx.date ? new Date(tx.date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A',
      tx.status || 'N/A',
      tx.paymentMethod || 'N/A'
    ]);

    // Combine headers and rows, converting array fields into standard safe CSV syntax
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Trigger file download in browser using Blob object
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Transactions_${profile?.name || 'Statement'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewStatement = () => {
    if (!transactions || transactions.length === 0) return;

    // Open a empty printable clean viewport tab
    const printWindow = window.open('', '_blank');
    
    // Generate transaction list HTML rows dynamic rendering
    const txRows = transactions.map(tx => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; font-size: 13px; color: #1e293b;">${formatDate(tx.date)} ${formatTime(tx.date)}</td>
        <td style="padding: 12px; font-size: 13px; color: #475569; font-family: monospace;">#${tx.id || 'N/A'}</td>
        <td style="padding: 12px; font-size: 13px; color: #475569;">${tx.paymentMethod}</td>
        <td style="padding: 12px; font-size: 13px; font-weight: bold; color: ${tx.status === 'SUCCESSFUL' ? '#16a34a' : '#d97706'}; text-transform: uppercase;">${tx.status}</td>
        <td style="padding: 12px; font-size: 13px; font-weight: bold; text-align: right; color: #0f172a;">Rs. ${formatCurrency(tx.amount)}</td>
      </tr>
    `).join('');

    // Inject pure plain statement HTML structure document frame
    printWindow.document.write(`
      <html>
        <head>
          <title>Account Statement - ${profile?.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #334155; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .meta-box { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; uppercase; color: #64748b; font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print { .no-print { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer;">Print / Save as PDF</button>
            <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer;">Close Window</button>
          </div>

          <img src="${invoiceHeaderImg}" alt="Header" class="header-image" style="width: 100%; max-height: 160px; object-fit: contain; margin-bottom: 20px;" />

          <div class="header">
            <div>
              <h1 style="margin: 0; font-size: 24px; color: #065f46;">ACCOUNT STATEMENT</h1>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Generated on ${new Date().toLocaleDateString('en-IN')}</p>
            </div>
            <div style="text-align: right;">
              <h3 style="margin: 0; color: #1e293b;">${profile?.name}</h3>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">ID: ${profile?.customerId}</p>
            </div>
          </div>

          <div class="meta-box">
            <div>
              <span style="font-size: 12px; color: #64748b; font-weight: bold;">Outstanding Dues</span>
              <h2 style="margin: 4px 0 0 0; color: #b91c1c;">Rs. ${formatCurrency(outstandingNum)}</h2>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 12px; color: #64748b; font-weight: bold;">Smart Wallet Balance</span>
              <h2 style="margin: 4px 0 0 0; color: #047857;">Rs. ${formatCurrency(advanceNum)}</h2>
            </div>
          </div>

          <h3>Transaction Records</h3>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Transaction ID</th>
                <th>Method</th>
                <th>Status</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${txRows}
            </tbody>
          </table>

          <div class="footer">
            <p>Thank you for your business. This is a system-generated account statement summary.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  
  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500 font-medium">Loading your account...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 text-sm text-red-600 font-bold underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const outstandingNum = Number(profile?.outstandingPayment || 0);
  const advanceNum = Number(profile?.advanceBalance || 0);
  const transactions = profile?.transactions || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-8">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 px-5 pt-8 pb-14 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-emerald-600/30 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <Recycle className="w-5 h-5 text-emerald-300" />
              </div>
              <span className="text-emerald-300/80 text-xs font-bold uppercase tracking-wider">
                My Account
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Namaste, {profile?.name?.split(' ')[0] || 'Customer'} 👋
            </h1>
            <p className="text-emerald-200/60 text-sm font-medium mt-1">
              {profile?.customerId} • {profile?.assignedArea}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/10"
            >
              {loggingOut ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <LogOut className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Dashboard Action & Financial Cards (overlap the header) ── */}
      <div className="px-4 -mt-8 relative z-10 space-y-3">

        {/* ── Live Tracking Action Card ── */}
        <button
          onClick={() => navigate('/tracking')}
          className="w-full text-left rounded-2xl p-5 shadow-lg shadow-emerald-900/10 border border-emerald-500 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 transition-all hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden flex items-center justify-between"
        >
          {/* Decorative background circle */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner shrink-0">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Live Truck Tracking
              </h3>
              <p className="text-emerald-50 text-xs font-medium mt-0.5 leading-snug">
                Tap to see where your garbage truck is right now
              </p>
            </div>
          </div>
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md group-hover:shadow-xl transition-all relative z-10 shrink-0">
            <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Outstanding Dues Card */}
        <div className={`rounded-2xl p-5 shadow-lg border transition-all ${
          outstandingNum > 0
            ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200 shadow-red-100/50'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${outstandingNum > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-700">Current Outstanding Dues</span>
            </div>
          </div>
          <p className={`text-3xl font-black tracking-tight ${outstandingNum > 0 ? 'text-red-700' : 'text-slate-400'}`}>
            Rs. {formatCurrency(outstandingNum)}
          </p>
          {outstandingNum > 0 && profile?.debtStartDate && (
            <p className="text-xs text-red-500/80 font-medium mt-2">
              Outstanding since {formatDate(profile.debtStartDate)}
            </p>
          )}
        </div>

        {/* Smart Wallet Card */}
        <div className={`rounded-2xl p-5 shadow-lg border transition-all ${
          advanceNum > 0
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-emerald-100/50'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${advanceNum > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-700">Smart Wallet Balance</span>
            </div>
          </div>
          <p className={`text-3xl font-black tracking-tight ${advanceNum > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
            Rs. {formatCurrency(advanceNum)}
          </p>
          {advanceNum > 0 && (
            <p className="text-xs text-emerald-600/70 font-medium mt-2">
              This advance balance auto-deducts when your next bill is generated.
            </p>
          )}
        </div>
      </div>

      {/* ── Transaction Ledger ── */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            Payment History
          </h2>
          
          {transactions.length > 0 ? (
            <div className="flex items-center gap-2">
              {/* New View/Print Statement Button */}
              <button
                onClick={handleViewStatement}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200"
              >
                <FileText className="w-3.5 h-3.5" />
                View Statement
              </button>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors border border-emerald-200"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-400">0 records</span>
          )}
        </div>
        
        {transactions.length > 0 ? (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              if (tx.type === 'CHARGE') {
                return (
                  <div
                    key={tx.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Rs. {formatCurrency(tx.amount)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(tx.date)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatTime(tx.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                        MONTHLY FEE
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium w-[100px] text-right truncate" title={tx.description}>
                        {tx.description}
                      </span>
                    </div>
                  </div>
                );
              }

              const isSuccess = tx.status === 'SUCCESSFUL';
              return (
                <div
                  key={tx.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Rs. {formatCurrency(tx.amount)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(tx.date)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatTime(tx.date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isSuccess
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {tx.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {tx.paymentMethod}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <CreditCard className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-slate-700 font-bold">No Payments Yet</h3>
            <p className="text-slate-400 text-sm mt-1">
              Your transaction history will appear here once payments are recorded.
            </p>
          </div>
        )}
      </div>

      {/* ── Logout Footer Button ── */}
      <div className="px-4 mt-8">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 active:bg-red-100 transition-all disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <><LogOut className="w-5 h-5" /> Log Out</>
          )}
        </button>
      </div>
    </div>
  );
}
