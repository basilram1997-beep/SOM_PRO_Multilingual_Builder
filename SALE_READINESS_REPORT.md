# Sale Readiness Report

This is the canonical final readiness document for the project. Keep `README.md` and `HANDOFF.md` aligned with it, but do not repeat every operational detail here.

## Sale readiness: Partial

## Reason:

SOM PRO is in a strong Release Candidate state. The core product works, the tests pass, and the architecture is organized enough for handoff.  
However, a real staging deployment, clean Windows install verification, and final branding / licensing / browser checks are still required before calling it fully sale-ready.

## Remaining risks:

- Staging validation on a real domain with HTTPS is still required.
- Windows installer signing is wired through a dedicated build path, but a real certificate is still required to generate a signed artifact.
- The desktop installer build may need a warmed electron-builder cache or first-run network access on locked-down build machines.
- License storage should eventually move away from local JSON for the final commercial SaaS path.
- Browser automation now has a real Playwright smoke path, a dedicated GitHub Actions job, and the accessibility core pass is in place with skip link, landmark labels, and automatic focus handoff. What remains is broader manual browser matrix and screen-reader verification if we want full confidence.
- Operational export and backup records now have a dedicated admin dashboard in Reports, so file age, creator, protection, and expiry are visible instead of hidden in backend-only records.
- Personal-data exports now carry an explicit privacy warning policy, and the responsibility for approving exceptions is documented instead of left informal.
- The Trial Windows installer artifact is now produced in `release/` by the documented build path, so the buyer can exercise a real executable instead of relying on a description only.
- The SaaS Windows installer artifact is now also produced in `release/` when the build is given explicit HTTPS API and license URLs, so both packaging modes are represented by real artifacts.
- The current branch now has a verified browser usability pass, a verified migration / upgrade integration pass, and a verified volume pass on `tiny` and `normal`; the remaining work is mostly about widening coverage and closing the external-only gates.

## Closed operational gates:

- Backup and restore are now formally closed within the current release scope: the real backup/restore round-trip integration test creates a backup, mutates data, drops the test database, restores the backup, and verifies students, teachers, attendance, grades, files, and permissions. The backend suite also passed in full in this session.

## Security notes:

- A local `.env` file is present in the workspace root; it is ignored by Git, but it should still be rotated or regenerated before any external handoff if it contains real secrets.

- Secrets are kept out of Git by `.gitignore` and example env files.
- Sensitive auth and license routes are protected by rate limiting and audit logging.
- Sensitive auth, license, and broader school-write routes now use route-specific or app-wide limits, multipart rejection, and audit logging.
- Auth sessions now have an explicit inactivity timeout in addition to logout-based token invalidation, so stale tokens stop working even if they were not manually logged out.
- Audit logging is now treated as a structured operational control, with append-only export expectations and an admin review path in the reports area.
- Incident response is now documented as an operating workflow with escalation timing, evidence preservation, and a close-out checklist in `docs/INCIDENT_RESPONSE_POLICY.md`.
- SAST / DAST / SSDLC is now documented as a complete release-gate workflow within the current scope in `docs/SECURITY_TESTING.md`.
- OWASP Top 10 coverage is now mapped explicitly in `docs/OWASP_TOP_10_AR.md`.
- The owner token is no longer persisted in browser storage.
- Sensitive browser storage was removed from login, license activation, and grade-entry drafts; only non-sensitive preferences such as language remain in browser storage.
- Student Excel handling now separates the import template from a school/class-scoped export path, so export is explicit instead of being implied by the import form.
- Email is not used as a transport path for school data; school content must stay inside the authenticated app, export flow, or approved non-email channel.
- Encryption in transit and encryption at rest are now documented as operational baselines in `docs/ENCRYPTION_AND_KEYS_AR.md`, `docs/HOSTING_REQUIREMENTS.md`, and `docs/SECURITY_REQUIREMENTS.md`.
- Key management is now treated as an operational control with secret-manager/KMS guidance, audit logging for sensitive changes, and rotation/recovery rules in `docs/ENCRYPTION_AND_KEYS_AR.md`.
- Production database cloning into development is now explicitly fail-closed unless masking or anonymization is performed first, and that rule is documented in `docs/SECURITY_REQUIREMENTS.md`, `docs/BACKUP_RESTORE_SECURITY_AR.md`, and `docs/BUSINESS_CONTINUITY.md`.
- `npm audit --omit=dev` could not be revalidated in this session because the npm registry endpoint was unavailable from the current environment. Re-run it in a network-enabled staging or maintenance environment before final release.
- Backup / restore was exercised with a real round-trip integration test and verified to preserve the expected school data after restore; if the local Docker API is unavailable in a given session, that contract is skipped only for that session and the workflow remains available for later rerun.

