# SOM PRO - Handoff Guide

This file is the short starting point for a new developer or buyer receiving the project.

## Canonical references

- `README.md` for setup, structure, and full repository reference
- `SALE_READINESS_REPORT.md` for the final readiness status and acceptance matrix
- `TECHNICAL_AUDIT_REPORT.md` for the technical audit summary
- `MANUAL_ACCEPTANCE_CHECKLIST.md` for the manual verification steps

## What SOM PRO is

SOM PRO is a hybrid school operations system with:

- a web frontend
- a backend API
- a separate license server
- a Windows desktop app
- shared logic and types in `packages/shared`

## Quick setup

1. Install dependencies:

```bash
npm install
```

2. Prepare the environment files listed in `README.md`.
3. Start PostgreSQL and Redis if you are using the local trial path.
4. Run database setup:

```bash
npm run setup:db
```

5. Start the app:

```bash
npm run dev
```

6. Start the license server when the local flow depends on it:

```bash
npm run dev:license-server
```

## Current state

- The app runs locally.
- The main build passes.
- The core automated tests pass.
- Multi-school isolation and licensing are covered by tests.
- Auth sessions are protected by logout invalidation and an explicit inactivity timeout.
- Backup and restore are formally closed within the current release scope.

## Where to look

- Frontend: `apps/frontend/src/`
- Backend: `apps/backend/src/`
- Desktop: `apps/desktop/src/`
- License server: `apps/license-server/src/server.js`
- Shared code: `packages/shared/src/`

## Production reminder

Use `SALE_READINESS_REPORT.md` as the canonical production reference. Keep local `.env` files on the developer machine only, use the `*.production.example` files on the server, and run releases only from a clean checkout with the committed lockfile.

## Acceptance summary

| Area                  | Status    | Notes                                                                        |
| --------------------- | --------- | ---------------------------------------------------------------------------- |
| Local run             | Automated | The app starts locally and the main build passes                             |
| Core tests            | Automated | Backend and browser smoke coverage are in place                              |
| Chrome browser        | Automated | Passed in this session                                                       |
| Edge browser          | Automated | Passed in this session                                                       |
| Firefox browser       | Manual    | Not installed on this machine                                                |
| Screen sizes          | Manual    | Still needs a full manual pass                                               |
| School printers       | Manual    | Still needs a full manual pass                                               |
| Slow network          | Manual    | Still needs a full manual pass                                               |
| Older device          | Manual    | Still needs a full manual pass                                               |
| Clean Windows install | Manual    | Still needs a real-device pass                                               |
| Backup / restore      | Complete  | Backup and restore are now formally closed within the current release scope. |

## Notes

- Historical phase reports and fix notes live under `docs/` as archive material.
- They are useful for context, but they are not the delivery baseline.
- If a new developer only reads one document after this file, it should be `README.md`.
