import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("Israel VPS staging provisioning runbook defines hardening, secrets, ingress, and evidence gates", () => {
  const runbook = read("../../docs/ISRAEL_VPS_STAGING_PROVISIONING.md");

  assert.match(runbook, /Required jurisdiction: Israel/);
  assert.match(runbook, /Ubuntu Server 22\.04 LTS or 24\.04 LTS/);
  assert.match(runbook, /PasswordAuthentication no/);
  assert.match(runbook, /PermitRootLogin no/);
  assert.match(runbook, /ufw default deny incoming/);
  assert.match(runbook, /ufw allow 80\/tcp/);
  assert.match(runbook, /ufw allow 443\/tcp/);
  assert.match(runbook, /Do not expose PostgreSQL `5432`, Redis `6379`/);
  assert.match(runbook, /docker compose --env-file \.env\.production -f docker-compose\.production\.yml up -d/);
  assert.match(runbook, /SOM_BACKUP_PASSPHRASE_FILE/);
  assert.match(runbook, /Cloudflare Named Tunnel/);
  assert.match(runbook, /Quick Tunnel is not acceptable for Ministry staging/);
  assert.match(runbook, /STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence/);
  assert.match(runbook, /ZAP_USE_DOCKER=true npm run security:dast/);
  assert.match(runbook, /Provider Israel region statement archived/);
});

test("Ministry and hosting docs link Israel VPS provisioning without claiming a VPS exists", () => {
  const decision = read("../../docs/HOSTING_PROVIDER_DECISION.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");
  const matrix = read("../../docs/MINISTRY_COMPLIANCE_MATRIX.md");

  for (const doc of [decision, evidence, testPlan, matrix]) {
    assert.match(doc, /ISRAEL_VPS_STAGING_PROVISIONING\.md/);
  }

  assert.match(evidence, /no VPS selected or provisioned/i);
  assert.match(matrix, /runbook only until a provider is selected/i);
});