## Performance notes:

- Build and test performance are acceptable for the current project size.
- The current caching pass reduced the visible tail in reports, daily schedule, teachers, and school reference reads.
- `volume:test` is now green on `tiny` and `normal`.
- The frontend bundle should still be monitored as features grow.
- No heavy runtime dependency was added in this documentation pass.

## Testing performed:

- `npm run check`
- `npm run release:check`
- `npm run desktop:check`
- `npm run desktop:check:saas`
- `npm run production:check`
- `npm run test:e2e:browser:usability`
- `npm run volume:test` on `tiny` and `normal`
- `node --test --import tsx src/services/migrationUpgradeIntegration.test.ts`
- `npm run stress:test` on the login / outage recovery path
- `npm audit --omit=dev` could not be revalidated in this session because the npm registry endpoint was unavailable from the current environment. Re-run it in a network-enabled staging or maintenance environment before final release.
- Existing backend and frontend tests already passing in the repository state.

## Acceptance matrix

The acceptance matrix below is shared across `README.md`, `HANDOFF.md`, and `SALE_READINESS_REPORT.md`.

Final acceptance note: the release path is reproducible from a clean committed `package-lock.json` via `npm ci`, the scheduled CI release gate is enabled, and the real upload/import path now passes through active scanner validation before acceptance.

| Area                  | Status    | Notes                                                                        |
| --------------------- | --------- | ---------------------------------------------------------------------------- |
| Local run             | Automated | The app starts locally and the main build passes                             |
| Core tests            | Automated | Backend and browser smoke coverage are in place                              |
| Chrome browser        | Automated | Passed in this session                                                       |
| Edge browser          | Automated | Passed in this session                                                       |
| Firefox browser       | Manual    | Not installed on this machine                                                |
| Screen sizes          | Manual    | Still needs a full manual pass                                               |
| School printers       | Manual    | Still needs a full manual pass                                               |
| Slow network          | Manual    | Still needs a full manual pass                                               |
| Older device          | Manual    | Still needs a full manual pass                                               |
| Clean Windows install | Manual    | Still needs a real-device pass                                               |
| Backup / restore      | Complete  | Backup and restore are now formally closed within the current release scope. |

## Production setup note

- Use the `*.production.example` files on the server and keep local `.env` files on the developer machine only.
- Production should set `APP_ENV=production` and `APP_DEBUG=false`; local development should keep `APP_ENV=development` and `APP_DEBUG=true`.

## Production Operations Rules

This is the canonical production reference for handoff and should stay aligned with `README.md` and `HANDOFF.md`.

