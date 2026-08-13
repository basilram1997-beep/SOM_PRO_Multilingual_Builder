import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

function parseRegisterRows(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\| MOS-\d{3} \|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

test("official Ministry standards intake register blocks formal compliance claims until archived standards are mapped and approved", () => {
  const intake = read("../../docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md");
  const archiveReadme = read("../../docs/official-ministry-standards/README.md");
  const packageJson = JSON.parse(read("../../package.json")) as { scripts: Record<string, string> };
  const script = read("../../scripts/runtime/ministry-standards-intake.js");

  assert.ok(existsSync("../../docs/official-ministry-standards/.gitkeep"));
  assert.equal(packageJson.scripts["ministry:standards:intake"], "node scripts/runtime/ministry-standards-intake.js");
  assert.match(intake, /sapakim\.education\.gov\.il/);
  assert.match(intake, /Security readiness evidence/);
  assert.match(intake, /Official Ministry compliance evidence/);
  assert.match(intake, /SOM PRO must not claim formal Ministry supplier compliance/);
  assert.match(intake, /Allowed status values/);
  assert.match(intake, /Missing/);
  assert.match(intake, /Downloaded/);
  assert.match(intake, /Mapped/);
  assert.match(intake, /Approved/);
  assert.match(intake, /SHA-256/);

  const rows = parseRegisterRows(intake);
  assert.equal(rows.length, 7, "intake register should track all required official document families");

  const statuses = rows.map((row) => row[9]);
  assert.deepEqual(statuses, Array(7).fill("Missing"), "no official standard may be treated as mapped/approved yet");

  for (const row of rows) {
    const [controlId, , sourceUrl, title, downloadDate, version, sha256, archivePath, owner, status, mappedIds] = row;
    assert.match(controlId, /^MOS-\d{3}$/);
    assert.equal(status, "Missing");
    assert.match(sourceUrl, /TBD/);
    assert.match(title, /TBD/);
    assert.match(downloadDate, /TBD/);
    assert.match(version, /TBD/);
    assert.match(sha256, /TBD/);
    assert.match(archivePath, /docs\/official-ministry-standards\//);
    assert.notEqual(owner, "TBD", "each required document should have an accountable owner");
    assert.match(mappedIds, /TBD/);
  }

  assert.match(archiveReadme, /original downloaded files without editing/);
  assert.match(archiveReadme, /SHA-256/);
  assert.match(archiveReadme, /Get-FileHash/);
  assert.match(archiveReadme, /npm run ministry:standards:intake/);
  assert.match(intake, /MINISTRY_STANDARDS_INTAKE_STRICT=true npm run ministry:standards:intake/);
  assert.match(script, /official-standards-intake\.json/);
  assert.match(script, /SHA-256 does not match archived file/);
  assert.match(script, /status === "Approved"/);
  assert.match(script, /Official Ministry standards intake is not submission-ready/);
});

test("Ministry-facing docs distinguish security readiness from formal official compliance evidence", () => {
  const matrix = read("../../docs/MINISTRY_COMPLIANCE_MATRIX.md");
  const evidence = read("../../docs/MINISTRY_EVIDENCE_INDEX.md");
  const testPlan = read("../../docs/MINISTRY_TEST_PLAN.md");

  for (const doc of [matrix, evidence, testPlan]) {
    assert.match(doc, /MINISTRY_OFFICIAL_STANDARDS_INTAKE\.md/);
    assert.match(doc, /official Ministry/i);
  }

  assert.match(matrix, /formal Ministry supplier compliance/i);
  assert.match(matrix, /security readiness/i);
  assert.match(evidence, /Security readiness evidence/i);
  assert.match(evidence, /Official Ministry compliance evidence/i);
  assert.match(testPlan, /No formal compliance claim/);
});
