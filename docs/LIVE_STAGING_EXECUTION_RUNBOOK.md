# Live Staging Execution Runbook

Review date: 2026-08-13

Purpose: provide the operator sequence for turning repository evidence into dated live staging evidence. This runbook does not store secrets and does not close any evidence item by itself.

## Required Inputs

| Input | Requirement | Handling rule |
| --- | --- | --- |
| `STAGING_URL` | Real `https://` staging URL, not localhost, IP-only, or placeholder. | Pass through the shell/CI secret store only. |
| `DATABASE_URL` | Staging database URL after `prisma migrate deploy`. | Pass through a secret manager or CI secret only; never commit it. |
| ZAP runtime | Docker with `ZAP_USE_DOCKER=true` or local `zap-baseline.py`. | Prefer Docker for repeatable evidence. |
| Archive location | Controlled release evidence location. | Keep generated reports under `reports/security/` and final bundle under `reports/ministry-review/`. |
| External tester contact | Approved test window and escalation contact. | Keep signed report/sign-off outside source code if it contains sensitive evidence. |

## Pre-Flight

1. Confirm staging is isolated from production and uses fake or masked data.
2. Confirm `prisma migrate deploy` has completed on staging.
3. Confirm privileged test accounts have MFA enabled.
4. Confirm backup encryption secret is configured through `SOM_BACKUP_PASSPHRASE` or `SOM_BACKUP_PASSPHRASE_FILE`.
5. Confirm no secrets are written into `.env`, shell history, screenshots, reports, or commits.
6. Run local/static readiness checks:

```bash
npm run security:release-evidence
npm run security:pentest:prep
npm run ministry:review-pack
```

## Execution Order

Run these commands from the repository root.

### 1. Live DAST/ZAP

Closes `LSE-102` and supports `LSE-201`.

```bash
STAGING_URL=https://staging-api.example.gov.il ZAP_USE_DOCKER=true npm run security:dast
```

Expected artifacts:

- `reports/security/dast-baseline.json`
- `reports/security/dast-zap-raw.json`
- `reports/security/zap-baseline-report.html`

Pass criteria:

- `reports/security/dast-baseline.json` has `status: "passed"`.
- No unresolved High or Critical finding remains.
- The target recorded in the report matches the approved staging URL.

### 2. Strict Staging Evidence

Closes `LSE-103`, supports `LSE-202`, and verifies HTTPS/HSTS/health plus release artifacts.

```bash
STAGING_URL=https://staging-api.example.gov.il STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
```

Expected artifacts:

- `reports/security/staging-evidence-pack.json`
- `reports/security/staging-evidence-pack.md`

Pass criteria:

- Process exits `0`.
- No `failed` checks.
- No live staging checks remain `pending`.

### 3. Live DB Guardrails

Closes `LSE-104` and supports `LSE-203`.

```bash
STAGING_URL=https://staging-api.example.gov.il STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
```

Pass criteria:

- Migration `20260812143000_audit_append_only_and_lifecycle_evidence_guards` is applied.
- Direct `AuditLog` update/delete probes are blocked.
- `reports_exports_school_id_fkey` and `backup_jobs_school_id_fkey` report `RESTRICT`.
- The generated report does not print `DATABASE_URL` or backup passphrases.

### 4. External Pentest Handoff

Supports `LSE-205`.

```bash
npm run security:pentest:prep
```

Then provide:

- `docs/EXTERNAL_PENTEST_HANDOFF_PACK.md`
- `docs/EXTERNAL_PENTEST_SIGNOFF_TEMPLATE.md`
- ZAP/DAST reports.
- Route inventory.
- Staging evidence pack.
- SBOM/SAST/license/dependency artifacts.

### 5. Ministry Review Pack

Generate the review bundle after all evidence artifacts are present.

```bash
npm run ministry:review-pack
```

Expected artifacts:

- `reports/ministry-review/manifest.json`
- `reports/ministry-review/MINISTRY_REVIEW_PACK.md`

Before any submission claim, run strict mode:

```bash
MINISTRY_REVIEW_PACK_STRICT=true npm run ministry:review-pack
```

Pass criteria:

- Strict mode exits `0`.
- `submissionReady` is `true`.
- Categories `Pending live staging`, `Pending official Ministry source`, and `Pending external sign-off` are empty.

## Failure Handling

| Failure | Response |
| --- | --- |
| DAST/ZAP reports High/Critical | Stop release, file remediation item, rerun ZAP after fix. |
| Strict staging evidence has pending checks | Do not submit; close missing live URL, DB, DAST, or artifact prerequisite. |
| Live DB guardrail fails | Stop release, verify migration deploy and runtime DB role, then rerun. |
| Secrets appear in generated evidence | Treat as incident, rotate affected secret, purge artifact from handoff package, regenerate. |
| External sign-off is missing | Keep `Pending external sign-off` open in the Ministry review pack. |
| Official Ministry documents remain Missing | Do not claim formal Ministry compliance; keep official source category pending. |

## Archive Checklist

| Evidence ID | Artifact |
| --- | --- |
| LSE-102 | `reports/security/dast-baseline.json`, `reports/security/dast-zap-raw.json`, `reports/security/zap-baseline-report.html` |
| LSE-103 | `reports/security/staging-evidence-pack.json`, `reports/security/staging-evidence-pack.md` |
| LSE-104 | `reports/security/staging-evidence-pack.json` with live DB mode evidence |
| LSE-201 | Reviewed ZAP finding disposition |
| LSE-202 | Strict staging evidence JSON/Markdown |
| LSE-203 | Audit mutation/FK restrict proof |
| LSE-204 | `reports/security/sbom.cyclonedx.json`, `reports/security/sast-baseline.json`, `reports/security/npm-audit.json`, `reports/security/license-report.json`, `reports/security/license-report.md` |
| LSE-205 | Signed external pentest report and retest status |

## Final Operator Sign-Off

| Item | Owner | Status | Date | Notes |
| --- | --- | --- | --- | --- |
| Live staging URL validated | DevOps | Pending | | |
| DAST/ZAP passed | Security | Pending | | |
| Strict staging evidence passed | DevOps/security | Pending | | |
| Live DB guardrails passed | DBA/security | Pending | | |
| External pentest sign-off attached | Product/security | Pending | | |
| Official Ministry source intake mapped/approved | Compliance/legal | Pending | | |
| Strict Ministry review pack passed | Release owner | Pending | | |
