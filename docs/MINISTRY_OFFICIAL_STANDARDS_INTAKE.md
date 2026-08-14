# Ministry Official Standards Intake

Review date: 2026-08-15

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

## Ready-To-Receive Checklist

When an official file or link is provided, close the matching row using this sequence:

| Step | Action | Required field |
| --- | --- | --- |
| 1 | Save the original unmodified document. | `Archive path` |
| 2 | Record the exact official source URL. | `Source URL` |
| 3 | Record the visible document title and version/publication date. | `Document title`, `Version / publication date` |
| 4 | Record the local download date. | `Download date` |
| 5 | Calculate SHA-256 from the archived file. | `SHA-256` |
| 6 | Change status from `Missing` to `Downloaded`. | `Status` |
| 7 | Map clauses to controls/tests in `docs/MINISTRY_COMPLIANCE_MATRIX.md`. | `Mapped control IDs` |
| 8 | Owner signs off and status becomes `Approved`. | `Review owner`, `Status` |

Suggested archive names:

| Standard | Suggested file name |
| --- | --- |
| Supplier information security | `MOS-001_supplier-information-security-standard_YYYY-MM-DD_original.pdf` |
| Privacy procedure | `MOS-002_privacy-procedure-technological-products_YYYY-MM-DD_original.pdf` |
| Pedagogical management software | `MOS-003_pedagogical-management-software-standard_YYYY-MM-DD_original.pdf` |
| Technology compatibility | `MOS-004_technology-compatibility-standard_YYYY-MM-DD_original.pdf` |
| Scheduling and teaching staff | `MOS-005_scheduling-teaching-staff-standard_YYYY-MM-DD_original.pdf` |
| Ministry identity integration | `MOS-006_ministry-idm-oidc-saml-requirements_YYYY-MM-DD_original.pdf` |
| Ministry data exchange/API | `MOS-007_ministry-data-exchange-api-spec_YYYY-MM-DD_original.pdf` |
 

## Intake Automation

Generate the archive/register evidence report:

```bash
npm run ministry:standards:intake
```

Before any Ministry submission attempt, run strict mode:

```bash
MINISTRY_STANDARDS_INTAKE_STRICT=true npm run ministry:standards:intake
```

The script writes:

```text
reports/ministry-standards/official-standards-intake.json
reports/ministry-standards/official-standards-intake.md
```

Strict mode must fail while any `MOS-*` row is not `Approved`, while an archived file is missing, or while a recorded SHA-256 does not match the archived file.

## Mapping Rules

- Every mapped clause must reference a control ID from this register.
- Every code-verifiable requirement should have an automated test or script.
- Every staging/infrastructure/legal requirement should have a dated manual evidence artifact.
- Public context pages may be cited separately, but must not close a `MOS-*` official standard row.
- If an official document conflicts with current tests/docs, the Ministry document controls and the gap must be added to `docs/MINISTRY_COMPLIANCE_MATRIX.md`.

## Current Result

As of 2026-08-15, all official Ministry supplier documents in this register are `Missing`.

Repository evidence supports security readiness tracking, but not formal Ministry compliance certification.