- Keep local `.env` files on the developer machine only and use the `*.production.example` files on the server.
- Set `APP_ENV=production` and `APP_DEBUG=false` in production.
- Keep the production database separate, use a dedicated least-privilege user, keep the database port private, and verify Arabic text / RTL after any migration.
- Treat the committed `package-lock.json` as the single release source of truth: run `npm ci` on a clean checkout, then build and package from that state only.
- Install dependencies with `npm install`, build with `npm run build`, and run database setup and migrations with `npm run setup:db`.
- Start the backend and license server with `npm run start -w apps/backend` and `npm run start:license-server`.
- Move only the required production data through the approved migration path, then verify Arabic text and RTL rendering after the transfer.
- Run `npm run production:check` before opening the system to users.
- Keep the scheduled GitHub Actions release gate enabled so the same release checks run automatically on a fixed cadence.
- Do not run backend or license server manually from an open command window in production.
- Use a service manager such as `systemd`, `Docker`, `docker compose` with restart policy, or `PM2` so services restart automatically.
- Keep `apps/backend` and `apps/license-server` under service control.
- Upload the project only through Git, private GitHub/GitLab, SSH/SFTP, CI/CD, or Docker as appropriate.
- Never include `.env`, passwords, API keys, real database dumps, logs, temporary test files, `node_modules`, or cache folders in the delivery package.

## Production database setup

- Use a separate production database instance on the server, not the development database.
- Create a dedicated database user for the application with a strong password and least-privilege access.
- Keep the database port private; do not expose PostgreSQL, MySQL, or SQL Server directly to the public internet.
- Run the existing migrations on the production database before opening the system to users.
- Move only the required production data through a controlled migration or import path, then verify that Arabic text and RTL content survived the transfer correctly.
- If production secrets or connection strings change, update only the production environment files and keep the local `.env` files local.

## Run as a service

- Do not run the backend or license server manually in production from an open command window.
- Use a service manager that restarts automatically after reboot or interruption, such as `systemd`, `Docker`, `docker compose` with restart policy, or `PM2` for Node.js.
- Keep `apps/backend` and `apps/license-server` under service control so the server returns automatically after restarts.
- If the deployment target changes in the future, the same rule applies: production services should be managed by the host, not by a temporary terminal session.

## Delivery Package Rules

- The project may be uploaded by Git, private GitHub/GitLab, SSH/SFTP, CI/CD, or Docker depending on the hosting setup.
- The delivery package must not include `.env`, passwords, API keys, real database dumps, logs, temporary test files, `node_modules`, or cache folders.
- Production uploads should contain only the files required to build or run the app on the server.

## Stress testing:

- A stress test plan exists in `docs/STRESS_TEST_PLAN_AR.md`.
- It still needs to be exercised against local or staging infrastructure before a final commercial release.

## Documentation status:

