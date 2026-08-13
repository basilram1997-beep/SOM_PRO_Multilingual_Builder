import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("Israel hosting provider request checklist contains provider questions, scoring, no-go rules, and evidence requirements", () => {
  const checklist = read("../../docs/ISRAEL_HOSTING_PROVIDER_REQUEST_CHECKLIST.md");

  assert.match(checklist, /ready-to-send request/i);
  assert.match(checklist, /compute, storage, snapshots\/backups, and operational data are hosted in Israel/);
  assert.match(checklist, /Managed PostgreSQL in Israel/);
  assert.match(checklist, /Secret manager\/KMS/);
  assert.match(checklist, /DPA\/data processing agreement/);
  assert.match(checklist, /ISO\/SOC/);
  assert.match(checklist, /Data deletion\/return process/);
  assert.match(checklist, /Scoring Table/);
  assert.match(checklist, /Staging candidate: at least `35` weighted points/);
  assert.match(checklist, /Production candidate: at least `50` weighted points/);
  assert.match(checklist, /No-Go Answers/);
  assert.match(checklist, /Evidence To Archive/);
  assert.match(checklist, /Decision Template/);
});

test("provider decision, VPS runbook, and Ministry docs link the provider request checklist", () => {
  const decision = read("../../docs/HOSTING_PROVIDER_DECISION.md");
  const vps = read("../../docs/ISRAEL_VPS_STAGING_PROVISIONING.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");
  const matrix = read("../../docs/MINISTRY_COMPLIANCE_MATRIX.md");

  for (const doc of [decision, vps, evidence, testPlan, matrix]) {
    assert.match(doc, /ISRAEL_HOSTING_PROVIDER_REQUEST_CHECKLIST\.md/);
  }

  assert.match(evidence, /provider selection still pending/i);
  assert.match(matrix, /Send the Israel hosting provider request checklist/);
});
