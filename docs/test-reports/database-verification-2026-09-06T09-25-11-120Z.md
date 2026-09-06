# Database Verification Report

Generated at: 2026-09-06T09:25:11.120Z
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
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T09:24:45.808Z | 2026-09-06T09:24:47.778Z |
| Backend database-critical suite | PASS | 0 | 2026-09-06T09:24:47.778Z | 2026-09-06T09:25:07.918Z |
| License server database flow | PASS | 0 | 2026-09-06T09:25:07.919Z | 2026-09-06T09:25:11.119Z |

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

25 migrations found in prisma/migrations


No pending migrations to apply.
[SOM PRO] Local test database is ready.
```

### Backend database-critical suite

```text
✔ license flow accepts a valid license activation (4.5857ms)
✔ license flow rejects expired and cancelled licenses (23.3847ms)
✔ license flow blocks extra devices but allows an already activated device (0.5232ms)
✔ API route contracts consistently use data wrappers for success responses (6.963ms)
✔ license routes expose persistent setup endpoints (0.7923ms)
✔ student certificates routes expose persistent storage endpoints (1.1666ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (2.0144ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (3.3318ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (1.9138ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (1.4724ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (1.2839ms)
✔ behavior records can be cleared for a student day (1.5821ms)
✔ lesson routes reuse the shared teacher scope resolver (1.5525ms)
✔ API route contracts expose stable error codes for failure responses (6.2319ms)
✔ API response contract report documents the supported envelope and intentional exceptions (0.6688ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (0.5471ms)
✔ school operations route exposes operations dashboard data (0.8836ms)
✔ uploads route enforces scanner validation before accepting files (0.4814ms)
✔ settings router stays mounted only on explicit settings prefixes (1.0007ms)
[0mGET /api/version [32m200[0m 2.803 ms - 162[0m
[0mPOST /api/auth/login [32m200[0m 118.334 ms - 476[0m
[0mPOST /api/classes [32m201[0m 58.830 ms - 311[0m
[0mGET /api/classes [32m200[0m 68.034 ms - 155[0m
[0mGET /api/teachers [33m401[0m 0.841 ms - 72[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (2093.0523ms)
[0mPOST /api/auth/login [32m200[0m 97.126 ms - 474[0m
[0mPOST /api/auth/login [32m200[0m 88.239 ms - 474[0m
[0mPOST /api/settings/permission-review [32m201[0m 28.196 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 18.505 ms - 95[0m
✔ settings permission review enforces manageSettings at runtime (498.8772ms)
[0mPOST /api/auth/login [32m200[0m 73.127 ms - 501[0m
[0mPOST /api/auth/login [32m200[0m 63.116 ms - 524[0m
[0mPOST /api/teachers [32m201[0m 30.206 ms - 566[0m
[0mGET /api/teachers [32m200[0m 16.351 ms - 585[0m
[0mGET /api/teachers [33m403[0m 12.826 ms - 95[0m
[0mPOST /api/settings/users [32m201[0m 77.419 ms - 293[0m
[0mPOST /api/settings/users [33m403[0m 10.353 ms - 95[0m
[0mPOST /api/students/import [32m201[0m 36.923 ms - 944[0m
[0mPOST /api/students/import [33m403[0m 11.991 ms - 95[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (573.3425ms)
[0mPOST /api/auth/login [32m200[0m 63.757 ms - 562[0m
[0mPOST /api/auth/login [32m200[0m 59.441 ms - 588[0m
[0mPOST /api/students/attendance [32m200[0m 35.101 ms - 349[0m
[0mPOST /api/students/attendance [32m200[0m 18.092 ms - 342[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtplvg82-22480-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 28.681 ms - 656[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 8.138 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 14.293 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtplvg82-22480-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 10.782 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (446.4139ms)
[0mPOST /api/auth/login [32m200[0m 50.021 ms - 483[0m
[0mPOST /api/auth/login [32m200[0m 50.544 ms - 483[0m
[0mPOST /api/reports/export [32m200[0m 24.709 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 16.024 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 10.322 ms - 91[0m
✔ report exports persist export records and enforce report permissions (326.6873ms)
[0mPOST /api/auth/login [32m200[0m 48.262 ms - 583[0m
[0mPOST /api/auth/login [32m200[0m 52.884 ms - 576[0m
[0mGET /api/auth/me [32m200[0m 3.796 ms - 374[0m
[0mGET /api/students/portal-student-mtplvgtj-22480-portal/context [32m200[0m 29.173 ms - 1177[0m
[0mGET /api/students/portal-student-b-mtplvgtj-22480-portal/context [33m403[0m 14.647 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtplvgtj-22480-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 18.402 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 6.373 ms - 369[0m
✔ student and parent accounts can be created and log in against a linked student (368.7201ms)
[0mPOST /api/auth/login [32m200[0m 59.076 ms - 513[0m
[0mPOST /api/auth/login [32m200[0m 56.483 ms - 513[0m
[0mPATCH /api/students/writes-student-mtplvh3s-22480-writes [32m200[0m 37.698 ms - 854[0m
[0mPATCH /api/students/writes-student-mtplvh3s-22480-writes [33m403[0m 13.907 ms - 95[0m
[0mPOST /api/schools/writes-runtime-other-mtplvh3s-22480-writes/export-data [33m403[0m 9.332 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (361.9945ms)
✔ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (14716.0438ms)
✔ database contracts keep the core integrity guardrails in place (12.9679ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (280.3589ms)
✔ attendance stays unique for a student on the same day (97.3251ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (95.7047ms)
✔ teacher, subject, and class relations stay aligned and remain unique (90.8ms)
✔ grade records disappear when the owning student or subject is deleted (119.4651ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (80.0171ms)
✔ Arabic text survives a database round trip unchanged (69.4994ms)
[0mPOST /api/auth/login [32m200[0m 102.972 ms - 494[0m
[0mPOST /api/auth/login [32m200[0m 82.998 ms - 466[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 13.244 ms - 218[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 4.668 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 17.292 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 6.265 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.576 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (2840.1215ms)
✔ legacy baseline data survives migrations and reads with the current enum values (19343.2391ms)
[0mPOST /api/schools/privacy-a-school-mtplveyr-22364-2udkci/export-data [33m403[0m 86.428 ms - 95[0m
[0mPOST /api/schools/privacy-b-school-mtplveyr-22364-2udkci/export-data [33m403[0m 23.967 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtplveyr-22364-2udkci/export-data [32m200[0m 109.598 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 34.822 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtplveyr-22364-2udkci/delete-data [32m200[0m 80.438 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtplveyr-22364-2udkci/delete-data [32m200[0m 162.758 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (1243.168ms)
[0mPOST /api/auth/login [32m200[0m 118.953 ms - 491[0m
[0mGET /api/teachers [32m200[0m 72.950 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtplvdtj-16692-a9ia8n [33m404[0m 37.252 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtplvdtj-16692-a9ia8n/assignments/tenant-b-assignment-mtplvdtj-16692-a9ia8n/weekly-periods [33m404[0m 23.627 ms - 21[0m
[0mGET /api/subjects [32m200[0m 19.615 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtplvdtj-16692-a9ia8n [33m404[0m 14.925 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtplvdtj-16692-a9ia8n [32m200[0m 20.485 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtplvdtj-16692-a9ia8n/context [33m404[0m 13.873 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtplvdtj-16692-a9ia8n&date=2026-08-12 [33m404[0m 14.437 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 16.898 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtplvdtj-16692-a9ia8n [33m404[0m 14.353 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 20.415 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 44.321 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 24.333 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 152.544 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 130.590 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtplvdtj-16692-a9ia8n [33m404[0m 15.625 ms - 120[0m
[0mGET /api/archive [32m200[0m 25.707 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 15.549 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtplvdtj-16692-a9ia8n&from=2026-08-12&to=2026-08-12 [33m404[0m 17.024 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtplvdtj-16692-a9ia8n&subjectId=tenant-b-subject-mtplvdtj-16692-a9ia8n [33m404[0m 15.113 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 20.122 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 14.203 ms - 1241[0m
[0mGET /api/audit-logs/tenant-b-audit-mtplvdtj-16692-a9ia8n [33m404[0m 13.909 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtplvdtj-16692-a9ia8n/dashboard [33m403[0m 12.752 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtplvdtj-16692-a9ia8n/export-data [33m403[0m 9.890 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtplvdtj-16692-a9ia8n/delete-data [33m403[0m 9.991 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 17.734 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (3416.6929ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 33.282 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 122.175 ms - 576[0m
[0mPOST /api/uploads [32m201[0m 62.845 ms - 303[0m
[0mPOST /api/students/import [32m201[0m 56.542 ms - 1070[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (2276.7283ms)
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 20023.4758
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

25 migrations found in prisma/migrations


No pending migrations to apply.
[SOM PRO] Local test database is ready.

> @som/license-server@0.9.0-rc.1 test
> node --test src/server.security.test.js src/requestProtectionStore.test.js

✔ Redis-backed rate limits are shared across store instances (1.8183ms)
✔ Redis-backed nonce replay protection is shared across store instances (0.9917ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (634.9029ms)
✔ client nonce replay protection rejects repeated activation requests (155.3519ms)
✔ license lookup paths use indexed database access instead of full-table credential scans (0.547ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1024.6053
```
