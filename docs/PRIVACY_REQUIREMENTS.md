# Privacy Requirements

## Data ownership statement

All data created, uploaded, entered, or stored through SOM PRO on behalf of a school, authority, or educational organization is owned by that school or authority, not by the vendor.

The vendor may only process that data for the contracted educational purpose and according to the agreed deployment, retention, deletion, and export rules.

This ownership rule is a product-level requirement, not just a note in documentation. Any implementation, UI text, export workflow, retention rule, or support action must follow it.

The vendor must not:

- Sell the data.
- Reuse the data for marketing.
- Train AI models on the data without written authorization.
- Share the data with third parties by default.
- Keep the data after contract end unless a legal or contractual basis requires retention.

Operational rule:

- The product must never present vendor ownership over school data.
- Any future admin, support, or export screen must keep the school as the data owner and the vendor as the processor/service provider.
- Any new workflow that stores, exports, or deletes school data must preserve this ownership boundary.

## Export and deletion workflow

The backend already includes school-level operational workflows for:

- `exportSchoolData(school_id)`
- `deleteSchoolData(school_id)`

These workflows must remain school-scoped and auditable.

### Export

- Export must be permission-protected.
- Export must be logged.
- Exported files must have a defined retention window.
- Export files must not be public.
- Export must warn the requester about sensitive content.

### Deletion

- Deletion must require explicit confirmation.
- Deletion must be logged.
- If policy requires it, anonymization may be used instead of hard deletion.
- Deletion must not break unrelated schools.

## Local storage rule

Sensitive school data must not be stored locally on the desktop device or in browser storage.
Only non-sensitive bootstrap or UI-preference data may remain local.

## Third-party rule

No external service may receive student data unless it is explicitly approved in configuration and documented in `THIRD_PARTY_SERVICES.md`.
The approved list is closed by default, and every new service must pass a data-minimization and privacy review before enablement.

Email providers are not approved as a school-data delivery channel by default.
If email is ever enabled for generic operational notices, it must never carry attendance, grades, behavior notes, certificates, exports, or any other personal school content.

## Student media capture rule

Photo, video, and audio recording of students are disabled by default and are not part of the current MVP.
If such a feature is ever approved later, it must require explicit approval, clear consent rules, and a retention/deletion policy before enablement.
