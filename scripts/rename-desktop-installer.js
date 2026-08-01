const fs = require("fs");
const path = require("path");
const { error, success } = require("./cli-output");

const channel = process.argv[2];
if (!channel || !/^[A-Za-z0-9-]+$/.test(channel)) {
  error("Usage: node scripts/rename-desktop-installer.js SaaS|Trial");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const desktopReleaseDir = path.join(root, "apps", "desktop", "release");
const releaseDir = path.join(root, "release");
const rootPackage = require(path.join(root, "package.json"));
const targetName = `SOM-PRO-Setup-${rootPackage.version}-${channel}.exe`;

if (!fs.existsSync(desktopReleaseDir)) {
  error("مجلد إصدار سطح المكتب غير موجود:", desktopReleaseDir);
  process.exit(1);
}

const installers = fs
  .readdirSync(desktopReleaseDir)
  .filter((name) => name.toLowerCase().endsWith(".exe"))
  .map((name) => {
    const fullPath = path.join(desktopReleaseDir, name);
    return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

if (installers.length === 0) {
  error("لم يتم العثور على ملف .exe بعد بناء سطح المكتب.");
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
const source = installers[0].fullPath;
const desktopTarget = path.join(desktopReleaseDir, targetName);
const releaseTarget = path.join(releaseDir, targetName);

if (path.basename(source) !== targetName) {
  fs.copyFileSync(source, desktopTarget);
}
fs.copyFileSync(path.basename(source) === targetName ? source : desktopTarget, releaseTarget);

success("تم تجهيز المثبّت:", desktopTarget);
success("تم تجهيز نسخة الإطلاق:", releaseTarget);
