import React from 'react';
import invoiceHeaderImg from '../assets/invoice-header.png';
import { useSettings } from '../context/SettingsContext';

const Invoice = ({ customer, staffName, amount, date, receiptNo, paymentForStartDate, paymentForEndDate }) => {
  const { formatDate } = useSettings();

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
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

        {/* Info Grid - Replaced flex with a solid table layout to guarantee side-by-side positioning in print */}
        <table style={{ width: '100%', marginBottom: '20px', borderTop: '1px solid #ccc', paddingTop: '10px', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', valign: 'top', textAlign: 'left', padding: 0 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Billed To</h3>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', fontSize: '16px' }}>{customer?.name}</p>
                <p style={{ margin: '0 0 3px 0' }}>ID: {customer?.customerId}</p>
                <p style={{ margin: '0 0 3px 0' }}>Area: {customer?.assignedArea}</p>
                <p style={{ margin: '0' }}>Phone: {customer?.phone}</p>
              </td>
              <td style={{ width: '50%', valign: 'top', textAlign: 'right', padding: 0 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Receipt Details</h3>
                <p style={{ margin: '0 0 3px 0' }}><strong>Receipt No:</strong> {receiptNo || 'N/A'}</p>
                <p style={{ margin: '0 0 3px 0' }}><strong>Date:</strong> {formatDate(date)}</p>
                <p style={{ margin: '0' }}><strong>Collected By:</strong> {staffName || 'Staff'}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment Period Table - Restructured to lock labels to columns */}
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
                {paymentForStartDate || paymentForEndDate ? (
                  <>{formatDate(paymentForStartDate)} - {formatDate(paymentForEndDate)}</>
                ) : (
                  'Not Specified'
                )}
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                Rs. {formatCurrency(amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <div style={{ width: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '2px solid #000' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Total Paid:</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Rs. {formatCurrency(amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#666', fontSize: '11px', borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '20px' }}>
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
    </div>
  );
};

export default Invoice;