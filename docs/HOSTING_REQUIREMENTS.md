# Hosting Requirements

## Purpose

This document records the hosting assumptions SOM PRO should meet for regulated school deployments.

## Hosting location

- Production and Ministry-facing staging should use Israel region infrastructure unless a written legal/compliance approval says otherwise.
- The deployment should be designed so that sensitive school data can remain inside the required jurisdiction.
- The chosen region must be documented per deployment, and the production environment must not silently fall back to an unapproved region.
- Provider selection and evidence requirements are tracked in `docs/HOSTING_PROVIDER_DECISION.md`.

## Network isolation

- Use VPC or equivalent private network isolation.
- Separate application, database, and file storage paths where possible.
- Keep administrative interfaces off public exposure unless explicitly required and protected.

## Tenant isolation

- Tenants must be isolated at application and database level.
- Every core school record must remain scoped by `school_id`.
- Cross-school access must be blocked by backend authorization.
- Shared caches, queues, or exports must also preserve school scope.
- Tenant isolation must be validated in backend tests, not only by UI filtering.

## Security controls

- Encryption in transit: HTTPS with TLS 1.2 minimum, TLS 1.3 preferred.
- Encryption at rest: databases, backups, and exported files must be protected.
- IAM: least privilege for operators and service accounts.
- WAF: protect public web entry points when deployed publicly.
- Firewall: restrict ports and expose only required services.
- IDS/IPS: monitor suspicious network activity where available.
- DDoS readiness: use provider-level protections when the service is public.
- Availability zone or equivalent high-availability planning must be documented when the chosen deployment environment supports it.

## Operational notes

- Keep secrets out of source control.
- Do not depend on local desktop storage for real school data.
- Document the chosen region and production environment during deployment handoff.
- Any change to region, tenant layout, or availability design should be recorded as an operational change and reviewed before release.
