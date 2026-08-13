const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { error, success, warn } = require("../cli-output");

const root = path.resolve(__dirname, "..", "..");
const strict = process.argv.includes("--strict") || process.env.MINISTRY_REVIEW_PACK_STRICT === "true";
const reportDir = path.resolve(process.env.MINISTRY_REVIEW_REPORT_DIR || path.join(root, "reports", "ministry-review"));
const manifestPath = path.join(reportDir, "manifest.json");
const markdownPath = path.join(reportDir, "MINISTRY_REVIEW_PACK.md");

const sourceDocuments = [
  "docs/MINISTRY_EVIDENCE_INDEX.md",
  "docs/MINISTRY_COMPLIANCE_MATRIX.md",
  "docs/MINISTRY_TEST_PLAN.md",
  "docs/LIVE_STAGING_EVIDENCE_CLOSURE.md",
  "docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md"
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function sourceSummary(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) return { path: relativePath, exists: false, sha256: null, bytes: 0 };
  const stat = fs.statSync(full);
  return {
    path: relativePath,
    exists: true,
    sha256: sha256(relativePath),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

function artifact(pathname, description, requiredForSubmission = true) {
  return { path: pathname, description, exists: exists(pathname), requiredForSubmission };
}

function collectOfficialRows(intake) {
  return intake
    .split(/\r?\n/)
    .filter((line) => /^\| MOS-\d{3} \|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return {
        id: cells[0],
        document: cells[1],
        sourceUrl: cells[2],
        title: cells[3],
        downloadDate: cells[4],
        version: cells[5],
        sha256: cells[6],
        archivePath: cells[7],
        owner: cells[8],
        status: cells[9],
        mappedControlIds: cells[10]
      };
    });
}

function buildManifest() {
  const docs = Object.fromEntries(sourceDocuments.map((doc) => [doc, exists(doc) ? read(doc) : ""]));
  const officialRows = collectOfficialRows(docs["docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md"]);
  const pendingOfficial = officialRows.filter((row) => row.status !== "Mapped" && row.status !== "Approved");

  const categories = {
    Ready: [
      {
        id: "MRP-READY-001",
        title: "Security readiness evidence index is present",
        source: "docs/MINISTRY_EVIDENCE_INDEX.md",
        artifacts: [
          artifact("docs/MINISTRY_EVIDENCE_INDEX.md", "Evidence index"),
          artifact("docs/MINISTRY_COMPLIANCE_MATRIX.md", "Compliance matrix"),
          artifact("docs/MINISTRY_TEST_PLAN.md", "Ministry test plan")
        ]
      },
      {
        id: "MRP-READY-002",
        title: "Core security control tests are present",
        source: "apps/backend/src/services",
        artifacts: [
          artifact("apps/backend/src/services/tenantIsolation.security.test.ts", "Tenant isolation proof"),
          artifact("apps/backend/src/services/mfaAndSso.security.test.ts", "MFA/SSO fail-closed proof"),
          artifact("apps/backend/src/services/auditImmutabilityAndRedaction.security.test.ts", "Audit immutability/redaction proof"),
          artifact("apps/backend/src/services/backupEncryptionAndRpo.security.test.ts", "Backup encryption/RPO proof"),
          artifact("apps/backend/src/services/privacyLifecycleAndExport.security.test.ts", "Privacy lifecycle/export proof"),
          artifact("apps/backend/src/services/dbTenantIntegrity.security.test.ts", "DB tenant integrity proof")
        ]
      },
      {
        id: "MRP-READY-003",
        title: "Release security artifact generators are present",
        source: "package.json",
        artifacts: [
          artifact("scripts/generate-sbom.js", "CycloneDX SBOM generator"),
          artifact("scripts/runtime/sast-baseline.js", "SAST baseline generator"),
          artifact("scripts/runtime/dast-baseline.js", "DAST HTTPS baseline"),
          artifact("scripts/runtime/zap-baseline.js", "OWASP ZAP baseline"),
          artifact("scripts/license-report.js", "License report generator")
        ]
      }
    ],
    "Pending live staging": [
      {
        id: "MRP-LIVE-101",
        title: "Run live DAST/ZAP against real HTTPS staging",
        command: "STAGING_URL=https://... ZAP_USE_DOCKER=true npm run security:dast",
        source: "docs/LIVE_STAGING_EVIDENCE_CLOSURE.md#LSE-102",
        artifacts: [
          artifact("reports/security/dast-baseline.json", "Normalized DAST/ZAP report"),
          artifact("reports/security/zap-baseline-report.html", "ZAP HTML report")
        ]
      },
      {
        id: "MRP-LIVE-102",
        title: "Run strict staging evidence pack",
        command: "STAGING_URL=https://... STAGING_EVIDENCE_STRICT=true npm run security:staging-evidence",
        source: "docs/LIVE_STAGING_EVIDENCE_CLOSURE.md#LSE-103",
        artifacts: [
          artifact("reports/security/staging-evidence-pack.json", "Strict staging evidence JSON"),
          artifact("reports/security/staging-evidence-pack.md", "Strict staging evidence Markdown")
        ]
      },
      {
        id: "MRP-LIVE-103",
        title: "Run live DB guardrails after migration deploy",
        command: "STAGING_URL=https://... STAGING_EVIDENCE_STRICT=true STAGING_EVIDENCE_LIVE_DB=true DATABASE_URL=postgresql://... npm run security:staging-evidence",
        source: "docs/LIVE_STAGING_EVIDENCE_CLOSURE.md#LSE-104",
        artifacts: [
          artifact("reports/security/staging-evidence-pack.json", "Live DB guardrail evidence")
        ]
      }
    ],
    "Pending official Ministry source": pendingOfficial.map((row) => ({
      id: row.id,
      title: row.document,
      status: row.status,
      requiredAction: "Archive official source document, record URL/title/date/version/SHA-256, map controls, and approve.",
      source: "docs/MINISTRY_OFFICIAL_STANDARDS_INTAKE.md",
      owner: row.owner,
      archivePath: row.archivePath
    })),
    "Pending external sign-off": [
      {
        id: "MRP-EXT-201",
        title: "Attach signed external penetration test report and retest status",
        command: "npm run security:pentest:prep",
        source: "docs/EXTERNAL_PENTEST_HANDOFF_PACK.md",
        artifacts: [
          artifact("docs/EXTERNAL_PENTEST_SIGNOFF_TEMPLATE.md", "Sign-off template"),
          artifact("reports/ministry-review/external-pentest-signed-report.pdf", "Signed external tester report", true)
        ]
      }
    ]
  };

  const sourceFiles = sourceDocuments.map(sourceSummary);
  const pendingCount =
    categories["Pending live staging"].length +
    categories["Pending official Ministry source"].length +
    categories["Pending external sign-off"].length;

  return {
    generatedAt: new Date().toISOString(),
    strict,
    submissionReady: pendingCount === 0 && sourceFiles.every((file) => file.exists),
    sourceDocuments: sourceFiles,
    categories,
    summary: {
      ready: categories.Ready.length,
      pendingLiveStaging: categories["Pending live staging"].length,
      pendingOfficialMinistrySource: categories["Pending official Ministry source"].length,
      pendingExternalSignoff: categories["Pending external sign-off"].length
    }
  };
}

function writeMarkdown(manifest) {
  const lines = [
    "# Ministry Review Pack",
    "",
    `Generated at: ${manifest.generatedAt}`,
    "",
    `Submission ready: ${manifest.submissionReady ? "yes" : "no"}`,
    "",
    "## Source Documents",
    "",
    "| Path | Exists | SHA-256 |",
    "| --- | --- | --- |"
  ];

  for (const source of manifest.sourceDocuments) {
    lines.push(`| \`${source.path}\` | ${source.exists ? "yes" : "no"} | ${source.sha256 || "n/a"} |`);
  }

  lines.push("", "## Categories", "");
  for (const [category, items] of Object.entries(manifest.categories)) {
    lines.push(`### ${category}`, "");
    if (!items.length) {
      lines.push("No items.", "");
      continue;
    }
    lines.push("| ID | Title | Source/Command |");
    lines.push("| --- | --- | --- |");
    for (const item of items) {
      const source = item.command || item.source || "";
      lines.push(`| ${item.id} | ${item.title} | ${source} |`);
    }
    lines.push("");
  }

  lines.push("## Strict Mode", "");
  lines.push("Run `MINISTRY_REVIEW_PACK_STRICT=true npm run ministry:review-pack` before any Ministry submission claim.");
  lines.push("Strict mode fails while live staging, official Ministry source, or external sign-off items remain pending.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const manifest = buildManifest();
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(markdownPath, writeMarkdown(manifest));

  if (!manifest.submissionReady) {
    warn("Ministry review pack generated with pending items:", JSON.stringify(manifest.summary));
    if (strict) {
      error("Strict Ministry review pack failed: pending evidence remains.");
      process.exit(1);
    }
  }

  success("Ministry review pack written:", path.relative(root, manifestPath), path.relative(root, markdownPath));
}

main();
