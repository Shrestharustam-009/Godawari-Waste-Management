# Deployment Process for Today's Updates

Since we made changes to the database schema, backend services, and frontend admin portal, you need to follow a specific order to deploy these updates to your production environment smoothly without causing downtime or errors.

> **IMPORTANT**: Always back up your production database before running any Prisma migration or push commands, just to be safe!

---

## Step 1: Update the Production Database
Because we added `clearedDebtAmount` and `addedToAdvanceAmount` to the `IncomeLedger` table, the production database needs to be updated first.

1. SSH into your production server.

2. Navigate to your backend directory:
   ```bash
   cd /path/to/Godawari-Waste-Management/backend
   ```
3. Pull the latest code (if using git).

4. Run the Prisma database push command to safely add the new columns:
   ```bash
   npx prisma db push

   ```
   *(Note: If you use migrations in production, run `npx prisma migrate deploy` instead).*

---

## Step 2: Restart the Backend Server
Once the database schema is updated, the backend needs to be restarted so it can load the new logic for `payment.service.js`, `billing.worker.js`, and `customer.validator.js`.

1. While still in the backend directory, ensure all dependencies are up to date (just in case):
   ```bash
   npm install
   ```
2. Restart your backend process manager (assuming you use PM2, which is standard for Node.js):
   ```bash
   pm2 restart all
   ```
   *(Or whatever command your server uses, like `systemctl restart backend`)*.

---

## Step 3: Build & Deploy the Admin Portal (Frontend)
We updated the Admin Portal (`Customers.jsx`) to display the new detailed breakdown on the customer statements.

1. Navigate to your admin portal directory:
   ```bash
   cd /path/to/Godawari-Waste-Management/frontend/admin-portal
   ```
2. Pull the latest code.
3. Install dependencies and build the production bundle:
   ```bash
   npm install
   npm run build
   ```
4. Copy the newly generated `dist/` or `build/` folder to your web server (e.g., Nginx, Apache, or your hosting platform).

---

## Step 4: Verification
To ensure everything deployed successfully:
1. Open the Admin Portal in your browser and hard-refresh (`Ctrl + Shift + R`).
2. Go to a Customer's Profile and manually add an income (e.g., ₹500).
3. Look at the **Transaction History Statement** — you should immediately see the new breakdown format (e.g., `+₹500` with `[To Debt: ₹200 | To Wallet: ₹300]`).
4. You are completely finished!
