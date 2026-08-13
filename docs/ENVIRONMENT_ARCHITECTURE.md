# Environment Architecture

Date: 2026-08-13

SOM PRO uses one repository, one source tree, and one build architecture. Local, staging, and production are selected through environment configuration, DNS, TLS, and reverse proxy routing.

No source code copy should be created for staging or production.

## Environment Summary

| Setting | Local | Staging | Production |
|---|---|---|---|
| Public app URL | `http://localhost:5173` | `https://sompro.duckdns.org` | `https://app.example.com` |
| Browser API base | `http://localhost:4000` in direct Vite dev; `/api` when local proxy is used | `/api` | `/api` |
| Backend public URL | `http://localhost:4000` | `https://sompro.duckdns.org/api` | `https://app.example.com/api` |
| License server URL | `http://localhost:4100` | `https://sompro.duckdns.org/license` | `https://app.example.com/license` |
| CORS origin | `http://localhost:5173,http://127.0.0.1:5173` | `https://sompro.duckdns.org` | `https://app.example.com` |
| Cookie secure behavior | `false` unless using HTTPS locally | `true` | `true` |
| Trust proxy | `false` by default | `1` or `true` behind Nginx | `1` or `true` behind Nginx |
| TLS/HSTS | Not required | Required | Required |

`https://app.example.com` is a placeholder. Replace it in deployment configuration only after the official domain is chosen.

## 1. Local Environment

Local development may run the frontend and backend directly:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- License server: `http://localhost:4100`
- PostgreSQL/Redis: loopback or Docker-only bindings

Local examples may contain localhost defaults. These values must not be copied into staging or production env files.

## 2. Staging Environment

Staging currently uses DuckDNS as a temporary public domain:

- Public app: `https://sompro.duckdns.org`
- Browser API base: `/api`
- Backend public path: `https://sompro.duckdns.org/api`
- License public path: `https://sompro.duckdns.org/license`

DuckDNS is a deployment configuration value only. It must not appear in business logic.

## 3. Production Environment

Production uses the same source and build architecture as staging:

- Public app placeholder: `https://app.example.com`
- Browser API base: `/api`
- Backend public path: `https://app.example.com/api`
- License public path: `https://app.example.com/license`

When the real domain is selected, update DNS, TLS certificates, `.env.production`, and deployment secrets. Do not change application source code.

## 4. Required Environment Variables

| Variable | Local | Staging | Production |
|---|---|---|---|
| `APP_ENV` | `development` | `staging` or `production` runtime mode with staging release channel | `production` |
| `NODE_ENV` | optional/dev | `production` | `production` |
| `SOM_RUNTIME_MODE` | `development` or `local-trial` | `saas` | `saas` |
| `APP_URL` / `PUBLIC_APP_URL` | `http://localhost:5173` | `https://sompro.duckdns.org` | `https://app.example.com` |
| `VITE_API_URL` | `http://localhost:4000` for direct dev, or `/api` with a local proxy | `/api` | `/api` |
| `SOM_API_URL` | `http://localhost:4000` | `https://sompro.duckdns.org/api` | `https://app.example.com/api` |
| `CORS_ORIGIN` | localhost origins | `https://sompro.duckdns.org` | `https://app.example.com` |
| `SOM_LICENSE_SERVER_URL` / `SOM_PRO_LICENSE_SERVER_URL` | `http://localhost:4100` | `https://sompro.duckdns.org/license` | `https://app.example.com/license` |
| `PUBLIC_BASE_URL` | `http://localhost:4100` if needed | `https://sompro.duckdns.org/license` | `https://app.example.com/license` |
| `SOM_TRUST_PROXY` / `TRUST_PROXY` | `false` | `1` | `1` |

## 5. Secret Variables

These must never be committed with real values:

- `DATABASE_URL`
- `REDIS_URL` when it includes credentials
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `SOM_PRO_AUTH_SECRET`
- `SOM_PRO_LICENSE_SECRET`
- `LICENSE_ADMIN_TOKEN`
- backup passphrases and `_FILE` secret references
- webhook credentials or signed URLs