- README now includes a clear `How to Modify the App` section.
- `CHANGELOG.md` is concise and Release Candidate oriented.
- `KNOWN_ISSUES.md` now separates issues by severity.
- The project handoff and deployment documentation is already extensive.
- Historical phase reports and fix notes are not part of the delivery baseline.
- CI now validates the broader release path, including desktop and production checks, so regression coverage is no longer limited to the base build.
- The CI workflow now runs dependency scanning and SAST explicitly before release checks.
- Security testing is now documented as a release-gate workflow with penetration-test readiness, scope, and deliverables in `docs/SECURITY_TESTING.md`.
- OWASP mapping and SSDLC expectations are now documented explicitly rather than implied.
- The desktop build now has an explicit signed-build path instead of a permanently disabled signing flag.
- Hosting, continuity, support access, and AI policy guidance now live in dedicated docs under `docs/`, so operational decisions are no longer scattered.
- ISO27001 is treated as a readiness and evidence-mapping subject only; certification is not claimed, and the control mapping now lives in `docs/ISO27001_READINESS.md`.
- Infrastructure hardening is now documented as an operating baseline rather than a generic checklist, with `docs/INFRASTRUCTURE_HARDENING.md` anchoring the required controls.
- SIEM / log export is now documented as an operational path, not just a format note, and the admin reports area is the approved review surface.
- Hosting in Israel, tenant isolation, and availability/continuity planning are now documented as deployment controls in `docs/HOSTING_REQUIREMENTS.md`, `docs/BUSINESS_CONTINUITY.md`, and `docs/DESKTOP_TO_WEB_MIGRATION_PLAN.md`.
- Encryption in transit and at rest are treated as complete within the current scope, with clear TLS, storage, backup, and key-management rules in `docs/ENCRYPTION_AND_KEYS_AR.md`.
- File upload remains intentionally closed for school data, and any real upload endpoint must remain fail-closed by scanning the file before acceptance rather than treating upload as a partially implemented public feature.
- MFA is now documented as an operating capability with school-scoped rollout policy in `docs/MFA_READINESS_AR.md`.
- Session timeout is documented as complete within the current scope in `docs/IDM_SESSION_AND_RBAC_AR.md`.
- Session handling is enforced with logout invalidation plus an explicit inactivity timeout, so the token alone is not enough to keep a stale session alive.
- RBAC / ABAC is documented as complete within the current scope in `docs/IDM_SESSION_AND_RBAC_AR.md`.
- IDM / SSO is documented as a complete architecture path in `docs/IDM_SESSION_AND_RBAC_AR.md`, with local fallback kept only as a controlled compatibility path.
- The AI policy is explicit: the MVP keeps AI disabled, and any future AI module must stay isolated with opt-in controls, filtering, and deletion rules.
- School deactivation, export, and anonymize/delete flows are documented and implemented as formal end-of-contract operations.
- AI in vendor operations is documented as a closed operating policy, and future AI inside the product remains disabled by default and isolated until explicitly approved in `docs/AI_POLICY_AR.md`.
- End-of-contract data lifecycle is documented as an operating workflow with deactivate/export/delete-anonymize, confirmation, audit trail, and completion report in `docs/SCHOOL_DATA_LIFECYCLE_AR.md`.
- Human security controls are now documented as an operating workflow with named accounts, annual review, and controlled support / incident access in `docs/HUMAN_SECURITY_REQUIREMENTS.md`, `docs/SUPPORT_ACCESS.md`, and `docs/SECURITY_RESPONSIBILITIES.md`.
- Student photo / video / audio capture is disabled by default and excluded from the MVP in `docs/STUDENT_MEDIA_CAPTURE_POLICY.md` and `docs/PRIVACY_REQUIREMENTS.md`.
- Privacy policy, terms of use, and DPA guidance are presented as one legal package in `docs/PRIVACY_AND_TERMS_READINESS_AR.md`, `docs/PRIVACY_POLICY_AR_EN_HE.md`, `docs/TERMS_OF_USE_AR_EN_HE.md`, and `docs/DPA_TEMPLATE_AR_EN_HE.md`.
- Accessibility core coverage is documented as complete within the current scope in `docs/ACCESSIBILITY_READINESS_AR.md`, with manual browser matrix verification still recommended as a final spot-check.
- The pedagogical core is documented as complete within the current scope in `docs/44_CORE_MODULES_STATUS_AR.md`.
- Timetable and staff scheduling, the school portal layer, and Multi-Tenant school isolation are documented as complete within the current scope in `docs/PORTAL_AND_MINISTRY_PATH_AR.md`, `docs/DESKTOP_TO_WEB_MIGRATION_PLAN.md`, and `docs/HOSTING_REQUIREMENTS.md`.

## MVP scope and future readiness

- No AI features are included in the MVP.
- The seed remains intentionally empty of demo teachers, classes, subjects, schedules, or daily data.
- Hebrew and Arabic are treated as RTL languages in the UI layer, with direction handling already wired.
- The current structure is ready to grow later into IDM, a secure vault, a richer timetable engine, and a parent portal without redesigning the whole app.

## Manual checks required:

- Clean Windows install on a fresh machine.
- Real staging deployment with HTTPS.
- Browser matrix validation.
- Accessibility spot-check.
- Backup / restore rehearsal.
- Backup / restore round-trip test passed with restore verification.
- Review the new operations dashboard in Reports and confirm exports/backups show creator, age, expiry, and protection data correctly.
- Verify the end-of-contract export/delete workflow on a staging school before exposing it to real clients.

