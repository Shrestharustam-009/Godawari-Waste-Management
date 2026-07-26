# Deployment Process for Today's Updates (IRD CBMS Compliance & Security Patches)

Since we made changes to the database (adding new Prisma schema fields and PostgreSQL audit triggers), backend services, and frontend UI templates, you need to follow this specific order to deploy these updates to your production environment smoothly.

---

## Step 1: Pull the Latest Code
SSH into your production server and navigate to the project directory, then pull the commits:
```bash
cd /path/to/Godawari-Waste-Management
git pull origin main
```

## Step 2: Update the Database Schema (Prisma)
We added several new fields to the `IncomeLedger` table today (like `printCount`, `isSalesReturn`, `returnRefId`, and `hsCode`) to support the IRD compliance features. **You MUST push these schema changes to the database before running the triggers script.**

Run this in the backend folder:
```bash
cd backend
npm install
npx prisma db push
```
*(Note: If you use Prisma migrations in production instead of db push, run `npx prisma migrate deploy` instead).*

## Step 3: Install the Database Triggers
Now that the database schema is updated, you must execute the raw PostgreSQL setup script we wrote today to install the immutable audit logs table and triggers. *You only need to run this once.*
```bash
node setup-ird-triggers.js
```
*(Ensure your `.env` file in the backend directory has the correct production `DATABASE_URL` before running this).*

## Step 4: Build the Frontend Applications
Since we added new UI pages (Audit Logs, Sales Returns, VAT Register) and print templates, you need to rebuild the React bundles for both the Admin Portal and the Staff App.

**Build Admin Portal:**
```bash
cd ../frontend/admin-portal
npm install
npm run build
```

**Build Staff App:**
```bash
cd ../staff-app
npm install
npm run build
```

## Step 5: Restart the Backend Server
Finally, restart your Node.js backend to apply the security patches (XSS, SQL Injection prevention), API route changes, and printing authorization logic. Assuming you are using `pm2` to manage your server:
```bash
cd ../../backend
pm2 restart all
```

---

## Verification Checklist after Deployment:
1. **Audit Logs:** Log into the live Admin Portal and go to `/audit-logs`. Verify the page loads without errors.
2. **Test Printing:** Go to the Income Ledger, click "Print" on an existing invoice, and ensure the popup window displays the new Tax Invoice layout. Cancel the print, refresh the page, and ensure the count did *not* go up (verifying our security fix).
3. **Database Security:** Try to manually delete a record from the `income_ledger` table using a database client like pgAdmin or DBeaver. The database engine should block you with an error stating `IRD Compliance: DELETES are strictly prohibited`.