Staging and production must receive these values from a deployment secret store, CI secret, Docker secret, or equivalent protected mechanism.

Detailed secret inventory, KMS readiness, and rotation rules are tracked in `docs/SECRETS_AND_KMS_READINESS.md`.

## 6. Domain Change Procedure

To move from DuckDNS staging to a future professional domain:

1. Point DNS for the new domain to the deployment edge.
2. Issue TLS certificates for the new domain.
3. Update `.env.production` or deployment secret values:
   - `APP_URL`
   - `PUBLIC_APP_URL`
   - `CORS_ORIGIN`
   - `SOM_API_URL`
   - `SOM_LICENSE_SERVER_URL`
   - `SOM_PRO_LICENSE_SERVER_URL`
   - license server `PUBLIC_BASE_URL`
4. Keep `VITE_API_URL=/api`.
5. Rebuild/redeploy with the same source code.
6. Run HTTPS/staging evidence, DAST, and the Ministry review pack.

## 7. CORS Architecture

The browser should call same-origin `/api` in staging and production. This reduces CORS exposure because the request origin is the same public app origin.

Backend CORS still stays explicit:

- Local: allow localhost frontend origins.
- Staging: allow only `https://sompro.duckdns.org`.
- Production: allow only the final production origin, represented here by `https://app.example.com`.

Do not use `*` for authenticated backend APIs in staging or production.

## 8. Reverse Proxy Architecture

The reverse proxy is the routing source of truth:

```text
https://DOMAIN/
  -> frontend

https://DOMAIN/api/*
  -> backend

https://DOMAIN/license/*
  -> license-server
```

Nginx must preserve:

- HTTP to HTTPS redirect.
- HSTS in production.
- `X-Forwarded-Proto: https`.
- `X-Forwarded-Host`.
- `/healthz` at the edge.

Cloudflare Tunnel may sit in front of this same routing model when router port forwarding is blocked. The tunnel is infrastructure, not business logic: Quick Tunnel is acceptable only for temporary demos, while a Named Tunnel with a stable hostname is required before DAST, external tester handoff, or Ministry evidence closure. See `docs/CLOUDFLARE_TUNNEL_STAGING.md`.

## 9. Electron Configuration

Electron local-trial and development modes may use localhost:

- `SOM_PRO_APP_URL=http://localhost:5173`
- `SOM_API_URL=http://localhost:4000`
- `SOM_LICENSE_SERVER_URL=http://localhost:4100`

Electron SaaS mode must use runtime configuration and HTTPS origins. Do not embed DuckDNS or a future production domain in Electron source code.

## 10. License Server Configuration

Local license server defaults are allowed for development. Staging and production must configure:

- `PUBLIC_BASE_URL`
- `CORS_ORIGIN`
- `SOM_PRO_LICENSE_SECRET`
- `LICENSE_ADMIN_TOKEN`

The public license path can be hosted under `/license` by the reverse proxy, while the internal container service remains `license-server:4100`.

## 11. HTTPS/TLS Requirements

Staging and production require:

- Valid TLS certificate.
- HTTP to HTTPS redirect.
- HSTS.
- Secure cookies where cookies are used.
- `HttpOnly` for auth cookies if cookie auth is introduced.
- `SameSite=Lax` or stricter unless an explicit IdP callback requires otherwise.
- CSRF protection for cookie-authenticated state-changing requests if cookie auth is introduced.

Current token-based frontend auth should still avoid leaking tokens to URLs, logs, reports, or local persistent storage.

## Guardrails

- `sompro.duckdns.org` may appear in env examples and documentation only.
- Production placeholder must remain `https://app.example.com` until a real domain is chosen.
- Browser production builds should default to `/api`, not localhost.
- Changing staging to production must be a configuration, DNS, TLS, and deployment operation only.
