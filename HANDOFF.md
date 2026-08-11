# SOM PRO - Handoff Guide

This is the short starting point for the next developer, reviewer, or buyer.

## Canonical references

- `README.md` for the full setup and repository reference
- `docs/DELIVERY_INDEX.md` for the live documentation map
- `SALE_READINESS_REPORT.md` for the current release and handoff status
- `KNOWN_ISSUES.md` for open gaps and their priority
- `docs/USER_INSTALL_CHECKLIST_AR.md` for the end-user install path
- `docs/RELEASE_PROCESS_AR.md` for the release workflow

## What SOM PRO is

SOM PRO is a hybrid school operations system with:

- a web frontend
- a backend API
- a separate license server
- a Windows desktop app
- shared logic and types in `packages/shared`

## Current operating state

- The app runs locally.
- The main build passes.
- The browser usability flow passed in this branch.
- The volume runner passed on `tiny` and `normal`.
- The migration / upgrade integration path passed.
- Stress recovery was verified in the login / outage path.
- Backup and restore are formally closed within the current release scope, but the runbook remains part of the handoff.

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

## Acceptance snapshot

| Area                  | Status    | Notes                                           |
| --------------------- | --------- | ----------------------------------------------- |
| Local run             | Automated | Main app flow starts locally                    |
| Core tests            | Automated | Backend and browser smoke coverage are in place |
| Browser usability     | Automated | Passed in this branch                           |
| Volume tiny / normal  | Automated | Passed in this branch                           |
| Migration upgrade     | Automated | Passed in this branch                           |
| Stress recovery       | Automated | Login / outage recovery passed                  |
| Firefox browser       | Manual    | Not installed on this machine                   |
| Screen sizes          | Manual    | Still needs a full manual pass                  |
| School printers       | Manual    | Still needs a full manual pass                  |
| Slow network          | Manual    | Still needs a full manual pass                  |
| Older device          | Manual    | Still needs a full manual pass                  |
| Clean Windows install | Manual    | Still needs a real-device pass                  |
| Backup / restore      | Complete  | Closed within the current release scope         |

## Notes

- Historical phase reports and old fix notes live under `docs/` as archive material.
- They are useful for context, but they are not the delivery baseline.
- If you only read one document after this file, read `README.md`.
