const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { error, success, warn } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "reports", "security");
const reportPath = path.join(reportDir, "desktop-signing-report.json");
const configPath = path.join(root, "apps", "desktop", "electron-builder.config.cjs");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function findInstaller() {
  const releaseDir = path.join(root, "apps", "desktop", "release");
  if (!fs.existsSync(releaseDir)) return null;
  return (
    fs
      .readdirSync(releaseDir)
      .filter((name) => /^SOM-PRO-Setup-.*\.exe$/i.test(name))
      .map((name) => path.join(releaseDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null
  );
}

function verifyWindowsSignature(file) {
  if (process.platform !== "win32") {
    return { checked: false, ok: false, status: "SKIPPED", message: "Authenticode verification requires Windows" };
  }
  const command = [
    "powershell",
    "-NoProfile",
    "-Command",
    `(Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, "''")}').Status`
  ];
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8", windowsHide: true });
  const status = String(result.stdout || "").trim();
  return {
    checked: true,
    ok: status === "Valid",
    status,
    message: status === "Valid" ? "signature valid" : "signature missing or invalid"
  };
}

function writeReport(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function main() {
  const config = fs.readFileSync(configPath, "utf8");
  const signingRequested = String(process.env.SOM_ENABLE_CODESIGN || "").toLowerCase() === "true";
  const installer = process.env.SOM_DESKTOP_INSTALLER || findInstaller();
  const configSignals = {
    signExecutableEnvGate: /signExecutable:\s*codesignEnabled/.test(config),
    signedBuildScript: /build:win:signed/.test(
      fs.readFileSync(path.join(root, "apps", "desktop", "package.json"), "utf8")
    )
  };
  const installerEvidence =
    installer && fs.existsSync(installer)
      ? {
          path: path.relative(root, installer).replace(/\\/g, "/"),
          sha256: sha256(installer),
          authenticode: verifyWindowsSignature(installer)
        }
      : null;

  const report = {
    generatedAt: new Date().toISOString(),
    signingRequested,
    configSignals,
    installer: installerEvidence,
    updateIntegrity: {
      autoUpdateEnabled: false,
      policy:
        "No auto-update channel is enabled in this release. Updates are manual signed-installer deliveries with SHA-256 evidence."
    }
  };
  writeReport(report);

  if (!configSignals.signExecutableEnvGate || !configSignals.signedBuildScript) {
    error("Desktop signing config is incomplete");
    process.exit(1);
  }

  if (!signingRequested) {
    warn(
      "Desktop signing check: baseline only. Set SOM_ENABLE_CODESIGN=true and provide a signed installer for release evidence."
    );
    success("Desktop signing baseline written:", path.relative(root, reportPath));
    return;
  }

  if (!installerEvidence) {
    error(
      "SOM_ENABLE_CODESIGN=true requires SOM_DESKTOP_INSTALLER or a generated SOM-PRO installer under apps/desktop/release"
    );
    process.exit(1);
  }

  if (!installerEvidence.authenticode.ok) {
    error("Installer signature is missing or invalid:", installerEvidence.authenticode.status);
    process.exit(1);
  }

  success("Desktop signing evidence passed:", path.relative(root, reportPath));
}

main();
