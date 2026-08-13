# Environment URL Inventory

Date: 2026-08-13

Purpose: classify URL, origin, and endpoint assumptions before changing SOM PRO to a single source tree that runs in local, staging, and production through configuration only.

Target architecture for the next package:

| Environment | Public address | Goal |
|---|---|---|
| Local | `http://localhost:...` | Development |
| Staging | `https://sompro.duckdns.org` | Staging and trial evidence |
| Production | `https://app.example.com` | Future official deployment placeholder |

Rules for this inventory:

- `sompro.duckdns.org` is a staging configuration value only, not business logic.
- Future production domains must stay in configuration/DNS/reverse proxy only.
- Localhost defaults are allowed for local development, tests, and loopback healthchecks.
- No database schema changes are part of this package.
- No secrets are added to Git.

## Classification Legend

| Classification | Meaning | Action |
|---|---|---|
| Legitimate local default | Loopback URL used for local development, tests, healthchecks, or desktop local-trial mode. | Keep, but document scope. |
| Environment configuration | URL belongs in `.env`, CI/CD, Docker, Electron runtime config, or reverse proxy config. | Keep configurable; avoid source logic coupling. |
| Hard-coded URL to remove | Deployment URL is embedded in source/build behavior where relative `/api` or env config should be used. | Remove in the config unification package. |
| Documentation/example only | Example, runbook, checklist, or evidence text. | Keep placeholders generic and clearly non-production. |

## Current Inventory

| Area | Current references | Classification | Notes and next action |
|---|---|---|---|
| Frontend API client | `apps/frontend/src/api/http.ts` uses `VITE_API_URL` and falls back to `http://localhost:4000`. | Hard-coded URL to remove for web deployments; legitimate local default for dev fallback. | Change web deployment default to relative `/api` when served through reverse proxy. Preserve desktop/local-trial loopback fallback. |
| Frontend env examples | `.env.example`, `.env.development.example`, `.env.local-trial.example`, `apps/frontend/.env.example` use `http://localhost:4000`; staging/production examples use separate API domains. | Environment configuration. | Change staging/production examples to `VITE_API_URL=/api` for same-origin web. Keep local examples on loopback or `/api` only when a local proxy is present. |
| Frontend production Dockerfile | `apps/frontend/Dockerfile.production` has `ARG VITE_API_URL=https://api.your-domain.com`. | Hard-coded URL to remove. | Make the default `/api` and allow override only through build/deploy configuration. |
| Backend CORS | `apps/backend/src/config/env.ts` defaults `CORS_ORIGIN` to local Vite origins. | Legitimate local default. | Add clear environment docs for `CORS_ORIGIN`/`CORS_ORIGINS`. Staging and production must use public app origin from env. |
| Backend URLs/env examples | `.env.*`, `apps/backend/.env.*` include `APP_URL`, `SOM_API_URL`, `SOM_LICENSE_SERVER_URL`, webhook URLs, and replica URLs. | Environment configuration. | Use `PUBLIC_APP_URL`/`APP_URL`, `SOM_API_URL` only when absolute backend self-reference is needed, and never as a business-logic domain. |
| Backend tests | Backend security/integration tests create `http://127.0.0.1:<port>` servers. | Legitimate local default. | Keep; these are isolated test loopbacks. |
| Database/Redis local URLs | `.env.example`, `scripts/runtime/database-config.js`, E2E/perf helpers use loopback PostgreSQL/Redis URLs. | Legitimate local default. | Keep for local. Staging/production secrets must come from secret manager or deployment env. |
| Reverse proxy | `deploy/nginx/sompro.conf` redirects `http` to `https://$host$request_uri`; healthchecks use container/local addresses. | Environment configuration. | Good domain-agnostic pattern. Next package should confirm `/api/* -> backend` and `/ -> frontend` same-origin architecture. |
| Docker Compose healthchecks | `docker-compose.production.yml` uses `http://127.0.0.1` and `https://127.0.0.1/healthz` inside containers. | Legitimate local/container healthcheck. | Keep if only used inside container network. |
| Electron runtime | `apps/desktop/src/runtimeConfig.js`, `apps/desktop/som-pro-runtime.env`, and desktop env examples use local and SaaS URLs. | Environment configuration with legitimate local defaults. | Keep local-trial defaults; SaaS mode must require configured HTTPS app/API/license URLs. Consider same-origin app URL plus `/api` only when Electron loads hosted web. |
| Electron installer | `apps/desktop/installer.nsh` posts to `http://localhost:4100` during install registration. | Legitimate local default for local installer flow; review before SaaS installer release. | Next package should confirm SaaS installer uses env/configured license URL or disables local registration path. |
| License server | `apps/license-server/src/server.js` uses `PUBLIC_BASE_URL`, `LICENSE_CORS_ORIGIN`, and local console URLs. | Environment configuration plus legitimate local default. | Keep local console messages; staging/production must set explicit HTTPS public base/CORS/admin token. |
| Staging/DAST scripts | `scripts/runtime/dast-baseline.js`, `zap-baseline.js`, `staging-evidence-pack.js`, `staging-check.js` require HTTPS and reject localhost/placeholders. | Environment configuration. | Keep. Update examples to use `https://sompro.duckdns.org` only in staging env/runbooks if needed. |
| E2E/perf/stress scripts | `scripts/run-e2e-browser.js`, `scripts/perf-*`, `scripts/stress-*` default to `http://127.0.0.1`. | Legitimate local default. | Keep local defaults; staging runs should pass `SOM_E2E_BASE_URL`/`SOM_E2E_API_BASE_URL`. |
| WebSocket/SSE | Search found no active `WebSocket`, `ws://`, `wss://`, `EventSource`, or SSE runtime surface. | Not currently present. | If added later, use same-origin `/api` or env-driven `wss://` origin derivation. |
| Password reset/auth callbacks | Backend routes are relative API paths such as `/api/auth/password-reset/*` and `/api/auth/sso/oidc/callback`. | Environment configuration for public links/callbacks. | Keep API paths relative. Future email/reset absolute links must derive from `PUBLIC_APP_URL`/`APP_URL`, not hard-coded domains. |
| Ministry/security docs | `docs/*` include `https://...`, `your-domain`, `example.invalid`, and official Ministry URLs. | Documentation/example only. | Keep official source URLs. Keep deployment placeholders explicit and non-production. |

