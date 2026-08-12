# Phase 10 Staging HTTPS Verification Report

Review date: 2026-08-12

Purpose: evidence pack for Ministry/security review proving that staging and production deployment are not relying on an informal HTTPS intention. This report must be completed after deployment to a real staging domain.

## Automated Baseline

Run before every staging handoff:

```bash
node scripts/staging-check.js
cd apps/backend
node --test --import tsx src/services/httpsStagingEvidence.security.test.ts
```

Expected automated result:

- Nginx listens on port 80 and redirects application traffic to `https://$host$request_uri`.
- Nginx has a `listen 443 ssl http2` server block.
- TLS certificate and key paths are mounted from `/etc/letsencrypt/live/sompro/`.
- Production edge headers include HSTS, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.
- Docker Compose publishes `443:443` and the nginx healthcheck uses `https://127.0.0.1/healthz`.
- Frontend build fails closed if `VITE_API_URL` is not explicitly provided.
- `.env.staging` is checked when present and fails on non-HTTPS public URLs or placeholder secrets.

## Live Staging Evidence To Attach

Complete this section after deploying to the real staging domain.

| Item | Evidence Required | Result |
| ---- | ----------------- | ------ |
| Staging app URL | Final browser URL starts with `https://` | Pending |
| API health URL | `https://<api-domain>/health` returns healthy response | Pending |
| Edge health URL | `https://<domain>/healthz` returns 200 | Pending |
| HTTP redirect | `http://<domain>` returns 301/308 to the same HTTPS host/path | Pending |
| HSTS | Response contains `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` | Pending |
| TLS certificate | Issuer, subject/SAN, valid-from, valid-to, and chain captured | Pending |
| Placeholder scan | `.env.staging` contains no `CHANGE_ME`, `example.invalid`, `your-domain`, `localhost`, or `127.0.0.1` for public endpoints/secrets | Pending |
| Smoke login | Non-production test user can open the app over HTTPS only | Pending |
| Evidence artifact | Console output/screenshots saved in review pack | Pending |

## Suggested Command Log

Record command output and timestamps here:

```bash
date -u
node scripts/staging-check.js
curl -I http://<domain>/
curl -I https://<domain>/
curl -I https://<api-domain>/health
openssl s_client -connect <domain>:443 -servername <domain> -showcerts </dev/null
```

## Current Status

Status: Partial.

The repository now includes production HTTPS configuration and automated static verification. Final Ministry-ready evidence still requires a real staging deployment with a valid certificate, dated command output, and screenshots or CI artifacts attached to the release evidence pack.
