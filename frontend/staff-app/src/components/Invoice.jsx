import React from 'react';
import { createPortal } from 'react-dom';
import invoiceHeaderImg from '../assets/invoice-header.png';
import { useSettings } from '../context/SettingsContext';
import { toBS } from '@zener/nepali-datepicker-react';

const Invoice = ({ customer, staffName, amount, date, receiptNo, paymentForStartDate, paymentForEndDate, baseAmount, vatAmount, bonusFee, isPOS, balanceSnapshot, printCount = 0, hsCode = "999999", dualCopy }) => {
  const { formatDate, settings } = useSettings();

  const isCopy = Number(printCount || 0) > 0;
  const copyLabel = isCopy ? `Copy of Original (${printCount})` : '';
  const copyLabelNepali = isCopy ? `Copy of Original (प्रतिलिपि) (${printCount})` : '';

  const numBonus = Number(bonusFee || 0);
  const bonusBase = numBonus / 1.13;
  const bonusVat = numBonus - bonusBase;
  const numAmount = Number(amount || 0);
  const mainBase = Number(baseAmount) || (numAmount - (Number(vatAmount) || 0));
  const mainVat = Number(vatAmount) || 0;
  const totalVat = mainVat + bonusVat;
  const grandTotal = numAmount + numBonus;

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const amountToWords = (num) => {
    const n = Number(num);
    if (isNaN(n) || n === 0) return 'Rupees Zero Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertLessThanOneThousand = (val) => {
      let str = '';
      if (val >= 100) {
        str += ones[Math.floor(val / 100)] + ' Hundred ';
        val %= 100;
      }
      if (val >= 20) {
        str += tens[Math.floor(val / 10)] + ' ';
        val %= 10;
      }
      if (val > 0) {
        str += ones[val] + ' ';
      }
      return str.trim();
    };

    const integerPart = Math.floor(Math.abs(n));
    const decimalPart = Math.round((Math.abs(n) - integerPart) * 100);

    let result = '';
    let crore = Math.floor(integerPart / 10000000);
    let remainder = integerPart % 10000000;
    let lakh = Math.floor(remainder / 100000);
    remainder %= 100000;
    let thousand = Math.floor(remainder / 1000);
    remainder %= 1000;
    let hundred = remainder;

    if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
    if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
    if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
    if (hundred > 0) result += convertLessThanOneThousand(hundred) + ' ';

    result = result.trim();
    if (!result) result = 'Zero';

    let finalStr = 'Rupees ' + result;
    if (decimalPart > 0) {
      finalStr += ' and ' + convertLessThanOneThousand(decimalPart) + ' Paisa';
    }
    finalStr += ' Only';
    return finalStr;
  };

  const clearedDebt = balanceSnapshot 
    ? Math.max(0, Number(balanceSnapshot.previousOutstanding || 0) - Number(balanceSnapshot.newOutstanding || 0))
    : 0;
  
  const addedToWallet = balanceSnapshot
    ? Math.max(0, Number(balanceSnapshot.newAdvance || 0) - Number(balanceSnapshot.previousAdvance || 0))
    : 0;

  const getMonthName = (dStr) => {
    if (!dStr) return '';
    try {
      const dateObj = new Date(dStr);
      if (isNaN(dateObj)) return '';
      
      if (settings?.calendarType === 'BS') {
        const adDateOnly = dateObj.toISOString().split('T')[0];
        const bsObj = toBS(adDateOnly);
        const nepaliMonths = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
        return `${nepaliMonths[bsObj.month]} ${bsObj.year}`;
      }
      return dateObj.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    } catch (e) {
      try { return new Date(dStr).toLocaleString('en-IN', { month: 'long', year: 'numeric' }); } catch(err) { return ''; }
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
        return `${bsObj.date} ${nepaliMonths[bsObj.month]} ${bsObj.year}`;
      }
      return dateObj.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return getMonthName(dStr);
    }
  };

  // Simultaneous dual printing for field POS: prints Customer Copy followed by Office Copy
  const shouldPrintDual = isPOS && (dualCopy !== undefined ? dualCopy : (Number(printCount || 0) === 0));

  const renderPOSSlip = (isOfficeCopy = false) => {
    const isThisSlipCopy = isOfficeCopy || isCopy;
    const slipCopyNumber = isOfficeCopy ? (Number(printCount || 0) > 0 ? printCount : 1) : printCount;
    const slipCopyLabelNepali = `Copy of Original (प्रतिलिपि) (${slipCopyNumber})`;

    return (
      <div style={{
        width: '100%',
        maxWidth: '52mm',
        margin: '0 auto',
        padding: '2mm 1.5mm',
        boxSizing: 'border-box',
        fontFamily: 'monospace, "Courier New", Courier',
        color: '#000',
        fontSize: '11px',
        lineHeight: '1.25'
      }}>
        {/* POS Header */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          {isOfficeCopy && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 'bold', border: '1px solid #000', padding: '1px 5px', textTransform: 'uppercase' }}>
                OFFICE COPY (कार्यालय प्रति)
              </span>
            </div>
          )}
          <h2 style={{ fontSize: '13.5px', margin: '0 0 2px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {settings?.companyName || 'विनायक फोहोर व्यवस्थापन'}
          </h2>
          <p style={{ margin: '0', fontSize: '10px' }}>{settings?.companyAddress || 'टोखा नगरपालिका-९, गोंगबु, काठमाडौँ'}</p>
          <p style={{ margin: '0', fontSize: '10px' }}>PAN/VAT: {settings?.panNumber || '606698005'}</p>
          <p style={{ margin: '0', fontSize: '10px' }}>Phone: {settings?.contactNumber || settings?.phone || '01-4963742'}</p>
          <div style={{ borderBottom: '1px solid #000', margin: '5px 0' }}></div>
          <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 'bold' }}>
            {mainVat > 0 || customer?.vatNumber ? 'TAX INVOICE (कर विजक)' : 'ABBREVIATED TAX INVOICE (संक्षिप्त कर विजक)'}
          </p>
          {isThisSlipCopy && (
            <p style={{ margin: '2px 0 0 0', fontSize: '10.5px', fontStyle: 'italic', fontWeight: 'bold', color: '#b91c1c' }}>
              {slipCopyLabelNepali}
            </p>
          )}
          <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
        </div>
        
        {/* POS Info */}
        <div style={{ textAlign: 'center', marginBottom: '6px', fontSize: '10.5px' }}>
          <p style={{ margin: '1px 0' }}>Date: {formatPeriodDate(date)}</p>
          <p style={{ margin: '1px 0' }}>Receipt No: {receiptNo || 'N/A'}</p>
          <p style={{ margin: '1px 0' }}>Staff: {staffName || 'Staff'}</p>
          <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
        </div>

        {/* POS Customer */}
        <div style={{ marginBottom: '6px', fontSize: '10.5px' }}>
          <p style={{ margin: '1px 0', fontWeight: 'bold' }}>Name: {customer?.name}</p>
          <p style={{ margin: '1px 0' }}>Monthly Fee: Rs.{formatCurrency(customer?.monthlyFee)}</p>
          {Number(customer?.increasedFee) > 0 && (
            <p style={{ margin: '1px 0' }}>Increased fee: Rs.{formatCurrency(customer?.increasedFee)}</p>
          )}
          <p style={{ margin: '1px 0' }}>Cust ID: {customer?.customerId}</p>
          {customer?.vatNumber && <p style={{ margin: '1px 0' }}>PAN: {customer?.vatNumber}</p>}
          <p style={{ margin: '1px 0' }}>Phone: {customer?.phone || 'N/A'}</p>
          <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
        </div>

        {/* POS Period & Amounts */}
        <div style={{ marginBottom: '6px', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '3px' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Period:</span>
            <span style={{ textAlign: 'right' }}>
              {(() => {
                const m1 = formatPeriodDate(paymentForStartDate) || getMonthName(paymentForStartDate);
                const m2 = formatPeriodDate(paymentForEndDate) || getMonthName(paymentForEndDate);
                if (m1 && m2) return m1 === m2 ? m1 : `${m1} - ${m2}`;
                if (m1 || m2) return m1 || m2;
                return getMonthName(date) || 'N/A';
              })()}
            </span>
          </div>
          <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
        </div>

        {/* POS Totals */}
        <div style={{ marginBottom: '8px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Base:</span>
            <span>Rs.{formatCurrency(mainBase)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>VAT (13%):</span>
            <span>Rs.{formatCurrency(mainVat)}</span>
          </div>
          {numBonus > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bonus Base:</span>
                <span>Rs.{formatCurrency(bonusBase)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bonus VAT:</span>
                <span>Rs.{formatCurrency(bonusVat)}</span>
              </div>
            </>
          )}
          <div style={{ borderBottom: '1px solid #000', margin: '5px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13.5px', marginTop: '3px' }}>
            <span>TOTAL:</span>
            <span>Rs.{formatCurrency(grandTotal)}</span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '9.5px', fontStyle: 'italic', wordBreak: 'break-word', lineHeight: '1.2' }}>
            In Words: {amountToWords(grandTotal)}
          </p>
          
          {(clearedDebt > 0 || addedToWallet > 0) && (
            <div style={{ marginTop: '6px', paddingTop: '5px', borderTop: '1px dashed #000', fontSize: '10px', textAlign: 'left' }}>
              <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>Payment Allocation:</p>
              {clearedDebt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cleared Dues:</span>
                  <span>Rs.{formatCurrency(clearedDebt)}</span>
                </div>
              )}
              {addedToWallet > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Wallet Advance:</span>
                  <span>Rs.{formatCurrency(addedToWallet)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* POS Footer */}
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <p style={{ margin: '0', fontSize: '10px' }}>Thank you!</p>
          <p style={{ margin: '2px 0 0 0', fontSize: '10px' }}>Keep our city clean</p>
          
          {isOfficeCopy && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '4px', fontSize: '9.5px', textAlign: 'center' }}>
              <div style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '2px' }}>Collector Sign<br/>(संकलनकर्ता)</div>
              <div style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '2px' }}>Customer Sign<br/>(ग्राहक)</div>
            </div>
          )}
          
          <div style={{ height: '35px' }}></div> {/* Spacing for thermal tear off */}
        </div>
      </div>
    );
  };

  if (isPOS) {
    return createPortal(
      <div className="print-only pos-receipt-wrapper">
        {/* Slip 1: Original Tax Invoice */}
        {renderPOSSlip(false)}

        {/* Separator and Slip 2: Office Copy (Simultaneous Print) */}
        {shouldPrintDual && (
          <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
            <div style={{ textAlign: 'center', margin: '0 auto', maxWidth: '52mm', borderTop: '2px dashed #000', paddingTop: '6px', fontSize: '9px', fontWeight: 'bold' }}>
              ✂ - - - - - - - - - - - - - - ✂
              <div style={{ margin: '2px 0' }}>TEAR HERE / यहाँबाट च्यात्नुहोस्</div>
              ✂ - - - - - - - - - - - - - - ✂
            </div>
            {renderPOSSlip(true)}
          </div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @media screen {
            .print-only {
              display: none !important;
            }
          }
          @media print {
            @page {
              size: 58mm 185mm;
              margin: 0mm;
            }
            html, body {
              width: 58mm !important;
              max-width: 58mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
              width: 58mm !important;
              max-width: 58mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
            }
          }
        `}} />
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="print-only">
      <div style={{ padding: '15px', maxWidth: '750px', margin: '0 auto', fontFamily: 'sans-serif', color: '#000' }}>
        
        {/* Official Header */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold' }}>
            {settings?.companyName || 'विनायक फोहोर व्यवस्थापन'}
          </h1>
          <p style={{ margin: '0 0 3px 0', fontSize: '13px' }}>
            {settings?.companyAddress || 'टोखा नगरपालिका-९, गोंगबु, काठमाडौँ'}
          </p>
          <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
            <strong>स्थायी लेखा नं. (PAN/VAT):</strong> {settings?.panNumber || '606698005'} &nbsp;|&nbsp; <strong>फोन:</strong> {settings?.contactNumber || settings?.phone || '01-4963742'}
          </p>
          <h2 style={{ margin: '8px 0 0 0', textTransform: 'uppercase', fontSize: '18px', fontWeight: 'bold' }}>
            {(mainVat > 0 || customer?.vatNumber) ? 'TAX INVOICE (कर विजक)' : 'ABBREVIATED TAX INVOICE (संक्षिप्त कर विजक)'}
          </h2>
          {isCopy && <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontStyle: 'italic', color: '#dc2626', fontWeight: 'bold' }}>{copyLabelNepali}</p>}
        </div>

        {/* Info Grid */}
        <table style={{ width: '100%', marginBottom: '20px', borderTop: '1px solid #ccc', paddingTop: '10px', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', valign: 'top', textAlign: 'left', padding: 0 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#000', textTransform: 'uppercase' }}>Billed To</h3>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', fontSize: '16px' }}>{customer?.name}</p>
                <p style={{ margin: '0 0 3px 0' }}>Monthly Fee: Rs. {formatCurrency(customer?.monthlyFee)}</p>
                {Number(customer?.increasedFee) > 0 && (
                  <p style={{ margin: '0 0 3px 0' }}>Increased fee (applicable): Rs. {formatCurrency(customer?.increasedFee)}</p>
                )}
                <p style={{ margin: '0 0 3px 0' }}>ID: {customer?.customerId}</p>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold' }}>VAT No: {customer?.vatNumber || 'N/A'}</p>
                <p style={{ margin: '0 0 3px 0' }}>Area: {customer?.assignedArea}</p>
                <p style={{ margin: '0 0 3px 0' }}>Phone: {customer?.phone || 'N/A'}</p>
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
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>H.S. Code</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>Period Covered</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', textAlign: 'left' }}>
                <strong>Waste Collection Service Fee</strong>
              </td>
              <td style={{ padding: '12px', textAlign: 'center' }}>{settings?.hsCode || 'N/A'}</td>
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
                Rs. {formatCurrency(mainBase)}
              </td>
            </tr>
            {mainVat > 0 && (
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', textAlign: 'left', paddingLeft: '24px' }}>
                  <small>Add: VAT (13%)</small>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}></td>
                <td style={{ padding: '12px', textAlign: 'center' }}>-</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {formatCurrency(mainVat)}
                </td>
              </tr>
            )}
            {numBonus > 0 && (
              <>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', textAlign: 'left' }}>
                    <strong>Festival Bonus Fee (Base)</strong>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{settings?.hsCode || 'N/A'}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>-</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    Rs. {formatCurrency(bonusBase)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', textAlign: 'left', paddingLeft: '24px' }}>
                    <small>Add: Bonus VAT (13%)</small>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}></td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>-</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    Rs. {formatCurrency(bonusVat)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #d1d5db' }}>
              <td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>
                TOTAL AMOUNT:
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px', color: '#16a34a' }}>
                Rs. {formatCurrency(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <div style={{ width: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontSize: '14px', color: '#000' }}>Service Base:</span>
              <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(mainBase)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ fontSize: '14px', color: '#000' }}>VAT (13%):</span>
              <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(mainVat)}</span>
            </div>
            {numBonus > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ fontSize: '14px', color: '#000' }}>Bonus Base:</span>
                  <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(bonusBase)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ fontSize: '14px', color: '#000' }}>Bonus VAT (13%):</span>
                  <span style={{ fontSize: '14px', color: '#000' }}>Rs. {formatCurrency(bonusVat)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '2px solid #000' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Total Paid:</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Rs. {formatCurrency(grandTotal)}</span>
            </div>
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #9ca3af', fontSize: '12px' }}>
              <strong>In Words (अक्षरेपी):</strong> <em>{amountToWords(grandTotal)}</em>
            </div>
            
            {(clearedDebt > 0 || addedToWallet > 0) && (
              <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px dashed #9ca3af' }}>
                <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '0 0 8px 0', color: '#374151' }}>Payment Allocation:</p>
                {clearedDebt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ fontSize: '14px', color: '#4b5563' }}>Cleared Dues:</span>
                    <span style={{ fontSize: '14px', color: '#4b5563' }}>Rs. {formatCurrency(clearedDebt)}</span>
                  </div>
                )}
                {addedToWallet > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ fontSize: '14px', color: '#4b5563' }}>Smart Wallet Advance:</span>
                    <span style={{ fontSize: '14px', color: '#4b5563' }}>Rs. {formatCurrency(addedToWallet)}</span>
                  </div>
                )}
              </div>
            )}
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
            size: A4 portrait;
            margin: 8mm 6mm;
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