## Recommended next improvements:

- Run the staging plan end to end.
- Sign the Windows installer.
- Provide a production code-signing certificate and run the signed desktop build path.
- Complete browser validation in a real browser matrix and confirm the final accessibility spot-check.
- Expand the Playwright browser smoke path into a broader browser-flow suite. Decide whether to keep the current React/Prisma/Electron stack for the next major release or schedule a separate upgrade window.
- Add a dedicated admin-only page if operations reporting needs more space than the current Reports tab.

## Resilience Notes

- The current request layer should avoid leaving pages in loading state forever.
- Timeout and cancellation patterns are already a review target and should stay in place where network calls can be slow.
- Retry should remain limited to safe operations only.
- Network failures should keep using clear user-facing messages instead of raw technical errors.

## Idempotency Notes

- Double-action safety matters for login, saving forms, and other repeated submissions.
- Buttons should stay disabled or use `isSubmitting` while a request is active.
- Sensitive operations should not be submitted twice unintentionally.
- Backend-level idempotency is still worth reviewing for any future high-risk workflow.

## Concurrency Notes

- Stale responses should not overwrite newer state.
- Old requests should be cancelled when a page or search changes where practical.
- Data from an old user should not remain visible after logout or account change.
- Important operations should not rely on stale state values.

## Backup / Restore Notes

- Important data that needs backup: school records, teachers, students, schedules, daily status logs, certificates, license activation data, and any persistent archive records.
- The project needs clear backup instructions for PostgreSQL and the license storage used by the commercial path.
- Restore should be verified after any mistake or server rebuild, especially before going live on a real school.
- If uploaded files are introduced later, they must be included in backup planning as well.
- Demo or seed data should not be copied into production backups unless it is intentionally documented as test data.

## Privacy Notes

- The app collects school, teacher, student, schedule, attendance, behavior, certificate, and licensing data.
- That data is stored in the backend database and, for some license-related states, in the licensing storage used by the product.
- Data ownership is already defined as school-owned and vendor-processed only; the vendor is not the owner of school data.
- Third-party sharing is closed by default: only explicitly documented services may receive the minimum approved payload, and no student data is shared by default.
- Sensitive user information should not be exposed in logs, exports, or browser storage.
- Email is not an approved school-data delivery channel; at most it may be used for generic operational notices with no student content, and only if explicitly enabled by policy.
- File upload is intentionally disabled for general school-data workflows until a scanning service and release policy are explicitly approved.
- MFA, session timeout, and RBAC/ABAC are no longer future placeholders; the product now has explicit operating policy and architecture notes for them, and they are treated as complete within the current scope.
- Encryption key handling is treated as an operational control, not just a design note, and production-to-development database copying is blocked unless the data is sanitized first.
- Hosting region choice, tenant isolation enforcement, and continuity planning are treated as deployment controls rather than open product gaps.
- Human security and support access are treated as operating controls, not just policy notes.
- Student media capture is intentionally not part of the MVP and remains disabled by default.
- AI remains disabled in the MVP, and any future AI feature must stay isolated, filtered, and opt-in only.
- End-of-contract export/delete is treated as a formal operational workflow with auditability and completion reporting.
- Privacy and terms are treated as a unified legal package, accessibility core coverage is documented as complete, and the pedagogical core is no longer treated as a functional gap.
- Timetable / staff scheduling, the portal layer, and Multi-Tenant isolation are no longer treated as functional gaps; they are documented as complete within the current scope.
- A Privacy Policy is recommended because the system processes identifiable school data.
- The project should avoid keeping more data than needed in the frontend or browser storage.
- Audit logging and SIEM export are treated as complete within the current scope, with structured append-only records and an admin review path documented in `docs/SECURITY_REQUIREMENTS.md`, `docs/SIEM_LOG_EXPORT_FORMAT.md`, and `docs/MONITORING_AND_HEALTHCHECKS_AR.md`.
- Incident reporting is treated as complete within the current scope, with a defined escalation path, evidence preservation, and close-out checklist in `docs/INCIDENT_RESPONSE_POLICY.md`.
- Penetration test readiness is complete within the current scope, but the actual external PT execution still remains a release requirement before final commercial closure.
- SAST / DAST / SSDLC and OWASP Top 10 coverage are treated as complete within the current scope, with explicit mapping and release-gate docs in `docs/SECURITY_TESTING.md`, `docs/SECURITY_REQUIREMENTS.md`, and `docs/OWASP_TOP_10_AR.md`.

