# Israel Hosting Provider Request Checklist

Date: 2026-08-13

Purpose: provide a ready-to-send request and comparison checklist for selecting an Israel-hosted provider for SOM PRO staging/production.

Status: provider not selected.

## Short Message To Send

```text
Hello,

We are evaluating an Israel-hosted VPS or managed cloud environment for a school management SaaS handling student and school data.

Please confirm whether you can provide the following:

1. Written confirmation that compute, storage, snapshots/backups, and operational data are hosted in Israel.
2. Static public IPv4 or stable hostname support.
3. Ubuntu Server 22.04/24.04 or a managed container/runtime option.
4. Firewall/security group controls.
5. Docker/Compose support or managed container equivalent.
6. Managed PostgreSQL in Israel, or support for a hardened self-managed PostgreSQL deployment.
7. Secret manager/KMS or another protected secret injection mechanism.
8. Encrypted backups/snapshots and documented backup storage location.
9. Audit/operator access logs and retention options.
10. SLA/support plan and incident escalation path.
11. DPA/data processing agreement and privacy/security terms.
12. ISO/SOC or equivalent security assurance package if available.
13. Data deletion/return process at contract termination.
14. Monthly cost for staging and expected production scale.

Please also state any limitation that would prevent using your service for Ministry-facing school data.
```

## Minimum VPS Staging Requirements

| Requirement | Minimum                                                         |
| ----------- | --------------------------------------------------------------- |
| Region      | Israel                                                          |
| IP          | Static public IPv4                                              |
| OS          | Ubuntu Server 22.04 LTS or 24.04 LTS                            |
| CPU/RAM     | 2 vCPU / 4 GB minimum; 4 vCPU / 8 GB preferred                  |
| Disk        | 80 GB SSD minimum                                               |
| Firewall    | Provider firewall/security group plus OS firewall               |
| Database    | PostgreSQL private to server/Docker network                     |
| Redis       | Private to server/Docker network                                |
| Secrets     | Protected operator vault, secret manager, or KMS-backed process |
| Backup      | Encrypted backup/snapshot with Israel location documented       |
| Ingress     | Nginx HTTPS or Cloudflare Named Tunnel                          |

## Scoring Table

Score each item:

- `0`: missing or unknown.
- `1`: available but weak/manual/no written evidence.
- `2`: available with written evidence and acceptable controls.

| Criterion                                                 | Weight | Candidate A | Candidate B | Candidate C |
| --------------------------------------------------------- | -----: | ----------: | ----------: | ----------: |
| Israel compute/data residency evidence                    |      5 |             |             |             |
| Backup/snapshot location documented as Israel or approved |      5 |             |             |             |
| DPA/privacy terms                                         |      5 |             |             |             |
| Secret manager/KMS/protected secret injection             |      4 |             |             |             |
| Managed PostgreSQL or hardened private DB support         |      4 |             |             |             |
| Firewall/security groups                                  |      4 |             |             |             |
| Audit/operator logs                                       |      3 |             |             |             |
| SLA/support/incident path                                 |      3 |             |             |             |
| ISO/SOC/security assurance package                        |      3 |             |             |             |
| Cost fit for staging                                      |      2 |             |             |             |
| Docker/Compose or managed runtime support                 |      2 |             |             |             |
| Cloudflare Named Tunnel compatibility                     |      1 |             |             |             |

Recommended decision threshold:

- Staging candidate: at least `35` weighted points and no `No-Go` item.
- Production candidate: at least `50` weighted points, DPA complete, backups/KMS documented, and external security evidence accepted.

## No-Go Answers

Do not use the provider for Ministry-facing staging or production if any answer is true:

- They cannot confirm Israel data residency for compute and storage.
- Backups/snapshots may leave Israel without written legal/compliance approval.
- They cannot provide a DPA or privacy/data processing terms.
- They require password SSH/root login for routine operation.
- PostgreSQL or Redis must be publicly exposed.
- They cannot support HTTPS or stable ingress.
- They cannot explain backup restore and deletion/return process.
- They cannot provide any secret-management or protected deployment-env mechanism.

## Evidence To Archive

| Evidence                                            |     Required for staging |   Required for production |
| --------------------------------------------------- | -----------------------: | ------------------------: |
| Provider region/data residency statement            |                      Yes |                       Yes |
| Order form/contract showing Israel region           |                      Yes |                       Yes |
| DPA/privacy terms                                   | Before real student data |                       Yes |
| SLA/support plan                                    |                Preferred |                       Yes |
| Security package/ISO/SOC statement                  |                Preferred | Yes if available/required |
| Firewall/security group screenshot/export           |                      Yes |                       Yes |
| Secret manager/KMS or compensating control evidence |                      Yes |                       Yes |
| Backup storage location and encryption statement    |                      Yes |                       Yes |
| Deletion/return process                             | Before real student data |                       Yes |

## Candidate Comparison Register

| Candidate   | Contact | Israel residency evidence |    Cost | Score | No-Go?  | Decision | Notes |
| ----------- | ------- | ------------------------- | ------: | ----: | ------- | -------- | ----- |
| Candidate A | Pending | Pending                   | Pending |     0 | Pending | Pending  |       |
| Candidate B | Pending | Pending                   | Pending |     0 | Pending | Pending  |       |
| Candidate C | Pending | Pending                   | Pending |     0 | Pending | Pending  |       |

## Decision Template

```text
Selected provider:
Selected plan:
Region/data center:
Evidence archive path:
Reason for selection:
Known gaps:
Compensating controls:
Approved by:
Date:
```

After a provider is selected, update `docs/HOSTING_PROVIDER_DECISION.md` and follow `docs/ISRAEL_VPS_STAGING_PROVISIONING.md` or a managed-cloud equivalent runbook.
