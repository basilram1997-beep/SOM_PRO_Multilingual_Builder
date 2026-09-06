# Database Verification Report

Generated at: 2026-09-06T14:32:01.423Z
Overall status: PASS_WITH_SKIPS

## Scope

- PostgreSQL and Redis local services readiness.
- Prisma migration deployment against the local test database.
- API integration and contracts.
- Tenant isolation runtime.
- MFA and SSO security flow.
- Privacy lifecycle export/delete flow.
- Upload import integration.
- Backup/restore Docker integration.
- Migration upgrade Docker integration.
- License server database-backed security flow.

## Environment

- DATABASE_URL: default local test URL
- REDIS_URL: default local test URL
- Docker: required for backup/restore and migration upgrade checks.

## Results

| Check | Status | Exit Code | Started | Finished |
| --- | --- | ---: | --- | --- |
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T14:31:52.203Z | 2026-09-06T14:31:54.287Z |
| Backend database-critical suite | PASS_WITH_SKIPS | 0 | 2026-09-06T14:31:54.287Z | 2026-09-06T14:31:58.373Z |
| License server database flow | PASS | 0 | 2026-09-06T14:31:58.373Z | 2026-09-06T14:32:01.423Z |

## Raw Output

### Prepare PostgreSQL, Redis, and migrations

```text
> som-pro-hybrid-perfect-builder@0.9.0 test:db:prepare
> node scripts/runtime/prepare-test-database.js

[SOM PRO] Local data services are reachable.

> @som/backend@0.9.0 prisma:migrate:deploy
> node ../../scripts/runtime/prisma-cli.js migrate deploy

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "som", schema "public" at "127.0.0.1:5432"

25 migrations found in prisma/migrations


No pending migrations to apply.
[SOM PRO] Local test database is ready.
```

### Backend database-critical suite

