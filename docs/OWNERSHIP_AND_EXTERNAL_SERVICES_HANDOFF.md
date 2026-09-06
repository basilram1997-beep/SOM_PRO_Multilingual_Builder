# Ownership And External Services Handoff

Last reviewed: 2026-09-07

Use this checklist before transferring SOM PRO to a buyer, customer, or operations team. The repository can prove local build, tests, database creation, Docker production compose, and migration behavior, but these external accounts must be handed over by their real owners.

## Required Ownership Transfer

| Area | Required owner / evidence | Handoff action |
| --- | --- | --- |
| GitHub repository | Repository owner and admin maintainers | Transfer repository or add customer admins, review branch protection, and document release tags. |
| GitHub Actions secrets | GitHub org/repo administrator | Recreate secrets in the buyer-owned repo or environment; never export plaintext secrets through Git. |
| DNS/domain | Domain registrar owner, if a custom domain is required | Transfer domain or delegate DNS zone administration; archive final records for app/API/license hostnames when branded DNS is used. `https://som-pro.pages.dev` is acceptable as the commercial web origin when no custom domain is required. |
| Cloudflare account/tunnel | Cloudflare account owner | Transfer Cloudflare Pages project ownership for `https://som-pro.pages.dev`, and transfer zone/tunnel ownership or create a buyer-owned Named Tunnel if backend/license routing uses Cloudflare. Rotate tunnel credentials after handoff. |
| VPS/server | Hosting account owner | Transfer billing/admin access, SSH key policy, firewall rules, backup paths, and recovery contacts. |
| PostgreSQL | Database administrator | Rotate `POSTGRES_PASSWORD` and `DATABASE_URL`; verify least-privilege runtime and migration users. |
| Redis | Platform/database administrator | Rotate `REDIS_PASSWORD`, `REDIS_URL`, and `LICENSE_REDIS_URL`; keep Redis private to the deployment network. |
| Secret manager/KMS | Security/DevOps owner | Record provider, key IDs, access policy, rotation cadence, and emergency recovery owner. |
| License admin | Product/security owner | Rotate `LICENSE_ADMIN_TOKEN`; assign owner portal administrators and offboarding rules. |
| Backup encryption | Security/operations owner | Transfer backup passphrase/KMS material, prove restore access, and document RPO/RTO sign-off. |
| Windows code signing | Release manager | Transfer certificate ownership or issue a buyer-owned certificate; keep signing password outside Git. |
| Mobile signing | Mobile release manager | Transfer Apple/Google developer accounts, signing keys, and store release permissions. |

## Final External Proof Required

Before claiming a real production deployment is complete, archive:

- HTTPS commercial web URL: `https://som-pro.pages.dev/`, plus API/license URLs if routed under Pages or deployed separately.
- DNS or Cloudflare route evidence.
- Successful production migration log from the target environment.
- Successful smoke test after migration.
- Backup creation and restore drill evidence.
- Secret rotation confirmation after handoff.
- Signed Windows installer or documented unsigned-distribution exception.
- Mobile signing/build account confirmation if mobile builds are in scope.
- `reports/security/production-external-evidence.json` from `PRODUCTION_URL=https://... npm run production:external:verify`.
- Current Cloudflare Pages commercial site evidence is tracked at `docs/test-reports/production-external-evidence-2026-09-06T22-54-35-733Z.md`.

## Non-Repository Boundary

Do not mark these items complete from source code alone. They require account access, billing ownership, DNS/provider control, or legal/security sign-off outside the repository.
