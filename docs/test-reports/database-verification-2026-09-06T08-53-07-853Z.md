# Database Verification Report

Generated at: 2026-09-06T08:53:07.853Z
Overall status: PASS

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
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T08:52:39.363Z | 2026-09-06T08:52:41.737Z |
| Backend database-critical suite | PASS | 0 | 2026-09-06T08:52:41.737Z | 2026-09-06T08:53:04.775Z |
| License server database flow | PASS | 0 | 2026-09-06T08:53:04.775Z | 2026-09-06T08:53:07.852Z |

## Raw Output

### Prepare PostgreSQL, Redis, and migrations

```text
> som-pro-hybrid-perfect-builder@0.9.0-rc.1 test:db:prepare
> node scripts/runtime/prepare-test-database.js

[SOM PRO] Local data services are reachable.

> @som/backend@0.9.0-rc.1 prisma:migrate:deploy
> node ../../scripts/runtime/prisma-cli.js migrate deploy

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "som", schema "public" at "127.0.0.1:5432"

24 migrations found in prisma/migrations


No pending migrations to apply.
[SOM PRO] Local test database is ready.
```

### Backend database-critical suite

```text
✔ license flow accepts a valid license activation (7.7986ms)
✔ license flow rejects expired and cancelled licenses (21.1841ms)
✔ license flow blocks extra devices but allows an already activated device (0.5054ms)
✔ API route contracts consistently use data wrappers for success responses (7.8264ms)
✔ license routes expose persistent setup endpoints (0.9385ms)
✔ student certificates routes expose persistent storage endpoints (1.3882ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (1.7945ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (3.6005ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (1.7819ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (1.7163ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (1.1402ms)
✔ behavior records can be cleared for a student day (1.5072ms)
✔ lesson routes reuse the shared teacher scope resolver (1.5142ms)
✔ API route contracts expose stable error codes for failure responses (4.3099ms)
✔ API response contract report documents the supported envelope and intentional exceptions (0.9402ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (0.9487ms)
✔ school operations route exposes operations dashboard data (1.3911ms)
✔ uploads route enforces scanner validation before accepting files (0.5627ms)
✔ settings router stays mounted only on explicit settings prefixes (0.9858ms)
[0mGET /api/version [32m200[0m 4.041 ms - 162[0m
[0mPOST /api/auth/login [32m200[0m 122.347 ms - 476[0m
[0mPOST /api/classes [32m201[0m 63.299 ms - 311[0m
[0mGET /api/classes [32m200[0m 80.870 ms - 155[0m
[0mGET /api/teachers [33m401[0m 1.176 ms - 72[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (2371.5993ms)
[0mPOST /api/auth/login [32m200[0m 85.869 ms - 474[0m
[0mPOST /api/auth/login [32m200[0m 84.394 ms - 474[0m
[0mPOST /api/settings/permission-review [32m201[0m 25.884 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 16.948 ms - 95[0m
✔ settings permission review enforces manageSettings at runtime (404.3793ms)
[0mPOST /api/auth/login [32m200[0m 59.664 ms - 501[0m
[0mPOST /api/auth/login [32m200[0m 58.352 ms - 524[0m
[0mPOST /api/teachers [32m201[0m 26.024 ms - 566[0m
[0mGET /api/teachers [32m200[0m 20.189 ms - 585[0m
[0mGET /api/teachers [33m403[0m 13.375 ms - 95[0m
[0mPOST /api/settings/users [32m201[0m 84.139 ms - 293[0m
[0mPOST /api/settings/users [33m403[0m 12.710 ms - 95[0m
[0mPOST /api/students/import [32m201[0m 37.932 ms - 944[0m
[0mPOST /api/students/import [33m403[0m 11.275 ms - 95[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (573.6653ms)
[0mPOST /api/auth/login [32m200[0m 60.743 ms - 562[0m
[0mPOST /api/auth/login [32m200[0m 56.201 ms - 588[0m
[0mPOST /api/students/attendance [32m200[0m 35.291 ms - 349[0m
[0mPOST /api/students/attendance [32m200[0m 17.438 ms - 342[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpkq6jx-14400-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 23.609 ms - 656[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 9.633 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 15.736 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpkq6jx-14400-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 11.985 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (448.0488ms)
[0mPOST /api/auth/login [32m200[0m 55.927 ms - 483[0m
[0mPOST /api/auth/login [32m200[0m 54.781 ms - 483[0m
[0mPOST /api/reports/export [32m200[0m 21.398 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 11.630 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 7.667 ms - 91[0m
✔ report exports persist export records and enforce report permissions (309.5356ms)
[0mPOST /api/auth/login [32m200[0m 60.088 ms - 583[0m
[0mPOST /api/auth/login [32m200[0m 63.996 ms - 576[0m
[0mGET /api/auth/me [32m200[0m 3.752 ms - 374[0m
[0mGET /api/students/portal-student-mtpkq74z-14400-portal/context [32m200[0m 33.540 ms - 1177[0m
[0mGET /api/students/portal-student-b-mtpkq74z-14400-portal/context [33m403[0m 15.098 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtpkq74z-14400-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 16.079 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 6.050 ms - 369[0m
✔ student and parent accounts can be created and log in against a linked student (410.9136ms)
[0mPOST /api/auth/login [32m200[0m 57.357 ms - 513[0m
[0mPOST /api/auth/login [32m200[0m 57.219 ms - 513[0m
[0mPATCH /api/students/writes-student-mtpkq7ge-14400-writes [32m200[0m 35.313 ms - 854[0m
[0mPATCH /api/students/writes-student-mtpkq7ge-14400-writes [33m403[0m 14.139 ms - 95[0m
[0mPOST /api/schools/writes-runtime-other-mtpkq7ge-14400-writes/export-data [33m403[0m 9.210 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (365.5471ms)
✔ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (15228.5417ms)
✔ database contracts keep the core integrity guardrails in place (17.2593ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (313.4981ms)
✔ attendance stays unique for a student on the same day (103.447ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (105.5307ms)
✔ teacher, subject, and class relations stay aligned and remain unique (102.9487ms)
✔ grade records disappear when the owning student or subject is deleted (135.968ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (94.6713ms)
✔ Arabic text survives a database round trip unchanged (82.8029ms)
[0mPOST /api/auth/login [32m200[0m 105.270 ms - 494[0m
[0mPOST /api/auth/login [32m200[0m 92.295 ms - 466[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 12.801 ms - 218[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 5.304 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 19.769 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 4.591 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.593 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (3250.8981ms)
✔ legacy baseline data survives migrations and reads with the current enum values (22186.5177ms)
[0mPOST /api/schools/privacy-a-school-mtpkq55r-23628-48m1bi/export-data [33m403[0m 81.476 ms - 95[0m
[0mPOST /api/schools/privacy-b-school-mtpkq55r-23628-48m1bi/export-data [33m403[0m 25.417 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtpkq55r-23628-48m1bi/export-data [32m200[0m 120.083 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 30.988 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtpkq55r-23628-48m1bi/delete-data [32m200[0m 87.594 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtpkq55r-23628-48m1bi/delete-data [32m200[0m 164.430 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (1284.5926ms)
[0mPOST /api/auth/login [32m200[0m 122.912 ms - 491[0m
[0mGET /api/teachers [32m200[0m 117.515 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpkq3ps-24972-vjsamc [33m404[0m 20.956 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpkq3ps-24972-vjsamc/assignments/tenant-b-assignment-mtpkq3ps-24972-vjsamc/weekly-periods [33m404[0m 24.446 ms - 21[0m
[0mGET /api/subjects [32m200[0m 16.703 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtpkq3ps-24972-vjsamc [33m404[0m 17.296 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtpkq3ps-24972-vjsamc [32m200[0m 17.065 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtpkq3ps-24972-vjsamc/context [33m404[0m 20.185 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtpkq3ps-24972-vjsamc&date=2026-08-12 [33m404[0m 14.761 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 17.982 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtpkq3ps-24972-vjsamc [33m404[0m 12.592 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 24.182 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 48.268 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 20.985 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 126.053 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 125.972 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtpkq3ps-24972-vjsamc [33m404[0m 11.547 ms - 120[0m
[0mGET /api/archive [32m200[0m 25.987 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 16.890 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtpkq3ps-24972-vjsamc&from=2026-08-12&to=2026-08-12 [33m404[0m 19.047 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtpkq3ps-24972-vjsamc&subjectId=tenant-b-subject-mtpkq3ps-24972-vjsamc [33m404[0m 17.628 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 19.493 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 18.754 ms - 1241[0m
[0mGET /api/audit-logs/tenant-b-audit-mtpkq3ps-24972-vjsamc [33m404[0m 13.012 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtpkq3ps-24972-vjsamc/dashboard [33m403[0m 12.552 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtpkq3ps-24972-vjsamc/export-data [33m403[0m 10.387 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtpkq3ps-24972-vjsamc/delete-data [33m403[0m 8.603 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 15.622 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (3794.5237ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 45.612 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 123.597 ms - 576[0m
[0mPOST /api/uploads [32m201[0m 59.973 ms - 303[0m
[0mPOST /api/students/import [32m201[0m 82.727 ms - 1070[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (2725.401ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 22889.5995
```

### License server database flow

```text
> @som/license-server@0.9.0-rc.1 pretest
> node ../../scripts/runtime/prepare-test-database.js

[SOM PRO] Local data services are reachable.

> @som/backend@0.9.0-rc.1 prisma:migrate:deploy
> node ../../scripts/runtime/prisma-cli.js migrate deploy

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "som", schema "public" at "127.0.0.1:5432"

24 migrations found in prisma/migrations


No pending migrations to apply.
[SOM PRO] Local test database is ready.

> @som/license-server@0.9.0-rc.1 test
> node --test src/server.security.test.js src/requestProtectionStore.test.js

✔ Redis-backed rate limits are shared across store instances (3.849ms)
✔ Redis-backed nonce replay protection is shared across store instances (1.0743ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (453.6726ms)
✔ client nonce replay protection rejects repeated activation requests (156.3231ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 843.077
```
