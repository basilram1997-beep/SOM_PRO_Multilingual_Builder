# Known Issues

This file lists the remaining issues that are not fully closed yet.

## P0 - Blocks sale or operation

- None currently confirmed in local checks.

## P1 - Important before sale

| Issue                                                                 | Impact                                        | Recommendation                                            |
| --------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Real staging validation is still required                             | Commercial SaaS readiness is not fully proven | Run the staging plan on a real domain with HTTPS          |
| Windows installer is not code-signed unless a certificate is provided | Trust and install warnings may appear         | Sign the installer before broad distribution              |
| License server storage still relies on local JSON for some flows      | Long-term SaaS durability is weaker           | Move production license storage to managed server storage |

## P2 - Good improvement but does not block sale

| Issue                                                                | Impact                                            | Recommendation                       |
| -------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| Browser compatibility is not fully verified on every target browser  | Possible layout or form edge cases                | Run a browser matrix QA pass         |
| Accessibility still needs broader human review                       | Some small UX/accessibility gaps may remain       | Run a manual accessibility checklist |
| README still contains some legacy copy that could be cleaned further | Documentation is readable, but not fully polished | Do a final documentation polish pass |
| External-review packaging still needs a final buyer/legal pass       | Approval may still depend on reviewer feedback    | Run the external review pack end to end |

## P3 - Optional future improvement

| Issue                                           | Impact                                     | Recommendation                                                          |
| ----------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| White-label branding is not centralized yet     | Branding changes require more manual edits | Centralize brand strings later if the product needs white-label support |
| Additional analytics/tracking is not configured | No marketing telemetry                     | Add only if a product decision requires it                              |
