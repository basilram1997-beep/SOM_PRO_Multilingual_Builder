# Security Updates and Hardening

## Purpose

This document records the ongoing security maintenance expectations for SOM PRO.

## Dependency scanning

- Run `npm audit --omit=dev` regularly.
- Run `npm outdated` before commercial releases and after dependency changes.
- Review any package update that affects authentication, routing, Prisma, PDF generation, export handling, or desktop packaging.
- Keep a scheduled CI release gate enabled so the same checks repeat automatically on a fixed cadence.
- Treat `npm ci` on a clean checkout and the committed `package-lock.json` as the only supported source for release builds.

## Supported versions

- Use only supported and maintained runtime versions.
- Avoid deprecated libraries when a supported alternative exists.
- Do not upgrade major dependencies without a focused test pass.

## Container and host hardening

- Keep production hosts behind a firewall.
- Use MFA for administrative access.
- Keep secrets out of source control.
- Run services with the minimum required ports and privileges.
- Keep audit logging enabled.
- Treat infrastructure changes as security changes and review them before release.
- Keep the deployment assumptions aligned with `HOSTING_REQUIREMENTS.md`, `INFRASTRUCTURE_HARDENING.md`, and `SECURITY_REQUIREMENTS.md`.
- Hardening is a baseline operating requirement, not an optional post-release checklist.
- Review WAF, IDS/IPS, network isolation, and backup protections as part of every release review.

## File upload hardening

- The current product intentionally does not expose a general school-data upload workflow.
- Future upload flows must fail closed when scanning is unavailable.
- Any future upload enablement must first pass the scanning policy in `FILE_UPLOAD_SCANNING_POLICY.md`.

## MFA readiness

- MFA is now a defined operating capability, not just a future idea.
- Admin accounts are prepared for MFA.
- School settings can carry an `adminMfaRequired` flag.
- User accounts can carry MFA method and encrypted secret fields.
- MFA rollout remains school-scoped and policy-driven.

## Future IDP / SSO support

- IDM / SSO is architecturally complete within the current product scope and isolated in `IDM_SESSION_AND_RBAC_AR.md`.
- The current local fallback remains available only as an allowed compatibility path.
- Do not weaken the current password-based flow while keeping SSO readiness in place.

## Least privilege

- Least privilege is a release rule, not just a design note.
- Keep the enforcement in backend authorization and school-scoped queries.
- Re-check any new endpoint against school, class, subject, and role boundaries before release.

## ISO27001 readiness

- Use `ISO27001_READINESS.md` as the control mapping document.
- Do not claim ISO27001 certification unless the organization actually holds it.
- Keep evidence for access control, logging, backup, incident response, and change management in the docs set.
