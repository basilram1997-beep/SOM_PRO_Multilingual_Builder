# Business Continuity

## Purpose

This document outlines the minimum continuity expectations for SOM PRO.

## Design goals

- Prefer stateless backend services where possible.
- Keep persistent data in PostgreSQL and durable object storage.
- Make backups and restores an explicit part of operations.
- Avoid desktop-local storage for any real school data.
- Design for regional failover or equivalent recovery options when the deployment environment supports them.

## Resilience targets

- Target values for RTO and RPO should be defined per deployment and customer agreement.
- Final values should be documented before production go-live.
- The deployment plan should state whether availability-zone redundancy, region failover, or a documented single-region recovery model is being used.

## Failure handling

- If a service fails, the system should fail safely and preserve data integrity.
- If the network is interrupted, sensitive operations should not silently succeed.
- If the license server is temporarily unavailable, behavior should follow the approved grace policy.

## Storage guidance

- Use durable object storage for exported files and backups.
- Keep backups encrypted and separated from the primary database.
- Keep restore procedures documented and periodically tested.
- Never reuse a production backup as a development seed unless it has been anonymized or masked first.
- Production-origin data must remain isolated from local developer storage.
- If the chosen cloud provider supports multiple availability zones, the production plan should state how the database, app, and storage survive a zone failure.

## Operational checklist

- Backup jobs are recorded.
- Restore tests are documented.
- Production data is not copied into development without masking.
- Recovery steps are known to the support owner.
- Any approved production-to-nonproduction copy is logged with the masking method and approver.
- The continuity plan states the chosen region and whether availability zones are used.
