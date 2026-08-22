# DuckDNS Staging Deployment

Date: 2026-08-13

This guide prepares the local machine to serve SOM PRO staging through:

```text
https://sompro.duckdns.org
```

The repository stays single-source. DuckDNS is a staging configuration value only.

## Current Network

| Item                        | Value                |
| --------------------------- | -------------------- |
| DuckDNS domain              | `sompro.duckdns.org` |
| Router public IP in DuckDNS | `79.177.139.125`     |
| Local SOM PRO machine IP    | `10.0.0.5`           |
| Router gateway              | `10.0.0.138`         |

Router forwarding must point:

| External port | Protocol | Internal target |
| ------------- | -------- | --------------- |
| `80`          | TCP      | `10.0.0.5:80`   |
| `443`         | TCP      | `10.0.0.5:443`  |

## Prepare Local Env Files

Run:

```bash
npm run staging:prepare-duckdns
```

This creates local ignored files:

- `.env.production`
- `apps/backend/.env.production`
- `apps/license-server/.env.production`

The script writes random local secrets. These files are intentionally ignored by Git.

Use `--force` only if you intentionally want to replace existing local staging secrets:

```bash
node scripts/runtime/prepare-duckdns-staging-env.js --force
```

## Required Public URLs

| Setting                      | Staging value                        |
| ---------------------------- | ------------------------------------ |
| `APP_URL`                    | `https://sompro.duckdns.org`         |
| `PUBLIC_APP_URL`             | `https://sompro.duckdns.org`         |
| `VITE_API_URL`               | `/api`                               |
| `SOM_API_URL`                | `https://sompro.duckdns.org/api`     |
| `CORS_ORIGIN`                | `https://sompro.duckdns.org`         |
| `SOM_LICENSE_SERVER_URL`     | `https://sompro.duckdns.org/license` |
| `SOM_PRO_LICENSE_SERVER_URL` | `https://sompro.duckdns.org/license` |

## TLS Certificate Requirement

The production compose stack expects the Nginx certificate at:

```text
/etc/letsencrypt/live/sompro/fullchain.pem
/etc/letsencrypt/live/sompro/privkey.pem
```

Do not expose a real staging login over plain HTTP. Port `80` is needed for HTTP-to-HTTPS redirect and certificate issuance.

Issue the certificate before starting Nginx:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml --profile certbot run --rm --service-ports certbot
```

If you want renewal notices, set `CERTBOT_EMAIL` in `.env.production` before running the command.

The compose service issues the certificate with `--cert-name sompro`, matching the Nginx paths above.

## If Port 80 Is Blocked on Windows

Run:

```bash
npm run staging:diagnose-duckdns
```

If the report shows port `80` in Windows excluded ranges or `W3SVC` running, open PowerShell as Administrator and run:

```powershell
Stop-Service W3SVC -Force
```

Then retry the Certbot command. If your router supports separate external/internal ports, another option is forwarding external `80` to an internal port that Docker can bind, but the default supported path is to free local port `80`.

## Start Stack

After certificate preparation, run:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Then verify locally:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

From another network, verify:

```bash
curl -I http://sompro.duckdns.org
curl -I https://sompro.duckdns.org
curl -I https://sompro.duckdns.org/healthz
```

## Evidence Commands

After the live site responds over HTTPS:

```bash
STAGING_URL=https://sompro.duckdns.org npm run security:staging-evidence
STAGING_URL=https://sompro.duckdns.org ZAP_USE_DOCKER=true npm run security:dast
npm run ministry:review-pack
```

Live DB guardrails need the staging `DATABASE_URL` passed through a secret channel:

```bash
STAGING_URL=https://sompro.duckdns.org STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
```
