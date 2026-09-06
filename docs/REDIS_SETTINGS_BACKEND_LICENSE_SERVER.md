# Redis Settings for Backend + License Server

Date: 2026-09-06

This runbook defines the shared Redis settings used by:

- `apps/backend`
- `apps/license-server`

Its goal is simple: keep rate limiting, nonce replay protection, and backend cache/state behavior consistent across multiple instances.

Use this file as the single Redis handoff reference for developers and operators. If another document disagrees with it, update that document or this one before delivery.

## Why this matters

If the backend or license server falls back to per-process memory, the behavior splits between instances. That is acceptable for isolated local development, but it is not acceptable for real staging or production.

For shared staging or production, use one Redis service and point both apps to it.

## Required environment variables

### Backend

Set:

```env
REDIS_URL=redis://:change-me-strong-redis-password@redis:6379
SOM_PRO_RATE_LIMIT_BACKING=redis
```

The backend uses `SOM_PRO_RATE_LIMIT_BACKING=redis` with `REDIS_URL` for distributed request protections. Do not omit `SOM_PRO_RATE_LIMIT_BACKING` in staging or production; leaving it implicit makes the environment harder to audit and can hide an accidental local-memory configuration.

### License Server

Set:

```env
LICENSE_REQUEST_BACKING=redis
LICENSE_REDIS_URL=redis://:change-me-strong-redis-password@redis:6379
```

`LICENSE_REDIS_URL` may also be injected through a secret manager or platform environment store, but it must point to the same Redis service used by the backend.

## Example files

The repository examples already include these values:

- [apps/backend/.env.staging.example](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/apps/backend/.env.staging.example)
- [apps/backend/.env.production.example](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/apps/backend/.env.production.example)
- [apps/license-server/.env.staging.example](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/apps/license-server/.env.staging.example)
- [apps/license-server/.env.production.example](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/apps/license-server/.env.production.example)

The DuckDNS staging helper also writes the same values into the generated local env files:

- `apps/backend/.env.production`
- `apps/license-server/.env.production`

## Local development

For local development, you may use memory mode for the license server if Redis is not available:

```env
LICENSE_REQUEST_BACKING=memory
```

That mode is not equivalent to multi-instance consistency. Use it only for isolated local testing.

## Staging and production

For any real shared environment:

1. Run one Redis service.
2. Keep it private to the internal network or host.
3. Do not expose `6379` to the public internet.
4. Use the same Redis credentials from both backend and license server.
5. Avoid `memory` mode unless you intentionally want local, per-process behavior.

## Pre-delivery checklist

- Confirm `SOM_PRO_RATE_LIMIT_BACKING=redis` in backend staging and production config.
- Confirm `LICENSE_REQUEST_BACKING=redis` in license-server staging and production config.
- Confirm `REDIS_URL` and `LICENSE_REDIS_URL` point to the same Redis service or the same managed Redis cluster.
- Confirm Redis credentials are stored in the deployment secret store, not in tracked source.
- Confirm the backend and license server can both reach Redis after deployment.
- Confirm `/api/license/status` and `/api/schools/operator-health` are protected by request throttling.

## Verification

After deployment, verify:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl -I https://sompro.duckdns.org/healthz
curl -I https://sompro.duckdns.org/license/health
```

If the site is healthy but Redis is not shared, you will still see inconsistent rate limiting across instances. That is a deployment misconfiguration, not an application bug.

## Related files

- [docs/DUCKDNS_STAGING_DEPLOYMENT.md](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/docs/DUCKDNS_STAGING_DEPLOYMENT.md)
- [docs/PRODUCTION_DEPLOYMENT_GUIDE_AR.md](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/docs/PRODUCTION_DEPLOYMENT_GUIDE_AR.md)
- [docs/ENVIRONMENT_VARIABLES_REFERENCE.md](./ENVIRONMENT_VARIABLES_REFERENCE.md)
- [docs/DELIVERY_INDEX.md](./DELIVERY_INDEX.md)
- [apps/license-server/src/requestProtectionStore.js](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/apps/license-server/src/requestProtectionStore.js)
- [scripts/runtime/prepare-duckdns-staging-env.js](/C:/Users/asus/Desktop/SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed/scripts/runtime/prepare-duckdns-staging-env.js)
