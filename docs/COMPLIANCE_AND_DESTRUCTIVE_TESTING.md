# Compliance and Destructive Testing

This document defines the product-level readiness checks for commercial, legal, and destructive testing.
It is part of the external-review pack and is meant to be ready for external review and approval, not to claim certification.

## Important note

These checks are readiness and hardening checks only.
They are **not** a legal certification and do **not** claim formal GDPR, HIPAA, PCI-DSS, ISO 27001, or other certification status.
Any actual certification or legal sign-off must be completed by the responsible organization and reviewed by qualified professionals.

## Commercial and compliance scope

The project should demonstrate the following baseline controls:

- GDPR-style privacy controls: data minimization, purpose limitation, retention control, export warnings, and deletion or anonymization support.
- HIPAA-style safeguards where healthcare data could ever be introduced: access control, audit logging, least privilege, and restricted sharing.
- PCI-DSS-style scope control: payment card data must stay out of the MVP unless a separate approved payment design is introduced later.
- Masked or fake staging data only.
- Controlled export, deletion, and backup workflows.
- Explicit audit trails for sensitive actions.

## Destructive testing scope

Destructive testing is limited to safe environments and should focus on:

- Invalid input and boundary values.
- Duplicate records and foreign-key conflicts.
- Delete, anonymize, and export workflows.
- Permission bypass attempts.
- Rate-limit and request-protection boundaries.
- Recovery behavior after an intentional failure.

The goal is to verify that the system fails closed, logs the attempt, and keeps unrelated school data intact.