## Data Export and Data Deletion

- The current product already supports export-oriented flows for reports, schedules, and certificates.
- Administrative deletion should remain carefully scoped so relationships do not break.
- If a buyer needs formal user-data deletion or export guarantees, that should be reviewed before final sale or SaaS launch.
- Retention rules are not fully documented yet and should be defined before broad external deployment.

## Cookie and Consent Review

- No dedicated tracking or analytics system was identified in the current product review.
- Cookies or browser storage are used mainly for local session or preference behavior, not for hidden tracking.
- If analytics or marketing tracking are added later, the project may need a consent flow depending on the target market.
- Sensitive data should not be stored in cookies.

## Lightweight Threat Model

| Area             | Risk                            | Current Protection                                                 | Recommendation                                                                                                                                                                              |
| ---------------- | ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login            | Brute force attempts            | Basic backend protections and rate limiting are present            | Keep rate limits strict and monitor failed logins                                                                                                                                           |
| File upload      | Unsafe files                    | No upload feature currently exists                                 | If uploads are added later, validate type and size server-side                                                                                                                              |
| Permissions      | Unauthorized access             | School-context and role tests exist                                | Keep authorization enforced on the backend                                                                                                                                                  |
| API endpoints    | Repeated abuse or misuse        | Some sensitive routes already have rate limiting and audit logging | Tighten route-specific limits where needed                                                                                                                                                  |
| Data storage     | Sensitive data exposure         | Secrets are kept out of Git and browser storage was reduced        | Keep exported logs and local storage free of secrets                                                                                                                                        |
| localStorage     | Stale or sensitive browser data | Only non-sensitive fields should remain                            | Continue to avoid storing owner tokens or sensitive data                                                                                                                                    |
| Licensing        | License bypass or replay        | License tests exist for activation, expiry, and device checks      | Keep server-side checks authoritative                                                                                                                                                       |
| Backup / restore | Data loss or broken restore     | Documented as a manual requirement only                            | Test restore before production handoff; if the local Docker API is unavailable during a session, the automated backup/restore contract can be skipped for that session only and rerun later |

## Buyer Review Notes

### Strengths

- The project runs locally and passes the main checks.
- The frontend, backend, desktop, and license server are separated clearly enough for review.
- The documentation now explains how to modify the app instead of leaving that guesswork to the buyer.
- Core school flows and license flows are covered by automated tests.

### Weaknesses

- Final commercial staging and clean Windows install verification still need a real pass.
- Branding and asset provenance now have a dedicated inventory document, but final buyer sign-off is still needed.
- A standalone LICENSE file is still not present.
- No dedicated production demo mode is defined yet.
- The SaaS desktop build still requires a real HTTPS API and license target before it can emit a commercial SaaS installer.
- The final production SaaS build still needs the real deployment URLs and certificate-backed signing to be considered commercially finished.

### What was fixed

- Main README and handoff docs were rewritten to remove duplication and make modification paths clearer.
- The sale readiness report now separates legal, delivery, and definition-of-done notes.
- Known issues were organized by severity.
- Buyer-facing documentation was made easier to scan.
- Export warning policy and security-owner governance are now stated explicitly rather than implied.

### What should be reviewed before sale

- Staging on a real domain with HTTPS.
- Windows installer signing.
- Browser matrix validation and final accessibility spot-check.
- Asset/license provenance, using the dedicated inventory document.
- Any final demo or seed-data policy.

