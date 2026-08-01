# SIEM Log Export Format

This project should be ready to export security and audit records in a structure that can later be consumed by a SIEM system.

## Recommended format

Use JSON Lines (`.jsonl`) with one event per line.

## Export interface

- Keep the export logic behind a small service interface so the backend can later send the same event stream to:
  - JSONL files
  - syslog
  - SIEM/SOAR collectors
- The first supported backend format is JSONL.
- Future exporters should reuse the same normalized security event shape and should not receive raw passwords, tokens, or student content.

## Minimum fields

```json
{
  "timestamp": "2026-07-18T10:00:00.000Z",
  "schoolId": "school_123",
  "userId": "user_123",
  "action": "ATTENDANCE_UPDATE",
  "entity": "StudentAttendance",
  "entityId": "attendance_123",
  "path": "/api/students/attendance",
  "method": "PUT",
  "accessResult": "ALLOWED",
  "statusCode": 200,
  "ipAddress": "redacted-or-encoded",
  "userAgent": "redacted-or-encoded"
}
```

## Rules

- Do not export passwords, tokens, license secrets, or student content.
- Redact personal values not needed for security review.
- Keep timestamps in UTC.
- Keep school scope explicit.
- Include denied access attempts and rate-limit blocks.
- Keep audit exports append-only in practice: do not provide an API that edits or deletes historical security events.
- Keep the admin export path visible inside the reports / operations area so the operator can review records before sending them to SIEM.
- Do not allow direct public access to the export stream; every export must be authenticated and logged.

## Future use

- This format can later feed a SIEM, audit portal, or incident review tool.
- The export should remain authenticated and logged.
