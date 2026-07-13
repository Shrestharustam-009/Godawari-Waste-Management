import React from 'react';
import { createPortal } from 'react-dom';
import invoiceHeaderImg from '../assets/invoice-header.png';
import { useSettings } from '../context/SettingsContext';
import { toBS } from '@zener/nepali-datepicker-react';

const Invoice = ({ customer, staffName, amount, date, receiptNo, paymentForStartDate, paymentForEndDate, baseAmount, vatAmount, bonusFee, isPOS }) => {
  const { formatDate, settings } = useSettings();

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getMonthName = (dStr) => {
    if (!dStr) return '';
    try {
      const dateObj = new Date(dStr);
      if (isNaN(dateObj)) return '';
      
      if (settings?.calendarType === 'BS') {
        const adDateOnly = dateObj.toISOString().split('T')[0];
        const bsObj = toBS(adDateOnly);
        const nepaliMonths = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
        return nepaliMonths[bsObj.month];
      }
      return dateObj.toLocaleString('en-IN', { month: 'long' });
    } catch (e) {
      try { return new Date(dStr).toLocaleString('en-IN', { month: 'long' }); } catch(err) { return ''; }
    }
  };

  const formatPeriodDate = (dStr) => {
    if (!dStr) return '';
    try {
      const dateObj = new Date(dStr);
      if (isNaN(dateObj)) return '';
      
      if (settings?.calendarType === 'BS') {
        const adDateOnly = dateObj.toISOString().split('T')[0];
        const bsObj = toBS(adDateOnly);
        const nepaliMonths = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
        return `${bsObj.date} ${nepaliMonths[bsObj.month]}`;
      }
      return dateObj.toLocaleString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return getMonthName(dStr);
    }
  };

  if (isPOS) {
    return createPortal(
      <div className="print-only">
        <div style={{ width: '58mm', margin: '0 auto', fontFamily: 'monospace', color: '#000', fontSize: '12px', lineHeight: '1.3' }}>
          {/* POS Header */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '15px', margin: '0 0 4px 0', fontWeight: 'bold' }}>विनायक फोहोर मैला</h2>
            <p style={{ margin: '0' }}>व्यवस्थापन प्रा.लि.</p>
            <p style={{ margin: '0' }}>मासिक शुल्क कार्ड</p>
            <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>
          </div>
          
          {/* POS Info */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ margin: '2px 0' }}>Date: {formatPeriodDate(date)}</p>
            <p style={{ margin: '2px 0' }}>Receipt No: {receiptNo || 'N/A'}</p>
            <p style={{ margin: '2px 0' }}>Staff: {staffName || 'Staff'}</p>
            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
          </div>

          {/* POS Customer */}
          <div style={{ marginBottom: '8px' }}>
            <p style={{ margin: '2px 0' }}>Name: {customer?.name}</p>
            <p style={{ margin: '2px 0' }}>ID: {customer?.customerId}</p>
            <p style={{ margin: '2px 0' }}>Phone: {customer?.phone}</p>
            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
          </div>

          {/* POS Period & Amounts */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Period:</span>
              <span style={{ textAlign: 'right' }}>
                {(() => {
                  const m1 = formatPeriodDate(paymentForStartDate) || getMonthName(paymentForStartDate);
                  const m2 = formatPeriodDate(paymentForEndDate) || getMonthName(paymentForEndDate);
                  if (m1 && m2) return m1 === m2 ? m1 : `${m1} to ${m2}`;
                  if (m1 || m2) return m1 || m2;
                  return getMonthName(date) || 'N/A';
                })()}
              </span>
            </div>
            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
          </div>

          {/* POS Totals */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Base:</span>
              <span>Rs.{formatCurrency(baseAmount || (amount - (vatAmount || 0)))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>VAT:</span>
              <span>Rs.{formatCurrency(vatAmount || 0)}</span>
            </div>
            {Number(bonusFee) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bonus:</span>
                <span>Rs.{formatCurrency(bonusFee)}</span>
              </div>
            )}
            <div style={{ borderBottom: '1px solid #000', margin: '6px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', marginTop: '4px' }}>
              <span>TOTAL:</span>
              <span>Rs.{formatCurrency(amount)}</span>
            </div>
          </div>
          
          {/* POS Footer */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ margin: '0', fontSize: '11px' }}>Thank you!</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px' }}>Keep our city clean</p>
            <div style={{ height: '40px' }}></div> {/* Spacing for tear off */}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="print-only">
      <div style={{ padding: '15px', maxWidth: '750px', margin: '0 auto', fontFamily: 'sans-serif', color: '#000' }}>
        
        {/* Header Image */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px' }}>
          <img 
            src={invoiceHeaderImg} 
            alt="Header" 
            style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
          />
        </div>

        {/* Info Grid */}
        <table style={{ width: '100%', marginBottom: '20px', borderTop: '1px solid #ccc', paddingTop: '10px', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', valign: 'top', textAlign: 'left', padding: 0 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#000', textTransform: 'uppercase' }}>Billed To</h3>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', fontSize: '16px' }}>{customer?.name}</p>
                <p style={{ margin: '0 0 3px 0' }}>ID: {customer?.customerId}</p>
                <p style={{ margin: '0 0 3px 0' }}>Area: {customer?.assignedArea}</p>
                <p style={{ margin: '0' }}>Phone: {customer?.phone}</p>
              </td>
              <td style={{ width: '50%', valign: 'top', textAlign: 'right', padding: 0 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#000', textTransform: 'uppercase' }}>Receipt Details</h3>
                <p style={{ margin: '0 0 3px 0' }}><strong>Receipt No:</strong> {receiptNo || 'N/A'}</p>
                <p style={{ margin: '0 0 3px 0' }}><strong>Date:</strong> {formatPeriodDate(date)}</p>
                <p style={{ margin: '0' }}><strong>Collected By:</strong> {staffName || 'Staff'}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment Period Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>Period Covered</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', textAlign: 'left' }}>
                <strong>Waste Collection Service Fee</strong>
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                {(() => {
                  const m1 = formatPeriodDate(paymentForStartDate) || getMonthName(paymentForStartDate);
                  const m2 = formatPeriodDate(paymentForEndDate) || getMonthName(paymentForEndDate);
                  if (m1 && m2) return m1 === m2 ? m1 : `${m1} to ${m2}`;
                  if (m1 || m2) return m1 || m2;
                  return getMonthName(date) || 'Not Specified';
                })()}
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                Rs. {formatCurrency(baseAmount || (amount - (vatAmount || 0)))}
              </td>
            </tr>
            {Number(vatAmount) > 0 && (
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', textAlign: 'left', paddingLeft: '24px' }}>
                  <small>Add: VAT (13%)</small>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>-</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {formatCurrency(vatAmount)}
                </td>
              </tr>
            )}
            {Number(bonusFee) > 0 && (
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', textAlign: 'left' }}>
                  <strong>Festival Bonus Fee</strong>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>-</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {formatCurrency(bonusFee)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #d1d5db' }}>
              <td colSpan="2" style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>
                TOTAL AMOUNT:
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px', color: '#16a34a' }}>
                Rs. {formatCurrency(amount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <div style={{ width: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontSize: '14px', color: '#000' }}>Subtotal:</span>
              <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(baseAmount || (amount - (vatAmount || 0)))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontSize: '14px', color: '#000' }}>VAT:</span>
              <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(vatAmount || 0)}</span>
            </div>
            {Number(bonusFee) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ fontSize: '14px', color: '#000' }}>Bonus Fee:</span>
                <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(bonusFee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '2px solid #000' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Total Paid:</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Rs. {formatCurrency(Number(amount) + Number(bonusFee || 0))}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#000', fontSize: '11px', borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '20px' }}>
          <p style={{ margin: '0 0 3px 0' }}>Thank you for your cooperation.</p>
          <p style={{ margin: '0' }}>Keep our city clean and green!</p>
        </div>
      </div>
      
      {/* Safely injected style tag using dangerouslySetInnerHTML so the raw code doesn't print out text */}
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: auto;
            margin: 5mm 0mm;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          body * {
            visibility: hidden;
          }
          .print-only, .print-only * {
            visibility: visible !important;
          }
          .print-only {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            page-break-inside: avoid;
          }
          tr, table, img {
            page-break-inside: avoid;
          }
        }
      `}} />
    </div>,
    document.body
  );
};

export default Invoice;