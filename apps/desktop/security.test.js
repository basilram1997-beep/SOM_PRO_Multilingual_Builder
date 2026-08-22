const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isAllowedExternalUrl, isTrustedNavigationUrl } = require("./src/securityPolicy");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const saasConfig = {
  isSaas: true,
  appUrl: "https://app.school.example",
  apiUrl: "https://api.school.example",
  licenseServerUrl: "https://license.school.example"
};

const localConfig = {
  isSaas: false,
  appUrl: "http://localhost:5173",
  apiUrl: "http://localhost:4000",
  licenseServerUrl: "http://localhost:4100"
};

test("BrowserWindow uses hardened webPreferences", () => {
  const source = read("apps/desktop/src/window.js");

  assert.match(source, /contextIsolation:\s*true/, "contextIsolation must stay enabled");
  assert.match(source, /nodeIntegration:\s*false/, "nodeIntegration must stay disabled");
  assert.match(source, /sandbox:\s*true/, "sandbox must stay enabled");
  assert.match(source, /webSecurity:\s*true/, "webSecurity must stay enabled");
  assert.match(source, /allowRunningInsecureContent:\s*false/, "insecure mixed content must stay disabled");
});

test("desktop shell blocks untrusted navigation and external windows", () => {
  const source = read("apps/desktop/src/window.js");

  assert.match(source, /will-navigate/, "top-level navigation must be intercepted");
  assert.match(source, /isTrustedNavigationUrl\(url, runtimeConfig\)/, "navigation must use the trust policy");
  assert.match(source, /setWindowOpenHandler/, "window.open must be intercepted");
  assert.match(source, /isAllowedExternalUrl\(url, runtimeConfig\)/, "external opens must use the allowlist");
  assert.match(
    source,
    /som-repair-local-services"[\s\S]*isTrustedSender\(event\)/,
    "repair IPC must reject untrusted senders"
  );
  assert.match(
    source,
    /som-export-pdf"[\s\S]*isTrustedSender\(event\)/,
    "PDF export IPC must reject untrusted senders"
  );
  assert.match(source, /return \{ action: "deny" \}/, "new renderer windows must be denied");
  assert.doesNotMatch(
    source,
    /shell\.openExternal\(url\);\s*return \{ action: "deny" \}/,
    "external URLs must not open without an allowlist check"
  );
  assert.ok(
    source.indexOf("setWindowOpenHandler") < source.indexOf('loadFile(path.join(root, "loading.html"))'),
    "window.open handler should be installed before the first page load"
  );
  assert.ok(
    source.indexOf("will-navigate") < source.indexOf('loadFile(path.join(root, "loading.html"))'),
    "navigation guard should be installed before the first page load"
  );
});

test("preload remains a narrow sandbox-compatible IPC bridge", () => {
  const preload = read("apps/desktop/preload.js");

  assert.match(
    preload,
    /contextBridge\.exposeInMainWorld\(\s*"somDesktop"/,
    "preload should expose one bridge namespace"
  );
  assert.match(
    preload,
    /ipcRenderer\.sendSync\("som-desktop-bridge-data"\)/,
    "static bridge data should come from main"
  );
  assert.match(preload, /Object\.freeze/, "exposed bridge object should be immutable");
  assert.match(preload, /safeFileName/, "exported filenames should be sanitized before IPC");
  assert.doesNotMatch(
    preload,
    /require\("fs"\)|require\("path"\)|require\("\.\/src\//,
    "sandboxed preload must not use Node filesystem or local modules"
  );
});

test("security policy allows only trusted app navigation and HTTPS external origins", () => {
  assert.equal(isTrustedNavigationUrl("https://app.school.example/dashboard", saasConfig), true);
  assert.equal(isTrustedNavigationUrl("https://evil.example/dashboard", saasConfig), false);
  assert.equal(isTrustedNavigationUrl("http://app.school.example/dashboard", saasConfig), false);
  assert.equal(isTrustedNavigationUrl("file:///C:/som/offline.html", saasConfig), true);
  assert.equal(isTrustedNavigationUrl("http://localhost:5173", localConfig), true);

  assert.equal(isAllowedExternalUrl("https://app.school.example/help", saasConfig), true);
  assert.equal(isAllowedExternalUrl("https://api.school.example/docs", saasConfig), true);
  assert.equal(isAllowedExternalUrl("https://license.school.example/status", saasConfig), true);
  assert.equal(isAllowedExternalUrl("https://evil.example/phish", saasConfig), false);
  assert.equal(isAllowedExternalUrl("http://app.school.example/insecure", saasConfig), false);
  assert.equal(isAllowedExternalUrl("https://localhost/help", saasConfig), false);
  assert.equal(isAllowedExternalUrl("javascript:alert(1)", saasConfig), false);
});

test("desktop release signing and update integrity evidence is gated", () => {
  const builder = read("apps/desktop/electron-builder.config.cjs");
  const rootPackage = JSON.parse(read("package.json"));
  const desktopPackage = JSON.parse(read("apps/desktop/package.json"));
  const signingCheck = read("scripts/desktop-signing-check.js");

  assert.match(builder, /SOM_ENABLE_CODESIGN/, "code signing should be controlled by an explicit env gate");
  assert.match(builder, /signExecutable:\s*codesignEnabled/, "Windows executable signing should use the env gate");
  assert.match(
    desktopPackage.scripts["build:win:signed"],
    /SOM_ENABLE_CODESIGN=true/,
    "desktop package should expose a signed Windows build"
  );
  assert.equal(rootPackage.scripts["desktop:signing:check"], "node scripts/desktop-signing-check.js");
  assert.match(
    rootPackage.scripts["desktop:check"],
    /desktop:signing:check/,
    "desktop checks should include signing evidence baseline"
  );

  assert.match(signingCheck, /Get-AuthenticodeSignature/, "signing check should verify Authenticode on Windows");
  assert.match(signingCheck, /sha256/, "signing check should write installer hash evidence");
  assert.match(
    signingCheck,
    /SOM_ENABLE_CODESIGN=true requires SOM_DESKTOP_INSTALLER/,
    "release signing should fail without an installer artifact"
  );
  assert.match(
    signingCheck,
    /No auto-update channel is enabled/,
    "update integrity policy should be explicit when auto-update is absent"
  );
});
