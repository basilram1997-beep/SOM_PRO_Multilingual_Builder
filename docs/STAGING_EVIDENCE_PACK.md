# Staging Evidence Pack

Review date: 2026-08-12

Purpose: produce one Ministry-reviewable evidence bundle proving that staging is not only configured in code, but checked against live HTTPS, health, database guardrails, backup encryption settings, and release security artifacts.

For final Ministry handoff, close the dated execution checklist in `docs/LIVE_STAGING_EVIDENCE_CLOSURE.md` after generating this pack.

## Commands

Generate local/static evidence and mark unavailable live checks as pending:

```bash
npm run security:staging-evidence
```

Strict handoff mode for real staging:

```bash
STAGING_URL=https://staging-api.example.invalid STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
```

Run live DAST before strict handoff so the evidence pack can attach OWASP ZAP artifacts:

```bash
STAGING_URL=https://staging-api.example.invalid ZAP_USE_DOCKER=true npm run security:dast
```

Strict mode with live DB guardrail probes after `prisma migrate deploy`:

```bash
STAGING_URL=https://staging-api.example.invalid STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
```

## Output Artifacts

| Artifact                                      | Purpose                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `reports/security/staging-evidence-pack.json` | Machine-readable evidence for CI/release archive.                       |
| `reports/security/staging-evidence-pack.md`   | Human-readable summary for Ministry/security review.                    |
| `reports/security/dast-baseline.json`         | Normalized live DAST/ZAP status, target, threshold, and finding counts. |
| `reports/security/zap-baseline-report.html`   | Human-readable OWASP ZAP baseline report.                               |

## Closure Evidence IDs

| Evidence ID | Source                                                  |
| ----------- | ------------------------------------------------------- |
| LSE-102     | Live ZAP/DAST output required before strict handoff.    |
| LSE-103     | Strict staging evidence pack output.                    |
| LSE-104     | Live DB guardrail probes after migration deployment.    |
| LSE-202     | Ministry attachment for JSON/Markdown staging evidence. |

## Evidence Covered

| Area                       | Evidence                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS/TLS/HSTS             | `STAGING_URL` must be a real HTTPS URL; live check verifies HTTP redirect, HSTS, and `/health`.                                                      |
| Static deployment baseline | Nginx 443, HTTP-to-HTTPS redirect, HSTS, Docker 443 publication, and staging env operator-health flags.                                              |
| DB migration status        | Migration `20260812143000_audit_append_only_and_lifecycle_evidence_guards` is verified by contract and optionally against live `_prisma_migrations`. |
| Audit append-only          | Live DB mode creates a probe `AuditLog` row and verifies direct update/delete are blocked.                                                           |
| Lifecycle evidence FKs     | Live DB mode verifies `reports_exports_school_id_fkey` and `backup_jobs_school_id_fkey` use `ON DELETE RESTRICT`.                                    |
| Backup encryption env      | Verifies `SOM_BACKUP_PASSPHRASE` or `SOM_BACKUP_PASSPHRASE_FILE` is configured without printing the value.                                           |
| Release artifacts          | Checks SBOM, license report, npm audit baseline, SAST baseline, and requires DAST/ZAP JSON and HTML evidence for strict staging handoff.             |
| OWASP ZAP DAST             | `security:dast` rejects HTTP, localhost, and placeholder targets; CI runs ZAP through Docker and archives JSON/HTML evidence.                        |

## Handoff Rule

- Local mode may contain `pending` live checks.
- Run `npm run security:dast` against the real HTTPS staging URL before Ministry handoff.
- Ministry/staging handoff must run strict mode with a real `STAGING_URL`.
- After DB migration deployment, run strict mode with `STAGING_EVIDENCE_LIVE_DB=true` and archive the JSON/Markdown outputs.
