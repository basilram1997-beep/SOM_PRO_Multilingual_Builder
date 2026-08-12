const fs = require("fs");
const path = require("path");
const { findProjectRoot, bundledWebIndex, runtimeConfig } = require("./paths");
const { error, success } = require("../../../scripts/cli-output");

const root = path.resolve(__dirname, "..", "..", "..");
const required = [
  "apps/desktop/src/main.js",
  "apps/desktop/src/window.js",
  "apps/desktop/src/runtimeConfig.js",
  "apps/desktop/src/desktopDevice.js",
  "apps/desktop/src/securityPolicy.js",
  "apps/desktop/security.test.js",
  "apps/desktop/preload.js",
  "apps/desktop/loading.html",
  "apps/desktop/offline.html",
  "apps/desktop/icon.ico",
  "apps/frontend/dist/index.html"
];

let ok = true;
for (const file of required) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) success("موجود:", file);
  else {
    error("غير موجود:", file);
    ok = false;
  }
}

success("وضع التشغيل:", runtimeConfig.mode);
success("رابط API:", runtimeConfig.apiUrl);
success("رابط خادم الترخيص:", runtimeConfig.licenseServerUrl);
success("اكتشاف جذر المشروع:", findProjectRoot() || "غير موجود");
success("ملف الويب المضمّن:", bundledWebIndex() || "غير موجود");
process.exit(ok ? 0 : 1);
