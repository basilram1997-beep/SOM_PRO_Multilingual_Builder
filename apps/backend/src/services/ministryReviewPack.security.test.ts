import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("Ministry review pack generator writes manifest and markdown with required evidence categories", () => {
  const reportDir = mkdtempSync(join(tmpdir(), "som-ministry-review-"));
  try {
    const result = spawnSync(process.execPath, ["../../scripts/runtime/ministry-review-pack.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MINISTRY_REVIEW_REPORT_DIR: reportDir
      },
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(readFileSync(join(reportDir, "manifest.json"), "utf8")) as {
      submissionReady: boolean;
      sourceDocuments: Array<{ path: string; exists: boolean; sha256: string | null }>;
      categories: Record<string, Array<{ id: string; title: string; command?: string; source?: string }>>;
      summary: Record<string, number>;
    };
    const markdown = readFileSync(join(reportDir, "MINISTRY_REVIEW_PACK.md"), "utf8");

    assert.equal(
      manifest.submissionReady,
      false,
      "local pack should not claim Ministry submission readiness with pending evidence"
    );
    assert.deepEqual(
      manifest.sourceDocuments.map((source) => source.path),
      [
        "docs/MINISTRY_EVIDENCE_INDEX.md",
        "docs/MINISTRY_COMPLIANCE_MATRIX.md",
        "docs/MINISTRY_TEST_PLAN.md",
        "docs/LIVE_STAGING_EVIDENCE_CLOSURE.md",
        "docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md",
        "docs/MINISTRY_LOCAL_READINESS_REPORT_AR.md"
      ]
    );
    assert.ok(manifest.sourceDocuments.every((source) => source.exists && source.sha256));
    assert.ok(manifest.categories.Ready.length >= 3);
    assert.ok(manifest.categories["Pending live staging"].length >= 3);
    assert.ok(manifest.categories["Pending official Ministry source"].length >= 7);
    assert.ok(manifest.categories["Pending external sign-off"].length >= 1);
    assert.match(JSON.stringify(manifest), /STAGING_URL=https:\/\/\.\.\. ZAP_USE_DOCKER=true npm run security:dast/);
    assert.match(JSON.stringify(manifest), /STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence/);
    assert.match(JSON.stringify(manifest), /MINISTRY_OFFICIAL_STANDARDS_INTAKE\.md/);
    assert.match(JSON.stringify(manifest), /EXTERNAL_PENTEST_HANDOFF_PACK\.md/);
    assert.match(markdown, /# Ministry Review Pack/);
    assert.match(markdown, /### Ready/);
    assert.match(markdown, /### Pending live staging/);
    assert.match(markdown, /### Pending official Ministry source/);
    assert.match(markdown, /### Pending external sign-off/);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("Ministry review pack strict mode fails while pending evidence remains and docs expose canonical command", () => {
  const reportDir = mkdtempSync(join(tmpdir(), "som-ministry-review-strict-"));
  try {
    const result = spawnSync(process.execPath, ["../../scripts/runtime/ministry-review-pack.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MINISTRY_REVIEW_REPORT_DIR: reportDir,
        MINISTRY_REVIEW_PACK_STRICT: "true"
      },
      encoding: "utf8"
    });
    const pkg = JSON.parse(read("../../package.json")) as { scripts: Record<string, string> };
    const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
    const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");

    assert.notEqual(result.status, 0, "strict mode must fail until pending evidence categories are closed");
    assert.equal(pkg.scripts["ministry:review-pack"], "node scripts/runtime/ministry-review-pack.js");
    assert.match(evidence, /ministry:review-pack/);
    assert.match(testPlan, /ministry:review-pack/);
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
});
