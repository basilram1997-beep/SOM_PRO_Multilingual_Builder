# DB Tenant Integrity Evidence

Review date: 2026-08-12

Purpose: document database-level guardrails that support API tenant isolation, audit immutability, and privacy lifecycle evidence.

## Implemented Guardrails

| Control                                                          | Evidence                                                                                                                                                                                                                   | Verification                                                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Audit append-only trigger                                        | `apps/backend/prisma/migrations/20260812143000_audit_append_only_and_lifecycle_evidence_guards/migration.sql` creates `prevent_audit_log_mutation()` plus `AuditLog_prevent_update` and `AuditLog_prevent_delete` triggers | `apps/backend/src/services/dbTenantIntegrity.security.test.ts`                                                                         |
| Export/backup evidence cannot cascade away on hard school delete | `reports_exports_school_id_fkey` and `backup_jobs_school_id_fkey` are recreated with `ON DELETE RESTRICT`; Prisma schema uses `onDelete: Restrict` for `ReportExport` and `BackupJob`                                      | `apps/backend/src/services/dbTenantIntegrity.security.test.ts`                                                                         |
| School delete is lifecycle purge, not hard delete                | `apps/backend/src/modules/schools/schools.routes.ts` keeps a `DELETED` school tombstone and does not delete audit, report export, or backup job rows during lifecycle purge                                                | `apps/backend/src/services/privacyLifecycleAndExport.security.test.ts`, `apps/backend/src/services/dbTenantIntegrity.security.test.ts` |
| Archive deletion no longer deletes audit evidence                | `apps/backend/src/modules/archive/archive.routes.ts` deletes the daily schedule row but keeps `ARCHIVE_DAY` audit snapshots and records `ARCHIVE_DELETE`                                                                   | `apps/backend/src/services/dbTenantIntegrity.security.test.ts`                                                                         |
| School-private models carry tenant ownership                     | Models with school-private data contain `schoolId`, a `School` relation, and a `schoolId`-leading index/unique constraint                                                                                                  | `apps/backend/src/services/dbTenantIntegrity.security.test.ts`                                                                         |

## Explicit Global/Exception Models

| Model            | Reason                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `School`         | Tenant root entity.                                                                                                             |
| `Permission`     | Global permission dictionary.                                                                                                   |
| `RolePermission` | Bridge table scoped through `Role`, which is school-scoped.                                                                     |
| `AuditLog`       | May contain global/system events, so `schoolId` is nullable; it still has schoolId indexes and append-only DB trigger evidence. |

## Operational Notes

- The migration must be applied to staging and production with `prisma migrate deploy`; repository tests verify the migration and schema contract, but a live DB trigger check should be archived after staging deployment.
- Database owners/superusers can still bypass any in-database control. Production evidence should include least-privilege application DB roles and restricted migration access.
- External WORM/SIEM storage remains a separate control for infrastructure-grade audit immutability.

## Remaining Gaps

- Live staging proof that attempted `UPDATE`/`DELETE` on `AuditLog` fails after migration.
- DB role separation: application runtime user should not own schemas or run migrations.
- Signed periodic audit export or WORM/SIEM sink.
