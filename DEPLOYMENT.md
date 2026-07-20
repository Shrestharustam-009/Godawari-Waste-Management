# Godawari Waste Management - Deployment Guide

This document outlines the standard deployment process for updating the Godawari Waste Management system on a production server. 

Always follow this order to ensure database changes are applied before the new code attempts to access them.

---

## 1. Pull Latest Code
SSH into your production server and navigate to your project root directory.
```bash
cd /path/to/Godawari-Waste-Management
git pull origin main
```
*(If you upload files manually via FTP/cPanel, replace the updated `backend` and `frontend` folders now).*

---

## 2. Database & Backend Deployment
You **must** update the database schema before restarting the backend server. If you skip this, the backend will crash when trying to read or write newly added fields (like `vatNumber` or `increasedFee`).

```bash
# Navigate to the backend directory
cd backend

# Install any new dependencies (optional but recommended)
npm install

# Update the database schema
npx prisma db push

# Restart the backend service (assuming you are using PM2)
pm2 restart all
```
> **Note:** If you are using Prisma Migrations in production rather than prototyping, use `npx prisma migrate deploy` instead of `db push`.

---

## 3. Frontend Deployment
You need to build the production files for all three frontends so that the UI reflects the latest changes.

### Admin Portal
```bash
cd ../frontend/admin-portal
npm install
npm run build
```

### Staff App (Collector Portal)
```bash
cd ../staff-app
npm install
npm run build
```

### Customer App
```bash
cd ../customer-app
npm install
npm run build
```

---

## 4. Serving the Frontend Files
After running `npm run build` on the frontends, a `dist` folder will be created inside each respective directory (e.g., `frontend/admin-portal/dist`).

If you are using a web server like **Nginx** or **Apache**, you must copy or sync the contents of these `dist` folders to your public web directories. 

**Example (Nginx):**
```bash
sudo cp -r frontend/admin-portal/dist/* /var/www/admin.yourdomain.com/
sudo cp -r frontend/staff-app/dist/* /var/www/staff.yourdomain.com/
sudo cp -r frontend/customer-app/dist/* /var/www/customer.yourdomain.com/
```

## Troubleshooting
- **White screen on frontend after deployment:** Hard refresh your browser (Ctrl + F5 or Cmd + Shift + R) to clear the old cached Javascript.
- **Backend throwing Prisma errors:** Ensure you ran `npx prisma db push`. If it still fails, try running `npx prisma generate` in the backend folder and restart PM2.
