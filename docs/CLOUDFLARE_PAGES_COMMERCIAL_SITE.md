# Cloudflare Pages Commercial Site

Last reviewed: 2026-09-07

## Decision

`https://som-pro.pages.dev/` is the approved commercial web origin for SOM PRO delivery.

This means the `pages.dev` URL is not a temporary demo URL for this handoff. It is the customer-facing commercial site unless a buyer or operator later requests a branded custom domain.

## What Is Proven

- Cloudflare Pages serves the public SOM PRO commercial web site.
- HTTPS is enforced through Cloudflare.
- Security headers are configured in `web-page/_headers` and `apps/frontend/public/_headers`.
- The latest tracked external evidence is `docs/test-reports/production-external-evidence-2026-09-06T22-54-35-733Z.md`.
- Production env examples use `https://som-pro.pages.dev` as the public app origin.

## Backend And License Routing

The commercial web origin may route backend and license traffic as:

```text
https://som-pro.pages.dev/api
https://som-pro.pages.dev/license
```

Use those paths only when Cloudflare Pages, a Worker, Tunnel, reverse proxy, or hosting edge actually forwards them to the production backend and license server.

If backend or license services are deployed on separate HTTPS hosts, keep:

```env
APP_URL=https://som-pro.pages.dev
PUBLIC_APP_URL=https://som-pro.pages.dev
CORS_ORIGIN=https://som-pro.pages.dev
```

and set the service URLs explicitly:

```env
SOM_API_URL=https://<operator-api-host>/api
SOM_LICENSE_SERVER_URL=https://<operator-license-host>/license
SOM_PRO_LICENSE_SERVER_URL=https://<operator-license-host>/license
```

## Custom Domain Policy

A custom domain is optional. It becomes required only if the commercial agreement requires branded DNS.

If a custom domain is added later:

1. Keep `https://som-pro.pages.dev` working or redirect it intentionally.
2. Add the custom hostname in Cloudflare Pages.
3. Update production env values and CORS origins.
4. Rerun `PRODUCTION_URL=https://<custom-domain> npm run production:external:verify`.
5. Archive the new evidence report under `docs/test-reports/`.

## Delivery Status

The source repository can treat Cloudflare Pages as the commercial web site now. Remaining external delivery items are account ownership, DNS/custom-domain decisions if requested, real backend/license deployment credentials, production secret rotation, and signing accounts.
