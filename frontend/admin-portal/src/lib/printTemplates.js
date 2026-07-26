export const formatCurrency = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
  .copy-text { font-size: 12px; font-weight: bold; font-style: italic; margin-top: 5px; }
  .info-grid { display: flex; justify-content: space-between; margin-bottom: 15px; }
  @media print {
    .no-print { display: none; }
    body { padding: 0; }
  }
`;

const getPrintButtons = () => `
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background: #000; color: #fff; border: none; padding: 8px 16px; cursor: pointer; font-weight: bold; border-radius: 4px;">Print</button>
    <button onclick="window.close()" style="background: #ccc; color: #000; border: none; padding: 8px 16px; cursor: pointer; font-weight: bold; border-radius: 4px; margin-left: 10px;">Close</button>
  </div>
`;

// ==========================================
// TAX INVOICE PRINT
// ==========================================
export const generateInvoiceHTML = (tx, settings, customFormatDate) => {
  const isCopy = (tx.printCount || 0) > 0;
  const copyLabel = isCopy ? `<div class="copy-text">Copy of Original (${tx.printCount})</div>` : '';
  const invoiceType = tx.customer?.vatNumber ? 'TAX INVOICE' : 'ABBREVIATED TAX INVOICE';
  
  const formattedDate = customFormatDate ? customFormatDate(tx.date) : formatDate(tx.date);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${tx.id}</title>
        <style>${getBaseStyles()}</style>
      </head>
      <body>
        ${getPrintButtons()}
        
        <div class="header-section">
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'Godawari Waste Management'}</h2>
          <div class="mb-1">${escapeHTML(settings?.address) || 'Godawari, Lalitpur, Nepal'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || 'NOT CONFIGURED'}</div>
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
              <td class="text-center">${escapeHTML(tx.hsCode) || '999999'}</td>
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
          <h2 style="margin:0;">${escapeHTML(settings?.companyName) || 'Godawari Waste Management'}</h2>
          <div class="mb-1">${escapeHTML(settings?.address) || 'Godawari, Lalitpur, Nepal'}</div>
          <div class="mb-1">PAN/VAT No: ${escapeHTML(settings?.panNumber) || 'NOT CONFIGURED'}</div>
          <div class="title">CREDIT NOTE (SALES RETURN)</div>
        </div>

        <div class="info-grid border-t border-b" style="padding: 10px 0;">
          <div>
            <div class="mb-1"><strong>Return Note No:</strong> CN-${tx.id}</div>
            <div class="mb-1"><strong>Return Date:</strong> ${escapeHTML(formattedDate)}</div>
            <div class="mb-1" style="color: #dc2626;"><strong>Reference Bill No:</strong> REC-${tx.returnRefId}</div>
          </div>
          <div class="text-right">
            <div class="mb-1"><strong>Customer Name:</strong> ${escapeHTML(tx.customer?.name) || 'Cash Customer'}</div>
            <div class="mb-1"><strong>Customer PAN:</strong> ${escapeHTML(tx.customer?.vatNumber) || 'N/A'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-left">S.N.</th>
              <th class="text-left">Reason for Return</th>
              <th class="text-center">H.S. Code</th>
              <th class="text-right">Amount Returned (Rs)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left">1</td>
              <td class="text-left">${escapeHTML(tx.returnReason || tx.note || 'Cancellation')}</td>
              <td class="text-center">${escapeHTML(tx.hsCode) || '999999'}</td>
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
            <span>Total Refunded:</span>
            <span>Rs. ${formatCurrency(Math.abs(tx.amount))}</span>
          </div>
        </div>
        <div style="clear: both;"></div>
        
        <div class="mt-4 text-center border-t pt-2" style="font-size: 10px; color: #555;">
          <div>Printed by: ${escapeHTML(tx.collectedBy?.name || tx.collectedBy) || 'Admin'} on ${new Date().toLocaleString()}</div>
        </div>
      </body>
    </html>
  `;
};
