# Staging Evidence Pack

Review date: 2026-08-12

Purpose: produce one Ministry-reviewable evidence bundle proving that staging is not only configured in code, but checked against live HTTPS, health, database guardrails, backup encryption settings, and release security artifacts.

## Commands

Generate local/static evidence and mark unavailable live checks as pending:

```bash
npm run security:staging-evidence
```

Strict handoff mode for real staging:

```bash
STAGING_URL=https://staging-api.example.invalid STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
```

Strict mode with live DB guardrail probes after `prisma migrate deploy`:

```bash
STAGING_URL=https://staging-api.example.invalid STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
```

## Output Artifacts

| Artifact | Purpose |
| -------- | ------- |
| `reports/security/staging-evidence-pack.json` | Machine-readable evidence for CI/release archive. |
| `reports/security/staging-evidence-pack.md` | Human-readable summary for Ministry/security review. |

## Evidence Covered

| Area | Evidence |
| ---- | -------- |
| HTTPS/TLS/HSTS | `STAGING_URL` must be a real HTTPS URL; live check verifies HTTP redirect, HSTS, and `/health`. |
| Static deployment baseline | Nginx 443, HTTP-to-HTTPS redirect, HSTS, Docker 443 publication, and staging env operator-health flags. |
| DB migration status | Migration `20260812143000_audit_append_only_and_lifecycle_evidence_guards` is verified by contract and optionally against live `_prisma_migrations`. |
| Audit append-only | Live DB mode creates a probe `AuditLog` row and verifies direct update/delete are blocked. |
| Lifecycle evidence FKs | Live DB mode verifies `reports_exports_school_id_fkey` and `backup_jobs_school_id_fkey` use `ON DELETE RESTRICT`. |
| Backup encryption env | Verifies `SOM_BACKUP_PASSPHRASE` or `SOM_BACKUP_PASSPHRASE_FILE` is configured without printing the value. |
| Release artifacts | Checks SBOM, license report, npm audit baseline, SAST baseline, and tracks DAST as required for strict staging handoff. |

## Handoff Rule

- Local mode may contain `pending` live checks.
- Ministry/staging handoff must run strict mode with a real `STAGING_URL`.
- After DB migration deployment, run strict mode with `STAGING_EVIDENCE_LIVE_DB=true` and archive the JSON/Markdown outputs.