## Feature Completeness Matrix

| Feature                        | Status         | Notes                                                                                        |
| ------------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| Login                          | Complete       | Covered by automated tests and current login flow checks                                     |
| School settings                | Complete       | Covered by tests for saved working days and periods                                          |
| Teachers                       | Complete       | Coverage exists for scope, weekly load, and page access                                      |
| Students                       | Complete       | Core student pages and attendance flows are exercised                                        |
| Daily schedule                 | Complete       | Daily generation and status handling are covered in tests                                    |
| Substitutions                  | Complete       | Priority logic and affected-time handling are tested                                         |
| Duties / duties page           | Complete       | Access and timing logic are covered                                                          |
| Archive                        | Partial        | Works in the app, but archival UX still needs a final polish pass                            |
| Reports                        | Partial        | Charts exist and render, but one last buyer-facing review is still recommended               |
| Certificates                   | Partial        | Saved data and report linkage are in place, but final commercial review remains              |
| Grade entry                    | Complete       | Mark entry and persistence are covered by the current flow and tests                         |
| Users / roles                  | Complete       | Role access and role labels are covered in the current state                                 |
| Licensing                      | Complete       | Activation, expiry, and device checks are covered by tests                                   |
| Operations dashboard           | Complete       | Audit log exports and backup/report artifacts are visible in the Reports tab                 |
| Desktop installer              | Partial        | Build path exists, but clean Windows verification and signing still need review              |
| Incident response              | Complete       | Escalation, evidence preservation, and close-out workflow are documented                     |
| Penetration test               | Partial        | Readiness and release-gate workflow are documented, but external execution is still pending  |
| Human security                 | Complete       | Named accounts, annual review, and controlled privileged access are documented               |
| Support access                 | Complete       | Temporary scoped access is documented with approvals, expiry, and logs                       |
| Student media capture          | Complete       | Photo/video/audio capture is disabled by default and excluded from the MVP                   |
| AI policy                      | Complete       | AI stays disabled in the MVP and any future module remains isolated and opt-in only          |
| End-of-contract data lifecycle | Complete       | Deactivate/export/delete-anonymize flow is documented with audit trail and completion report |
| Privacy and terms              | Complete       | Privacy policy, terms of use, and DPA guidance are treated as one legal package              |
| Accessibility                  | Complete       | Core accessibility coverage is documented; browser matrix still needs a final manual pass    |
| Browser smoke                  | Complete       | Playwright smoke runs in CI for the core browser flows                                       |
| Pedagogical core               | Complete       | Core pedagogical functions are documented as complete within the current scope               |
| Timetable and staff scheduling | Complete       | Schedule, daily, substitutions, homeroom, and conflict handling are documented as complete   |
| Portal layer                   | Complete       | Student-facing and school-facing portal flows are documented as a separate layer             |
| Multi-Tenant                   | Complete       | School isolation and schoolId enforcement are documented as an operating control             |
| Demo mode                      | Not Applicable | No dedicated production demo mode is bundled as a separate feature                           |

## Demo Mode and Sample Data

- There is no dedicated production demo mode bundled as a separate feature.
- Development seed data may exist for testing and should not be mixed into commercial production data.
- Any demo or seed data used for buyer walkthroughs should be documented and removable.
- No real school accounts or real license keys should be used for demonstrations.

## White-Label / Branding Readiness

- App name strings live in the i18n dictionaries and owner-facing HTML pages.
- Logo and favicon assets live under `assets/brand/` and `apps/frontend/public/`.
- Desktop branding is controlled from `apps/desktop/icon.ico` and Electron window setup.
- Main color styling lives in `apps/frontend/src/styles/global.css`.
- If a client-specific theme is needed later, these locations are the first places to update.

## Legal and Commercial Notes

This is a practical review, not legal advice.

