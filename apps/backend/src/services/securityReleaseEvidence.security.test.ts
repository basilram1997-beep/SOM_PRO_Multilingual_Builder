import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

test("CI includes real SAST, release security artifacts, and DAST evidence jobs", () => {
  const ci = read("../../.github/workflows/ci.yml");

  assert.match(ci, /security-events:\s*write/, "CodeQL upload permission should be enabled");
  assert.match(ci, /codeql_sast:/, "CI should include a CodeQL SAST job");
  assert.match(ci, /github\/codeql-action\/init@v3/, "CI should initialize CodeQL");
  assert.match(ci, /languages:\s*javascript-typescript/, "CodeQL should scan JavaScript and TypeScript");
  assert.match(ci, /queries:\s*security-extended,security-and-quality/, "CodeQL should use security query packs");
  assert.match(ci, /github\/codeql-action\/analyze@v3/, "CI should publish CodeQL SARIF/security results");

  assert.match(ci, /release_security_artifacts:/, "CI should generate release security artifacts");
  assert.match(ci, /npm run security:release-evidence/, "release evidence job should run the canonical script");
  assert.match(ci, /reports\/security\//, "security artifacts should be uploaded from reports/security");

  assert.match(ci, /dast_baseline:/, "CI should include a DAST baseline job");
  assert.match(ci, /STAGING_URL:\s*\$\{\{\s*secrets\.STAGING_URL\s*\}\}/, "DAST should target the configured staging URL secret");
  assert.match(ci, /npm run security:dast/, "DAST job should use the canonical DAST script");
});

test("package scripts expose SBOM, license, SAST, DAST, and release evidence commands", () => {
  const pkg = JSON.parse(read("../../package.json"));

  assert.equal(pkg.scripts["security:sbom"], "node scripts/generate-sbom.js");
  assert.equal(pkg.scripts["security:licenses"], "node scripts/license-report.js");
  assert.equal(pkg.scripts["security:sast"], "node scripts/runtime/sast-baseline.js");
  assert.equal(pkg.scripts["security:dast"], "node scripts/runtime/dast-baseline.js");
  assert.match(pkg.scripts["security:baseline"], /security:sbom/);
  assert.match(pkg.scripts["security:baseline"], /security:licenses/);
  assert.match(pkg.scripts["security:release-evidence"], /security:baseline/);
  assert.match(pkg.scripts["security:release-evidence"], /security:sast/);
});

test("SBOM and license scripts generate reviewable release artifacts", () => {
  const sbom = read("../../scripts/generate-sbom.js");
  const licenses = read("../../scripts/license-report.js");

  assert.match(sbom, /bomFormat:\s*"CycloneDX"/, "SBOM should use CycloneDX");
  assert.match(sbom, /specVersion:\s*"1\.5"/, "SBOM should declare a stable CycloneDX spec version");
  assert.match(sbom, /package-lock\.json/, "SBOM should be generated from the locked dependency graph");
  assert.match(sbom, /sbom\.cyclonedx\.json/, "SBOM output should be a release artifact");
  assert.match(sbom, /pkg:npm\//, "SBOM components should include package URLs");

  assert.match(licenses, /license-report\.json/, "license script should write JSON evidence");
  assert.match(licenses, /license-report\.md/, "license script should write human-readable evidence");
  assert.match(licenses, /UNKNOWN/, "license report should make unknown licenses explicit");
});

test("SAST and DAST scripts fail closed for missing controls and unsafe staging targets", () => {
  const sast = read("../../scripts/runtime/sast-baseline.js");
  const dast = read("../../scripts/runtime/dast-baseline.js");

  assert.match(sast, /CodeQL CI workflow is incomplete/, "SAST baseline should require CodeQL init in CI");
  assert.match(sast, /npm run lint/, "SAST baseline should include local lint checks");
  assert.match(sast, /NODE_TLS_REJECT_UNAUTHORIZED/, "SAST baseline should flag disabled TLS validation");
  assert.match(sast, /sast-baseline\.json/, "SAST should write an evidence artifact");

  assert.match(dast, /STAGING_URL must use https:\/\//, "DAST should reject non-HTTPS targets");
  assert.match(dast, /localhost\|127\\\.0\\\.0\\\.1/, "DAST should reject local targets");
  assert.match(dast, /example\\\.invalid\|your-domain/, "DAST should reject placeholder targets");
  assert.match(dast, /strict-transport-security/, "DAST should verify HSTS");
  assert.match(dast, /dast-baseline\.json/, "DAST should write an evidence artifact");
});
