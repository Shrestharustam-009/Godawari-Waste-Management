# Data Security, Immutability & Backup Procedure
**Document prepared for IRD Registration Compliance (Point 19)**

## 1. Procedure for Ensuring Data Cannot be Updated or Deleted (Immutability)
To strictly comply with the IRD Computerized Billing System standards, the software utilizes database-level protections that operate independently of the application code.

* **Database Engine:** PostgreSQL
* **Security Implementation:** We have implemented raw SQL Triggers directly on the `income_ledger` (Billing) table.
* **Functionality:** 
  1. The `prevent_income_ledger_update` trigger listens for any `UPDATE` command and immediately throws a fatal exception, rejecting the transaction.
  2. The `prevent_income_ledger_delete` trigger listens for any `DELETE` command and rejects it instantly.
* **Conclusion:** Even if a system administrator or software developer attempts to alter a bill using direct database access, the PostgreSQL engine will block the action. Errors must be corrected legally by issuing a Credit Note (Sales Return).

---

## 2. Backup & Restore Arrangement (ब्याकअप र रिस्टोरको व्यवस्था)

To ensure the safety, longevity, and recovery of financial data, the following backup mechanisms are actively deployed on the host server.

### A. Automated Daily Backups (Cron Job)
The server runs an automated daily cron job that executes the PostgreSQL `pg_dump` utility. 
* **Frequency:** Every night at 12:00 AM (Midnight).
* **Format:** Compressed custom format (`.dump`), which preserves the exact schema, triggers, and relational data.
* **Storage:** Backups are stored locally on the server in a designated `/backups` directory, and are automatically synced to a secondary secure cloud storage bucket (e.g., AWS S3) for disaster recovery.

### B. Backup Execution Command (Technical Reference)
```bash
# Automated dump command executed by the system
pg_dump -U db_user -F c -f /backups/godawari_billing_$(date +%Y%m%d).dump godawari_db
```

### C. Data Restore Procedure
In the event of hardware failure or server migration, the system administrator can restore the entire database (including the immutable triggers and audit logs) to its exact state using the `pg_restore` utility.

```bash
# Command to restore the database from a backup file
pg_restore -U db_user -d godawari_db -1 /backups/godawari_billing_YYYYMMDD.dump
```
*Note: Restoration operations are strictly logged and restricted to authorized IT personnel only.*
