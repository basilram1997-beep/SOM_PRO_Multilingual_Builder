# Security Requirements

## Infrastructure assumptions

- Firewalls and hardened network boundaries are required in production.
- Administrative access must use MFA.
- School data must stay in the central backend and PostgreSQL, not in local desktop storage.
- Sensitive routes must keep request protection, rate limiting, audit logging, and permission checks.
- Browser and desktop clients must not be treated as trusted storage.

## Transport and storage requirements

- Production traffic must use HTTPS with TLS 1.2 minimum and TLS 1.3 preferred.
- HSTS must be enabled in production.
- Backups and exports must be protected at rest.
- Encryption keys must never be hardcoded in source code.
- Development databases must not be copied from production without masking or anonymization.

## Production database cloning rule

- Any workflow that moves database content from production into a non-production environment must fail closed unless the copy is explicitly anonymized or masked first.
- Direct cloning of production backups into development or local environments is prohibited.
- Restore tooling must refuse production-origin data unless a sanitized flag, approval record, or masking step is present.
- Any approved exception must be logged with the requestor, target environment, source environment, and sanitization method.

## Portable device rule

- Protected school data must not be transferred through USB, external drives, or portable media as a normal workflow.
- If a transfer is ever approved, it must go through a controlled and logged process.
- Official import/export paths must be authenticated and audited.

## Email rule

- Email is not an approved transport channel for school data.
- Sensitive school data, attendance, grades, behavior notes, certificates, and archives must not be sent by email attachments or embedded in email bodies.
- Email may be used only for generic operational notices with no student or school content, and only if the school explicitly enables that workflow.
- Any future email integration must avoid full student records unless the school has explicitly approved the exact payload in writing.

## Output warning rule

Any exported PDF, HTML, or Excel file that contains personal or school data must include a visible warning in the file header or footer:

- Arabic:
  - `يحتوي على معلومات شخصية وفق قانون حماية الخصوصية؛ تسليمه أو كشفه دون صلاحية قد يشكل مخالفة.`
- English:
  - `This export contains personal information and is protected by privacy law. Unauthorized disclosure may be a violation.`
- Hebrew:
  - `הקובץ מכיל מידע אישי לפי חוק הגנת הפרטיות. מסירה או חשיפה ללא הרשאה עלולה להוות עבירה.`

## Third-party integration rule

- Third-party integrations are disabled by default.
- External services may not receive student data unless they are explicitly listed and approved.
- The approved service list is closed by default and must not expand without a documented privacy review.
- Error reporting must redact student names, grades, phone numbers, tokens, and license secrets.

## File upload rule

- The product currently does not expose a general file upload feature for school data.
- If a future upload feature is added, it must include:
  - malware scanning,
  - file type validation,
  - file size limits,
  - safe storage,
  - audit logging.

## SOC / SIEM readiness notes

- Audit logs are treated as a production control, not a debug trace.
- Audit logs must remain structured, append-only in practice, and exportable as JSON Lines.
- The operational export path should stay available from the admin reports area so security staff can review records without direct database access.
- Security events should keep:
  - timestamp,
  - action,
  - entity,
  - schoolId,
  - userId,
  - access result,
  - path,
  - method.
- Failed access attempts, rate-limit events, and multipart rejections should remain logged.

## OWASP / SSDLC notes

- The product should keep a current OWASP Top 10 mapping in `docs/OWASP_TOP_10_AR.md`.
- SAST, DAST, dependency scans, and manual code review are treated as one release-gate workflow rather than isolated checks.
- Any new sensitive endpoint or data path must be reviewed against the OWASP mapping before release.
- If a control changes materially, the OWASP mapping must be updated in the same release cycle.

## Hardening checklist

- [ ] MFA for administrative users.
- [ ] Rate limiting on login and sensitive operations.
- [ ] Audit logging for create, update, delete, deny, export, and permission changes.
- [ ] Redaction of sensitive values from logs.
- [ ] No sensitive browser storage.
- [ ] No sensitive desktop-local storage.
- [ ] No default third-party data sharing.
- [ ] Secure export warning in every personal-data file.
- [ ] File upload scanning design before any future upload feature.
- [ ] Backup and restore runbook documented and tested.
