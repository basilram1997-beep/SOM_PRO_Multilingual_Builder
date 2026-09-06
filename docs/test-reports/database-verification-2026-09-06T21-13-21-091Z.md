# Database Verification Report

Generated at: 2026-09-06T21:13:21.091Z
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
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T21:12:55.131Z | 2026-09-06T21:12:56.985Z |
| Backend database-critical suite | PASS | 0 | 2026-09-06T21:12:56.985Z | 2026-09-06T21:13:18.276Z |
| License server database flow | PASS | 0 | 2026-09-06T21:13:18.277Z | 2026-09-06T21:13:21.091Z |

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
✔ license flow accepts a valid license activation (5.0009ms)
✔ license flow rejects expired and cancelled licenses (19.4206ms)
✔ license flow blocks extra devices but allows an already activated device (0.626ms)
✔ API route contracts consistently use data wrappers for success responses (5.5233ms)
✔ license routes expose persistent setup endpoints (0.7165ms)
✔ student certificates routes expose persistent storage endpoints (1.1228ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (1.9714ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (3.488ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (2.2746ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (1.6195ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (3.9744ms)
✔ behavior records can be cleared for a student day (1.6142ms)
✔ lesson routes reuse the shared teacher scope resolver (1.2561ms)
✔ API route contracts expose stable error codes for failure responses (4.8957ms)
✔ API response contract report documents the supported envelope and intentional exceptions (0.615ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (0.6196ms)
✔ school operations route exposes operations dashboard data (1.5972ms)
✔ uploads route enforces scanner validation before accepting files (0.5151ms)
✔ settings router stays mounted only on explicit settings prefixes (0.9912ms)
[0mGET /api/version [32m200[0m 3.289 ms - 147[0m
[0mPOST /api/auth/login [32m200[0m 117.610 ms - 470[0m
[0mPOST /api/classes [32m201[0m 56.722 ms - 309[0m
[0mGET /api/classes [32m200[0m 41.562 ms - 154[0m
[0mGET /api/teachers [33m401[0m 1.006 ms - 84[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (2193.8317ms)
[0mPOST /api/auth/login [32m200[0m 95.894 ms - 468[0m
[0mPOST /api/auth/login [32m200[0m 72.657 ms - 468[0m
[0mPOST /api/settings/permission-review [32m201[0m 24.719 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 16.032 ms - 107[0m
✔ settings permission review enforces manageSettings at runtime (406.8049ms)
[0mPOST /api/auth/login [32m200[0m 64.240 ms - 495[0m
[0mPOST /api/auth/login [32m200[0m 66.633 ms - 517[0m
[0mPOST /api/teachers [32m201[0m 26.203 ms - 562[0m
[0mGET /api/teachers [32m200[0m 15.331 ms - 581[0m
[0mGET /api/teachers [33m403[0m 10.425 ms - 107[0m
[0mPOST /api/settings/users [32m201[0m 73.668 ms - 290[0m
[0mPOST /api/settings/users [33m403[0m 11.085 ms - 107[0m
[0mPOST /api/students/import [32m201[0m 36.332 ms - 938[0m
[0mPOST /api/students/import [33m403[0m 14.337 ms - 107[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (561.0086ms)
[0mPOST /api/auth/login [32m200[0m 60.142 ms - 557[0m
[0mPOST /api/auth/login [32m200[0m 55.634 ms - 582[0m
[0mPOST /api/students/attendance [32m200[0m 38.798 ms - 347[0m
[0mPOST /api/students/attendance [32m200[0m 17.952 ms - 340[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtqb6536-2544-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 30.870 ms - 653[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 8.809 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 16.525 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtqb6536-2544-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 10.643 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (428.0795ms)
[0mPOST /api/auth/login [32m200[0m 50.830 ms - 480[0m
[0mPOST /api/auth/login [32m200[0m 50.567 ms - 480[0m
[0mPOST /api/reports/export [32m200[0m 22.460 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 13.380 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 9.101 ms - 91[0m
✔ report exports persist export records and enforce report permissions (308.6542ms)
[0mPOST /api/auth/login [32m200[0m 47.624 ms - 575[0m
[0mPOST /api/auth/login [32m200[0m 49.873 ms - 569[0m
[0mGET /api/auth/me [32m200[0m 2.942 ms - 368[0m
[0mGET /api/students/portal-student-mtqb65nn-2544-portal/context [32m200[0m 26.622 ms - 1169[0m
[0mGET /api/students/portal-student-b-mtqb65nn-2544-portal/context [33m403[0m 12.935 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtqb65nn-2544-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 20.461 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 7.253 ms - 363[0m
✔ student and parent accounts can be created and log in against a linked student (373.106ms)
[0mPOST /api/auth/login [32m200[0m 54.833 ms - 507[0m
[0mPOST /api/auth/login [32m200[0m 53.645 ms - 507[0m
[0mPATCH /api/students/writes-student-mtqb65y0-2544-writes [32m200[0m 35.417 ms - 848[0m
[0mPATCH /api/students/writes-student-mtqb65y0-2544-writes [33m403[0m 11.500 ms - 107[0m
[0mPOST /api/schools/writes-runtime-other-mtqb65y0-2544-writes/export-data [33m403[0m 9.120 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (332.2077ms)
✔ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (14670.4184ms)
✔ database contracts keep the core integrity guardrails in place (14.0369ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (250.1098ms)
✔ attendance stays unique for a student on the same day (81.12ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (110.2701ms)
✔ teacher, subject, and class relations stay aligned and remain unique (98.7772ms)
✔ grade records disappear when the owning student or subject is deleted (113.7261ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (76.5485ms)
✔ Arabic text survives a database round trip unchanged (66.1606ms)
[0mPOST /api/auth/login [32m200[0m 95.037 ms - 494[0m
[0mPOST /api/auth/login [32m200[0m 81.988 ms - 466[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 11.908 ms - 218[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 3.833 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 16.275 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 4.981 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.608 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (2892.2336ms)
✔ legacy baseline data survives migrations and reads with the current enum values (20584.1973ms)
[0mPOST /api/schools/privacy-a-school-mtqb63xz-10800-tll1d3/export-data [33m403[0m 76.452 ms - 107[0m
[0mPOST /api/schools/privacy-b-school-mtqb63xz-10800-tll1d3/export-data [33m403[0m 17.856 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtqb63xz-10800-tll1d3/export-data [32m200[0m 111.872 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 25.082 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtqb63xz-10800-tll1d3/delete-data [32m200[0m 84.955 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtqb63xz-10800-tll1d3/delete-data [32m200[0m 148.747 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (1135.1035ms)
[0mPOST /api/auth/login [32m200[0m 116.637 ms - 491[0m
[0mGET /api/teachers [32m200[0m 89.137 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtqb62n8-14288-bl5ggc [33m404[0m 35.562 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtqb62n8-14288-bl5ggc/assignments/tenant-b-assignment-mtqb62n8-14288-bl5ggc/weekly-periods [33m404[0m 16.151 ms - 21[0m
[0mGET /api/subjects [32m200[0m 21.271 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtqb62n8-14288-bl5ggc [33m404[0m 28.138 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtqb62n8-14288-bl5ggc [32m200[0m 19.388 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtqb62n8-14288-bl5ggc/context [33m404[0m 12.497 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtqb62n8-14288-bl5ggc&date=2026-08-12 [33m404[0m 13.029 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 14.333 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtqb62n8-14288-bl5ggc [33m404[0m 12.785 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 19.162 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 46.901 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 20.629 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 142.574 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 128.047 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtqb62n8-14288-bl5ggc [33m404[0m 12.235 ms - 120[0m
[0mGET /api/archive [32m200[0m 25.407 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 23.171 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtqb62n8-14288-bl5ggc&from=2026-08-12&to=2026-08-12 [33m404[0m 14.519 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtqb62n8-14288-bl5ggc&subjectId=tenant-b-subject-mtqb62n8-14288-bl5ggc [33m404[0m 13.273 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 17.471 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 17.304 ms - 1242[0m
[0mGET /api/audit-logs/tenant-b-audit-mtqb62n8-14288-bl5ggc [33m404[0m 12.074 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtqb62n8-14288-bl5ggc/dashboard [33m403[0m 10.448 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtqb62n8-14288-bl5ggc/export-data [33m403[0m 11.672 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtqb62n8-14288-bl5ggc/delete-data [33m403[0m 8.758 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 19.371 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (3483.3781ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 35.687 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 107.140 ms - 576[0m
[0mPOST /api/uploads [32m201[0m 53.569 ms - 303[0m
[0mPOST /api/students/import [32m201[0m 68.510 ms - 1070[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (2398.5142ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21183.4179
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

✔ Redis-backed rate limits are shared across store instances (1.9826ms)
✔ Redis-backed nonce replay protection is shared across store instances (3.0115ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (424.6022ms)
✔ client nonce replay protection rejects repeated activation requests (169.0205ms)
✔ license lookup paths use indexed database access instead of full-table credential scans (0.9548ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 812.7149
```
