import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("live staging execution runbook preserves operator commands, secret handling, and evidence outputs", () => {
  const runbook = read("../../docs/LIVE_STAGING_EXECUTION_RUNBOOK.md");

  assert.match(runbook, /STAGING_URL/);
  assert.match(runbook, /DATABASE_URL/);
  assert.match(runbook, /ZAP_USE_DOCKER=true npm run security:dast/);
  assert.match(runbook, /STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence/);
  assert.match(
    runbook,
    /STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql:\/\/\.\.\. npm run security:staging-evidence/
  );
  assert.match(runbook, /npm run security:pentest:prep/);
  assert.match(runbook, /npm run ministry:review-pack/);
  assert.match(runbook, /MINISTRY_REVIEW_PACK_STRICT=true npm run ministry:review-pack/);
  assert.match(runbook, /never commit it/i);
  assert.match(runbook, /does not print `DATABASE_URL` or backup passphrases/);
  assert.match(runbook, /reports\/security\/dast-baseline\.json/);
  assert.match(runbook, /reports\/security\/zap-baseline-report\.html/);
  assert.match(runbook, /reports\/security\/staging-evidence-pack\.json/);
  assert.match(runbook, /reports\/ministry-review\/manifest\.json/);
  assert.match(runbook, /reports\/ministry-review\/MINISTRY_REVIEW_PACK\.md/);
  assert.match(runbook, /submissionReady/);
});

test("Ministry evidence docs link the live staging execution runbook", () => {
  const closure = read("../../docs/LIVE_STAGING_EVIDENCE_CLOSURE.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");

  for (const doc of [closure, evidence, testPlan]) {
    assert.match(doc, /LIVE_STAGING_EXECUTION_RUNBOOK\.md/);
  }
});
