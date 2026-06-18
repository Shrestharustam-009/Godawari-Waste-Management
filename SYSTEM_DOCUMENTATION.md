# Master Technical Architecture & Documentation

**Date:** June 17, 2026
**System:** Godawari Waste Management Enterprise System

This document provides a 100% accurate, up-to-date snapshot of the workspace across the backend, admin portal, and field staff mobile app.

---

## 1. DATABASE ARCHITECTURE (Prisma Schema)

The database utilizes PostgreSQL 15+ with Prisma 5.x. Financial accuracy is strictly enforced using `Decimal(10, 2)` across the board (no floating points).

### 1.1 Core Entities
*   **User:** Internal operators utilizing `Enum Role { ADMIN, STAFF, DRIVER, NORMAL_EMPLOYEE }`.
*   **Customer:** Subscriber model. Uses `Decimal` for `outstandingPayment` and `advanceBalance` (Smart Wallet).
*   **GlobalSettings:** Singleton configuration utilizing `JSONB` for `customDeductions`.

### 1.2 Isolated Financial Ledgers
To prevent accidental category mixing, the Chart of Accounts is physically separated into distinct models:
*   **IncomeLedger:** Tracks all inbound cash flows. Linked to `IncomeCategory`.
*   **ExpenseLedger:** Tracks standard outflows (maintenance, tools). Linked to `ExpenseCategory`.
*   **VehicleExpenseLedger:** Fleet-specific tracking. Linked to `VehicleExpenseCategory`.
*   **SalaryLedger:** Dedicated payroll tracking. Uses `JSONB` for dynamic deductions.

### 1.3 Audit & Fleet
*   **Vehicle & VehicleLocation:** High-performance GPS tracking utilizing a composite index on `[vehicleId, timestamp]`.
*   **AuditLog:** Append-only system logging.
*   **RefreshToken:** Database-backed token persistence for device and session tracking.

---

## 2. BACKEND ARCHITECTURE & APIs

The backend is an Express 4.x application utilizing centralized error handling, rate limiting, and strict security middlewares.

### 2.1 Security & Auth
*   **CORS Configuration:** `allowedOrigins` explicitly whitelists `http://localhost:3000`, `http://localhost:5173`, `http://localhost:5174`, and `process.env.CORS_ORIGIN`. `credentials: true` is strictly enabled.
*   **Cookie Strategy:** A 15-minute JWT Access Token is transported securely inside an `HttpOnly`, `Strict/Lax` cookie (`accessToken`).
*   **Refresh Strategy:** A 7-day, opaque 512-bit hex token is stored in the database.

### 2.2 Core Endpoints & Business Logic
*   **Accounting Router (`/api/v1/accounting`):** Globally protected by `checkAuth` middleware, with individual routes protected by `authorizeRoles`.
*   **Smart Wallet Logic (`POST /api/v1/accounting/income`):**
    *   Wrapped completely in a Prisma `$transaction`.
    *   Calculates overpayments dynamically: if a customer pays more than they owe, the controller automatically reduces `outstandingPayment` to 0 and routes the remainder to `advanceBalance`.
    *   Includes a dynamic 13% Output VAT splitter for 'Monthly Collection Fee' entries.
*   **Staff History (`GET /api/v1/accounting/income/history`):**
    *   Fetches recent collections for the staff app.
    *   Implements native `Date()` math to generate a 7-day time fence, executing a Prisma query where `date: { gte: sevenDaysAgo }` and `collectedById: req.user.id`.
    *   Includes related `Customer` data for frontend display.

---

## 3. REAL-TIME & BACKGROUND PROCESSES

The system utilizes an internal event-driven architecture to offload heavy processing and provide real-time updates.

### 3.1 WebSockets (Socket.IO)
*   The `accounting.controller.js` directly imports `getIO()`.
*   Upon successful completion of a field payment (`Monthly Collection Fee`), it emits a `live_collection_update` event to the `admin_room`.
*   Payload standard: `{ type: 'COLLECTION', amount: Number, staffName: String, timestamp: Date }`.

### 3.2 Automated Cron Jobs
Initialized sequentially via `workers/index.js`:
*   **Zero-Touch Billing (`billing.worker.js`):** Automatically applies monthly fees to customer accounts.
*   **15-Day Debt Hunter (`debtHunter.js` & `debt.worker.js`):** Scans the database for prolonged debts and triggers notification logs or alerts.
*   **Reconciliation (`reconciliation.worker.js`):** Background financial consistency checks.

---

## 4. FRONTEND 1: ADMIN PORTAL (`/frontend/admin-portal`)

A React SPA built with TailwindCSS, utilizing a protected layout architecture.

### 4.1 Routing Structure
*   **Public:** `/login`
*   **Protected Shell (`<AdminLayout>`):**
    *   `/dashboard`: Real-time operational overview.
    *   `/customers`: Subscriber management.
    *   `/fleet`: Fleet HR and vehicle tracking.
    *   `/settings`: Sudo-protected system configurations.
*   **Accounting Sub-Tabs:**
    *   `/accounting/analysis`
    *   `/accounting/income`
    *   `/accounting/expense`
    *   `/accounting/vehicle-expenses`
    *   `/accounting/staff-salary`

---

## 5. FRONTEND 2: FIELD STAFF PWA (`/frontend/staff-app`)

A mobile-first Progressive Web App designed specifically for drivers and field staff, utilizing a bottom-navigation UI model.

### 5.1 Routing Structure
*   **Public:** `/login`
*   **Protected Shell (`<MobileLayout>`):**
    *   `/` (Search): Customer lookup and QR entry.
    *   `/register`: Street-side customer onboarding.
    *   `/collection/:customerId`: Payment processing view.
    *   `/recent`: 7-day localized transaction history.
    *   `/profile`: Staff metadata.

### 5.2 Workflows & Hardware Integrations
*   **QR Code Scanning:** Implemented via `html5-qrcode` inside `Search.jsx`. Invokes a clean camera UI overlay to scan physical customer cards.
*   **Collection Workflow & Validation:** `Collection.jsx` features an explicitly togglable "Advance Payment" switch. Form validation actively blocks submission if the entered amount exceeds the outstanding debt and the advance toggle is OFF.
*   **Bluetooth Printing:** Implements the native Web Bluetooth API (`navigator.bluetooth.requestDevice`) to target thermal printers via the standard `000018f0` GATT service. The promise is wrapped in a strict `try/catch` block that fires a `SweetAlert2` modal if the browser blocks access (e.g., due to local HTTP testing limits).
*   **Secure Registration:** The `/register` route explicitly strips any financial capabilities, hardcoding the submission payload to `{ outstandingPayment: 0, advanceBalance: 0 }` to prevent rogue field debt assignment.
