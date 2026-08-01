# ISO27001 Readiness

## Purpose

This document records how SOM PRO maps to ISO27001-style operational expectations without claiming certification.

## Scope

This project does not claim ISO27001 certification in the product, UI, or marketing.
It does, however, keep the operational evidence needed for a future review:

- Security responsibilities are assigned in `SECURITY_RESPONSIBILITIES.md`.
- Hosting, isolation, encryption, and hardening assumptions are recorded in `HOSTING_REQUIREMENTS.md` and `SECURITY_REQUIREMENTS.md`.
- Access control and least-privilege expectations are documented in `IDM_SESSION_AND_RBAC_AR.md` and `ROLE_ACCESS_MATRIX_AR.md`.
- Incident handling and support access are documented in `INCIDENT_RESPONSE_POLICY.md` and `SUPPORT_ACCESS.md`.
- Backup, restore, and continuity are documented in `BACKUP_RESTORE_RUNBOOK_AR.md`, `BACKUP_RESTORE_SECURITY_AR.md`, and `BUSINESS_CONTINUITY.md`.
- Logging and monitoring expectations are documented in `MONITORING_AND_HEALTHCHECKS_AR.md` and `SIEM_LOG_EXPORT_FORMAT.md`.
- Security testing expectations are documented in `SECURITY_TESTING.md` and `OWASP_CHECKLIST_AR.md`.

## Operational control areas

For a future formal review, the project already has documented coverage for:

- Access control.
- Logging and auditability.
- Backup and restore.
- Incident response.
- Data protection and retention.
- Dependency and release review.
- Third-party and export governance.

## Non-claim rule

- Do not state that the product or vendor is ISO27001 certified unless the organization actually holds that certificate.
- Do not infer certification from documentation alone.
- Use this document only as readiness evidence and control mapping.
