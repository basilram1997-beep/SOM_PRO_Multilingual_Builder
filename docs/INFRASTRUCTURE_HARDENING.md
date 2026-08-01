# Infrastructure Hardening

## Purpose

This document turns the infrastructure checklist into a concrete operating baseline for SOM PRO.

## Required production baseline

- Public traffic must terminate over HTTPS only.
- Administrative interfaces must stay behind authentication and role checks.
- Firewalls must expose only the ports required for the chosen deployment.
- VPC or equivalent private network isolation must be used for backend, database, and file storage.
- School data must remain inside the backend and approved storage layers, not on desktop clients.
- Backups and exports must remain encrypted.
- MFA must be enabled for privileged access.

## Security controls that are not optional

- Request protection on sensitive routes.
- Route-specific rate limiting for login, licensing, export, and other sensitive actions.
- Audit logging for create, update, delete, deny, export, and permission changes.
- Safe secrets management with no hardcoded keys.
- Supported runtime and dependency versions only.
- Monitoring and health checks for the core services.
- Controlled third-party allowlist only.

## Operational evidence

These controls should be backed by:

- `SECURITY_REQUIREMENTS.md`
- `HOSTING_REQUIREMENTS.md`
- `MONITORING_AND_HEALTHCHECKS_AR.md`
- `SECURITY_UPDATES.md`
- `PRODUCTION_SECURITY_CHECKLIST_AR.md`

## Review rule

- Any production infrastructure change must be treated as a security change.
- The security owner must review changes before release.
- Exceptions must be recorded and approved in writing.
