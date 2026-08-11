require("dotenv").config();

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const runId = sanitizeRunId(process.env.COMPATIBILITY_RUN_ID || crypto.randomUUID().slice(0, 8));
const artifactDir = process.env.COMPATIBILITY_OUTPUT_DIR || join("tests", "e2e", "artifacts");
const reportJsonPath = process.env.COMPATIBILITY_OUTPUT_JSON || join(artifactDir, `compatibility-report-${runId}.json`);
const reportMdPath = process.env.COMPATIBILITY_OUTPUT_MD || join(artifactDir, `compatibility-report-${runId}.md`);

const browserTargets = resolveBrowserTargets();
const viewportProfiles = resolveViewportProfiles();

function sanitizeRunId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function resolveBrowserTargets() {
  const projectTargets = String(process.env.COMPATIBILITY_PLAYWRIGHT_PROJECTS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (projectTargets.length > 0) {
    return projectTargets.map((project) => ({
      label: project,
      project,
      executablePath: ""
    }));
  }

  const customTargets = String(process.env.COMPATIBILITY_BROWSER_EXECUTABLES || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (customTargets.length > 0) {
    return customTargets
      .filter((candidate) => existsSync(candidate))
      .map((candidate) => ({
        label: candidate.includes("msedge.exe") ? "edge" : "chrome",
        project: "",
        executablePath: candidate
      }));
  }

  const defaults = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];

  const foundDefaults = defaults.filter((candidate) => existsSync(candidate));
  if (foundDefaults.length > 0) {
    return foundDefaults.map((candidate) => ({
      label: candidate.includes("msedge.exe") ? "edge" : "chrome",
      project: "",
      executablePath: candidate
    }));
  }

  return [
    {
      label: "chromium",
      project: "chromium",
      executablePath: ""
    }
  ];
}

function resolveViewportProfiles() {
  const requested = String(process.env.COMPATIBILITY_VIEWPORTS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const profiles = [
    {
      label: "desktop",
      width: Number(process.env.COMPATIBILITY_DESKTOP_WIDTH || 1440),
      height: Number(process.env.COMPATIBILITY_DESKTOP_HEIGHT || 900)
    },
    {
      label: "tablet",
      width: Number(process.env.COMPATIBILITY_TABLET_WIDTH || 1024),
      height: Number(process.env.COMPATIBILITY_TABLET_HEIGHT || 768)
    },
    {
      label: "mobile",
      width: Number(process.env.COMPATIBILITY_MOBILE_WIDTH || 390),
      height: Number(process.env.COMPATIBILITY_MOBILE_HEIGHT || 844)
    }
  ].filter((profile) => Number.isFinite(profile.width) && Number.isFinite(profile.height));

  if (!requested.length) {
    return profiles;
  }

  return profiles.filter((profile) => requested.includes(profile.label));
}

function runMatrixEntry(target, viewport) {
  const runLabel = `${target.label}-${viewport.label}`;
  const startedAt = Date.now();
  const env = {
    ...process.env,
    SOM_E2E_TIMEOUT_MS: process.env.COMPATIBILITY_E2E_TIMEOUT_MS || "90000",
    PLAYWRIGHT_E2E_BROWSER_EXECUTABLE_PATH: target.executablePath,
    PLAYWRIGHT_BROWSER_PROJECT: target.project,
    PLAYWRIGHT_VIEWPORT_WIDTH: String(viewport.width),
    PLAYWRIGHT_VIEWPORT_HEIGHT: String(viewport.height),
    COMPATIBILITY_MATRIX_LABEL: runLabel
  };

  const browserArgs = target.project ? [`--project=${target.project}`] : [];
  const result = spawnSync(
    nodeCommand,
    ["scripts/run-e2e-browser.js", ...browserArgs, "tests/e2e/playwright/compatibility-matrix.spec.js"],
    {
      stdio: "inherit",
      shell: false,
      env
    }
  );

  const durationMs = Date.now() - startedAt;
  return {
    browserName: target.label,
    browserExecutablePath: target.executablePath,
    project: target.project,
    viewport,
    runLabel,
    durationMs,
    status: result.status,
    signal: result.signal,
    ok: (result.status || 0) === 0 && !result.signal
  };
}

function writeReport(results) {
  mkdirSync(artifactDir, { recursive: true });

  const payload = {
    runId,
    generatedAt: new Date().toISOString(),
    matrix: results
  };
  writeFileSync(reportJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const lines = [];
  lines.push("# Compatibility Test Report");
  lines.push("");
  lines.push(`- Run ID: \`${runId}\``);
  lines.push(`- Output JSON: \`${reportJsonPath}\``);
  lines.push("");
  lines.push("| Browser | Viewport | Status | Duration ms |");
  lines.push("|---|---|---:|---:|");
  for (const result of results) {
    const viewportLabel = `${result.viewport.label} (${result.viewport.width}x${result.viewport.height})`;
    lines.push(`| ${result.browserName} | ${viewportLabel} | ${result.ok ? "OK" : "FAIL"} | ${result.durationMs} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- The matrix uses installed desktop browsers when available.");
  lines.push("- Mobile, tablet, and desktop viewports are checked through the same user path.");
  lines.push(
    "- This does not replace a real multi-OS CI grid, but it does catch layout and browser-engine regressions early."
  );

  writeFileSync(reportMdPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  trace("compatibility test started", {
    runId,
    browserTargets: browserTargets.length,
    viewportProfiles: viewportProfiles.length
  });

  if (!browserTargets.length) {
    throw new Error(
      "No compatible desktop browser executable was found. Set COMPATIBILITY_BROWSER_EXECUTABLES to override."
    );
  }

  const results = [];
  for (const target of browserTargets) {
    for (const viewport of viewportProfiles) {
      trace("matrix entry started", {
        target,
        viewport
      });
      const result = runMatrixEntry(target, viewport);
      results.push(result);
      trace("matrix entry completed", {
        runLabel: result.runLabel,
        ok: result.ok,
        durationMs: result.durationMs
      });
      if (!result.ok) {
        writeReport(results);
        process.exitCode = result.status || 1;
        return;
      }
    }
  }

  writeReport(results);
  trace("compatibility test completed", { runId, reportJsonPath, reportMdPath });
}

main();
