import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("hosting provider decision requires Israel data residency and keeps provider pending", () => {
  const decision = read("../../docs/HOSTING_PROVIDER_DECISION.md");

  assert.match(decision, /Required jurisdiction: Israel data residency/);
  assert.match(decision, /Decision status: provider not selected/);
  assert.match(decision, /Cloudflare Quick Tunnel[\s\S]*No \| No/);
  assert.match(decision, /DuckDNS on home router[\s\S]*No \| No/);
  assert.match(decision, /Small VPS in Israel/);
  assert.match(decision, /Managed cloud in Israel/);
  assert.match(decision, /Provider region statement, contract\/order form, DPA/);
  assert.match(decision, /Secret manager\/KMS/);
  assert.match(decision, /Provider DPA\/data processing terms are missing/);
  assert.match(decision, /provider\/KMS\/data-region evidence as pending/);
});

test("hosting requirements and Ministry docs link provider decision evidence without claiming completion", () => {
  const requirements = read("../../docs/HOSTING_REQUIREMENTS.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");
  const matrix = read("../../docs/MINISTRY_COMPLIANCE_MATRIX.md");

  for (const doc of [requirements, evidence, testPlan, matrix]) {
    assert.match(doc, /HOSTING_PROVIDER_DECISION\.md/);
  }

  assert.match(requirements, /Israel region infrastructure/);
  assert.match(evidence, /provider not selected/i);
  assert.match(matrix, /Needs Verification/);
  assert.match(matrix, /Israel data residency/);
});
