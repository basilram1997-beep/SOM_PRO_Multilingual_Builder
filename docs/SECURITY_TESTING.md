# Security Testing and SSDLC

This document describes the minimum security testing posture for SOM PRO before production or sale.

## Goals

- Catch critical and high-risk security issues before release.
- Keep the security workflow repeatable.
- Separate local demo checks from real staging checks.
- Make security review part of normal release work.

## Minimum security review stack

- Dependency scan.
- Static analysis / SAST.
- Manual code review for sensitive paths.
- Browser smoke checks on staging.
- Limited DAST against a non-production environment.
- A qualified external penetration test before commercial release or shortly after a major release, depending on the deployment agreement.
- OWASP Top 10 coverage mapped in `docs/OWASP_TOP_10_AR.md`.

## Suggested repository scripts

- `npm run security:deps`
- `npm run security:sast`
- `npm run security:dast`
- `npm run security:review`

## What each step checks

### Dependency scan

- Vulnerable packages.
- Outdated packages that need human review.
- Known license concerns for sale.

### SAST

- Unsafe string handling.
- Authorization gaps.
- Logging of secrets.
- Dangerous direct object access.
- Weak input validation.

### DAST

- Login and logout flow.
- Permission boundaries.
- Rate limiting.
- Export routes.
- Sensitive write routes.

## Penetration test readiness

The product is prepared for a real penetration test with these expectations:

- Scope is defined before the test starts.
- Staging data is fake or masked.
- The tester receives only the access required for the agreed scope.
- Findings are recorded with severity and reproduction notes.
- Critical and high findings block release until fixed or formally accepted.

## Recommended PT deliverables

- Scope statement.
- Test window.
- Findings list with severity.
- Proof of exploit or reproduction notes.
- Remediation plan.
- Re-test confirmation.
- Sign-off record.

## SSDLC expectations

- Every sensitive change should have a review note.
- Do not merge a security-sensitive change without a manual sanity check.
- Keep security requirements documented in the repo.
- Keep audit logging and permission checks aligned with backend routes.
- Keep OWASP mapping and test coverage aligned with the current product scope.

## Release gate

Before release, confirm:

- Build succeeds.
- Tests pass or the gap is documented.
- SAST and dependency scan have been reviewed.
- DAST was run on staging or documented as pending.
- New secrets were not committed.
- Penetration testing has been completed, or is formally scheduled with scope, owner, and re-test plan.
