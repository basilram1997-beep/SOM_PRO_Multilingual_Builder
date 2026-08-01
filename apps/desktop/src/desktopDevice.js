const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function appDataDir() {
  const base = process.env.APPDATA || process.env.LOCALAPPDATA || os.homedir() || process.cwd();
  return path.join(base, "SOM PRO");
}

function readOrCreateInstallationId() {
  const dir = appDataDir();
  const file = path.join(dir, "device.json");
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data.installationId) return String(data.installationId);
    }
    const installationId = crypto.randomBytes(24).toString("hex");
    fs.writeFileSync(
      file,
      JSON.stringify({ installationId, createdAt: new Date().toISOString() }, null, 2) + "\n",
      "utf8"
    );
    return installationId;
  } catch {
    return crypto.createHash("sha256").update([os.hostname(), os.platform(), os.arch()].join("|")).digest("hex");
  }
}

function getDesktopDeviceInfo() {
  const installationId = readOrCreateInstallationId();
  const platform = os.platform();
  const arch = os.arch();
  const deviceName = os.hostname() || "SOM PRO Desktop";
  const appVersion = process.env.npm_package_version || "1.5.5";
  const deviceId = crypto
    .createHash("sha256")
    .update(["som-pro", installationId, platform, arch].join("|"))
    .digest("hex");
  return { deviceId, deviceName, appVersion, platform, arch };
}

module.exports = { getDesktopDeviceInfo };
