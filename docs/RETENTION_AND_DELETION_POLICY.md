# Retention and Deletion Policy

This document defines the default retention and deletion posture for SOM PRO.
It should be adapted to each school or authority agreement before formal deployment.

## Principles

- Keep only what is needed for the educational purpose.
- Prefer school-scoped retention rules.
- Separate operational artifacts from core school records when possible.
- Log export and deletion actions.
- Use anonymization when policy allows it and hard deletion is not required.

## Data classes

### Core school records

- Attendance.
- Grades.
- Student and teacher profiles.
- Classes and schedules.
- Certificates and reports.

Retention:

- Kept according to the school or authority retention policy.
- Deleted only when the contract, law, or approved workflow allows it.

### Operational artifacts

- Export files.
- Backup files.
- Temporary report outputs.
- Generated previews.

Retention:

- Kept for the shortest practical period.
- Must have an explicit expiry or review date.
- Must not remain public.

### Audit and decision records

- Audit logs.
- Security events.
- Deployment decisions.
- Review approvals.

Retention:

- Kept for the period required by the school, authority, contract, or law.
- Must remain readable and traceable.

## Deletion rules

- Deletion requests must be explicit, logged, school-scoped, and authorized.
- Bulk deletion must require authorization.
- Data must not be deleted across schools.
- A deletion should fail closed if authorization is missing.
- If anonymization is permitted, it must preserve operational integrity while removing personal identifiers.

## Export rules

- Exported files must include a retention or expiry rule.
- Export links must not be public by default.
- Export requests must be auditable.

## Review owner

- Vendor security owner.
- School or authority contact.
