# Ministry Official Standards Intake

Review date: 2026-08-13

Purpose: maintain a controlled intake register for official Ministry of Education supplier standards from `sapakim.education.gov.il` before SOM PRO claims formal Ministry compliance.

This document separates two kinds of evidence:

- Security readiness evidence: repository controls, tests, staging checks, DAST/ZAP, audit, backup, tenant isolation, MFA, and release artifacts.
- Official Ministry compliance evidence: archived official Ministry documents, SHA-256 hashes, exact versions/dates, reviewer approval, and mapped control IDs.

## Compliance Claim Guardrail

SOM PRO must not claim formal Ministry supplier compliance until all applicable official documents are archived, hashed, mapped, and approved.

Allowed wording while intake is incomplete:

`Technical and security readiness evidence exists; formal Ministry supplier compliance requires official standards intake, control mapping, and Ministry/security review.`

Disallowed wording while any required document remains `Missing` or `Downloaded`:

- `Ministry compliant`
- `Approved by the Ministry`
- `Fully compliant with Ministry supplier standards`
- `Certified for Ministry supplier requirements`

## Official Document Intake Register

Allowed status values:

- `Missing`: document has not been obtained.
- `Downloaded`: original document is archived and hashed, but not mapped.
- `Mapped`: exact clauses are mapped to controls/tests, but not approved.
- `Approved`: mapped controls were reviewed and signed off by the owner.

| Control ID | Required official document | Source URL | Document title | Download date | Version / publication date | SHA-256 | Archive path | Review owner | Status | Mapped control IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOS-001 | Ministry supplier information security standard | TBD from `sapakim.education.gov.il` | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | Product owner + security reviewer | Missing | TBD |
| MOS-002 | Privacy procedure for technological products | TBD from `sapakim.education.gov.il` | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | Legal/privacy owner | Missing | TBD |
| MOS-003 | Pedagogical management software standard | TBD from `sapakim.education.gov.il` | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | Product owner + backend owner | Missing | TBD |
| MOS-004 | Technology compatibility standard | TBD from `sapakim.education.gov.il` | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | QA/accessibility owner | Missing | TBD |
| MOS-005 | Scheduling and teaching staff management standard | TBD from `sapakim.education.gov.il` | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | Product owner + scheduling owner | Missing | TBD |
| MOS-006 | Ministry IDM/OIDC/SAML integration requirements | TBD from `sapakim.education.gov.il` or official IdP onboarding source | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | Security/identity owner | Missing | TBD |
| MOS-007 | Official data exchange/API interface specification | TBD from `sapakim.education.gov.il` or official Ministry integration source | TBD | TBD | TBD | TBD | `docs/official-ministry-standards/` | Backend/integration owner | Missing | TBD |

## Public Context Sources

Public Ministry pages may inform readiness work, but they are not a substitute for official supplier standards unless the Ministry explicitly designates them as controlling requirements.

| Source | Status | Relevant themes | Project mapping |
| --- | --- | --- | --- |
| `https://pop.education.gov.il/sherutey-tiksuv-bachinuch/data-security-e-learning/` | Public context only | Safe digital learning environments, privacy, cyber reporting, approved technology tools | Security controls, incident response, privacy, audit evidence |
| `https://pop.education.gov.il/sherutey-tiksuv-bachinuch/ict-technology-coordinator-portfolio/school-electronic-organization/` | Public context only | Unified identification, approved digital tools, pedagogical management software functions, information security | SSO/OIDC readiness, route inventory, role/access controls |
| `https://edu-tech.education.gov.il/taknot/kol-kore/authorities-genetic-laboratory/` | Public context only | Approved technological suppliers, Ministry security/privacy review, IDM connection references | Supplier approval dependency, SSO/IDM requirement tracking |
| `https://www.mr.gov.il/` | Procurement context only | Procurement publications and tender metadata | Procurement context; not a substitute for supplier security standards |

## Intake Procedure

1. Download the original official document from `sapakim.education.gov.il` or the approved Ministry source.
2. Store the original unmodified file in `docs/official-ministry-standards/`.
3. Compute SHA-256 for the archived file and record it in the intake register.
4. Record source URL, document title, version/publication date, download date, archive path, and review owner.
5. Change status to `Downloaded` only after URL, archive path, and SHA-256 are recorded.
6. Map clauses to `docs/MINISTRY_COMPLIANCE_MATRIX.md`, tests, scripts, and manual evidence; then change status to `Mapped`.
7. Obtain owner/legal/security approval; then change status to `Approved`.
8. Update `docs/MINISTRY_EVIDENCE_INDEX.md` and `docs/MINISTRY_TEST_PLAN.md`.

## Mapping Rules

- Every mapped clause must reference a control ID from this register.
- Every code-verifiable requirement should have an automated test or script.
- Every staging/infrastructure/legal requirement should have a dated manual evidence artifact.
- Public context pages may be cited separately, but must not close a `MOS-*` official standard row.
- If an official document conflicts with current tests/docs, the Ministry document controls and the gap must be added to `docs/MINISTRY_COMPLIANCE_MATRIX.md`.

## Current Result

As of 2026-08-13, all official Ministry supplier documents in this register are `Missing`.

Repository evidence supports security readiness tracking, but not formal Ministry compliance certification.
