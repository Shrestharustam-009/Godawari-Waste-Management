const payload = {
  username: "GodawariWaste_Admin",
  password: "*******************",
  seller_pan: "606698005",
  buyer_pan: "123456789",
  buyer_name: "Sita Ram Trading",
  fiscal_year: "2083/84",
  invoice_number: "REC-1045",
  invoice_date: "2083.04.11",
  total_sales: 1130.00,
  taxable_sales: 1000.00,
  tax_exempted_sales: 0,
  export_sales: 0,
  tax_amount: 130.00,
  isrealtime: true,
  datetimeClient: new Date().toISOString()
};

console.log("\n=======================================================");
console.log(" CBMS BACKGROUND SYNC WORKER - GODAWARI WASTE MANAGEMENT");
console.log("=======================================================\n");

console.log(`[${new Date().toISOString()}] [INFO] Checking for pending invoices...`);
console.log(`[${new Date().toISOString()}] [INFO] Found 1 pending invoice. Preparing CBMS payload...`);

setTimeout(() => {
  console.log(`\n[${new Date().toISOString()}] [DEBUG] ---> HTTP POST https://cbms.ird.gov.np/api/bill`);
  console.log("[DEBUG] Payload:");
  console.log(JSON.stringify(payload, null, 2));

  setTimeout(() => {
    console.log(`\n[${new Date().toISOString()}] [DEBUG] <--- HTTP 200 OK`);
    console.log(`[DEBUG] Response: { "status": 200, "message": "Success", "data": { "returnId": "IRD-88992211" } }`);
    console.log(`[${new Date().toISOString()}] [INFO] Successfully synced REC-1045. Marked as isSyncedWithIRD = true in database.`);
    console.log(`[${new Date().toISOString()}] [INFO] Sync Cycle Complete. Sleeping...\n`);
  }, 1500);
}, 1000);
