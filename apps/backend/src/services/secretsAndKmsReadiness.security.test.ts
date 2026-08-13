import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function assertPlaceholder(value: string, key: string) {
  if (/^redis:\/\/[^:@/]+:\d+$/i.test(value)) return;
  assert.match(value, /CHANGE_ME|change-me|example\.com|\/run\/secrets\//i, `${key} must be placeholder or secret-file reference only`);
}

test("secrets and KMS readiness runbook defines inventory, rotation, and evidence boundaries", () => {
  const doc = read("../../docs/SECRETS_AND_KMS_READINESS.md");

  for (const secret of [
    "DATABASE_URL",
    "REDIS_PASSWORD",
    "POSTGRES_PASSWORD",
    "SOM_PRO_AUTH_SECRET",
    "SOM_PRO_LICENSE_SECRET",
    "LICENSE_ADMIN_TOKEN",
    "SOM_BACKUP_PASSPHRASE_FILE",
    "Cloudflare tunnel credentials",
    "OIDC/SAML client secret"
  ]) {
    assert.match(doc, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(doc, /Do not copy local `\.env` values to staging or production/);
  assert.match(doc, /Rotation Checklist/);
  assert.match(doc, /Evidence must not show secret values/);
  assert.match(doc, /Final provider\/KMS proof \| Pending/);
  assert.match(doc, /App-wide `_FILE` support for every secret \| Pending/);
  assert.match(doc, /security readiness only/);
});

test("production and staging examples keep secrets as placeholders or secret-file references", () => {
  const envFiles = [
    "../../.env.production.example",
    ".env.production.example",
    "../license-server/.env.production.example",
    "../../.env.staging.example",
    ".env.staging.example",
    "../license-server/.env.staging.example"
  ];
  const sensitiveKeys = [
    "DATABASE_URL",
    "REDIS_URL",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_SECRET",
    "SOM_PRO_AUTH_SECRET",
    "SOM_PRO_LICENSE_SECRET",
    "SOM_PRO_ADMIN_PASSWORD",
    "LICENSE_ADMIN_TOKEN",
    "SOM_BACKUP_PASSPHRASE_FILE"
  ];

  for (const file of envFiles) {
    const values = parseEnv(read(file));
    for (const key of sensitiveKeys) {
      if (!values[key]) continue;
      assertPlaceholder(values[key], `${file}:${key}`);
    }
  }

  const rootProduction = parseEnv(read("../../.env.production.example"));
  const backendProduction = parseEnv(read(".env.production.example"));
  assert.equal(rootProduction.SOM_BACKUP_PASSPHRASE_FILE, "/run/secrets/som_backup_passphrase");
  assert.equal(backendProduction.SOM_BACKUP_PASSPHRASE_FILE, "/run/secrets/som_backup_passphrase");
});

test("Ministry evidence docs link secrets/KMS readiness without claiming final KMS completion", () => {
  const architecture = read("../../docs/ENVIRONMENT_ARCHITECTURE.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");
  const matrix = read("../../docs/MINISTRY_COMPLIANCE_MATRIX.md");

  for (const doc of [architecture, evidence, testPlan, matrix]) {
    assert.match(doc, /SECRETS_AND_KMS_READINESS\.md/);
  }

  assert.match(evidence, /final provider\/KMS proof still pending/i);
  assert.match(matrix, /final provider\/KMS is not selected/i);
});
