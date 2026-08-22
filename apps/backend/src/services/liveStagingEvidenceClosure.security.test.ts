import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("live staging evidence closure checklist preserves required execution commands and evidence IDs", () => {
  const closure = read("../../docs/LIVE_STAGING_EVIDENCE_CLOSURE.md");

  assert.match(closure, /Ready in repo/);
  assert.match(closure, /Must run on staging/);
  assert.match(closure, /Required for Ministry attachment/);
  assert.match(closure, /LSE-001/);
  assert.match(closure, /LSE-101/);
  assert.match(closure, /LSE-201/);
  assert.match(
    closure,
    /STAGING_URL=https:\/\/staging-api\.example\.gov\.il ZAP_USE_DOCKER=true npm run security:dast/
  );
  assert.match(closure, /STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence/);
  assert.match(
    closure,
    /STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql:\/\/\.\.\. npm run security:staging-evidence/
  );
  assert.match(closure, /npm run security:pentest:prep/);
  assert.match(closure, /reports\/security\/dast-baseline\.json/);
  assert.match(closure, /reports\/security\/zap-baseline-report\.html/);
  assert.match(closure, /reports\/security\/staging-evidence-pack\.json/);
  assert.match(closure, /reports\/security\/staging-evidence-pack\.md/);
  assert.match(closure, /reports\/security\/sbom\.cyclonedx\.json/);
  assert.match(closure, /reports\/security\/sast-baseline\.json/);
  assert.match(closure, /reports\/security\/license-report\.json/);
  assert.match(closure, /docs\/EXTERNAL_PENTEST_SIGNOFF_TEMPLATE\.md/);
});

test("Ministry-facing documents link the live staging evidence closure path", () => {
  const matrix = read("../../docs/MINISTRY_COMPLIANCE_MATRIX.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");
  const stagingPack = read("../../docs/STAGING_EVIDENCE_PACK.md");

  for (const doc of [matrix, evidence, testPlan, stagingPack]) {
    assert.match(doc, /LIVE_STAGING_EVIDENCE_CLOSURE\.md/);
  }

  assert.match(matrix, /live staging evidence closure/i);
  assert.match(evidence, /Live staging evidence closure/i);
  assert.match(testPlan, /Live staging evidence closure/i);
  assert.match(stagingPack, /LSE-102/);
  assert.match(stagingPack, /LSE-104/);
});
