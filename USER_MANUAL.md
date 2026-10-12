# Godawari Waste Management - User & Technical Manual

This is the official operational guide for the Godawari Waste Management System, designed for administrative staff, field agents, and IT personnel.

## 1. System Overview

The system consists of three main portals:
1. **Admin Portal**: For managers to oversee operations, billing, fleet, and reports.
2. **Staff App**: A mobile-optimized application for field agents to collect payments and print receipts on the go.
3. **Customer App**: A client-facing portal for residents and businesses to track their waste collection dues and payment history.

Both systems are securely connected to a centralized database that adheres to strict Nepal Inland Revenue Department (IRD) Computerized Billing Management System (CBMS) standards.

---

## 2. Admin Portal Guide

### Logging In
1. Navigate to the Admin Portal URL on a desktop or tablet.
2. Enter your authorized username and password.
3. Upon login, you will see the Dashboard with key metrics (Total Revenue, Outstanding Dues, Active Customers).

### Managing Global Settings & Company Profile
The settings page is protected by a **Sudo Password** to prevent unauthorized changes to critical billing logic.
1. Navigate to **Settings**.
2. Under **Company Profile**, you can update the Company Name, Address, PAN/VAT Number, and H.S. Code.
3. Under **Billing Engine**, you can change the default billing cycle trigger date and calendar formats.
4. Click **Save** and enter your Master Admin Password to confirm the changes.

### Issuing Invoices & Credit Notes
1. **Invoices**: When a payment is collected (either via the Staff App or manual entry in the Admin Portal), a Tax Invoice or Abbreviated Tax Invoice is automatically generated.
2. **Immutability**: Once an invoice is generated, it **cannot** be edited or deleted (IRD requirement).
3. **Credit Notes**: If a mistake was made on an invoice, locate the invoice in the Ledger and click **Issue Sales Return**. This will generate a reverse transaction (Credit Note) to safely correct the accounting error without deleting historical data.

### Reports
The portal generates real-time reports for:
* Daily/Monthly Income
* Expense Tracking
* Tax & VAT collection summaries

---

## 3. Staff App (Field Operations) Guide

### Collecting Payments
1. Open the Staff App on your mobile device.
2. Search for the customer using their Name, ID, or Phone Number.
3. Tap **Collect Payment**.
4. Enter the collected amount. The system will automatically split the Base Amount and VAT (13%).
5. Select the Payment Method (Cash, FonePay, etc.).
6. Tap **Confirm Collection**.

### Printing Receipts (Thermal Printer)
1. Ensure your Bluetooth Thermal Printer is paired with your mobile device.
2. Upon confirming a payment, the receipt preview will appear on the screen.
3. Tap **Print**. The device will prompt you to select the connected Bluetooth printer.
4. If a receipt is printed more than once, it will automatically print with a **"Copy of Original"** tag to comply with IRD regulations.

---

## 4. Customer App Guide

### Logging In & Dashboard
1. Customers access the Customer Portal via their mobile browser or desktop.
2. They log in using their registered **Phone Number** and secure **4-digit PIN**.
3. The dashboard immediately displays their **Outstanding Dues** (if any) or their **Smart Wallet / Advance Balance** if they have pre-paid.

### Viewing Billing History
1. Navigate to the **History** tab.
2. Customers can view every automated monthly bill generated against their account.
3. They can also view a ledger of every payment they have made, providing complete financial transparency.

### Digital Payments (If Enabled)
1. If the Digital Gateway is active, customers can click **Pay Now** from their dashboard.
2. They can complete the transaction via FonePay, eSewa, or Bank Transfer.
3. Upon successful payment, the system automatically generates an IRD-compliant invoice in the background and clears their outstanding dues.

---

## 5. Technical Maintenance & IT Guide

### Deployment & Restarting Services
If the server is rebooted or needs a manual update, use the Node.js process manager (PM2).

```bash
# Check status of the backend
pm2 status

# View live server and API sync logs
pm2 logs backend

# Restart the backend service
pm2 restart backend
```

### CBMS Integration (IRD Sync)
The software is equipped with an automated background worker that syncs invoices with the IRD servers.
* **Credentials**: The IRD API Username and Password must be placed in the backend `.env` file (`IRD_USERNAME` and `IRD_PASSWORD`).
* **Offline Fallback**: If the internet drops, the system will continue to generate invoices locally (marked as `PENDING`). Once the internet is restored, the background worker will automatically push all pending invoices to the IRD in bulk.

### Security Reminders
* Never share the Admin Sudo Password.
* Do not attempt to manually modify the database directly via SQL tools; strict database triggers will block any alterations to the `IncomeLedger`.
