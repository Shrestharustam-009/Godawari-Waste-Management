export const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ── Amount to Words (Nepali / Indian Numbering System) ──
export const amountToWords = (num) => {
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

// ── XSS Prevention: escape all user-supplied values before injecting into HTML ──
const escapeHTML = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const getBaseStyles = () => `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #000; font-size: 12px; max-width: 800px; margin: 0 auto; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .font-bold { font-weight: bold; }
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-4 { margin-top: 16px; }
  .border-b { border-bottom: 1px solid #000; }
  .border-t { border-top: 1px solid #000; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th, td { border: 1px solid #000; padding: 6px; font-size: 11px; }
  th { background-color: #f8f9fa; }
  .header-section { margin-bottom: 20px; text-align: center; }
  .title { font-size: 16px; font-weight: bold; margin: 5px 0; text-transform: uppercase; }
  .copy-text { font-size: 13px; font-weight: bold; font-style: italic; margin-top: 5px; color: #dc2626; }
  .info-grid { display: flex; justify-content: space-between; margin-bottom: 15px; }
  @media print {
    .no-print { display: none; }
    body { padding: 0; }
  }
`;

const getPrintButtons = (hasCopyToggle = false) => `
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      ${hasCopyToggle ? `
        <span style="font-size: 11px; font-weight: bold; margin-right: 8px;">Select Copy:</span>
        <button onclick="document.getElementById('copy-badge').innerText = 'CUSTOMER COPY (ग्राहक प्रति)'; window.print();" style="background: #2563eb; color: #fff; border: none; padding: 6px 12px; cursor: pointer; font-weight: bold; border-radius: 4px; font-size: 11px;">Print Customer Copy (ग्राहक प्रति)</button>
        <button onclick="document.getElementById('copy-badge').innerText = 'OFFICE COPY (कार्यालय प्रति)'; window.print();" style="background: #0d9488; color: #fff; border: none; padding: 6px 12px; cursor: pointer; font-weight: bold; border-radius: 4px; font-size: 11px; margin-left: 8px;">Print Office Copy (कार्यालय प्रति)</button>
      ` : ''}
    </div>
    <div>
      <button onclick="window.print()" style="background: #000; color: #fff; border: none; padding: 8px 16px; cursor: pointer; font-weight: bold; border-radius: 4px;">Print</button>
      <button onclick="window.close()" style="background: #ccc; color: #000; border: none; padding: 8px 16px; cursor: pointer; font-weight: bold; border-radius: 4px; margin-left: 10px;">Close</button>
    </div>
  </div>
`;

// ==========================================
// TAX INVOICE PRINT
// ==========================================
export const generateInvoiceHTML = (tx, settings, customFormatDate) => {
  const isCopy = (tx.printCount || 0) > 0;
  const copyLabel = isCopy ? `<div class="copy-text">Copy of Original (प्रतिलिपि) (${tx.printCount})</div>` : '';
  const invoiceType = tx.customer?.vatNumber 
    ? 'TAX INVOICE (कर विजक)' 
    : 'ABBREVIATED TAX INVOICE (संक्षिप्त कर विजक)';
  
  const formattedDate = customFormatDate ? customFormatDate(tx.date) : formatDate(tx.date);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${tx.id}</title>
        <style>${getBaseStyles()}</style>
      </head>
      <body>
        ${getPrintButtons(true)}
        
        <div class="header-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span id="copy-badge" style="font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 2px 7px; text-transform: uppercase;">
              CUSTOMER COPY (ग्राहक प्रति)
            </span>
            <span style="font-size: 10px; color: #555;">
              ${isCopy ? `Reprint #${tx.printCount}` : 'Original (मूल प्रति)'}
            </span>
          </div>
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'विनायक फोहोर व्यवस्थापन'}</h2>
          <div class="mb-1">${escapeHTML(settings?.companyAddress) || 'टोखा-९, गणेशस्थान, काठमाडौँ'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || '606698005'}</div>
          <div class="title">${invoiceType}</div>
          ${copyLabel}
        </div>

        <div class="info-grid border-t border-b" style="padding: 10px 0;">
          <div>
            <div class="mb-1"><strong>Invoice No:</strong> REC-${tx.id}</div>
            <div class="mb-1"><strong>Transaction Date:</strong> ${escapeHTML(formattedDate)}</div>
            <div class="mb-1"><strong>Payment Method:</strong> ${escapeHTML(tx.paymentMethod)}</div>
          </div>
          <div class="text-right">
            <div class="mb-1"><strong>Customer Name:</strong> ${escapeHTML(tx.customer?.name) || 'Cash Customer'}</div>
            <div class="mb-1"><strong>Customer PAN:</strong> ${escapeHTML(tx.customer?.vatNumber) || 'N/A'}</div>
            <div class="mb-1"><strong>Customer Address:</strong> ${escapeHTML(tx.customer?.assignedArea) || 'N/A'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-left">S.N.</th>
              <th class="text-left">Description</th>
              <th class="text-center">H.S. Code</th>
              <th class="text-right">Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left">1</td>
              <td class="text-left">${escapeHTML(tx.category?.name || tx.categoryName || 'Service Rendered')} ${tx.subCategory && tx.subCategory !== '-' ? '- ' + escapeHTML(tx.subCategory) : ''}</td>
              <td class="text-center">${escapeHTML(settings?.hsCode) || 'N/A'}</td>
              <td class="text-right">${formatCurrency(tx.baseAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div style="width: 300px; float: right; margin-top: 15px;">
          <div class="flex justify-between mb-1">
            <span>Taxable Amount:</span>
            <span>Rs. ${formatCurrency(tx.baseAmount)}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span>VAT (13%):</span>
            <span>Rs. ${formatCurrency(tx.vatAmount)}</span>
          </div>
          <div class="flex justify-between mb-2 font-bold border-t pt-1">
            <span>Total Amount:</span>
            <span>Rs. ${formatCurrency(tx.amount)}</span>
          </div>
        </div>
        <div style="clear: both;"></div>

        <div style="margin-top: 12px; padding: 6px 0; border-top: 1px dashed #000; font-size: 11px;">
          <strong>Amount in Words (अक्षरेपी):</strong> ${escapeHTML(amountToWords(tx.amount))}
        </div>
        
        <div style="margin-top: 45px; display: flex; justify-content: space-between; font-size: 11px; padding: 0 20px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 200px; padding-top: 5px;">
            Customer's Signature (ग्राहकको दस्तखत)
          </div>
          <div style="text-align: center; border-top: 1px solid #000; width: 200px; padding-top: 5px;">
            Authorized Signature (अधिकृत दस्तखत)
          </div>
        </div>
        
        <div class="mt-4 text-center border-t pt-2" style="font-size: 10px; color: #555;">
          <div class="mb-1">Thank you for your business!</div>
          <div>Printed by: ${escapeHTML(tx.collectedBy?.name || tx.collectedBy) || 'Admin'} on ${new Date().toLocaleString()}</div>
        </div>
      </body>
    </html>
  `;
};

// ==========================================
// SALES RETURN PRINT (CREDIT NOTE)
// ==========================================
export const generateSalesReturnHTML = (tx, settings, customFormatDate) => {
  const formattedDate = customFormatDate ? customFormatDate(tx.date) : formatDate(tx.date);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sales Return - ${tx.id}</title>
        <style>${getBaseStyles()}</style>
      </head>
      <body>
        ${getPrintButtons()}
        
        <div class="header-section">
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'विनायक फोहोर व्यवस्थापन'}</h2>
          <div class="mb-1">${escapeHTML(settings?.companyAddress) || 'टोखा-९, गणेशस्थान, काठमाडौँ'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || '606698005'}</div>
          <div class="title">CREDIT NOTE / SALES RETURN (क्रेडिट नोट / बिक्री फिर्ता)</div>
        </div>

        <div class="info-grid border-t border-b" style="padding: 10px 0;">
          <div>
            <div class="mb-1"><strong>Credit Note No (क्र.सं.):</strong> CN-${tx.id}</div>
            <div class="mb-1"><strong>Return Date (मिति):</strong> ${escapeHTML(formattedDate)}</div>
            <div class="mb-1" style="color: #dc2626;"><strong>Ref. Tax Invoice No (मूल कर विजक नं.):</strong> REC-${tx.returnRefId}</div>
          </div>
          <div class="text-right">
            <div class="mb-1"><strong>Customer Name (नाम):</strong> ${escapeHTML(tx.customer?.name) || 'Cash Customer'}</div>
            <div class="mb-1"><strong>Customer PAN (स्थायी लेखा नं.):</strong> ${escapeHTML(tx.customer?.vatNumber) || 'N/A'}</div>
            <div class="mb-1"><strong>Customer Address (ठेगाना):</strong> ${escapeHTML(tx.customer?.assignedArea) || 'N/A'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-left">S.N.</th>
              <th class="text-left">Reason for Return (फिर्ता हुनुको कारण)</th>
              <th class="text-center">H.S. Code</th>
              <th class="text-right">Amount Refunded (Rs)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left">1</td>
              <td class="text-left">${escapeHTML(tx.returnReason || tx.note || 'Cancellation')}</td>
              <td class="text-center">${escapeHTML(settings?.hsCode) || 'N/A'}</td>
              <td class="text-right">${formatCurrency(Math.abs(tx.baseAmount))}</td>
            </tr>
          </tbody>
        </table>

        <div style="width: 300px; float: right; margin-top: 15px;">
          <div class="flex justify-between mb-1">
            <span>Returned Taxable Amount:</span>
            <span>Rs. ${formatCurrency(Math.abs(tx.baseAmount))}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span>Returned VAT (13%):</span>
            <span>Rs. ${formatCurrency(Math.abs(tx.vatAmount))}</span>
          </div>
          <div class="flex justify-between mb-2 font-bold border-t pt-1">
            <span>Total Refunded (जम्मा):</span>
            <span>Rs. ${formatCurrency(Math.abs(tx.amount))}</span>
          </div>
        </div>
        <div style="clear: both;"></div>

        <div style="margin-top: 12px; padding: 6px 0; border-top: 1px dashed #000; font-size: 11px;">
          <strong>Refund Amount in Words (अक्षरेपी):</strong> ${escapeHTML(amountToWords(Math.abs(tx.amount)))}
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; padding: 0 20px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 220px; padding-top: 5px;">
            Receiver's Signature (बुझिलिनेको दस्तखत)
          </div>
          <div style="text-align: center; border-top: 1px solid #000; width: 220px; padding-top: 5px;">
            Authorized Signature (अधिकृत दस्तखत)
          </div>
        </div>
        
        <div class="mt-4 text-center border-t pt-2" style="font-size: 10px; color: #555;">
          <div>Printed by: ${escapeHTML(tx.collectedBy?.name || tx.collectedBy) || 'Admin'} on ${new Date().toLocaleString()}</div>
        </div>
      </body>
    </html>
  `;
};

// ==========================================
// SALES RETURN REGISTER PRINT (SCHEDULE 9)
// ==========================================
export const generateSalesReturnRegisterHTML = ({
  records = [],
  startDate,
  endDate,
  settings,
  formatDate,
  totalBase = 0,
  totalVat = 0,
  totalRefund = 0
}) => {
  const periodText = startDate && endDate
    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
    : (startDate ? `From ${formatDate(startDate)}` : (endDate ? `Up to ${formatDate(endDate)}` : 'All Dates'));

  const rowsHTML = records.map((r, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHTML(formatDate(r.date))}</td>
      <td>CN-${escapeHTML(r.id)}</td>
      <td>REC-${escapeHTML(r.returnRefId)}</td>
      <td>${escapeHTML(r.customer?.name || 'Cash Customer')}</td>
      <td>${escapeHTML(r.customer?.vatNumber || '-')}</td>
      <td>${escapeHTML(r.returnReason || '-')}</td>
      <td class="text-right">${formatCurrency(Math.abs(r.baseAmount))}</td>
      <td class="text-right">${formatCurrency(Math.abs(r.vatAmount))}</td>
      <td class="text-right font-bold">${formatCurrency(Math.abs(r.amount))}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sales Return Register - IRD Form 9</title>
        <style>
          ${getBaseStyles()}
          body { font-size: 11px; max-width: 100%; padding: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 4px 6px; font-size: 10px; }
          th { background-color: #f1f5f9; text-align: left; }
        </style>
      </head>
      <body>
        ${getPrintButtons()}
        <div class="header-section">
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'विनायक फोहोर व्यवस्थापन'}</h2>
          <div class="mb-1">${escapeHTML(settings?.companyAddress) || 'टोखा-९, गणेशस्थान, काठमाडौँ'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || '606698005'}</div>
          <div class="title" style="margin-top: 8px;">SALES RETURN REGISTER / बिक्री फिर्ता खाता (अनुसूची - ९)</div>
          <div style="font-size: 10px; color: #444;">(नियम २३ को उपनियम (१) को खण्ड (छ) सँग सम्बन्धित)</div>
          <div style="margin-top: 4px; font-weight: bold;">Period: ${escapeHTML(periodText)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>S.N.</th>
              <th>Date (मिति)</th>
              <th>Credit Note No</th>
              <th>Ref Invoice No</th>
              <th>Customer Name</th>
              <th>Customer PAN</th>
              <th>Reason for Return</th>
              <th class="text-right">Taxable Base (Rs)</th>
              <th class="text-right">VAT (13%) (Rs)</th>
              <th class="text-right">Total Refund (Rs)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #f8fafc;">
              <td colspan="7" class="text-right">Total (जम्मा योग):</td>
              <td class="text-right">${formatCurrency(totalBase)}</td>
              <td class="text-right">${formatCurrency(totalVat)}</td>
              <td class="text-right">${formatCurrency(totalRefund)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 45px; display: flex; justify-content: space-between; font-size: 11px; padding: 0 40px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Prepared By (तयार गर्ने)</div>
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Checked By (जाँच गर्ने)</div>
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Authorized By (प्रमाणित गर्ने)</div>
        </div>
      </body>
    </html>
  `;
};

// ── Transaction Activity Log / Audit Log Report (IRD Compliance) ──
export const generateAuditLogReportHTML = ({ logs = [], settings = {}, filterText = 'All Records' }) => {
  const rowsHTML = logs.map((log, index) => {
    const performedUser = log.performedBy?.name || log.performedBy?.username || log.details?.db_user || 'System';
    const performedRole = log.performedBy?.role ? ` (${log.performedBy.role})` : '';
    const dateFormatted = new Date(log.createdAt).toLocaleString();
    let detailSummary = '-';
    if (log.details?.old || log.details?.new) {
      const keys = Object.keys(log.details?.new || log.details?.old || {});
      detailSummary = keys.slice(0, 4).map(k => `${k}: ${log.details?.new?.[k] ?? log.details?.old?.[k]}`).join(', ');
      if (keys.length > 4) detailSummary += ' ...';
    } else if (typeof log.details === 'object' && log.details !== null) {
      detailSummary = JSON.stringify(log.details).slice(0, 80);
    }

    return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${escapeHTML(dateFormatted)}</td>
        <td style="font-weight: bold;">${escapeHTML(log.action)}</td>
        <td style="font-family: monospace;">${escapeHTML(log.entityType || log.tableName || '-')}</td>
        <td style="font-family: monospace;">${escapeHTML(String(log.entityId || log.recordId || '-'))}</td>
        <td>${escapeHTML(performedUser + performedRole)}</td>
        <td style="font-family: monospace;">${escapeHTML(log.ipAddress || 'Internal')}</td>
        <td style="font-size: 9px; font-family: monospace;">${escapeHTML(detailSummary)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Audit Log Report - IRD Activity Log</title>
        <style>
          ${getBaseStyles()}
          body { font-size: 11px; max-width: 100%; padding: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 4px 6px; font-size: 10px; }
          th { background-color: #f1f5f9; text-align: left; }
        </style>
      </head>
      <body>
        ${getPrintButtons()}
        <div class="header-section">
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'विनायक फोहोर व्यवस्थापन'}</h2>
          <div class="mb-1">${escapeHTML(settings?.companyAddress) || 'टोखा-९, गणेशस्थान, काठमाडौँ'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || '606698005'}</div>
          <div class="title" style="margin-top: 8px;">TRANSACTION ACTIVITY LOG / AUDIT LOG REPORT (कारोबार गतिविधि तथा अडिट लग प्रतिवेदन)</div>
          <div style="font-size: 10px; color: #444;">(IRD Electronic Billing Directive - Section 6 System Audit Compliance)</div>
          <div style="margin-top: 4px; font-weight: bold;">Filter Scope: ${escapeHTML(filterText)} | Total Records: ${logs.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">S.N.</th>
              <th style="width: 120px;">Timestamp (मिति/समय)</th>
              <th style="width: 90px;">Action (क्रियाकलाप)</th>
              <th style="width: 90px;">Table / Entity (खाता)</th>
              <th style="width: 80px;">Record ID (रेकर्ड नं.)</th>
              <th style="width: 120px;">Performed By (प्रयोगकर्ता)</th>
              <th style="width: 80px;">IP Address</th>
              <th>Changes / Remarks (परिवर्तन विवरण / कैफियत)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML || '<tr><td colspan="8" style="text-align: center; padding: 20px;">No audit records found matching scope.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 45px; display: flex; justify-content: space-between; font-size: 11px; padding: 0 40px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Prepared By (तयार गर्ने)</div>
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Internal Auditor (आन्तरिक लेखापरीक्षक)</div>
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">IT Administrator / Custodian (प्रणाली व्यवस्थापक)</div>
        </div>
      </body>
    </html>
  `;
};

// ==========================================
// VAT SALES REGISTER (SCHEDULE 8 / अनुसूची - ८)
// ==========================================
export const generateVatRegisterHTML = ({ records = [], startDate = '', endDate = '', settings = {}, formatDate, totalAmount = 0, totalBase = 0, totalVat = 0 }) => {
  const periodText = startDate && endDate
    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
    : startDate
      ? `From ${formatDate(startDate)}`
      : endDate
        ? `Up to ${formatDate(endDate)}`
        : 'All Available Periods (सबै अवधि)';

  const rowsHTML = records.map((rec, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>${escapeHTML(formatDate(rec.date))}</td>
      <td style="font-family: monospace;">REC-${rec.id}</td>
      <td>${escapeHTML(rec.customer?.name || 'Cash Customer')}</td>
      <td style="font-family: monospace;">${escapeHTML(rec.customer?.vatNumber || '-')}</td>
      <td>Waste Collection Service</td>
      <td style="text-align: right;">${formatCurrency(rec.amount)}</td>
      <td style="text-align: right;">${formatCurrency(rec.baseAmount)}</td>
      <td style="text-align: right;">${formatCurrency(rec.vatAmount)}</td>
      <td style="text-align: center;">${rec.isSyncedWithIRD ? 'Synced' : 'Pending'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sales Register - IRD Form 8</title>
        <style>
          ${getBaseStyles()}
          body { font-size: 11px; max-width: 100%; padding: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 4px 6px; font-size: 10px; }
          th { background-color: #f1f5f9; text-align: left; }
        </style>
      </head>
      <body>
        ${getPrintButtons()}
        <div class="header-section">
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'विनायक फोहोर व्यवस्थापन'}</h2>
          <div class="mb-1">${escapeHTML(settings?.companyAddress) || 'टोखा-९, गणेशस्थान, काठमाडौँ'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || '606698005'}</div>
          <div class="title" style="margin-top: 8px;">SALES REGISTER / बिक्री खाता (अनुसूची - ८)</div>
          <div style="font-size: 10px; color: #444;">(नियम २३ को उपनियम (१) को खण्ड (च) सँग सम्बन्धित)</div>
          <div style="margin-top: 4px; font-weight: bold;">Period: ${escapeHTML(periodText)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">S.N.</th>
              <th style="width: 90px;">Date (मिति)</th>
              <th style="width: 80px;">Invoice No</th>
              <th>Customer Name</th>
              <th style="width: 90px;">Customer PAN</th>
              <th>Service Description</th>
              <th class="text-right" style="width: 90px;">Total Sales (Rs)</th>
              <th class="text-right" style="width: 90px;">Taxable Base (Rs)</th>
              <th class="text-right" style="width: 80px;">VAT (13%) (Rs)</th>
              <th style="width: 60px; text-align: center;">IRD Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML || '<tr><td colspan="10" style="text-align: center; padding: 20px;">No sales records found.</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #f8fafc;">
              <td colspan="6" class="text-right">Grand Total (जम्मा कुल योग):</td>
              <td class="text-right">${formatCurrency(totalAmount)}</td>
              <td class="text-right">${formatCurrency(totalBase)}</td>
              <td class="text-right">${formatCurrency(totalVat)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 45px; display: flex; justify-content: space-between; font-size: 11px; padding: 0 40px;">
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Prepared By (तयार गर्ने)</div>
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Checked By (जाँच गर्ने)</div>
          <div style="text-align: center; border-top: 1px solid #000; width: 180px; padding-top: 4px;">Authorized By (प्रमाणित गर्ने)</div>
        </div>
      </body>
    </html>
  `;
};


