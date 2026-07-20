# Deployment Guide: Godawari Waste Management (Update: Add Customer & Edit Customer Debt Date Sync)

Follow these exact steps to pull the latest changes onto your VPS and deploy them safely.

## Step 1: Pull Latest Changes from Git
SSH into your VPS and navigate to the root directory of your project, then pull the latest code.
```bash
cd /path/to/your/Godawari-Waste-Management
git pull origin main
```
*(Replace `main` with your production branch name if it is different).*

## Step 2: Restart the Node.js Backend Server
Since we made changes to `customer.controller.js` and `customer.validator.js`, the backend server needs to be restarted to pick up the new logic. 
```bash
pm2 restart all
```
*(If your PM2 process has a specific name like "gdw-backend", run `pm2 restart gdw-backend` instead).*

## Step 3: Rebuild the Admin Portal Frontend
Since we modified `Customers.jsx` and `DatePicker.jsx` inside the React application, you need to compile a fresh production build.
```bash
cd frontend/admin-portal
npm run build
```

## Step 4: Verify Deployment
1. Go to your live admin portal.
2. Hard refresh your browser (`Ctrl + F5` or `Cmd + Shift + R`) to clear cache.
3. Open a customer profile and click **Edit Customer**.
4. Change the "Starting Debt" to an amount greater than 0, and verify the Date fields appear!
5. Change it back to 0, and verify the fields disappear.

---
**Note:** No database migrations (`npx prisma migrate` or `db push`) are needed because the database structure (`schema.prisma`) remained unchanged.
