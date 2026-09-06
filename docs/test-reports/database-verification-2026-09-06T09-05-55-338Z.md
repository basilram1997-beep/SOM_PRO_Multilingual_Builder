# Database Verification Report

Generated at: 2026-09-06T09:05:55.338Z
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
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T09:05:29.667Z | 2026-09-06T09:05:31.673Z |
| Backend database-critical suite | PASS | 0 | 2026-09-06T09:05:31.673Z | 2026-09-06T09:05:51.592Z |
| License server database flow | PASS | 0 | 2026-09-06T09:05:51.592Z | 2026-09-06T09:05:55.338Z |

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
✔ license flow accepts a valid license activation (5.4177ms)
✔ license flow rejects expired and cancelled licenses (20.2942ms)
✔ license flow blocks extra devices but allows an already activated device (0.5327ms)
✔ API route contracts consistently use data wrappers for success responses (7.7547ms)
✔ license routes expose persistent setup endpoints (0.797ms)
✔ student certificates routes expose persistent storage endpoints (1.1974ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (1.757ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (3.5133ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (2.0805ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (1.5453ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (1.1886ms)
✔ behavior records can be cleared for a student day (1.3488ms)
✔ lesson routes reuse the shared teacher scope resolver (1.1455ms)
✔ API route contracts expose stable error codes for failure responses (3.7467ms)
✔ API response contract report documents the supported envelope and intentional exceptions (0.7733ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (2.2294ms)
✔ school operations route exposes operations dashboard data (1.1164ms)
✔ uploads route enforces scanner validation before accepting files (0.5045ms)
✔ settings router stays mounted only on explicit settings prefixes (0.7671ms)
[0mGET /api/version [32m200[0m 3.756 ms - 162[0m
[0mPOST /api/auth/login [32m200[0m 109.794 ms - 476[0m
[0mPOST /api/classes [32m201[0m 58.485 ms - 311[0m
[0mGET /api/classes [32m200[0m 44.484 ms - 155[0m
[0mGET /api/teachers [33m401[0m 0.809 ms - 72[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (2039.1239ms)
[0mPOST /api/auth/login [32m200[0m 93.092 ms - 474[0m
[0mPOST /api/auth/login [32m200[0m 86.592 ms - 474[0m
[0mPOST /api/settings/permission-review [32m201[0m 31.161 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 13.748 ms - 95[0m
✔ settings permission review enforces manageSettings at runtime (447.1008ms)
[0mPOST /api/auth/login [32m200[0m 64.358 ms - 501[0m
[0mPOST /api/auth/login [32m200[0m 68.215 ms - 524[0m
[0mPOST /api/teachers [32m201[0m 29.299 ms - 566[0m
[0mGET /api/teachers [32m200[0m 22.181 ms - 585[0m
[0mGET /api/teachers [33m403[0m 10.335 ms - 95[0m
[0mPOST /api/settings/users [32m201[0m 77.608 ms - 293[0m
[0mPOST /api/settings/users [33m403[0m 10.359 ms - 95[0m
[0mPOST /api/students/import [32m201[0m 40.600 ms - 944[0m
[0mPOST /api/students/import [33m403[0m 12.321 ms - 95[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (541.7602ms)
[0mPOST /api/auth/login [32m200[0m 65.738 ms - 562[0m
[0mPOST /api/auth/login [32m200[0m 63.748 ms - 588[0m
[0mPOST /api/students/attendance [32m200[0m 39.289 ms - 349[0m
[0mPOST /api/students/attendance [32m200[0m 20.764 ms - 342[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpl6o0z-28456-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 31.830 ms - 656[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 9.094 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 17.738 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpl6o0z-28456-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 10.387 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (482.2992ms)
[0mPOST /api/auth/login [32m200[0m 50.156 ms - 483[0m
[0mPOST /api/auth/login [32m200[0m 53.175 ms - 483[0m
[0mPOST /api/reports/export [32m200[0m 22.925 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 9.809 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 7.342 ms - 91[0m
✔ report exports persist export records and enforce report permissions (322.7199ms)
[0mPOST /api/auth/login [32m200[0m 49.713 ms - 583[0m
[0mPOST /api/auth/login [32m200[0m 51.544 ms - 576[0m
[0mGET /api/auth/me [32m200[0m 3.935 ms - 374[0m
[0mGET /api/students/portal-student-mtpl6onc-28456-portal/context [32m200[0m 27.143 ms - 1177[0m
[0mGET /api/students/portal-student-b-mtpl6onc-28456-portal/context [33m403[0m 15.882 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtpl6onc-28456-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 16.793 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 5.692 ms - 369[0m
✔ student and parent accounts can be created and log in against a linked student (368.6937ms)
[0mPOST /api/auth/login [32m200[0m 56.908 ms - 513[0m
[0mPOST /api/auth/login [32m200[0m 57.694 ms - 513[0m
[0mPATCH /api/students/writes-student-mtpl6oxl-28456-writes [32m200[0m 41.557 ms - 854[0m
[0mPATCH /api/students/writes-student-mtpl6oxl-28456-writes [33m403[0m 11.747 ms - 95[0m
[0mPOST /api/schools/writes-runtime-other-mtpl6oxl-28456-writes/export-data [33m403[0m 9.858 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (364.4901ms)
✔ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (14572.7315ms)
✔ database contracts keep the core integrity guardrails in place (11.0164ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (253.6993ms)
✔ attendance stays unique for a student on the same day (85.0078ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (89.6396ms)
✔ teacher, subject, and class relations stay aligned and remain unique (84.5242ms)
✔ grade records disappear when the owning student or subject is deleted (98.4048ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (80.642ms)
✔ Arabic text survives a database round trip unchanged (64.2568ms)
[0mPOST /api/auth/login [32m200[0m 100.804 ms - 494[0m
[0mPOST /api/auth/login [32m200[0m 73.703 ms - 466[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 12.163 ms - 218[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 5.795 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 19.265 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 6.405 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.554 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (2752.5414ms)
✔ legacy baseline data survives migrations and reads with the current enum values (19173.0619ms)
[0mPOST /api/schools/privacy-a-school-mtpl6mwv-23960-zksl1p/export-data [33m403[0m 72.858 ms - 95[0m
[0mPOST /api/schools/privacy-b-school-mtpl6mwv-23960-zksl1p/export-data [33m403[0m 26.173 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtpl6mwv-23960-zksl1p/export-data [32m200[0m 112.619 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 32.432 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtpl6mwv-23960-zksl1p/delete-data [32m200[0m 74.196 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtpl6mwv-23960-zksl1p/delete-data [32m200[0m 136.581 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (1307.105ms)
[0mPOST /api/auth/login [32m200[0m 118.865 ms - 491[0m
[0mGET /api/teachers [32m200[0m 107.877 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpl6lqt-23512-47rtlx [33m404[0m 26.501 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpl6lqt-23512-47rtlx/assignments/tenant-b-assignment-mtpl6lqt-23512-47rtlx/weekly-periods [33m404[0m 18.351 ms - 21[0m
[0mGET /api/subjects [32m200[0m 21.700 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtpl6lqt-23512-47rtlx [33m404[0m 14.875 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtpl6lqt-23512-47rtlx [32m200[0m 18.165 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtpl6lqt-23512-47rtlx/context [33m404[0m 18.731 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtpl6lqt-23512-47rtlx&date=2026-08-12 [33m404[0m 12.485 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 16.912 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtpl6lqt-23512-47rtlx [33m404[0m 12.321 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 18.329 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 44.504 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 21.278 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 128.678 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 123.613 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtpl6lqt-23512-47rtlx [33m404[0m 14.167 ms - 120[0m
[0mGET /api/archive [32m200[0m 25.758 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 15.446 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtpl6lqt-23512-47rtlx&from=2026-08-12&to=2026-08-12 [33m404[0m 10.353 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtpl6lqt-23512-47rtlx&subjectId=tenant-b-subject-mtpl6lqt-23512-47rtlx [33m404[0m 12.866 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 20.198 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 20.467 ms - 1241[0m
[0mGET /api/audit-logs/tenant-b-audit-mtpl6lqt-23512-47rtlx [33m404[0m 14.204 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtpl6lqt-23512-47rtlx/dashboard [33m403[0m 10.528 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtpl6lqt-23512-47rtlx/export-data [33m403[0m 10.898 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtpl6lqt-23512-47rtlx/delete-data [33m403[0m 11.734 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 19.039 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (3421.4455ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 37.223 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 117.618 ms - 571[0m
[0mPOST /api/uploads [32m201[0m 45.105 ms - 302[0m
[0mPOST /api/students/import [32m201[0m 96.200 ms - 1064[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (2209.6157ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 19799.6939
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

✔ Redis-backed rate limits are shared across store instances (2.0382ms)
✔ Redis-backed nonce replay protection is shared across store instances (3.1134ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (1076.4738ms)
✔ client nonce replay protection rejects repeated activation requests (157.3364ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1472.3044
```
