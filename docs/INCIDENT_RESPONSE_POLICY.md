# Incident Response Policy

This document defines the minimum response path for suspected security incidents in SOM PRO.

## Objectives

- Preserve evidence.
- Limit damage quickly.
- Notify the correct owner.
- Record the incident in the audit trail.
- Keep the review school-scoped.
- Keep the process simple enough that an administrator can use it under pressure.
- Make the workflow auditable end to end.

## Recommended response flow

1. Flag the suspected incident in the admin security panel.
2. Record the detection time, affected systems, affected data, and suspected attack path.
3. Preserve logs and exports needed for investigation.
4. Notify the vendor security owner and the school security contact.
5. Review whether integrations should be disabled temporarily.
6. Confirm containment and recovery steps.
7. Close the incident only after follow-up actions are documented.
8. Export the incident record for internal review or regulator handoff if needed.
9. Keep the response timeline in the incident record and in the audit trail.

## Timing guidance

- Report fast when possible.
- Target the first internal notice within 8 hours.
- Treat 12 hours as the outer practical limit for the classes of incidents covered by the policy.
- Escalate immediately if the incident touches authentication, exports, cross-school access, or leaked personal data.

## Minimum incident fields

- Title.
- Summary.
- Severity.
- Detected at.
- Reported at.
- Systems affected.
- Data affected.
- Attack vector.
- Observed weaknesses.
- Current status.
- Reporting user.

## Logging requirements

- Create an immutable audit record for incident creation.
- Log every status update.
- Keep the investigation trail in the audit log and incident record.
- Do not log passwords, tokens, or other secrets.
- Keep the incident record separate from general support tickets so the security trail does not get lost.
- Preserve old values when a record is amended so reviewers can see what changed and when.

## Operating checklist

- [ ] Incident button exists in the admin security area.
- [ ] Suspected incident can be flagged by an authorized user.
- [ ] School scope is attached to every incident.
- [ ] Incident timeline is visible to the security owner.
- [ ] Audit trail is retained.
- [ ] Close-out note is required before resolution.

## Notification guidance

- Notify the designated security owner.
- Notify the school contact when the scope affects a specific school.
- Use generic notification text outside the secure portal.
- Keep the detailed evidence inside the authenticated admin area.
