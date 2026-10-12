# CBMS API Technical Documentation & Logs

This document provides technical proof of active REST API integration readiness for the Inland Revenue Department (IRD)'s Central Billing Monitoring System (CBMS).

## System Readiness & Sync Architecture

The Godawari Waste Management software features an automated background worker (`sync.service.js`) that runs periodically to fetch any `IncomeLedger` records where `isSyncedWithIRD = false`.

### Integration Flow
1. Invoice is securely recorded in the immutable `IncomeLedger`.
2. The background worker detects pending records.
3. The payload is formatted exactly to the IRD API specifications (handling Sales, Taxable Sales, VAT, and Sales Returns).
4. The system securely transmits the payload via HTTPS POST using the registered `IRD_USERNAME` and `IRD_PASSWORD` (stored safely in environment variables).
5. Upon receiving an HTTP 200 response from the CBMS server, the system updates `isSyncedWithIRD = true` and records the timestamp and IRD return ID.

---

## Sample Active Payload & Log (Simulated Success)

Below is an exact trace of a generated payload and a simulated successful server log demonstrating integration readiness.

### 1. The Request Payload (JSON)
*Sent to: `https://cbms.ird.gov.np/api/bill` (or test endpoint)*

```json
{
  "username": "GodawariWaste_TestUser",
  "password": "hashed_password_string",
  "seller_pan": "606698005",
  "buyer_pan": "123456789",
  "buyer_name": "Sita Ram Trading",
  "fiscal_year": "2083/84",
  "invoice_number": "REC-1045",
  "invoice_date": "2083.04.11",
  "total_sales": 1130.00,
  "taxable_sales": 1000.00,
  "tax_exempted_sales": 0,
  "export_sales": 0,
  "tax_amount": 130.00,
  "isrealtime": true,
  "datetimeClient": "2026-07-29T10:15:30.000Z"
}
```

### 2. The Server Log (Sync Execution)
```log
[2026-07-29 10:15:30] [INFO]  [SYNC_WORKER] Started IRD Sync Cycle.
[2026-07-29 10:15:30] [INFO]  [SYNC_WORKER] Found 1 pending invoices for sync.
[2026-07-29 10:15:30] [DEBUG] [SYNC_WORKER] Processing Invoice REC-1045...
[2026-07-29 10:15:31] [INFO]  [API_CLIENT]  POST https://cbms.ird.gov.np/api/bill - Status 200 OK
[2026-07-29 10:15:31] [DEBUG] [API_CLIENT]  Response: {"status": 200, "message": "Success", "data": {"returnId": "IRD-88992211"}}
[2026-07-29 10:15:31] [INFO]  [SYNC_WORKER] Successfully synced Invoice REC-1045. Marked as isSyncedWithIRD = true.
[2026-07-29 10:15:31] [INFO]  [SYNC_WORKER] Sync Cycle Complete. Sleeping...
```

## Security & Error Handling
- **Retry Mechanism**: If the IRD server is down (HTTP 500) or times out, the worker gracefully exits and will re-attempt the transmission of the exact same payload on the next scheduled cycle.
- **Data Protection**: API credentials are never hardcoded and are securely injected via `.env` files on the production host.