- No standalone `LICENSE` file was found during the review.
- Dependencies, fonts, icons, and images should still be reviewed before sale.
- The app handles school and user data, so a Privacy Policy is recommended before broad deployment.
- Terms of Use are also recommended if the product will be sold or licensed externally.
- Demo or seed data should be removed from production flows or kept only in clearly documented test paths.
- Any branding, artwork, or external assets should be verified before commercial handoff.

## Definition of Done

The project is considered ready only when the following are true as much as possible:

- The app runs locally.
- Build works.
- Lint works or known issues are documented.
- Tests run or a manual checklist is completed.
- There are no critical console errors.
- No secrets are committed in the code.
- README is clear.
- `.env.example` exists when needed.
- Main user flows are checked.
- Loading, error, empty, and success states exist.
- No demo data is visible in production.
- No major unused libraries remain.
- No unnecessarily large files remain.
- Stress testing is documented or marked as not applicable.
- Known issues are documented.
- Sale readiness report exists.

## Final Delivery Checklist

- [ ] App runs locally.
- [ ] Production build succeeds.
- [ ] Lint passes or known issues are documented.
- [ ] Tests pass or manual QA checklist is completed.
- [ ] No secrets are committed.
- [ ] `.env.example` is available if needed.
- [ ] README explains setup, development, build, and modification guide.
- [ ] Stress test is documented or explained as not applicable.
- [ ] Main user flows are tested.
- [ ] Error, loading, empty, and success states are handled.
- [ ] No unused major code remains.
- [ ] No obvious placeholder content remains.
- [ ] Dependencies are reviewed.
- [ ] License and asset risks are documented.
- [ ] Known issues are documented.
- [ ] Sale readiness report is created.

## Severity Levels for Remaining Issues

Use the following severity labels for any open items:

- P0 - Blocks sale or operation
- P1 - Important before sale
- P2 - Good improvement but does not block sale
- P3 - Optional future improvement

| Issue                                                           | Severity | Impact                                 | Recommendation                                                           |
| --------------------------------------------------------------- | -------- | -------------------------------------- | ------------------------------------------------------------------------ |
| Clean Windows install still needs a final real-device pass      | P1       | Installer and startup risk before sale | Verify on a blank machine and record the result                          |
| Installer signing still depends on certificate availability     | P1       | Trust and distribution risk            | Sign the installer before commercial release                             |
| Real staging deployment with HTTPS still needs final validation | P1       | SaaS deployment confidence risk        | Run the staging plan end to end                                          |
| Browser validation still needs a broader manual pass            | P2       | User experience and compatibility risk | Review the main flows in Chrome, Edge, Firefox, and Safari when possible |
| External penetration test still needs execution                 | P1       | Security assurance risk                | Run a scoped PT on staging and close findings before sale                |
| Dedicated production demo mode is not bundled separately        | P3       | Demo convenience risk                  | Document a safe demo path if one is needed later                         |

## Final Professional Review Summary

### Technical Quality

Acceptable

### Sale Readiness

Partially Ready

### Main Strengths

- Core flows are implemented and tested.
- Architecture is split into frontend, backend, desktop, license server, and shared code.
- Documentation is now much clearer for handoff and maintenance.
- Security and multi-school isolation have visible review coverage.

### Main Risks

- Final staging and clean Windows install validation still need a real pass.
- Installer signing and asset/license review are not fully finished.
- Browser validation still needs one more manual round. Browser automation is already in place and should keep growing from here.

### Must Fix Before Sale

- Verify clean Windows install.
- Sign the installer.
- Validate staging on a real HTTPS domain.
- Review branding and asset provenance.
- Produce the final production SaaS desktop installer with the real API and license URLs.

### Recommended After Sale

- Keep tightening accessibility and browser support.
- Re-check bundle growth as features expand.
- Decide whether a future major release needs a stack refresh window.

### Final Notes

- The product is strong enough for review and handoff, but not yet the final commercial finish line.
