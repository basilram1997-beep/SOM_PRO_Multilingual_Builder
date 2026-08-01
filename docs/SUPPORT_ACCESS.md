# Support Access

## Purpose

Support access must help operators solve issues without exposing school data broadly.

## Rules

- Support access must be role-based.
- Temporary support access should expire automatically.
- Any access to school data by support staff must be logged.
- The support flow should require a reason field.
- Support access should be granted only for the smallest necessary scope.
- Support access should be activated from a controlled admin/support panel, not by ad-hoc database edits.
- Expiry must be visible to the operator and the reviewer.
- Support access should be re-approved whenever the scope changes.
- Support access should not be used to bypass normal role restrictions.

## Recommended audit fields

- support_user_id
- school_id
- reason
- granted_at
- expires_at
- approved_by
- action_taken

## Operational guidance

- Do not use shared support accounts.
- Do not keep support access active longer than needed.
- Review support access logs during incident follow-up.
- Keep an approval record for every grant, extension, and revocation.
