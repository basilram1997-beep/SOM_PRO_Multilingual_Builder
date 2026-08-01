# OWASP Top 10 Readiness

This document maps SOM PRO security controls to the OWASP Top 10 risk areas that matter for this product.

## Status

- SAST / DAST / SSDLC: complete within the current scope as a documented and enforceable workflow.
- OWASP Top 10 coverage: complete within the current scope for the product areas that exist today.
- External penetration testing: still required as a separate release gate before final commercial closure.

## Coverage map

### Broken Access Control

- Backend permission checks are required on every sensitive endpoint.
- School, class, subject, and assignment scope must be checked server-side.
- Cross-school access must be rejected.

### Cryptographic Failures

- HTTPS/TLS is required in production.
- Passwords are hashed.
- Keys are not hardcoded.
- Exports and backups are protected at rest.

### Injection

- Inputs are validated server-side.
- ORM / parameterized access is required.
- Sensitive outputs must be escaped or templated safely.

### Insecure Design

- Least privilege is required.
- Audit logging is mandatory for sensitive actions.
- School-scoped workflows must fail closed on missing authorization.

### Security Misconfiguration

- Production hardening is documented.
- Admin access requires MFA.
- Sensitive local storage is not allowed.
- Third-party integrations are closed by default.

### Vulnerable and Outdated Components

- Dependency scanning is part of the release flow.
- Known vulnerable packages must be reviewed before release.

### Identification and Authentication Failures

- Session timeout is required.
- MFA is expected for administrative access.
- Rate limiting is required on login and sensitive operations.

### Software and Data Integrity Failures

- Audit logs are append-only in practice.
- Release checks should block unreviewed sensitive changes.
- Export and backup flows are logged.

### Logging and Monitoring Failures

- Audit events must be structured.
- Failed access attempts and rate-limit blocks must be logged.
- Security events must be exportable for monitoring / SIEM.

### SSRF

- Future outbound integrations must be allowlisted and approved.
- Third-party services are disabled by default.
- Sensitive data must not be sent to uncontrolled endpoints.

## Notes

- This mapping is intentionally practical and product-specific.
- If a future feature introduces a new risk class, the mapping should be updated before release.
