# Secrets And KMS Readiness

Date: 2026-08-13

Purpose: define how SOM PRO must handle production and staging secrets before a stable staging hostname, VPS, or production deployment is accepted. This is readiness evidence, not proof that a final KMS/provider has already been selected.

## Rule

Do not copy local `.env` values to staging or production. Local secrets, demo tunnel secrets, generated admin passwords, and any value from a developer machine must be rotated before handoff.

Staging and production secrets must come from one of:

- Managed secret manager or KMS-backed secret injection.
- CI/CD protected secrets.
- Docker secrets mounted into the runtime.
- A documented deployment environment store with restricted operator access.

Real values must never be committed to Git, pasted into issue trackers, included in screenshots, or printed in evidence reports.

## Secret Inventory

| Secret | Scope | Required in | Storage rule | Rotation trigger |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL credential and host | Backend, migrations, live DB evidence | Secret manager/deployment env only | Any operator change, DB user rotation, suspected leak, staging rebuild |
| `REDIS_URL` / `REDIS_PASSWORD` | Redis auth | Backend, Redis container | Secret manager/deployment env only | Redis rebuild, suspected leak, access policy change |
| `POSTGRES_PASSWORD` | PostgreSQL container password | Production compose | Docker secret or protected deployment env | DB bootstrap, operator offboarding |
| `SOM_PRO_AUTH_SECRET` | Auth token/MFA encryption signing material | Backend | KMS/secret manager/deployment env only | Before production, after Quick Tunnel demos if local values were reused, suspected leak |
| `SOM_PRO_LICENSE_SECRET` | License signing/verification | Backend and license server | KMS/secret manager/deployment env only | License server deployment, suspected leak, pre-sale handoff |
| `LICENSE_ADMIN_TOKEN` | License server owner/admin API | License server | Secret manager/deployment env only | Admin offboarding, reset-token incident, pre-sale handoff |
| `SOM_BACKUP_PASSPHRASE` / `SOM_BACKUP_PASSPHRASE_FILE` | Backup encryption | Backup/restore jobs | Prefer `_FILE` with Docker secret/KMS materialization | Backup storage migration, restore drill, suspected leak |
| Cloudflare tunnel credentials | Named Tunnel | Cloudflare operator host | Cloudflare account + local protected credentials file outside repo | Domain/tunnel change, operator offboarding |
| OIDC/SAML client secret | Future Ministry/IdP SSO | Backend auth | IdP secret store/deployment secret only | IdP rotation, app registration change |
| Email/SMS/webhook tokens | Notifications | Backend/worker | Secret manager/deployment env only | Provider token rotation, incident |

## Current Support

| Capability | Status | Evidence |
|---|---|---|
| Real `.env` files ignored | Exists | `.gitignore`, `scripts/security-secrets-check.js` |
| Production examples use placeholders | Exists | `.env.production.example`, `apps/backend/.env.production.example`, `apps/license-server/.env.production.example` |
| Backup passphrase file reference | Exists | `SOM_BACKUP_PASSPHRASE_FILE=/run/secrets/som_backup_passphrase` |
| Strict staging secret placeholder check | Exists | `scripts/staging-check.js` |
| Quick Tunnel marked demo-only | Exists | `docs/CLOUDFLARE_QUICK_TUNNEL_DEMO_REPORT.md` |
| Final provider/KMS proof | Pending | Requires hosting/provider decision |
| App-wide `_FILE` support for every secret | Pending | Do not claim complete until implemented or provided by deployment platform |

## Production Readiness Gate

Before a staging or production environment is accepted:

1. Create fresh secrets in the selected secret store.
2. Set production/staging env from the secret store, not from local `.env`.
3. Rotate `SOM_PRO_AUTH_SECRET`, `SOM_PRO_LICENSE_SECRET`, `LICENSE_ADMIN_TOKEN`, database passwords, Redis passwords, and backup passphrase.
4. Configure backup passphrase via `SOM_BACKUP_PASSPHRASE_FILE` or equivalent KMS materialization.
5. Run `npm run security:secrets`.
6. Run `node scripts/staging-check.js` or strict staging evidence after `STAGING_URL` exists.
7. Archive evidence with secret values masked.

## Rotation Checklist

Use this after a Quick Tunnel demo, operator handoff, suspected secret leak, or before production launch:

| Step | Owner | Evidence |
|---|---|---|
| Revoke old license admin token | Security/operator | masked rotation log |
| Generate new `SOM_PRO_AUTH_SECRET` and `SOM_PRO_LICENSE_SECRET` | Security/operator | secret store version IDs only |
| Rotate DB and Redis credentials | DBA/operator | DB role/password version record |
| Rotate backup passphrase and test new encrypted backup | Operations | backup manifest and restore drill |
| Rotate Cloudflare tunnel credentials if Named Tunnel was exposed | DevOps | Cloudflare audit event/export |
| Restart affected services with new secret versions | DevOps | deployment log |
| Run smoke, DAST, staging evidence, and secret scan | QA/security | reports with secrets redacted |

## Evidence Rules

- Evidence may show secret names, secret store paths, version IDs, and timestamps.
- Evidence must not show secret values, database URLs with passwords, access tokens, MFA secrets, recovery codes, or license signing material.
- When screenshots are required, mask secret values before archiving.
- If a report accidentally contains a secret, rotate it immediately and mark the report invalid.

## Provider/KMS Decision Record

Fill this when a real staging/production provider is selected:

| Field | Value |
|---|---|
| Provider | Pending |
| Region/data residency | Pending |
| Secret manager/KMS product | Pending |
| Key rotation policy | Pending |
| Backup encryption key owner | Pending |
| Operator access approver | Pending |
| Audit export location | Pending |
| Evidence archive path | Pending |

## Ministry Boundary

This document supports security readiness only. Formal Ministry compliance still requires official supplier standards intake, stable staging evidence, provider/data-region evidence, and external sign-off.
