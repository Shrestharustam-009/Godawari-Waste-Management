const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Setting up IRD Database Triggers...');

  // 1. Create the generic audit trigger function in PostgreSQL
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION ird_audit_trigger_func()
    RETURNS TRIGGER AS $$
    DECLARE
      v_action VARCHAR(100);
      v_entity_id VARCHAR(60);
      v_details JSON;
      v_app_user_id VARCHAR(50);
      v_db_user VARCHAR(100);
      v_performed_by_id INTEGER;
    BEGIN
      -- Retrieve application user ID if set in transaction, default to empty string if not found
      BEGIN
        v_app_user_id := current_setting('app.current_user_id', true);
      EXCEPTION WHEN OTHERS THEN
        v_app_user_id := '';
      END;
      
      -- Convert to integer if valid, otherwise NULL
      IF (v_app_user_id IS NOT NULL AND v_app_user_id <> '' AND v_app_user_id ~ '^[0-9]+$') THEN
        v_performed_by_id := v_app_user_id::integer;
      ELSE
        v_performed_by_id := NULL;
      END IF;

      -- Capture database level actor
      v_db_user := session_user;

      IF (TG_OP = 'DELETE') THEN
        v_action := 'DB_TRIGGER_DELETE';
        v_entity_id := OLD.id::text;
        v_details := json_build_object('old', row_to_json(OLD), 'db_user', v_db_user);
        
        INSERT INTO audit_logs ("action", "entityType", "entityId", "details", "performedById", "createdAt")
        VALUES (v_action, TG_TABLE_NAME, v_entity_id, v_details, v_performed_by_id, NOW());
        
        RETURN OLD;
        
      ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'DB_TRIGGER_UPDATE';
        v_entity_id := NEW.id::text;
        v_details := json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW), 'db_user', v_db_user);
        
        INSERT INTO audit_logs ("action", "entityType", "entityId", "details", "performedById", "createdAt")
        VALUES (v_action, TG_TABLE_NAME, v_entity_id, v_details, v_performed_by_id, NOW());
        
        RETURN NEW;
        
      ELSIF (TG_OP = 'INSERT') THEN
        v_action := 'DB_TRIGGER_INSERT';
        v_entity_id := NEW.id::text;
        v_details := json_build_object('new', row_to_json(NEW), 'db_user', v_db_user);
        
        INSERT INTO audit_logs ("action", "entityType", "entityId", "details", "performedById", "createdAt")
        VALUES (v_action, TG_TABLE_NAME, v_entity_id, v_details, v_performed_by_id, NOW());
        
        RETURN NEW;
      END IF;
      
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `;

  await prisma.$executeRawUnsafe(createFunctionSQL);
  console.log('✔ Audit trigger function created.');

  // 2. Attach the trigger to income_ledger (which acts as our sales invoice ledger)
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_ird_audit_income_ledger ON income_ledger;');
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_ird_audit_income_ledger
    AFTER INSERT OR UPDATE OR DELETE ON income_ledger
    FOR EACH ROW EXECUTE FUNCTION ird_audit_trigger_func();
  `);
  console.log('✔ Trigger attached to income_ledger.');

  // 3. Attach the trigger to billing_ledger (just in case they audit automated bills)
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_ird_audit_billing_ledger ON billing_ledger;');
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_ird_audit_billing_ledger
    AFTER INSERT OR UPDATE OR DELETE ON billing_ledger
    FOR EACH ROW EXECUTE FUNCTION ird_audit_trigger_func();
  `);
  // 4. Attach blocker trigger to audit_logs to prevent UPDATE and DELETE
  const createBlockerSQL = `
    CREATE OR REPLACE FUNCTION block_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE are strictly prohibited.';
    END;
    $$ LANGUAGE plpgsql;
  `;
  await prisma.$executeRawUnsafe(createBlockerSQL);
  
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_block_audit_log_update_delete ON audit_logs;');
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_block_audit_log_update_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION block_audit_log_modification();
  `);
  console.log('✔ Immutability trigger attached to audit_logs.');

  console.log('IRD Database Triggers configured successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