## Hard-Coded Removal Backlog

These are the highest-priority items for the next package:

| Priority | File | Current assumption | Desired state |
|---|---|---|---|
| P0 | `apps/frontend/src/api/http.ts` | Web fallback can become `http://localhost:4000` in deployed browser builds. | Same-origin `/api` for web, local loopback only for local/desktop modes. |
| P0 | `apps/frontend/Dockerfile.production` | Build arg defaults to `https://api.your-domain.com`. | Default to `/api` or require explicit config without embedding a future domain. |
| P0 | `.env.staging.example`, `apps/frontend/.env.staging.example` | Separate staging API/license placeholder domains. | Staging web should use `APP_URL=https://sompro.duckdns.org`, `VITE_API_URL=/api`, and explicit license URL/config as architecture requires. |
| P0 | `.env.production.example`, `apps/frontend/.env.production.example` | Separate `api.your-domain.com` placeholder. | Production web should use `APP_URL=https://app.example.com`, `VITE_API_URL=/api`, and no real production domain assumption. |
| P1 | `apps/desktop/som-pro-runtime.env` | Local loopback defaults live in a checked-in runtime file. | Keep only as local-trial template or rename/document as local runtime config. SaaS runtime config must be operator supplied. |
| P1 | `apps/desktop/installer.nsh` | Local license server calls are embedded in installer script. | Confirm this path is local installer only or make SaaS installer registration configurable. |

## Environment Variables Seen

| Variable | Area | Secret? | Intended scope |
|---|---|---|---|
| `APP_ENV` | Backend/frontend scripts | No | `development`, `staging`, `production`. |
| `APP_URL` / `SOM_PRO_APP_URL` / future `PUBLIC_APP_URL` | Frontend/backend/Electron | No | Public application origin for redirects, links, CORS, and hosted Electron app URL. |
| `VITE_API_URL` / `SOM_API_URL` | Frontend/Electron/scripts | No | Prefer `/api` for same-origin web; absolute URL only for local desktop or external API topology. |
| `CORS_ORIGIN` | Backend/license server | No | Comma-separated allowed public origins. |
| `SOM_LICENSE_SERVER_URL` / `SOM_PRO_LICENSE_SERVER_URL` | Backend/frontend/Electron | No | License server origin; must be HTTPS outside local. |
| `PUBLIC_BASE_URL` | License server | No | License server public origin. |
| `DATABASE_URL`, `REDIS_URL` | Backend/scripts | Yes in real deployments | Secret manager/deployment env only for staging/production. |
| `SOM_PRO_LICENSE_SECRET`, `LICENSE_ADMIN_TOKEN`, auth secrets, backup passphrases | Backend/license/ops | Yes | Never commit. |
| `SOM_E2E_BASE_URL`, `SOM_E2E_API_BASE_URL`, `STAGING_URL` | Test/evidence scripts | No | Local by default; real HTTPS for staging evidence. |

## Decision for Next Package

Implement `config: add multi-environment runtime architecture` with these constraints:

- Keep localhost working for local development and tests.
- Use `/api` as the default browser API base for staging/production web deployments.
- Keep DuckDNS only in staging env examples or operator docs.
- Keep production domain as `https://app.example.com` placeholder until the real domain is chosen.
- Make reverse proxy the source of routing truth: `https://DOMAIN/` to frontend and `https://DOMAIN/api/*` to backend.
- Add contract tests that prevent hard-coding `sompro.duckdns.org` or a future production domain in source logic.
