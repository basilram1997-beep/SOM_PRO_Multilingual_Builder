# Production External Evidence

Generated at: 2026-09-06T21:29:40.487Z

Target: `https://som-pro.pages.dev`

| Check | Status | Evidence |
| --- | --- | --- |
| DNS | PASS | `som-pro.pages.dev` resolved to `172.66.44.219`, `172.66.47.37`. |
| HTTPS redirect | PASS | `http://som-pro.pages.dev/` returned `301` to `https://som-pro.pages.dev/`. |
| HSTS/security headers | PASS | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. |
| Health | PASS | `https://som-pro.pages.dev/healthz` returned `200`. |
| Cloudflare edge | PASS | `server: cloudflare`, `cf-ray` present. |
| Database evidence | PASS | `docs/test-reports/database-verification-latest.md` is closed with `Overall status: PASS`. |

Source command:

```bash
PRODUCTION_URL=https://som-pro.pages.dev/ npm run production:external:verify
```

Generated local artifacts:

- `reports/security/production-external-evidence.json`
- `reports/security/production-external-evidence.md`

The generated `reports/` artifacts are intentionally ignored by Git; this tracked summary preserves the delivery evidence.
