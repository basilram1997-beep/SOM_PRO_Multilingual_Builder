import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("staging evidence pack script verifies live deployment, DB guardrails, backups, and release artifacts", () => {
  const script = read("../../scripts/runtime/staging-evidence-pack.js");
  const pkg = JSON.parse(read("../../package.json")) as { scripts: Record<string, string> };
  const stagingEnv = read("../../.env.staging.example");
  const docs = read("../../docs/STAGING_EVIDENCE_PACK.md");

  assert.equal(pkg.scripts["security:staging-evidence"], "node scripts/runtime/staging-evidence-pack.js");

  assert.match(script, /STAGING_EVIDENCE_STRICT/, "script should support strict staging handoff mode");
  assert.match(script, /STAGING_EVIDENCE_LIVE_DB/, "script should support live DB probes");
  assert.match(script, /STAGING_URL/, "script should target a real staging URL");
  assert.match(script, /strict-transport-security/i, "script should inspect HSTS");
  assert.match(script, /new URL\("\/health"/, "script should verify backend health endpoint");
  assert.match(script, /prevent_audit_log_mutation/, "script should verify audit append-only migration");
  assert.match(script, /AuditLog_prevent_update/, "script should verify update trigger");
  assert.match(script, /AuditLog_prevent_delete/, "script should verify delete trigger");
  assert.match(script, /reports_exports_school_id_fkey/, "script should verify report export FK");
  assert.match(script, /backup_jobs_school_id_fkey/, "script should verify backup job FK");
  assert.match(script, /ON DELETE RESTRICT/, "script should verify lifecycle evidence restrict FKs");
  assert.match(script, /prisma\.auditLog\.update/, "live DB probe should attempt direct audit update");
  assert.match(script, /prisma\.auditLog\.delete/, "live DB probe should attempt direct audit delete");
  assert.match(script, /SOM_BACKUP_PASSPHRASE_FILE/, "script should verify backup encryption secret by presence only");
  assert.match(script, /sbom\.cyclonedx\.json/, "script should require SBOM evidence");
  assert.match(script, /sast-baseline\.json/, "script should require SAST evidence");
  assert.match(script, /dast-baseline\.json/, "script should track DAST evidence");
  assert.match(script, /zap-baseline-report\.html/, "script should track OWASP ZAP HTML evidence");
  assert.match(script, /dastReport\.status !== "passed"/, "script should reject failed DAST evidence artifacts");
  assert.match(script, /staging-evidence-pack\.json/, "script should write JSON evidence");
  assert.match(script, /staging-evidence-pack\.md/, "script should write markdown evidence");

  assert.match(stagingEnv, /SOM_BACKUP_PASSPHRASE_FILE=\/run\/secrets\/som_backup_passphrase/);
  assert.match(stagingEnv, /SOM_BACKUP_RPO_MINUTES=1440/);
  assert.match(stagingEnv, /SOM_BACKUP_RTO_MINUTES=240/);

  assert.match(docs, /npm run security:staging-evidence/);
  assert.match(docs, /STAGING_EVIDENCE_STRICT=true/);
  assert.match(docs, /STAGING_EVIDENCE_LIVE_DB=true/);
  assert.match(docs, /reports\/security\/staging-evidence-pack\.json/);
});
