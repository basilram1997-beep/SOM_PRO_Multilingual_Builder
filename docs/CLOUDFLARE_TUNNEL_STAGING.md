# Cloudflare Tunnel Staging

Date: 2026-08-13

Purpose: provide a stable staging path when home-router port forwarding is blocked by CGNAT or unavailable. This is a deployment option only. It must not create a second source tree or hard-code Cloudflare, DuckDNS, or a future production domain inside application logic.

## Decision

SOM PRO keeps one source code base and one build architecture:

```text
https://STAGING_DOMAIN/
  -> frontend

https://STAGING_DOMAIN/api/*
  -> backend

https://STAGING_DOMAIN/license/*
  -> license-server
```

Cloudflare Tunnel can replace public inbound ports. The application still uses the same environment variables, same `/api` browser routing, and same Ministry evidence scripts.

## Modes

| Mode | URL stability | Use for | Ministry evidence status |
|---|---|---|---|
| Quick Tunnel | Random `https://*.trycloudflare.com` URL | Short manual demo only | Not acceptable as final staging evidence |
| Named Tunnel | Stable hostname such as `https://staging.example.com` | Staging, DAST, external tester handoff | Acceptable after DNS, TLS, strict evidence, and access rules are archived |
| VPS/Nginx | Stable public IP/domain | Staging or production-like hosting | Acceptable after the same evidence gates pass |

## Quick Tunnel Fallback

Quick Tunnel is useful when the router cannot forward ports. It is public and temporary, so use fake test data only.

Start the local same-origin proxy:

```powershell
npm run staging:tunnel:proxy
```

Then start cloudflared against the proxy:

```powershell
docker run --rm --name sompro-cloudflared-quick cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:8080
```

The local proxy defaults are:

| Variable | Default | Purpose |
|---|---|---|
| `SOM_TUNNEL_PROXY_HOST` | `127.0.0.1` | Local listener host |
| `SOM_TUNNEL_PROXY_PORT` | `8080` | Local listener port passed to cloudflared |
| `SOM_TUNNEL_FRONTEND_ORIGIN` | `http://127.0.0.1:4188` | Local frontend origin |
| `SOM_TUNNEL_BACKEND_ORIGIN` | `http://127.0.0.1:4000` | Local backend origin |

Stop Quick Tunnel after the demo:

```powershell
docker rm -f sompro-cloudflared-quick
npm run e2e:clean
```

Quick Tunnel must not be used for formal DAST, external pentest sign-off, or Ministry submission because the hostname changes and there is no managed access policy.

## Named Tunnel Target

Use a Named Tunnel when a stable staging hostname is available. The hostname can be under a future professional domain, for example:

```text
https://staging.example.com
```

Do not assume the final production domain. Replace `staging.example.com` through Cloudflare/DNS/deployment configuration only.

Required deployment values:

| Setting | Staging value |
|---|---|
| `APP_URL` / `PUBLIC_APP_URL` | `https://staging.example.com` |
| `VITE_API_URL` | `/api` |
| `SOM_API_URL` | `https://staging.example.com/api` |
| `CORS_ORIGIN` | `https://staging.example.com` |
| `SOM_LICENSE_SERVER_URL` / `SOM_PRO_LICENSE_SERVER_URL` | `https://staging.example.com/license` |
| `SOM_TRUST_PROXY` / `TRUST_PROXY` | `1` |
| `STAGING_URL` | `https://staging.example.com` |

Secret values such as `DATABASE_URL`, `JWT_SECRET`, license secrets, backup passphrases, and Cloudflare tunnel credentials must come from the operator secret store. Never commit them.

## Named Tunnel Setup

Run the local operator check before creating a tunnel:

```powershell
npm run staging:tunnel:check
```

The operator creates the tunnel outside Git:

```powershell
cloudflared tunnel login
cloudflared tunnel create sompro-staging
cloudflared tunnel route dns sompro-staging staging.example.com
```

Example ingress configuration. Keep the real tunnel ID and credentials outside the repository:

```yaml
tunnel: sompro-staging
credentials-file: C:\secure\cloudflared\sompro-staging.json

ingress:
  - hostname: staging.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

The repository ships only a safe example template:

```text
deploy/cloudflare/sompro-staging.tunnel.example.yml
```

When a real hostname exists, generate a local ignored config:

```powershell
$env:SOM_CLOUDFLARE_TUNNEL_HOSTNAME="staging.example.com"
npm run staging:tunnel:write-config
```

The generated file is intentionally ignored:

```text
deploy/cloudflare/sompro-staging.tunnel.yml
```

The service at `127.0.0.1:8080` may be the local proxy during a temporary Windows staging run, or Nginx/container ingress in a server deployment.

Run the named tunnel:

```powershell
cloudflared tunnel run sompro-staging
```

## Access And Security Rules

- Use Cloudflare Access or an equivalent allowlist for non-public staging.
- Do not use real student data in Quick Tunnel.
- Keep `VITE_API_URL=/api` for web staging and production.
- Keep CORS explicit to the staging origin only.
- Keep auth cookies `Secure`, `HttpOnly`, and `SameSite=Lax` or stricter if cookie auth is introduced.
- Preserve `X-Forwarded-Proto: https` through the tunnel/proxy chain.
- Do not log Cloudflare tokens, tunnel credentials, database URLs, backup passphrases, or license secrets.

## Evidence Closure

After the Named Tunnel hostname is stable, run the same live evidence gates:

```powershell
STAGING_URL=https://staging.example.com ZAP_USE_DOCKER=true npm run security:dast
STAGING_URL=https://staging.example.com STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
STAGING_URL=https://staging.example.com STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence
npm run ministry:review-pack
MINISTRY_REVIEW_PACK_STRICT=true npm run ministry:review-pack
```

Archive:

- Cloudflare hostname and tunnel name.
- DNS route evidence.
- Access policy evidence when enabled.
- TLS/HSTS/health output.
- DAST/ZAP reports.
- Strict staging evidence pack.
- Ministry review pack.

## Production Boundary

Cloudflare Tunnel can also support production later, but production requires a named tunnel, stable domain, access/monitoring ownership, secret management, backup/restore evidence, incident response coverage, and external sign-off. Quick Tunnel is never a production path.
