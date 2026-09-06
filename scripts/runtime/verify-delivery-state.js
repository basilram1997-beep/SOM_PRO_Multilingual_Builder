const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { shellCommand } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");

const requiredTrackedPaths = [
  "apps/backend/src/services/licenseService.ts",
  "apps/backend/src/services/licenseStateService.ts",
  "apps/backend/src/services/licenseRepository.ts",
  "apps/backend/src/services/licenseActivationService.ts",
  "apps/license-server/src/server.js",
  "apps/license-server/src/routes/admin.js",
  "apps/license-server/src/routes/client.js",
  "apps/license-server/src/store.js",
  "apps/license-server/src/policy.js",
  "apps/license-server/src/security.js",
  "apps/license-server/src/requestProtectionStore.js",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/java/com/sompro/schooloperations/MainActivity.java",
  "android/gradle/wrapper/gradle-wrapper.properties",
  "ios/App/App/Info.plist",
  "ios/App/App/AppDelegate.swift",
  "ios/App/Podfile",
  "docs/DELIVERY_INDEX.md",
  "docs/DELIVERY_PACKAGES.md",
  "docs/test-reports/database-verification-latest.md"
];

const requiredIgnoredPaths = [
  ".env",
  "apps/backend/.env",
  "apps/frontend/.env",
  "apps/license-server/.env.production",
  "node_modules",
  "apps/backend/node_modules",
  "dist",
  "apps/backend/dist",
  "deliverables",
  "site-package.tgz"
];

function run(command, options = {}) {
  const shell = shellCommand(command);
  const result = spawnSync(shell.command, shell.args, {
    cwd: options.cwd || projectRoot,
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd || projectRoot,
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
    shell: false,
    windowsHide: true
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

function assertGitSuccess(label, command) {
  const result = run(command);
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.output}`);
  }
  return result.output;
}

function listTracked() {
  return new Set(
    assertGitSuccess("git ls-files", "git ls-files")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function verifyRequiredTrackedFiles(tracked) {
  const missing = requiredTrackedPaths.filter((item) => !tracked.has(item));
  if (missing.length > 0) {
    throw new Error(`Required delivery source files are not tracked:\n- ${missing.join("\n- ")}`);
  }
}

function verifyIgnoredPolicy(tracked) {
  const accidentallyTracked = requiredIgnoredPaths.filter((item) => tracked.has(item));
  if (accidentallyTracked.length > 0) {
    throw new Error(`Generated or secret-bearing paths must not be tracked:\n- ${accidentallyTracked.join("\n- ")}`);
  }

  const checkIgnore = run(`git check-ignore ${requiredIgnoredPaths.join(" ")}`);
  if (checkIgnore.status !== 0) {
    throw new Error(`One or more generated/secret paths are not ignored:\n${checkIgnore.output}`);
  }
}

function verifyCleanClone() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sompro-clean-clone-"));
  const clonePath = path.join(tempRoot, "repo");
  const clone = runGit(["clone", "--local", "--no-hardlinks", projectRoot, clonePath]);
  if (clone.status !== 0) {
    throw new Error(`Clean clone failed:\n${clone.output}`);
  }

  try {
    const tracked = run("git ls-files", { cwd: clonePath });
    if (tracked.status !== 0) {
      throw new Error(`Clean clone git ls-files failed:\n${tracked.output}`);
    }
    const clonedFiles = new Set(tracked.output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    verifyRequiredTrackedFiles(clonedFiles);

    const docs = ["docs/DELIVERY_INDEX.md", "docs/DELIVERY_PACKAGES.md"];
    for (const doc of docs) {
      if (!fs.existsSync(path.join(clonePath, doc))) {
        throw new Error(`Clean clone is missing ${doc}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  const tracked = listTracked();
  verifyRequiredTrackedFiles(tracked);
  verifyIgnoredPolicy(tracked);
  verifyCleanClone();

  console.log("Delivery state verification passed.");
  console.log("- Critical source paths are tracked.");
  console.log("- Generated artifacts, secrets, dumps, and package outputs remain ignored.");
  console.log("- A clean local clone contains the current handoff source baseline.");
}

main();
