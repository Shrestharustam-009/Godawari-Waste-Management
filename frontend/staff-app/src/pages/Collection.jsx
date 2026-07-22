import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, IndianRupee, Printer, Calendar, Receipt } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Invoice from '../components/Invoice';
import DatePicker from '../components/DatePicker';
import { useSettings } from '../context/SettingsContext';

export default function Collection() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [isAdvance, setIsAdvance] = useState(false);
  const [paymentForStartDate, setPaymentForStartDate] = useState('');
  const [paymentForEndDate, setPaymentForEndDate] = useState('');
  const { user } = useAuth();
  const { settings, formatDate } = useSettings();
  
  const [bonusFee, setBonusFee] = useState('');
  const [bonusRemark, setBonusRemark] = useState('');
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isPOSPrint, setIsPOSPrint] = useState(false);

  useEffect(() => {
    const fetchCustomerAndCategory = async () => {
      try {
        const custRes = await api.get(`/customers/${customerId}`);
        if (custRes.data?.success) {
          setCustomer(custRes.data.data);
        }

        const catRes = await api.get('/accounting/categories');
        if (catRes.data?.success) {
          const incCats = catRes.data.data.income || [];
          const targetCat = incCats.find(c => c.name === 'Monthly Collection Fee');
          if (targetCat) setCategoryId(targetCat.id);
        }
      } catch (err) {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomerAndCategory();
  }, [customerId]);

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleReviewClick = () => {
    const amt = Number(amount || 0);
    const bns = Number(bonusFee || 0);
    if (amt < 0 || bns < 0) return;
    if (amt === 0 && bns === 0) return;
    
    if (!isAdvance && amt > Number(customer.outstandingPayment)) {
      setError("Amount exceeds total debt. Enable 'Advance Payment' to allow overpayments.");
      return;
    }
    
    setError(null);
    setShowConfirm(true);
  };

  const handleProcessPayment = async () => {
    if (!categoryId) {
      setError("System Error: Missing collection category ID.");
      setShowConfirm(false);
      return;
    }

    setProcessing(true);
    setError(null);

    const payload = {
      customerId: customerId,
      amount: Number(amount).toFixed(2),
      isAdvancePayment: isAdvance,
      paymentMethod: "CASH",
      incomeCategoryId: categoryId,
      note: "Field Collection",
      paymentForStartDate: paymentForStartDate || undefined,
      paymentForEndDate: paymentForEndDate || undefined,
      bonusFee: bonusFee || undefined,
      bonusRemark: bonusFee ? (bonusRemark || "Festival Bonus") : undefined,
      idempotencyKey: `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };

    try {
      const res = await api.post('/payments/collect', payload);
      if (res.data?.success) {
        setReceiptData(res.data.data);
        setSuccess(true);
        setShowConfirm(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process payment');
      setShowConfirm(false);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (!customer) {
    return <div className="p-6 text-center text-red-500">Customer not found.</div>;
  }

  const handlePrintReceipt = (isPOS = false) => {
    setIsPOSPrint(isPOS);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (success) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
        <p className="text-slate-500 mb-8">Collected ₹{formatCurrency(amount)} from {customer.name}</p>
        
        <div className="w-full flex gap-3 mb-3">
          <button 
            onClick={() => handlePrintReceipt(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md active:bg-slate-900 transition-colors"
          >
            <Receipt className="w-5 h-5" /> Print (POS)
          </button>
          <button 
            onClick={() => handlePrintReceipt(false)}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md active:bg-slate-900 transition-colors"
          >
            <Printer className="w-5 h-5" /> Print (A4)
          </button>
        </div>

        <button 
          onClick={() => navigate('/')}
          className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 transition-colors"
        >
          Back to Search
        </button>
        <Invoice 
          customer={customer}
          staffName={user?.name || user?.username}
          amount={amount}
          date={new Date().toISOString()}
          receiptNo={receiptData?.incomeId ? `REC-${receiptData.incomeId}` : `REC-${Date.now()}`}
          paymentForStartDate={paymentForStartDate}
          paymentForEndDate={paymentForEndDate}
          baseAmount={receiptData?.vatBreakdown?.base}
          vatAmount={receiptData?.vatBreakdown?.vat}
          bonusFee={bonusFee}
          isPOS={isPOSPrint}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 flex items-center z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 mr-2 text-slate-500 active:bg-slate-100 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Collect Payment</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-1">{customer.name}</h2>
          <p className="text-slate-500 text-sm mb-4">{customer.customerId} • {customer.assignedArea}</p>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="bg-red-50 p-3 rounded-xl border border-red-100 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold text-red-600 mb-1">Total Debt</p>
              <p className="text-lg font-black text-red-700">₹{formatCurrency(customer.outstandingPayment)}</p>
              {Number(customer.outstandingPayment) > 0 && (customer.dueStartDate || customer.dueEndDate) && (
                <div className="text-[10px] text-red-500 font-medium mt-0.5 leading-tight whitespace-nowrap">
                  {customer.dueStartDate ? formatDate(customer.dueStartDate) : 'N/A'} - {customer.dueEndDate ? formatDate(customer.dueEndDate) : 'N/A'}
                </div>
              )}
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold text-emerald-600 mb-1">Smart Wallet</p>
              <p className="text-lg font-black text-emerald-700">₹{formatCurrency(customer.advanceBalance || 0)}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 col-span-2">
              <p className="text-xs font-semibold text-blue-600 mb-1">
                {Number(customer.increasedFee) > 0 ? 'Active Monthly Fee (Increased)' : 'Monthly Fee'}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-black text-blue-700">₹{formatCurrency(Number(customer.increasedFee) > 0 ? customer.increasedFee : customer.monthlyFee)}</p>
                {Number(customer.increasedFee) > 0 && (
                  <div className="px-2.5 py-1.5 bg-blue-100/50 border border-blue-200 rounded-lg text-right flex-shrink-0">
                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-0.5">Starting Monthly Fee (Original)</p>
                    <p className="text-sm font-black text-slate-500 line-through decoration-slate-400">₹{formatCurrency(customer.monthlyFee)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">{error}</div>}

        {/* Payment Input */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mt-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-bold text-slate-700">Amount to Collect (₹)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Advance Payment</span>
              <button 
                onClick={() => setIsAdvance(!isAdvance)}
                className={`w-10 h-6 rounded-full transition-colors relative ${isAdvance ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isAdvance ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <IndianRupee className="h-6 w-6 text-slate-400" />
            </div>
            <input 
              type="number" 
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-2xl font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Period Covered (Optional) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mt-4">
          <label className="block text-sm font-bold text-slate-700 mb-3">Period Covered (Optional)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">From Date <span className="text-[10px] text-emerald-600 font-normal">(Click a day)</span></label>
              <div className="relative border border-slate-300 rounded-xl bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white flex z-20">
                <div className="flex items-center justify-center pl-3 pr-2 border-r border-slate-200 bg-white pointer-events-none rounded-l-xl">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <DatePicker 
                  name="paymentForStartDate"
                  value={paymentForStartDate} 
                  onChange={(e) => setPaymentForStartDate(e.target.value)} 
                  className="flex-1 py-3 text-sm bg-transparent rounded-r-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">To Date <span className="text-[10px] text-emerald-600 font-normal">(Click a day)</span></label>
              <div className="relative border border-slate-300 rounded-xl bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white flex z-10">
                <div className="flex items-center justify-center pl-3 pr-2 border-r border-slate-200 bg-white pointer-events-none rounded-l-xl">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <DatePicker 
                  name="paymentForEndDate"
                  value={paymentForEndDate} 
                  onChange={(e) => setPaymentForEndDate(e.target.value)} 
                  className="flex-1 py-3 text-sm bg-transparent rounded-r-xl"
                />
              </div>
            </div>
          </div>
        </div>

        {settings?.isBonusFeeEnabled && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mt-4 border-l-4 border-l-amber-500">
            <label className="block text-sm font-bold text-slate-700 mb-1">Festival Bonus Fee (Optional)</label>
            <p className="text-xs text-slate-500 mb-3">Record any extra festival tips or bonuses collected.</p>
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IndianRupee className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="number" 
                  inputMode="decimal"
                  placeholder="0.00"
                  value={bonusFee}
                  onChange={(e) => setBonusFee(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>
              <div>
                <input 
                  type="text" 
                  placeholder="Bonus Remark (optional)"
                  value={bonusRemark}
                  onChange={(e) => setBonusRemark(e.target.value)}
                  className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={handleReviewClick}
          disabled={((Number(amount || 0) <= 0) && (Number(bonusFee || 0) <= 0)) || processing}
          className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-4 rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
        >
          {processing ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Review Payment'}
        </button>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-t-3xl p-6 pb-safe animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Collection</h3>
            <p className="text-slate-500 mb-6">Confirm Payment: Are you sure Rs. {amount || '0.00'} {Number(bonusFee || 0) > 0 ? `(+ Rs. ${bonusFee} Bonus)` : ''} is the correct amount?</p>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500 font-medium">Customer</span>
                <span className="text-slate-900 font-bold">{customer.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-500 font-medium">Method</span>
                <span className="text-slate-900 font-bold">CASH</span>
              </div>
              {Number(bonusFee) > 0 && (
                <div className="flex justify-between mb-2 text-amber-600">
                  <span className="font-medium">Bonus Fee</span>
                  <span className="font-bold">₹{formatCurrency(bonusFee)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Total Collected</span>
                <span className="text-emerald-600 font-black text-lg">₹{formatCurrency(Number(amount) + Number(bonusFee || 0))}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-4 text-slate-700 font-bold bg-white border border-slate-300 rounded-xl active:bg-slate-50"
              >
                No, Go Back
              </button>
              <button 
                onClick={handleProcessPayment}
                className="flex-1 py-4 text-white font-bold bg-emerald-600 rounded-xl active:bg-emerald-700 shadow-md shadow-emerald-600/20"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
