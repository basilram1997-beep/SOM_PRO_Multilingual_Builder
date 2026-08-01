# WEB_QUALITY_GAPS_AR

## What is now improved

- The frontend and owner portal now carry clearer metadata and are marked `noindex`.
- A real CI workflow is present for build, lint, test, and check.
- The recommended runtime version is documented in `.nvmrc`.
- A robots file blocks indexing of the internal frontend.

## Why the remaining items are still not fully "Done"

### Cookie and Consent Review

- The application is an internal school dashboard, not a public marketing site.
- There is no full consent flow because the product does not currently expose marketing cookies or tracking banners.
- This should be revisited only if analytics, ads, or external embeds are added.

### White-Label / Branding Readiness

- The product still contains fixed SOM PRO branding in titles, installer surfaces, and owner portal copy.
- A white-label pass would require centralizing brand strings and testing replacement behavior.

### CI/CD

- CI now exists, but CD is still not fully wired to an automatic staging or production deploy pipeline.

### SEO

- The app is not intended to be discoverable on search engines.
- `noindex,nofollow` is now in place, which is the correct behavior for this kind of internal app.

### Analytics and Tracking

- No analytics platform is enabled in the current repo.
- This is intentional for a school operations dashboard until a real product decision is made.

### Caching

- There is no explicit cache policy documented yet for every screen and every API flow.
- Sensitive data should not rely on browser cache behavior alone.

### File Uploads

- The core school flows currently do not depend on file upload.
- This remains unclassified until a real upload feature is added.

### Browser Compatibility

- The app needs manual verification across Chrome, Edge, Firefox, and Safari-like environments.
- The codebase is not yet backed by a full browser matrix run.

### Stress Test

- No full load test has been run yet against a real staging target.

### Payments and Sensitive Operations

- The current product does not contain a payment flow.
- If payments are added later, they need dedicated idempotency and retry rules.

## Practical next step

- Keep these items in the review list.
- Mark only what is truly measurable as Done.
- Use external verification for browser, staging, and install-related readiness.

## Data and Database Review

- The current backend validates school-scoped data before saving in the core routes.
- No demo seed data should remain active in production; the existing seed is intentionally clean for new installs.
- No schema change was required for this pass.
- Any future schema migration should be treated as a review item before release.

## File Uploads

- The core school flows do not expose file upload endpoints yet.
- Any future upload feature should validate file size, file type, and safe storage, and it should reject unsafe multipart content on routes that are meant to stay JSON-only.

## Search, Filtering, and Pagination

- Search and filtering exist in some pages, but pagination is not yet standardized across the whole project.
- The current lists are small enough to work without a global lazy-loading layer.
- Pagination or lazy loading should be introduced only when a specific list becomes large enough to need it.

## Caching

- The app uses only limited caching / persistence where it is explicitly useful.
- Sensitive values should not stay in browser storage longer than necessary.
- Any new cache behavior should be documented per screen or flow.

## Local Storage and Session Storage

- The language preference is stored as a simple non-sensitive value.
- Student grade-entry drafts are stored only as local page drafts, and invalid or corrupted drafts are now discarded safely.
- The owner portal no longer persists the owner token in browser session storage; it stays in memory for the current session only.
- School login persistence still exists for the explicit "remember me" flow, but no password or license code is stored in that remembered payload.
- Any future browser-storage keys should use clear names and must be reviewed before they are treated as persistent product data.

## Analytics and Tracking

- No analytics platform is configured in the repository.
- No tracking script or event collection library is currently enabled.
- This is intentional for an internal school system; analytics should only be added after a real product decision.

## SEO

- The application is an internal dashboard and owner portal, not a public marketing site.
- `noindex,nofollow` is already in place on the main frontend and license portal, which is the correct default here.
- No additional SEO work is needed unless a public site is introduced later.

## Environment and Configuration

- Real secrets belong in `.env` files only, and the repository already ignores local `.env` files.
- Example environment files exist for development, staging, production, SaaS, and local trial modes.
- Production should not rely on hardcoded localhost values; the runtime mode and API URLs must come from environment-specific configuration.

## Dependencies and Licenses

- The project uses standard open-source dependencies for React, Express, Prisma, Electron, and build tooling.
- Build-time tooling such as Prisma and Electron packaging is intentionally allowed through the scripted allowlist.
- No additional large dependency was added for the storage/security cleanup.
- A recent `npm audit --omit=dev` pass reported 0 vulnerabilities.
- A periodic `npm audit` / `npm outdated` pass is still recommended before a commercial release, especially if any dependency list changes.

## Assets

- The brand assets in `assets/brand/` are referenced from the web page, frontend favicon, desktop installer, README, and desktop shell screens.
- I did not find an unused brand asset in the current pass.
- The existing icon files should be kept together because they serve different packaging targets:
  - `.png` for web/docs
  - `.svg` for scalable branding
  - `.ico` for Windows/Electron
- No unknown external asset files were introduced in this cleanup pass.

## Repository Hygiene

- `.gitignore` already excludes `.env`, build output, release artifacts, and logs.
- Generated installers were removed from the repository root `release/` folder.
- Generated desktop installers and unpacked release output were removed from `apps/desktop/release/`.
- The remaining `logs/` files are generated runtime output; one or more are currently held open by a live local process, so they should be cleaned once that process stops.
- No temporary notes or cache folders were added in this pass.

## Build and Deployment Readiness

- Build, lint, and tests still pass after the cleanup work.
- README already documents build and deployment paths, environment variables, QA checklist, and handoff notes.
- The production build does not rely on `localhost` as the main documented deployment path.
- Scripts are present for:
  - development
  - desktop trial
  - desktop SaaS
  - staging checks
  - production checks
- Debug-only artifacts are already kept out of the tracked source tree.

## CI/CD

- A real GitHub Actions workflow is present at `.github/workflows/ci.yml`.
- It runs:
  - install
  - lint
  - build
  - test
  - full check
- There is no automatic deployment step yet, which is appropriate for the current stage.

## Required README

- The README is already practical and unusually detailed for a project of this size.
- It contains the important operational sections that a handoff buyer or new developer needs.
- It would still benefit from a smaller cleanup pass later to reduce the Arabic mojibake in the current copy, but that is a text-quality issue rather than a structural one.

## Rate Limiting and Abuse Protection

- Sensitive login and license routes now have a light in-memory rate limit.
- This is a good first layer, but it should still be reviewed under staging load.
- If the service is exposed publicly, stronger abuse protection may still be needed.
- Multipart uploads are rejected on the JSON-only auth/license routes, because the app does not currently expose real file upload flows.
- Rate-limit violations and multipart blocks are written to `AuditLog` as security events.
