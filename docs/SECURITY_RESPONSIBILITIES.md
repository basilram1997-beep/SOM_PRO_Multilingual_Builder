# Security Responsibilities

## Purpose

This document describes who is responsible for security, privacy, and compliance tasks in SOM PRO deployments.

## Suggested roles

### Vendor security owner

Responsibilities:

- Review security changes before release.
- Approve sensitive configuration changes.
- Review incidents and audit logs.
- Maintain the security checklist.
- Validate third-party integrations before enablement.

### School / authority security contact

Responsibilities:

- Approve data retention and deletion policy.
- Approve third-party communication channels.
- Review access changes for staff accounts.
- Decide who may export sensitive data.
- Request incident review when needed.

### System administrator

Responsibilities:

- Manage accounts, roles, and MFA.
- Review denied access attempts.
- Review exports and backup jobs.
- Confirm that production settings match the approved deployment.

## Operational security governance

To keep compliance decisions from being informal, the following operational rules apply:

- The vendor security owner must review privacy-impacting changes before release.
- The school or authority contact must approve any change that affects export, retention, or third-party communication.
- Export warnings are mandatory for any file that contains personal or school data.
- Security-sensitive export formats must remain auditable, and the log entry must include who exported the file, when it was created, and when it expires.
- If a workflow can expose personal information, it must be treated as a security change and not just a UI change.
- Any exception to the output-warning rule must be documented and approved in writing.

## Incident handling

When a security incident occurs:

1. Preserve audit evidence.
2. Disable risky integrations if needed.
3. Review affected school scope.
4. Notify the designated owner.
5. Record the resolution and follow-up action.

## Compliance review

- Access control changes must be reviewed.
- Export and deletion workflows must be logged.
- Sensitive integrations must remain disabled unless approved.
- No claim of ISO27001 should appear unless the organization actually holds that certification.
- Security governance reviews should be recorded at least once per school or release cycle.

## Annual permissions review workflow

The annual review is a required operating workflow, not just a note:

1. Export the current role and user matrix per school.
2. Review the effective permissions actually used by each role.
3. Verify least-privilege access for school, class, subject, and operation scope.
4. Record any changes in the Audit Log.
5. Approve the review by the vendor security owner or the school / authority contact.
6. Store the review date in the permission review record.

This workflow should be completed at least once per school per year, or sooner if the school changes staff, roles, or sensitive integrations.
