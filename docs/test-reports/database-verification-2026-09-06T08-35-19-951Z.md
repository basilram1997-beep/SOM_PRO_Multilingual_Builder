# Database Verification Report

Generated at: 2026-09-06T08:35:19.951Z
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
| Prepare PostgreSQL, Redis, and migrations | PASS | 0 | 2026-09-06T08:34:53.526Z | 2026-09-06T08:34:55.550Z |
| Backend database-critical suite | PASS | 0 | 2026-09-06T08:34:55.550Z | 2026-09-06T08:35:16.385Z |
| License server database flow | PASS | 0 | 2026-09-06T08:35:16.385Z | 2026-09-06T08:35:19.950Z |

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
✔ license flow accepts a valid license activation (3.8988ms)
✔ license flow rejects expired and cancelled licenses (20.0731ms)
✔ license flow blocks extra devices but allows an already activated device (0.497ms)
✔ API route contracts consistently use data wrappers for success responses (5.9799ms)
✔ license routes expose persistent setup endpoints (1.4168ms)
✔ student certificates routes expose persistent storage endpoints (1.3194ms)
✔ grade routes enforce lesson permissions and assignment scope before writing (1.9221ms)
✔ teacher files stay the source of truth for student, parent, and homeroom views (3.7728ms)
✔ student invitations and pledges are saved through the notification flow and remain re-saveable (2.1154ms)
✔ class edit and homeroom reassignment routes stay available for admin operations (1.5646ms)
✔ teachers administration routes require manageTeachers while permissions stay self-service (1.0279ms)
✔ behavior records can be cleared for a student day (1.3944ms)
✔ lesson routes reuse the shared teacher scope resolver (1.2322ms)
✔ API route contracts expose stable error codes for failure responses (4.0301ms)
✔ report routes expose entity summary reporting for class, student, teacher, subject, and homeroom (3.4396ms)
✔ school operations route exposes operations dashboard data (1.1311ms)
✔ uploads route enforces scanner validation before accepting files (0.4437ms)
✔ settings router stays mounted only on explicit settings prefixes (0.7396ms)
[0mGET /api/version [32m200[0m 3.964 ms - 162[0m
[0mPOST /api/auth/login [32m200[0m 143.196 ms - 470[0m
[0mPOST /api/classes [32m201[0m 61.203 ms - 309[0m
[0mGET /api/classes [32m200[0m 57.430 ms - 154[0m
[0mGET /api/teachers [33m401[0m 2.021 ms - 72[0m
✔ API exchanges JSON data with stable envelopes across version, login, class create, and protected reads (2560.7674ms)
[0mPOST /api/auth/login [32m200[0m 96.347 ms - 468[0m
[0mPOST /api/auth/login [32m200[0m 74.545 ms - 468[0m
[0mPOST /api/settings/permission-review [32m201[0m 26.119 ms - 60[0m
[0mPOST /api/settings/permission-review [33m403[0m 17.440 ms - 95[0m
✔ settings permission review enforces manageSettings at runtime (488.8118ms)
[0mPOST /api/auth/login [32m200[0m 75.447 ms - 495[0m
[0mPOST /api/auth/login [32m200[0m 63.046 ms - 517[0m
[0mPOST /api/teachers [32m201[0m 32.737 ms - 562[0m
[0mGET /api/teachers [32m200[0m 19.366 ms - 581[0m
[0mGET /api/teachers [33m403[0m 16.847 ms - 95[0m
[0mPOST /api/settings/users [32m201[0m 84.830 ms - 290[0m
[0mPOST /api/settings/users [33m403[0m 11.908 ms - 95[0m
[0mPOST /api/students/import [32m201[0m 38.248 ms - 938[0m
[0mPOST /api/students/import [33m403[0m 12.931 ms - 95[0m
✔ teachers, students, and settings flows keep happy paths and forbidden writes separated (633.2714ms)
[0mPOST /api/auth/login [32m200[0m 56.999 ms - 557[0m
[0mPOST /api/auth/login [32m200[0m 59.603 ms - 582[0m
[0mPOST /api/students/attendance [32m200[0m 31.625 ms - 347[0m
[0mPOST /api/students/attendance [32m200[0m 19.914 ms - 340[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpk3c61-7052-attendance&from=2026-08-09&to=2026-08-09 [32m200[0m 29.014 ms - 653[0m
[0mGET /api/reports/attendance?classId=&from=bad-date&to=2026-08-09 [33m400[0m 8.993 ms - 110[0m
[0mPOST /api/students/attendance [33m403[0m 16.662 ms - 97[0m
[0mGET /api/reports/attendance?classId=attendance-class-mtpk3c61-7052-attendance&from=2026-08-09&to=2026-08-09 [33m403[0m 12.480 ms - 85[0m
✔ attendance writes feed the attendance report and enforce role boundaries (453.3264ms)
[0mPOST /api/auth/login [32m200[0m 52.166 ms - 480[0m
[0mPOST /api/auth/login [32m200[0m 55.611 ms - 480[0m
[0mPOST /api/reports/export [32m200[0m 23.544 ms - 135[0m
[0mPOST /api/reports/export [33m403[0m 14.633 ms - 93[0m
[0mPOST /api/reports/export [33m400[0m 9.942 ms - 91[0m
✔ report exports persist export records and enforce report permissions (390.0602ms)
[0mPOST /api/auth/login [32m200[0m 57.762 ms - 575[0m
[0mPOST /api/auth/login [32m200[0m 61.007 ms - 569[0m
[0mGET /api/auth/me [32m200[0m 3.905 ms - 368[0m
[0mGET /api/students/portal-student-mtpk3ctg-7052-portal/context [32m200[0m 29.585 ms - 1169[0m
[0mGET /api/students/portal-student-b-mtpk3ctg-7052-portal/context [33m403[0m 11.688 ms - 100[0m
[0mGET /api/students/certificates?studentId=portal-student-b-mtpk3ctg-7052-portal&certificateType=TERM2_FINAL&academicYear=2025-2026 [33m403[0m 17.019 ms - 96[0m
[0mGET /api/auth/me [32m200[0m 4.520 ms - 363[0m
✔ student and parent accounts can be created and log in against a linked student (379.667ms)
[0mPOST /api/auth/login [32m200[0m 54.151 ms - 507[0m
[0mPOST /api/auth/login [32m200[0m 61.737 ms - 507[0m
[0mPATCH /api/students/writes-student-mtpk3d3z-7052-writes [32m200[0m 42.145 ms - 848[0m
[0mPATCH /api/students/writes-student-mtpk3d3z-7052-writes [33m403[0m 11.813 ms - 95[0m
[0mPOST /api/schools/writes-runtime-other-mtpk3d3z-7052-writes/export-data [33m403[0m 8.368 ms - 95[0m
✔ student write routes stay manageSettings-only and school export stays school-scoped (341.1111ms)
✔ backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions (15130.5136ms)
✔ database contracts keep the core integrity guardrails in place (16.9702ms)
✔ a failed batch write rolls back all inserted rows instead of leaving a partial set behind (333.0114ms)
✔ attendance stays unique for a student on the same day (80.4396ms)
✔ attendance CRUD keeps create, read, update, and delete behavior aligned (96.7181ms)
✔ teacher, subject, and class relations stay aligned and remain unique (91.0437ms)
✔ grade records disappear when the owning student or subject is deleted (132.0773ms)
✔ backup and report export records upsert cleanly without duplicating storage rows (98.9132ms)
✔ Arabic text survives a database round trip unchanged (76.9063ms)
[0mPOST /api/auth/login [32m200[0m 93.262 ms - 494[0m
[0mPOST /api/auth/login [32m200[0m 81.287 ms - 466[0m
[0mGET /api/auth/mfa/readiness [32m200[0m 14.145 ms - 218[0m
[0mPOST /api/auth/mfa/disable [33m403[0m 6.762 ms - 75[0m
[0mPOST /api/auth/mfa/disable [32m200[0m 22.634 ms - 20[0m
[0mPOST /api/auth/sso/oidc/callback [33m400[0m 7.543 ms - 138[0m
[0mPOST /api/auth/sso/oidc/callback [31m501[0m 0.672 ms - 138[0m
✔ MFA blocks privileged login without a second factor, hashes recovery codes, audits disable, and SSO fails closed (3388.2361ms)
✔ legacy baseline data survives migrations and reads with the current enum values (19790.091ms)
[0mPOST /api/schools/privacy-a-school-mtpk3and-13296-9xqkjo/export-data [33m403[0m 89.765 ms - 95[0m
[0mPOST /api/schools/privacy-b-school-mtpk3and-13296-9xqkjo/export-data [33m403[0m 15.301 ms - 95[0m
[0mPOST /api/schools/privacy-a-school-mtpk3and-13296-9xqkjo/export-data [32m200[0m 114.462 ms - 4928[0m
[0mGET /api/audit-logs/export [32m200[0m 33.101 ms - 1342[0m
[0mPOST /api/schools/privacy-a-school-mtpk3and-13296-9xqkjo/delete-data [32m200[0m 83.025 ms - 1093[0m
[0mPOST /api/schools/privacy-c-school-mtpk3and-13296-9xqkjo/delete-data [32m200[0m 155.951 ms - 1078[0m
✔ privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free (1957.8839ms)
[0mPOST /api/auth/login [32m200[0m 159.352 ms - 491[0m
[0mGET /api/teachers [32m200[0m 78.730 ms - 806[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpk39aa-17672-4enfps [33m404[0m 26.420 ms - 21[0m
[0mPATCH /api/teachers/tenant-b-teacher-mtpk39aa-17672-4enfps/assignments/tenant-b-assignment-mtpk39aa-17672-4enfps/weekly-periods [33m404[0m 17.042 ms - 21[0m
[0mGET /api/subjects [32m200[0m 21.759 ms - 315[0m
[0mPUT /api/subjects/tenant-b-subject-mtpk39aa-17672-4enfps [33m404[0m 12.842 ms - 66[0m
[0mGET /api/students?classId=tenant-b-class-mtpk39aa-17672-4enfps [32m200[0m 17.794 ms - 11[0m
[0mGET /api/students/tenant-b-student-mtpk39aa-17672-4enfps/context [33m404[0m 13.544 ms - 72[0m
[0mGET /api/students/attendance?classId=tenant-b-class-mtpk39aa-17672-4enfps&date=2026-08-12 [33m404[0m 14.078 ms - 66[0m
[0mPUT /api/students/attendance [33m404[0m 15.351 ms - 72[0m
[0mPATCH /api/classes/tenant-b-class-mtpk39aa-17672-4enfps [33m404[0m 13.570 ms - 60[0m
[0mGET /api/schedules/base [32m200[0m 24.240 ms - 615[0m
[0mPOST /api/schedules/base [33m400[0m 50.928 ms - 489[0m
[0mPOST /api/schedules/base/swap-periods [33m404[0m 25.863 ms - 82[0m
[0mGET /api/daily/2026-08-12 [32m200[0m 165.714 ms - 1461[0m
[0mPOST /api/daily/2026-08-12/events [33m400[0m 142.936 ms - 88[0m
[0mDELETE /api/daily/events/tenant-b-event-mtpk39aa-17672-4enfps [33m404[0m 14.701 ms - 120[0m
[0mGET /api/archive [32m200[0m 29.146 ms - 581[0m
[0mDELETE /api/archive/2026-08-12 [32m204[0m 18.061 ms - -[0m
[0mGET /api/reports/attendance?classId=tenant-b-class-mtpk39aa-17672-4enfps&from=2026-08-12&to=2026-08-12 [33m404[0m 12.955 ms - 66[0m
[0mGET /api/reports/grades?classId=tenant-a-class-mtpk39aa-17672-4enfps&subjectId=tenant-b-subject-mtpk39aa-17672-4enfps [33m404[0m 15.802 ms - 74[0m
[0mGET /api/schools/operations [32m200[0m 19.568 ms - 1602[0m
[0mGET /api/audit-logs?limit=200 [32m200[0m 23.343 ms - 1241[0m
[0mGET /api/audit-logs/tenant-b-audit-mtpk39aa-17672-4enfps [33m404[0m 14.196 ms - 83[0m
[0mGET /api/schools/tenant-b-school-mtpk39aa-17672-4enfps/dashboard [33m403[0m 12.599 ms - 83[0m
[0mPOST /api/schools/tenant-b-school-mtpk39aa-17672-4enfps/export-data [33m403[0m 8.808 ms - 95[0m
[0mPOST /api/schools/tenant-b-school-mtpk39aa-17672-4enfps/delete-data [33m403[0m 8.587 ms - 95[0m
[0mPOST /api/uploads [32m201[0m 15.725 ms - 348[0m
✔ tenant isolation blocks cross-school resource access through params, query, and body identifiers (3923.9989ms)
[0mPOST /api/auth/bootstrap-license [32m201[0m 52.738 ms - 57[0m
[0mPOST /api/auth/login [32m200[0m 148.563 ms - 571[0m
[0mPOST /api/uploads [32m201[0m 82.875 ms - 302[0m
[0mPOST /api/students/import [32m201[0m 49.270 ms - 1064[0m
✔ uploaded spreadsheet is scanned before acceptance and imported through the students endpoint (2799.6481ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 20675.492
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

✔ Redis-backed rate limits are shared across store instances (1.7558ms)
✔ Redis-backed nonce replay protection is shared across store instances (3.3394ms)
✔ admin recovery issues a one-time reset token and never returns a plaintext password (1028.5577ms)
✔ client nonce replay protection rejects repeated activation requests (178.4823ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1443.5408
```
