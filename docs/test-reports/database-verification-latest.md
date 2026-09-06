# Database Verification Report

Generated at: 2026-09-06T14:18:16.278Z
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
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T14:17:55.389Z | 2026-09-06T14:17:56.732Z |
| Backend database-critical suite | PASS | 0 | 2026-09-06T14:17:56.732Z | 2026-09-06T14:18:14.106Z |
| License server database flow | PASS | 0 | 2026-09-06T14:18:14.106Z | 2026-09-06T14:18:16.278Z |

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
✔ license flow accepts a valid license activation (2.6696ms)
✔ license flow rejects expired and cancelled licenses (13.1227ms)
✔ license flow blocks extra devices but allows an already activated device (0.3471ms)
✔ API route contracts consistently use data wrappers for success responses (3.4492ms)
✔ license routes expose persistent setup endpoints (0.5002ms)
✔ student certificates routes expose persistent storage endpoints (0.7209ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (1.0209ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (1.8946ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (1.2551ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (0.8895ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (0.6631ms)
✔ behavior records can be cleared for a student day (0.809ms)
✔ lesson routes reuse the shared teacher scope resolver (0.6496ms)
✔ API route contracts expose stable error codes for failure responses (2.2665ms)
✔ API response contract report documents the supported envelope and intentional exceptions (0.4565ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (1.8777ms)
✔ school operations route exposes operations dashboard data (0.7426ms)
✔ uploads route enforces scanner validation before accepting files (0.3009ms)
✔ settings router stays mounted only on explicit settings prefixes (0.4808ms)
[0mGET /api/version [32m200[0m 2.366 ms - 147[0m
[0mPOST /api/auth/login [32m200[0m 77.407 ms - 476[0m
[0mPOST /api/classes [32m201[0m 38.212 ms - 311[0m
[0mGET /api/classes [32m200[0m 30.500 ms - 155[0m
[0mGET /api/teachers [33m401[0m 0.955 ms - 84[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (1205.9215ms)
[0mPOST /api/auth/login [32m200[0m 58.044 ms - 474[0m
[0mPOST /api/auth/login [32m200[0m 57.361 ms - 474[0m
[0mPOST /api/settings/permission-review [32m201[0m 21.571 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 11.516 ms - 107[0m
✔ settings permission review enforces manageSettings at runtime (323.7367ms)
[0mPOST /api/auth/login [32m200[0m 39.709 ms - 501[0m
[0mPOST /api/auth/login [32m200[0m 44.349 ms - 524[0m
[0mPOST /api/teachers [32m201[0m 19.543 ms - 566[0m
[0mGET /api/teachers [32m200[0m 10.204 ms - 585[0m
[0mGET /api/teachers [33m403[0m 7.536 ms - 107[0m
[0mPOST /api/settings/users [32m201[0m 51.019 ms - 293[0m
[0mPOST /api/settings/users [33m403[0m 6.557 ms - 107[0m
[0mPOST /api/students/import [32m201[0m 19.700 ms - 944[0m
[0mPOST /api/students/import [33m403[0m 6.720 ms - 107[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (383.499ms)
[0mPOST /api/auth/login [32m200[0m 38.372 ms - 562[0m
[0mPOST /api/auth/login [32m200[0m 37.061 ms - 588[0m
[0mPOST /api/students/attendance [32m200[0m 20.353 ms - 349[0m
[0mPOST /api/students/attendance [32m200[0m 13.332 ms - 342[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpwcesm-15680-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 17.323 ms - 656[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 5.310 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 9.117 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpwcesm-15680-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 5.832 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (282.6805ms)
[0mPOST /api/auth/login [32m200[0m 37.455 ms - 483[0m
[0mPOST /api/auth/login [32m200[0m 38.879 ms - 483[0m
[0mPOST /api/reports/export [32m200[0m 12.299 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 6.659 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 4.491 ms - 91[0m
✔ report exports persist export records and enforce report permissions (234.7429ms)
[0mPOST /api/auth/login [32m200[0m 37.447 ms - 583[0m
[0mPOST /api/auth/login [32m200[0m 40.460 ms - 576[0m
[0mGET /api/auth/me [32m200[0m 2.168 ms - 374[0m
[0mGET /api/students/portal-student-mtpwcf70-15680-portal/context [32m200[0m 15.995 ms - 1177[0m
[0mGET /api/students/portal-student-b-mtpwcf70-15680-portal/context [33m403[0m 8.035 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtpwcf70-15680-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 8.339 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 3.026 ms - 369[0m
✔ student and parent accounts can be created and log in against a linked student (250.4896ms)
[0mPOST /api/auth/login [32m200[0m 36.767 ms - 513[0m
[0mPOST /api/auth/login [32m200[0m 36.825 ms - 513[0m
[0mPATCH /api/students/writes-student-mtpwcfdy-15680-writes [32m200[0m 19.269 ms - 854[0m
[0mPATCH /api/students/writes-student-mtpwcfdy-15680-writes [33m403[0m 6.534 ms - 107[0m
[0mPOST /api/schools/writes-runtime-other-mtpwcfdy-15680-writes/export-data [33m403[0m 4.479 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (215.2272ms)
✔ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (12475.5858ms)
✔ database contracts keep the core integrity guardrails in place (9.4115ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (171.4558ms)
✔ attendance stays unique for a student on the same day (47.7354ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (79.6815ms)
✔ teacher, subject, and class relations stay aligned and remain unique (65.5012ms)
✔ grade records disappear when the owning student or subject is deleted (82.4343ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (58.7912ms)
✔ Arabic text survives a database round trip unchanged (46.9036ms)
[0mPOST /api/auth/login [32m200[0m 64.912 ms - 494[0m
[0mPOST /api/auth/login [32m200[0m 57.131 ms - 466[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 7.760 ms - 218[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 2.789 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 11.526 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 3.184 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.326 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (1676.5192ms)
✔ legacy baseline data survives migrations and reads with the current enum values (16896.8708ms)
[0mPOST /api/schools/privacy-a-school-mtpwce0d-18568-5k1ny3/export-data [33m403[0m 50.510 ms - 107[0m
[0mPOST /api/schools/privacy-b-school-mtpwce0d-18568-5k1ny3/export-data [33m403[0m 14.107 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtpwce0d-18568-5k1ny3/export-data [32m200[0m 67.764 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 16.529 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtpwce0d-18568-5k1ny3/delete-data [32m200[0m 60.174 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtpwce0d-18568-5k1ny3/delete-data [32m200[0m 114.068 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (804.0023ms)
[0mPOST /api/auth/login [32m200[0m 75.442 ms - 491[0m
[0mGET /api/teachers [32m200[0m 72.372 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpwcdck-25432-ru2qm6 [33m404[0m 12.248 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpwcdck-25432-ru2qm6/assignments/tenant-b-assignment-mtpwcdck-25432-ru2qm6/weekly-periods [33m404[0m 12.338 ms - 21[0m
[0mGET /api/subjects [32m200[0m 15.541 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtpwcdck-25432-ru2qm6 [33m404[0m 9.608 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtpwcdck-25432-ru2qm6 [32m200[0m 15.441 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtpwcdck-25432-ru2qm6/context [33m404[0m 12.128 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtpwcdck-25432-ru2qm6&date=2026-08-12 [33m404[0m 9.477 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 11.194 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtpwcdck-25432-ru2qm6 [33m404[0m 7.805 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 12.916 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 25.393 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 13.042 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 89.411 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 75.568 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtpwcdck-25432-ru2qm6 [33m404[0m 8.067 ms - 120[0m
[0mGET /api/archive [32m200[0m 16.898 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 9.035 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtpwcdck-25432-ru2qm6&from=2026-08-12&to=2026-08-12 [33m404[0m 6.488 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtpwcdck-25432-ru2qm6&subjectId=tenant-b-subject-mtpwcdck-25432-ru2qm6 [33m404[0m 7.484 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 9.746 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 8.669 ms - 1241[0m
[0mGET /api/audit-logs/tenant-b-audit-mtpwcdck-25432-ru2qm6 [33m404[0m 6.691 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtpwcdck-25432-ru2qm6/dashboard [33m403[0m 5.325 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtpwcdck-25432-ru2qm6/export-data [33m403[0m 6.679 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtpwcdck-25432-ru2qm6/delete-data [33m403[0m 4.446 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 10.781 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (2047.3843ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 23.469 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 70.495 ms - 576[0m
[0mPOST /api/uploads [32m201[0m 33.088 ms - 303[0m
[0mPOST /api/students/import [32m201[0m 43.249 ms - 1070[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (1338.5648ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 17285.1176
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

✔ Redis-backed rate limits are shared across store instances (2.5364ms)
✔ Redis-backed nonce replay protection is shared across store instances (0.6987ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (334.2413ms)
✔ client nonce replay protection rejects repeated activation requests (120.3046ms)
✔ license lookup paths use indexed database access instead of full-table credential scans (0.412ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 615.1245
```
