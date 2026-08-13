# Cloudflare Quick Tunnel Demo Report

Date: 2026-08-13

Classification: temporary external reachability proof only.

This report documents a local SOM PRO external demo through Cloudflare Quick Tunnel. It is not stable staging evidence and must not be used as Ministry submission evidence.

## Run Summary

| Item | Result |
|---|---|
| Runner command | `npm.cmd run staging:tunnel:demo` |
| Cleanup command | `npm.cmd run staging:tunnel:demo:cleanup` |
| Temporary URL | `https://migration-computing-settled-columnists.trycloudflare.com` |
| Frontend probe | `200`, title `SOM PRO | School Operations Manager` |
| API probe | `200`, `/api/version` returned `0.9.0-rc.1` |
| Evidence JSON | `reports/security/cloudflare-quick-tunnel-trial.json` |
| Evidence Markdown | `reports/security/cloudflare-quick-tunnel-trial.md` |
| Ministry submission evidence | No |

## Findings

- The first runner attempt exposed a timing bug: the script collected evidence immediately after Cloudflare printed the random URL, before the tunnel connection was fully registered.
- The runner was fixed to wait for `Registered tunnel connection` before collecting evidence.
- The evidence step now retries while the temporary Cloudflare URL warms up.
- The runner remains explicitly demo-only and does not bypass strict staging rules.

## Evidence Snapshot

The generated local JSON report recorded:

```json
{
  "classification": "temporary-external-reachability-proof",
  "ministrySubmissionEvidence": false,
  "provider": "cloudflare-quick-tunnel",
  "stableHostname": false,
  "frontendStatus": 200,
  "apiVersionStatus": 200,
  "version": "0.9.0-rc.1"
}
```

## Closure

The tunnel must be closed after the demo. Once closed, the temporary URL is expected to stop working.

For real staging or Ministry evidence, use a stable Named Tunnel or VPS hostname and run:

```powershell
STAGING_URL=https://stable-staging.example.com ZAP_USE_DOCKER=true npm run security:dast
STAGING_URL=https://stable-staging.example.com STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence
```
