#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { error, success, warn } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const archiveDir = path.join(root, "docs", "official-ministry-standards");
const intakePath = path.join(root, "docs", "MINISTRY_OFFICIAL_STANDARDS_INTAKE.md");
const reportDir = path.resolve(
  process.env.MINISTRY_STANDARDS_INTAKE_REPORT_DIR || path.join(root, "reports", "ministry-standards")
);
const jsonReportPath = path.join(reportDir, "official-standards-intake.json");
const markdownReportPath = path.join(reportDir, "official-standards-intake.md");
const strict = process.argv.includes("--strict") || process.env.MINISTRY_STANDARDS_INTAKE_STRICT === "true";

function sha256(fullPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
}

function rel(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, "/");
}

function readIntake() {
  return fs.readFileSync(intakePath, "utf8");
}

function listArchiveFiles() {
  if (!fs.existsSync(archiveDir)) return [];
  return fs
    .readdirSync(archiveDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => ![".gitkeep", "README.md"].includes(entry.name))
    .map((entry) => {
      const fullPath = path.join(archiveDir, entry.name);
      const stat = fs.statSync(fullPath);
      const controlMatch = entry.name.match(/^(MOS-\d{3})[_-]/i);
      return {
        controlId: controlMatch ? controlMatch[1].toUpperCase() : null,
        path: rel(fullPath),
        filename: entry.name,
        bytes: stat.size,
        sha256: sha256(fullPath),
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function parseRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\| MOS-\d{3} \|/.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        controlId: cells[0],
        requiredDocument: cells[1],
        sourceUrl: cells[2],
        title: cells[3],
        downloadDate: cells[4],
        version: cells[5],
        sha256: cells[6],
        archivePath: cells[7].replace(/^`|`$/g, ""),
        owner: cells[8],
        status: cells[9],
        mappedControlIds: cells[10]
      };
    });
}

function isTbd(value) {
  return !value || /\bTBD\b|^Missing$/i.test(String(value));
}

function validateRow(row, archiveFiles) {
  const issues = [];
  const archive = archiveFiles.find((file) => file.path === row.archivePath);
  const matchingControlFiles = archiveFiles.filter((file) => file.controlId === row.controlId);
  const needsArtifact = ["Downloaded", "Mapped", "Approved"].includes(row.status);

  if (!["Missing", "Downloaded", "Mapped", "Approved"].includes(row.status)) {
    issues.push("invalid status");
  }
  if (row.status === "Missing" && matchingControlFiles.length) {
    issues.push("archive file exists but register status is Missing");
  }
  if (needsArtifact) {
    for (const [label, value] of [
      ["source URL", row.sourceUrl],
      ["document title", row.title],
      ["download date", row.downloadDate],
      ["version/publication date", row.version],
      ["SHA-256", row.sha256],
      ["archive path", row.archivePath]
    ]) {
      if (isTbd(value)) issues.push(`${label} is not recorded`);
    }
    if (!archive) issues.push("archive path does not exist");
    if (archive && row.sha256 !== archive.sha256) issues.push("SHA-256 does not match archived file");
  }
  if (["Mapped", "Approved"].includes(row.status) && isTbd(row.mappedControlIds)) {
    issues.push("mapped control IDs are not recorded");
  }
  if (row.status === "Approved" && /owner|TBD/i.test(row.owner)) {
    issues.push("approval owner is not specific");
  }

  return {
    ...row,
    archiveExists: Boolean(archive),
    matchingArchiveFiles: matchingControlFiles.map((file) => file.path),
    issues
  };
}

function buildReport() {
  const archiveFiles = listArchiveFiles();
  const rows = parseRows(readIntake());
  const validatedRows = rows.map((row) => validateRow(row, archiveFiles));
  const invalidRows = validatedRows.filter((row) => row.issues.length);
  const approvedRows = validatedRows.filter((row) => row.status === "Approved");
  const pendingRows = validatedRows.filter((row) => row.status !== "Approved");

  return {
    generatedAt: new Date().toISOString(),
    strict,
    intakePath: rel(intakePath),
    archiveDir: rel(archiveDir),
    archiveFiles,
    rows: validatedRows,
    summary: {
      totalRows: rows.length,
      archivedFiles: archiveFiles.length,
      approvedRows: approvedRows.length,
      pendingRows: pendingRows.length,
      invalidRows: invalidRows.length,
      submissionReady: rows.length > 0 && invalidRows.length === 0 && pendingRows.length === 0
    }
  };
}

function writeReports(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Ministry Official Standards Intake Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    `Submission ready: ${report.summary.submissionReady ? "yes" : "no"}`,
    "",
    "## Register Rows",
    "",
    "| Control | Status | Archive exists | Issues |",
    "| --- | --- | --- | --- |"
  ];
  for (const row of report.rows) {
    lines.push(
      `| ${row.controlId} | ${row.status} | ${row.archiveExists ? "yes" : "no"} | ${row.issues.join("; ") || "none"} |`
    );
  }
  lines.push("", "## Archive Files", "");
  if (!report.archiveFiles.length) {
    lines.push("No official archive files found.");
  } else {
    lines.push("| Control | Path | SHA-256 |");
    lines.push("| --- | --- | --- |");
    for (const file of report.archiveFiles) {
      lines.push(`| ${file.controlId || "unmatched"} | \`${file.path}\` | ${file.sha256} |`);
    }
  }
  fs.writeFileSync(markdownReportPath, `${lines.join("\n")}\n`);
}

function main() {
  const report = buildReport();
  writeReports(report);

  if (report.summary.invalidRows > 0 || (strict && !report.summary.submissionReady)) {
    for (const row of report.rows.filter((item) => item.issues.length)) {
      error(`official standards intake ${row.controlId}: ${row.issues.join("; ")}`);
    }
    if (strict && !report.summary.submissionReady) {
      error("Official Ministry standards intake is not submission-ready.");
    }
    error("Official standards intake report failed:", rel(jsonReportPath));
    process.exit(1);
  }

  if (!report.summary.submissionReady) {
    warn("Official Ministry standards intake is pending; formal Ministry compliance must not be claimed.");
  }
  success("Official standards intake report written:", rel(jsonReportPath));
  success("Official standards intake markdown written:", rel(markdownReportPath));
}

main();
