# Security Testing and SSDLC

This document defines the minimum security testing posture for SOM PRO before production or sale.

## Goals

- Catch critical and high-risk security issues before release.
- Keep the security workflow repeatable.
- Separate local demo checks from real staging checks.
- Make security review part of normal release work.

## Minimum security review stack

- Dependency scan.
- Secrets scan.
- Static analysis / SAST.
- Manual code review for sensitive paths.
- Browser smoke checks on staging.
- Limited DAST against a non-production environment.
- A qualified external penetration test before commercial release or shortly after a major release, depending on the deployment agreement.

## Canonical scripts

- `npm run security:baseline`
- `npm run security:review`
- `npm run security:sast`
- `npm run security:dast`
- `npm run security:sbom`
- `npm run security:licenses`
- `npm run security:release-evidence`
- `npm run security:pentest:prep`
- `npm run compliance:test`
- `npm run destructive:test`

## What each step checks

### `security:baseline`

- Secret leakage in the repository.
- Vulnerabilities reported by `npm audit --omit=dev`.
- CycloneDX SBOM generation under `reports/security/sbom.cyclonedx.json`.
- Dependency license report generation under `reports/security/license-report.json` and `reports/security/license-report.md`.

### `security:sast`

- Runs the local SAST baseline and writes `reports/security/sast-baseline.json`.
- Requires the CI workflow to include CodeQL for `javascript-typescript`.
- Runs ESLint as part of the local baseline.
- Fails on high-confidence critical/high patterns such as disabled TLS validation, `eval`, and dynamic function construction.

### `security:dast`

- Requires `STAGING_URL=https://...`.
- Rejects localhost and placeholder staging targets.
- Verifies HTTP-to-HTTPS redirect.
- Verifies HSTS on the HTTPS response.
- Verifies the staging health endpoint.
- Writes `reports/security/dast-baseline.json`.

### `security:release-evidence`

- Runs secrets, dependency audit, SBOM, license report, and SAST baseline.
- Produces reviewable artifacts under `reports/security/`.
- Does not replace live DAST; run `npm run security:dast` after `STAGING_URL` points to a real HTTPS staging host.

### `compliance:test`

- Commercial compliance readiness.
- GDPR / HIPAA / PCI-DSS control mapping.
- Masked staging and retention controls.
- Audit and export policy coverage.

### `destructive:test`

- Invalid and boundary input rejection.
- Confirmation-gated delete and anonymize flows.
- School-scoped cleanup behavior.
- Permission and request-protection boundaries.

## Penetration test readiness

The product is prepared for a real penetration test with these expectations:

- Scope is defined before the test starts.
- Staging data is fake or masked.
- The tester receives only the access required for the agreed scope.
- Findings are recorded with severity and reproduction notes.
- Critical and high findings block release until fixed or formally accepted.

### Handoff command

Run `npm run security:pentest:prep` before handing the environment to an external tester.
It checks that the handoff documents exist and prints the minimum checklist for a staging engagement.

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
- SBOM and dependency license report are attached to the release pack.
- DAST was run on real HTTPS staging with `STAGING_URL` or documented as pending with owner/date.
- New secrets were not committed.
- Penetration testing has been completed, or is formally scheduled with scope, owner, and re-test plan.
