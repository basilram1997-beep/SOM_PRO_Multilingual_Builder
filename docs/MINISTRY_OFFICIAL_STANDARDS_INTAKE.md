# Ministry Official Standards Intake

Review date: 2026-08-12

Purpose: keep a controlled intake log for official Ministry of Education standards before SOM PRO claims formal compliance. This document separates confirmed public evidence from standards that still require an official supplier-portal PDF, version, date, and archive copy.

## Current Verification Result

`sapakim.education.gov.il` supplier standards were searched during this review, but the exact supplier standards package was not retrievable from the current environment. SOM PRO must not claim formal Ministry supplier compliance until the official supplier documents are obtained and archived.

Public Ministry pages found during the review support the following control themes:

| Source | Status | Relevant themes | Project mapping |
| ------ | ------ | --------------- | --------------- |
| Ministry pedagogical portal, information security basics: `https://pop.education.gov.il/sherutey-tiksuv-bachinuch/data-security-e-learning/` | Public page found | Safe digital learning environments, protection of student/teacher privacy, cyber incident reporting, approved technology tools | Security controls, incident response, privacy, audit evidence |
| Ministry pedagogical portal, school as a digital organization: `https://pop.education.gov.il/sherutey-tiksuv-bachinuch/ict-technology-coordinator-portfolio/school-electronic-organization/` | Public page found | Unified identification, approved digital tools, pedagogical management software functions, information security | SSO/OIDC readiness, pedagogical route inventory, role/access controls |
| Ministry edu-tech AI call page: `https://edu-tech.education.gov.il/taknot/kol-kore/authorities-genetic-laboratory/` | Public page found | Approved technological suppliers, Ministry security/privacy review, IDM connection references | Supplier approval dependency, SSO/IDM requirement tracking |
| Israeli government procurement portal examples under `mr.gov.il` | Public tender pages found | Procurement publications and supplier/tender metadata | Procurement context only; not a substitute for supplier security standards |

## Required Official Documents

The product owner/compliance owner must obtain and archive the exact official documents below:

| Required document | Required evidence fields | Current status |
| ----------------- | ------------------------ | -------------- |
| Ministry supplier information security standard | Source URL, document title, version, publication/update date, downloaded PDF hash, reviewer, mapped control IDs | Missing |
| Privacy procedure for technological products | Source URL, version/date, legal/privacy reviewer, mapped retention/export/delete requirements | Missing |
| Pedagogical management software standard | Source URL, version/date, required data fields/interfaces, test mapping | Missing |
| Technology compatibility standard | Source URL, browser/device/accessibility criteria, acceptance matrix | Missing |
| Scheduling and teaching staff management standard | Source URL, version/date, scheduling/teacher workload/interface requirements | Missing |
| Ministry IDM/OIDC/SAML integration requirements | IdP metadata source, claim mapping, MFA assurance, logout/session rules | Missing |
| Official data exchange/API interface specification | Interface version, transport/security requirements, conformance examples | Missing |

## Intake Procedure

1. Download the official document from the Ministry or supplier portal.
2. Store the original file in the controlled evidence archive outside production runtime storage.
3. Record SHA-256, source URL, retrieval timestamp, document title, version, and reviewer.
4. Update `docs/MINISTRY_COMPLIANCE_MATRIX.md` from `Needs Verification` to mapped requirement rows only after the exact text is reviewed.
5. Add or update automated tests for every control that can be verified in code.
6. Keep a signed/manual evidence item for controls that require staging, legal, procurement, or Ministry approval.

## Non-Compliance Guardrail

Until the official supplier documents are obtained, repository evidence can support technical readiness only. External statements should use wording such as:

`Technical readiness baseline exists; formal Ministry supplier compliance requires official standards intake, control mapping, and Ministry/security review.`
