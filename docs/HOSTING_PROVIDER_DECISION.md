# Hosting Provider Decision Evidence

Date: 2026-08-13

Decision status: provider not selected.

Required jurisdiction: Israel data residency for production and Ministry-facing staging unless a written legal/compliance approval says otherwise.

## Purpose

This document prevents SOM PRO from treating "reachable from the internet" as equivalent to a compliant staging or production environment. A final deployment must satisfy hosting, data-residency, secret-management, backup, audit, and contract evidence requirements.

## Current Position

| Option | Current status | Acceptable for demo | Acceptable for Ministry staging | Acceptable for production |
|---|---|---:|---:|---:|
| Cloudflare Quick Tunnel | Implemented for temporary external demo | Yes | No | No |
| DuckDNS on home router | Blocked by CGNAT / port-forwarding limitations | Limited | No | No |
| Cloudflare Named Tunnel | Ready as architecture/runbook, needs owned domain and provider host | Yes | Only with stable Israel-hosted origin and evidence | Only with stable Israel-hosted origin and full provider evidence |
| Small VPS in Israel | Candidate | Yes | Possible after hardening/evidence | Possible only with provider/KMS/backup/SLA evidence |
| Managed cloud in Israel | Candidate | Yes | Preferred if KMS/secret manager/logging/backups are available | Preferred after contracts and evidence |

## Mandatory Acceptance Criteria

| Control | Requirement | Evidence required |
|---|---|---|
| Data residency | Student/school production data stored and processed in Israel | Provider region statement, contract/order form, DPA |
| Secret management | No production secrets in Git or local `.env`; use secret manager/KMS/protected deployment env | `docs/SECRETS_AND_KMS_READINESS.md`, masked secret-store evidence |
| KMS/key management | Backup/database/application key ownership and rotation documented | KMS/secret manager product, key IDs/version IDs only, rotation policy |
| TLS/edge security | HTTPS, HTTP-to-HTTPS redirect, HSTS, health evidence | strict staging evidence, TLS report |
| Backups | Encrypted backup, offsite/isolated storage, restore drill | backup manifest, restore drill, RPO/RTO report |
| Audit/logging | App audit plus provider/platform logs retained and protected | audit export, provider log retention settings, access logs masked |
| Provider assurance | ISO/SOC or equivalent provider security evidence when available | certificates/reports or provider security package |
| SLA/availability | uptime/support/incident escalation documented | provider SLA/support plan |
| DPA/privacy | processor obligations and deletion/return duties documented | signed DPA or legal-approved agreement |
| External testing | DAST and external pentest run against stable staging URL | ZAP report, external sign-off |

## Israel-First Shortlist Criteria

Do not select a host only because it can run Docker. Score candidates against:

| Criterion | Minimum |
|---|---|
| Israel region/data center | Required |
| Private network/VPC or equivalent | Required |
| Managed database or hardened self-managed PostgreSQL | Required |
| Secret manager/KMS or protected secret injection | Required for production, acceptable pending for pilot only with documented compensating controls |
| Encrypted backups and restore workflow | Required |
| Firewall/security groups | Required |
| Audit logs and operator access logs | Required |
| DPA and data processing terms | Required before real student data |
| SLA/support | Required before production |

## Decision Register

Fill this table when comparing real offers. Do not mark a provider approved until every required evidence item has an owner and archive location.

| Candidate | Israel data residency | KMS/secret manager | Backups | Provider assurance | SLA/support | DPA | Status | Evidence archive |
|---|---|---|---|---|---|---|---|---|
| Pending VPS candidate | Pending | Pending | Pending | Pending | Pending | Pending | Not selected | Pending |
| Pending managed cloud candidate | Pending | Pending | Pending | Pending | Pending | Pending | Not selected | Pending |

## Go / No-Go

No-Go for Ministry staging or production if any of these are true:

- The environment runs on a home router, CGNAT workaround, or random Quick Tunnel URL.
- The provider region is not documented as Israel.
- Real secrets are stored in Git, screenshots, chat, or local `.env` copied from a developer machine.
- Backup encryption and restore drill evidence are missing.
- Strict staging evidence has not passed against a stable HTTPS URL.
- Provider DPA/data processing terms are missing for real student data.

## Next Decision Inputs

Before buying or provisioning hosting, collect:

1. Provider name and Israel region/data-center statement.
2. Price and support/SLA tier.
3. Whether managed PostgreSQL is available in Israel.
4. Secret manager/KMS option and rotation support.
5. Backup storage location and encryption model.
6. DPA/security assurance documents.
7. Whether Cloudflare Named Tunnel or direct HTTPS ingress will be used.

## Current Recommendation

Proceed with demos through Quick Tunnel only for fake data. For real staging, choose either:

- An Israel-hosted VPS or server with Docker/Nginx, encrypted backups, strict firewall, and documented secret injection.
- A managed cloud/hosting provider with Israel data residency, managed database, KMS/secret manager, logs, backups, and support evidence.

The repository must continue to mark provider/KMS/data-region evidence as pending until a real provider is selected and documented.

If the selected path is a VPS, provision it using `docs/ISRAEL_VPS_STAGING_PROVISIONING.md`.
