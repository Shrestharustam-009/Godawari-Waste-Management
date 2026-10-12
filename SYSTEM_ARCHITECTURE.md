# Godawari Waste Management - System Architecture & Tech Stack

This document outlines the technical stack, core mechanisms, and compliance architecture of the Godawari Waste Management software application. This system is designed to handle waste collection billing, staff management, payroll, and fleet tracking, with strict compliance to the Inland Revenue Department (IRD) of Nepal's Computerized Billing Management System (CBMS).

## 1. Technology Stack

The application is built using a modern JavaScript/TypeScript stack (MERN-like architecture with PostgreSQL).

### Frontend (User Interface)
* **Framework:** React.js (Bootstrapped with Vite for fast builds and HMR)
* **Styling:** Tailwind CSS (Utility-first CSS framework for responsive design)
* **Icons:** Lucide React
* **State Management:** React Context API & Local State
* **Date Handling:** `@zener/nepali-datepicker-react` (For BS Calendar support)
* **Architecture:** Split into two distinct Single Page Applications (SPAs):
  * `admin-portal`: A comprehensive dashboard for back-office management, reporting, and settings.
  * `staff-app`: A mobile-first Progressive Web App (PWA) designed for field staff to collect payments, print thermal receipts, and track daily tasks.

### Backend (Server & API)
* **Runtime:** Node.js
* **Framework:** Express.js (RESTful API architecture)
* **Database:** PostgreSQL (Relational Database)
* **ORM:** Prisma (Type-safe database client and schema management)
* **Authentication:** JSON Web Tokens (JWT) & bcrypt (Password hashing)
* **Validation:** Zod (Strict schema validation for all incoming API payloads)
* **Process Manager:** PM2 (For production server monitoring and zero-downtime restarts)

---

## 2. Core Mechanisms & Workflow

### A. Field Collection (Staff App)
1. Field staff log into the mobile-optimized `staff-app` using their credentials.
2. The app fetches their assigned geographical areas and customer lists.
3. When a collection is made, the staff member records the payment (Cash, FonePay, Bank Transfer, etc.).
4. The system automatically calculates any active deductions, VAT (if applicable), and generates a sequential `Receipt Number`.
5. A receipt (Invoice / Abbreviated Tax Invoice) is generated and printed via a Bluetooth thermal printer directly from the mobile browser.

### B. Billing & Revenue Engine
* **Billing Cycle:** The system runs an automated check based on the global `billingCycleDay` setting. When triggered, it automatically maps monthly fees to active customers.
* **Accounting Ledger:** All transactions (Income, Expenses, Salary payouts) are recorded in centralized ledger tables (`IncomeLedger`, `ExpenseLedger`, `SalaryLedger`).
* **Smart Wallet:** If a customer overpays, the excess is automatically deposited into their "Smart Wallet" (Advance balance). Future bills automatically deduct from this wallet before showing outstanding dues.

### C. Master Admin & Sudo Protection
* Destructive actions, payroll modifications, and global settings updates are protected by a "Sudo Mode" pattern. Even if an admin is logged in, they must re-enter their Master Password to execute high-stakes mutations.

---

## 3. IRD CBMS Compliance Architecture

The system is rigorously engineered to comply with the Inland Revenue Department (IRD) of Nepal's rules for Computerized Billing.

### Immutability via Database Triggers
To prevent data tampering (a strict IRD requirement), the database employs raw PostgreSQL triggers that operate independently of the Node.js application layer.
* **`prevent_income_ledger_update`:** A SQL trigger that blocks any `UPDATE` statements on the `IncomeLedger` table. Once an invoice is generated, it cannot be modified by the user, the admin, or the software itself.
* **`prevent_income_ledger_delete`:** A SQL trigger that blocks any `DELETE` statements on the `IncomeLedger` table. Invoices cannot be erased.

### Sales Returns (Credit Notes)
Since invoices are immutable, mistakes must be corrected using standard accounting principles:
* If a bill is generated incorrectly, the system issues a **Sales Return (Credit Note)**.
* This generates a new, negative transaction in the `IncomeLedger` referencing the original bill (`returnRefId`), balancing the books without deleting historical data.

### Print Tracking & Watermarking
* The database tracks how many times a specific invoice has been printed (`printCount`).
* If `printCount > 1`, the generated HTML print template automatically applies a strict `"Copy of Original"` watermark, satisfying IRD duplicate printing laws.
* A flag (`isSalesReturn`) dictates whether the document is titled "TAX INVOICE" or "CREDIT NOTE".

### API Synchronization (CBMS)
* Every invoice is created with a `sync_status` of `'PENDING'`.
* A background worker (`sync.service.js`) regularly polls the database for pending invoices.
* It formats the data to exactly match the IRD's required payload (Seller PAN, Buyer PAN, Total Sales, Taxable Sales, VAT, etc.).
* It transmits the payload to the government API. Upon a successful HTTP 200 response, the invoice is marked as `'SYNCED'`. If the IRD server is down, it safely retries during the next polling cycle.

---

## 4. Database Structure Overview (Prisma Schema)

* **`User`**: System access (Admins, Field Staff) with Role-Based Access Control (RBAC).
* **`Customer`**: Client details, VAT numbers, assigned areas, and active monthly fee profiles.
* **`GlobalSettings`**: Singleton table for system configurations (Company Name, PAN, Billing Cycle, H.S. Code).
* **`IncomeLedger`**: Immutable table storing every generated invoice and credit note.
* **`ExpenseLedger`**: Records company expenditures.
* **`SalaryLedger`**: Tracks staff payroll, advances, and dynamic tax deductions (e.g., TDS, SSF).
* **`AuditLog`**: Tracks sensitive actions (logins, settings changes, failed sudo attempts) for security and accountability.
