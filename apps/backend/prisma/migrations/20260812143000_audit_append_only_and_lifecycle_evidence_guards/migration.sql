-- DB-level audit and lifecycle evidence hardening.
-- Audit logs are append-only. School export/backup evidence must not be
-- cascaded away by an accidental hard delete of the owning school.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; update/delete is not allowed'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditLog_prevent_update" ON "AuditLog";
DROP TRIGGER IF EXISTS "AuditLog_prevent_delete" ON "AuditLog";

CREATE TRIGGER "AuditLog_prevent_update"
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "AuditLog_prevent_delete"
BEFORE DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

DO $$
BEGIN
  ALTER TABLE "reports_exports" DROP CONSTRAINT IF EXISTS "reports_exports_school_id_fkey";
  ALTER TABLE "reports_exports"
    ADD CONSTRAINT "reports_exports_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "School"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

DO $$
BEGIN
  ALTER TABLE "backup_jobs" DROP CONSTRAINT IF EXISTS "backup_jobs_school_id_fkey";
  ALTER TABLE "backup_jobs"
    ADD CONSTRAINT "backup_jobs_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "School"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;
