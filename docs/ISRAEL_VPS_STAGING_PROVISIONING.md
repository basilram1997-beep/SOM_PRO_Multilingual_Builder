# Israel VPS Staging Provisioning Runbook

Date: 2026-08-13

Purpose: prepare a repeatable staging path on an Israel-hosted VPS without depending on a home router, CGNAT workaround, or random Quick Tunnel URL.

Status: ready-to-use runbook. No VPS has been purchased or approved yet.

## Boundary

This runbook is for staging or pilot preparation. It does not replace final provider due diligence, DPA/legal approval, external pentest sign-off, or Ministry official standards intake.

Required jurisdiction: Israel.

## What To Request From The VPS Provider

Use `docs/ISRAEL_HOSTING_PROVIDER_REQUEST_CHECKLIST.md` as the provider-facing request and comparison template.

| Requirement | Minimum answer before purchase |
|---|---|
| Data center / region | Written statement that the VPS and storage are hosted in Israel |
| Static public IP | One IPv4 address dedicated to the VPS |
| OS | Ubuntu Server 22.04 LTS or 24.04 LTS |
| CPU/RAM | 2 vCPU / 4 GB minimum for staging; 4 vCPU / 8 GB preferred |
| Disk | 80 GB SSD minimum, encrypted storage preferred |
| Backups | Snapshot/offsite backup option with location documented as Israel or legally approved |
| Firewall | Provider firewall/security group support |
| Reverse DNS/DNS | Ability to point a domain or Cloudflare Named Tunnel to the server |
| KMS/secret store | Native option preferred; otherwise document compensating secret-injection controls |
| SLA/support | Support plan and incident contact |
| DPA/security docs | DPA, privacy/security terms, ISO/SOC/security package if available |

## Initial Server Hardening

Run as a provider console/root bootstrap session. Replace placeholders before use.

```bash
adduser somdeploy
usermod -aG sudo somdeploy
mkdir -p /home/somdeploy/.ssh
chmod 700 /home/somdeploy/.ssh
```

Add the operator SSH public key to:

```text
/home/somdeploy/.ssh/authorized_keys
```

Then harden SSH:

```bash
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh
```

Firewall baseline:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

Do not expose PostgreSQL `5432`, Redis `6379`, or license/admin internals directly to the internet.

## Runtime Installation

```bash
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw fail2ban jq
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker somdeploy
systemctl enable --now docker
```

Verify:

```bash
docker --version
docker compose version
```

## Repository Deployment

Clone or copy the repository to:

```text
/opt/sompro
```

Recommended ownership:

```bash
mkdir -p /opt/sompro
chown -R somdeploy:somdeploy /opt/sompro
```

Use one source tree only. Do not create `frontend-staging`, `backend-staging`, or separate code copies.

## Secret Handling

Create runtime env files only on the VPS. Do not commit them.

```bash
cp .env.production.example .env.production
cp apps/backend/.env.production.example apps/backend/.env.production
cp apps/license-server/.env.production.example apps/license-server/.env.production
```

Replace every placeholder from a secret store, protected operator vault, or documented temporary staging secret procedure. Do not copy local developer `.env` values.

Create the backup passphrase as a mounted secret file:

```bash
mkdir -p /run/secrets
chmod 700 /run/secrets
printf '%s' 'REPLACE_WITH_SECRET_STORE_VALUE' > /run/secrets/som_backup_passphrase
chmod 600 /run/secrets/som_backup_passphrase
```

The env files should reference it as:

```env
SOM_BACKUP_PASSPHRASE_FILE=/run/secrets/som_backup_passphrase
```

Record only secret names/version IDs in evidence. Never record values.

## Ingress Options

Choose one:

| Ingress | Use when | Evidence |
|---|---|---|
| Nginx + DNS + TLS | A domain points to the VPS IP | TLS certificate, HTTP redirect, HSTS, health |
| Cloudflare Named Tunnel | No inbound public ports or extra edge access policy is desired | Named Tunnel config, DNS route, Access policy if enabled |

Quick Tunnel is not acceptable for Ministry staging.

## Start Staging

From `/opt/sompro`:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Apply migrations:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec backend npm run prisma:migrate:deploy -w apps/backend
```

Smoke checks:

```bash
curl -fsS https://STAGING_DOMAIN/healthz
curl -fsS https://STAGING_DOMAIN/api/version
curl -fsS https://STAGING_DOMAIN/license/health
```

## Evidence Commands

Run after HTTPS is stable:

```bash
STAGING_URL=https://STAGING_DOMAIN ZAP_USE_DOCKER=true npm run security:dast
STAGING_URL=https://STAGING_DOMAIN STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
STAGING_URL=https://STAGING_DOMAIN STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
npm run ministry:review-pack
```

Do not paste `DATABASE_URL` with password into reports. Use masked evidence.

## Backup And Restore Drill

Minimum staging drill:

1. Run encrypted DB backup.
2. Run encrypted license-data backup.
3. Verify only `.enc` artifacts and manifests are retained.
4. Restore into an isolated staging/test database.
5. Record RPO/RTO and restore result.

Archive:

```text
reports/security/staging-evidence-pack.json
reports/security/staging-evidence-pack.md
docs/STAGING_BACKUP_RESTORE_TEST_AR.md
```

## Go / No-Go

No-Go if:

- Provider cannot document Israel region/data residency.
- SSH password login or root SSH remains enabled.
- PostgreSQL or Redis are reachable from the internet.
- Real secrets are stored in Git or copied from developer `.env`.
- No backup encryption passphrase file exists.
- HTTPS/HSTS/health evidence is missing.
- Strict staging evidence fails.
- DPA/provider evidence is missing before real student data is used.

## Handoff Checklist

| Item | Status |
|---|---|
| Provider Israel region statement archived | Pending |
| VPS IP and hostname recorded | Pending |
| SSH key-only login verified | Pending |
| Firewall rules archived | Pending |
| Docker/Compose versions recorded | Pending |
| Secret injection source recorded without values | Pending |
| HTTPS certificate report archived | Pending |
| DAST/ZAP report archived | Pending |
| Strict staging evidence archived | Pending |
| Backup/restore drill archived | Pending |
| DPA/SLA/security package archived | Pending |