```text
✔ license flow accepts a valid license activation (3.7636ms)
✔ license flow rejects expired and cancelled licenses (14.0554ms)
✔ license flow blocks extra devices but allows an already activated device (0.3723ms)
✔ API route contracts consistently use data wrappers for success responses (3.9379ms)
✔ license routes expose persistent setup endpoints (0.6263ms)
✔ student certificates routes expose persistent storage endpoints (0.7328ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (1.1954ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (2.3026ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (1.5181ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (1.0946ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (0.7192ms)
✔ behavior records can be cleared for a student day (0.8746ms)
✔ lesson routes reuse the shared teacher scope resolver (0.719ms)
✔ API route contracts expose stable error codes for failure responses (5.2588ms)
✔ API response contract report documents the supported envelope and intentional exceptions (0.5ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (0.41ms)
✔ school operations route exposes operations dashboard data (0.6176ms)
✔ uploads route enforces scanner validation before accepting files (0.2815ms)
✔ settings router stays mounted only on explicit settings prefixes (0.5715ms)
[0mGET /api/version [32m200[0m 2.459 ms - 147[0m
[0mPOST /api/auth/login [32m200[0m 85.808 ms - 476[0m
[0mPOST /api/classes [32m201[0m 49.435 ms - 311[0m
[0mGET /api/classes [32m200[0m 48.569 ms - 155[0m
[0mGET /api/teachers [33m401[0m 0.850 ms - 84[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (1277.2486ms)
[0mPOST /api/auth/login [32m200[0m 61.118 ms - 474[0m
[0mPOST /api/auth/login [32m200[0m 60.380 ms - 474[0m
[0mPOST /api/settings/permission-review [32m201[0m 18.645 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 10.178 ms - 107[0m
✔ settings permission review enforces manageSettings at runtime (330.2367ms)
[0mPOST /api/auth/login [32m200[0m 45.843 ms - 501[0m
[0mPOST /api/auth/login [32m200[0m 44.334 ms - 524[0m
[0mPOST /api/teachers [32m201[0m 22.599 ms - 566[0m
[0mGET /api/teachers [32m200[0m 10.791 ms - 585[0m
[0mGET /api/teachers [33m403[0m 9.060 ms - 107[0m
[0mPOST /api/settings/users [32m201[0m 50.625 ms - 293[0m
[0mPOST /api/settings/users [33m403[0m 6.587 ms - 107[0m
[0mPOST /api/students/import [32m201[0m 21.747 ms - 944[0m
[0mPOST /api/students/import [33m403[0m 7.633 ms - 107[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (411.0699ms)
[0mPOST /api/auth/login [32m200[0m 39.779 ms - 562[0m
[0mPOST /api/auth/login [32m200[0m 42.533 ms - 588[0m
[0mPOST /api/students/attendance [32m200[0m 22.776 ms - 349[0m
[0mPOST /api/students/attendance [32m200[0m 11.967 ms - 342[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpwud87-27284-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 14.932 ms - 656[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 5.825 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 9.683 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpwud87-27284-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 6.825 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (295.1038ms)
[0mPOST /api/auth/login [32m200[0m 51.481 ms - 483[0m
[0mPOST /api/auth/login [32m200[0m 43.703 ms - 483[0m
[0mPOST /api/reports/export [32m200[0m 22.750 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 15.543 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 9.522 ms - 91[0m
✔ report exports persist export records and enforce report permissions (310.1176ms)
[0mPOST /api/auth/login [32m200[0m 41.604 ms - 583[0m
[0mPOST /api/auth/login [32m200[0m 44.553 ms - 576[0m
[0mGET /api/auth/me [32m200[0m 3.543 ms - 374[0m
[0mGET /api/students/portal-student-mtpwudp0-27284-portal/context [32m200[0m 20.586 ms - 1177[0m
[0mGET /api/students/portal-student-b-mtpwudp0-27284-portal/context [33m403[0m 9.614 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtpwudp0-27284-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 13.015 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 4.332 ms - 369[0m
✔ student and parent accounts can be created and log in against a linked student (295.2442ms)
[0mPOST /api/auth/login [32m200[0m 40.695 ms - 513[0m
[0mPOST /api/auth/login [32m200[0m 42.776 ms - 513[0m
[0mPATCH /api/students/writes-student-mtpwudx8-27284-writes [32m200[0m 27.498 ms - 854[0m
[0mPATCH /api/students/writes-student-mtpwudx8-27284-writes [33m403[0m 10.215 ms - 107[0m
[0mPOST /api/schools/writes-runtime-other-mtpwudx8-27284-writes/export-data [33m403[0m 6.852 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (255.4473ms)
﹣ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (0.9362ms) # SKIP
✔ database contracts keep the core integrity guardrails in place (8.7656ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (182.3093ms)
✔ attendance stays unique for a student on the same day (55.426ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (69.3077ms)
✔ teacher, subject, and class relations stay aligned and remain unique (61.9269ms)
✔ grade records disappear when the owning student or subject is deleted (104.0915ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (63.3291ms)
✔ Arabic text survives a database round trip unchanged (69.1228ms)
[0mPOST /api/auth/login [32m200[0m 80.261 ms - 489[0m
[0mPOST /api/auth/login [32m200[0m 67.664 ms - 460[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 10.024 ms - 216[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 3.454 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 13.029 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 5.426 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.528 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (1804.0691ms)
﹣ legacy baseline data survives migrations and reads with the current enum values (0.8886ms) # SKIP
[0mPOST /api/schools/privacy-a-school-mtpwucdn-10776-dc17cp/export-data [33m403[0m 53.061 ms - 107[0m
[0mPOST /api/schools/privacy-b-school-mtpwucdn-10776-dc17cp/export-data [33m403[0m 16.198 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtpwucdn-10776-dc17cp/export-data [32m200[0m 67.745 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 16.988 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtpwucdn-10776-dc17cp/delete-data [32m200[0m 52.216 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtpwucdn-10776-dc17cp/delete-data [32m200[0m 95.816 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (827.5915ms)
[0mPOST /api/auth/login [32m200[0m 81.566 ms - 491[0m
[0mGET /api/teachers [32m200[0m 69.039 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpwubpd-14212-9ql3sz [33m404[0m 18.387 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpwubpd-14212-9ql3sz/assignments/tenant-b-assignment-mtpwubpd-14212-9ql3sz/weekly-periods [33m404[0m 14.815 ms - 21[0m
[0mGET /api/subjects [32m200[0m 13.976 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtpwubpd-14212-9ql3sz [33m404[0m 11.294 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtpwubpd-14212-9ql3sz [32m200[0m 14.721 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtpwubpd-14212-9ql3sz/context [33m404[0m 10.599 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtpwubpd-14212-9ql3sz&date=2026-08-12 [33m404[0m 9.844 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 8.844 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtpwubpd-14212-9ql3sz [33m404[0m 9.503 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 15.623 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 30.810 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 17.214 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 93.610 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 87.327 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtpwubpd-14212-9ql3sz [33m404[0m 9.456 ms - 120[0m
[0mGET /api/archive [32m200[0m 15.805 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 12.050 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtpwubpd-14212-9ql3sz&from=2026-08-12&to=2026-08-12 [33m404[0m 11.524 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtpwubpd-14212-9ql3sz&subjectId=tenant-b-subject-mtpwubpd-14212-9ql3sz [33m404[0m 11.400 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 11.088 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 9.841 ms - 1241[0m
[0mGET /api/audit-logs/tenant-b-audit-mtpwubpd-14212-9ql3sz [33m404[0m 7.240 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtpwubpd-14212-9ql3sz/dashboard [33m403[0m 6.282 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtpwubpd-14212-9ql3sz/export-data [33m403[0m 8.171 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtpwubpd-14212-9ql3sz/delete-data [33m403[0m 4.990 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 13.134 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (2170.9872ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 37.703 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 81.978 ms - 576[0m
[0mPOST /api/uploads [32m201[0m 37.402 ms - 303[0m
[0mPOST /api/students/import [32m201[0m 43.206 ms - 1070[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (1383.8434ms)
ℹ tests 40
ℹ suites 0
ℹ pass 38
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 0
ℹ duration_ms 3954.2427
```

### License server database flow

```text
> @som/license-server@0.9.0 pretest
> node ../../scripts/runtime/prepare-test-database.js

[SOM PRO] Local data services are reachable.

> @som/backend@0.9.0 prisma:migrate:deploy
> node ../../scripts/runtime/prisma-cli.js migrate deploy

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "som", schema "public" at "127.0.0.1:5432"

25 migrations found in prisma/migrations


No pending migrations to apply.
[SOM PRO] Local test database is ready.

> @som/license-server@0.9.0 test
> node --test src/server.security.test.js src/requestProtectionStore.test.js

✔ Redis-backed rate limits are shared across store instances (2.3251ms)
✔ Redis-backed nonce replay protection is shared across store instances (1.7781ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (421.2919ms)
✔ client nonce replay protection rejects repeated activation requests (137.0425ms)
✔ license lookup paths use indexed database access instead of full-table credential scans (0.5136ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 759.574
```
