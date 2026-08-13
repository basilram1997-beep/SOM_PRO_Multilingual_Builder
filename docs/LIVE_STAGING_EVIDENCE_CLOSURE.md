# Live Staging Evidence Closure Checklist

Review date: 2026-08-13

Purpose: close the gap between controls that exist in the repository and evidence that proves those controls ran successfully on a real staging environment.

Execution runbook: use `docs/LIVE_STAGING_EXECUTION_RUNBOOK.md` for the operator sequence, secret-handling rules, failure handling, and final sign-off table.

## Closure Rule

Do not claim Ministry/security readiness until every `Required for Ministry attachment` item below has a dated artifact, owner, and pass/fail status.

## Status Board

| Category | Evidence ID | Status | Required action | Archive location |
| --- | --- | --- | --- | --- |
| Ready in repo | LSE-001 | Ready | Route inventory generator and report contract exist. | `docs/API_ROUTE_INVENTORY.md`, `reports/security/api-route-inventory.json` |
| Ready in repo | LSE-002 | Ready | Release artifacts scripts exist for SBOM, SAST, dependency audit, and license report. | `reports/security/sbom.cyclonedx.json`, `reports/security/sast-baseline.json`, `reports/security/npm-audit.json`, `reports/security/license-report.json` |
| Ready in repo | LSE-003 | Ready | Staging evidence pack generator exists. | `scripts/runtime/staging-evidence-pack.js`, `docs/STAGING_EVIDENCE_PACK.md` |
| Ready in repo | LSE-004 | Ready | DAST/ZAP gates exist and reject unsafe staging targets. | `scripts/runtime/dast-baseline.js`, `scripts/runtime/zap-baseline.js` |
| Ready in repo | LSE-005 | Ready | External pentest handoff and sign-off templates exist. | `docs/EXTERNAL_PENTEST_HANDOFF_PACK.md`, `docs/EXTERNAL_PENTEST_SIGNOFF_TEMPLATE.md` |
| Must run on staging | LSE-101 | Pending live run | Configure a real `STAGING_URL=https://...` that is not localhost, IP-only, or placeholder. | `docs/PHASE_10_STAGING_VERIFICATION_REPORT.md` |
| Must run on staging | LSE-102 | Pending live run | Run live ZAP/DAST against the real staging URL. | `reports/security/dast-baseline.json`, `reports/security/dast-zap-raw.json`, `reports/security/zap-baseline-report.html` |
| Must run on staging | LSE-103 | Pending live run | Run strict staging evidence pack after DAST artifacts exist. | `reports/security/staging-evidence-pack.json`, `reports/security/staging-evidence-pack.md` |
| Must run on staging | LSE-104 | Pending live run | Run strict live DB guardrails after `prisma migrate deploy`. | `reports/security/staging-evidence-pack.json`, `reports/security/staging-evidence-pack.md` |
| Must run on staging | LSE-105 | Pending live run | Capture TLS certificate, HTTP-to-HTTPS redirect, HSTS, and `/health` response evidence. | `docs/PHASE_10_STAGING_VERIFICATION_REPORT.md`, `reports/security/staging-evidence-pack.md` |
| Required for Ministry attachment | LSE-201 | Pending attachment | Attach ZAP HTML/JSON reports with no high/critical findings. | `reports/security/zap-baseline-report.html`, `reports/security/dast-baseline.json` |
| Required for Ministry attachment | LSE-202 | Pending attachment | Attach strict staging evidence pack with no pending/failed checks. | `reports/security/staging-evidence-pack.json`, `reports/security/staging-evidence-pack.md` |
| Required for Ministry attachment | LSE-203 | Pending attachment | Attach DB guardrail proof: audit update/delete blocked and restrict FKs verified. | `reports/security/staging-evidence-pack.json` |
| Required for Ministry attachment | LSE-204 | Pending attachment | Attach release security artifacts: SBOM, SAST, dependency audit, and license report. | `reports/security/` |
| Required for Ministry attachment | LSE-205 | Pending attachment | Attach external pentest sign-off and retest status. | `docs/EXTERNAL_PENTEST_SIGNOFF_TEMPLATE.md` or signed external report artifact |

## Execution Commands

Run from the repository root after staging deployment and migration deployment.

```bash
STAGING_URL=https://staging-api.example.gov.il ZAP_USE_DOCKER=true npm run security:dast
```

```bash
STAGING_URL=https://staging-api.example.gov.il STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
```

```bash
STAGING_URL=https://staging-api.example.gov.il STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
```

```bash
npm run security:pentest:prep
```

## Evidence Acceptance Criteria

| Evidence ID | Pass criteria |
| --- | --- |
| LSE-101 | `STAGING_URL` is `https://`, externally reachable, not placeholder/local, and points to staging only. |
| LSE-102 | `reports/security/dast-baseline.json` has `status: "passed"` and `zap-baseline-report.html` is archived. |
| LSE-103 | Strict staging evidence exits with code `0` and has no failed checks. |
| LSE-104 | Live DB mode verifies the audit mutation probe blocks update/delete and FK delete rules are `RESTRICT`. |
| LSE-105 | TLS certificate/redirect/HSTS/health evidence is dated and tied to the same staging URL. |
| LSE-201 | ZAP finding review confirms no unresolved high/critical findings. |
| LSE-202 | Staging evidence JSON/Markdown are attached to the Ministry evidence package. |
| LSE-203 | DB guardrail evidence is tied to the deployed migration version. |
| LSE-204 | SBOM/SAST/audit/license artifacts are generated from the release candidate. |
| LSE-205 | External tester sign-off records severity, owner, remediation evidence, and retest status. |

## Ministry Package Index

Use this final package layout when sending evidence for review:

| Evidence ID | File |
| --- | --- |
| LSE-101 | `docs/PHASE_10_STAGING_VERIFICATION_REPORT.md` |
| LSE-102 | `reports/security/dast-baseline.json`, `reports/security/zap-baseline-report.html` |
| LSE-103 | `reports/security/staging-evidence-pack.json`, `reports/security/staging-evidence-pack.md` |
| LSE-104 | `reports/security/staging-evidence-pack.json` |
| LSE-201 | `reports/security/dast-baseline.json`, `reports/security/dast-zap-raw.json`, `reports/security/zap-baseline-report.html` |
| LSE-202 | `reports/security/staging-evidence-pack.json`, `reports/security/staging-evidence-pack.md` |
| LSE-203 | `reports/security/staging-evidence-pack.json` |
| LSE-204 | `reports/security/sbom.cyclonedx.json`, `reports/security/sast-baseline.json`, `reports/security/npm-audit.json`, `reports/security/license-report.json`, `reports/security/license-report.md` |
| LSE-205 | Signed external penetration test report and `docs/EXTERNAL_PENTEST_SIGNOFF_TEMPLATE.md` |

## Owner Handoff

- DevOps owns `LSE-101` through `LSE-105`.
- Security/release owner reviews `LSE-201` through `LSE-204`.
- Product/security owner and external tester jointly own `LSE-205`.
- Any failed or pending item must be copied back into `docs/MINISTRY_COMPLIANCE_MATRIX.md` before a Ministry/security readiness claim.
