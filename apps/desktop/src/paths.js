const path = require("path");
const fs = require("fs");
const electron = require("electron");
const app = electron.app || { isPackaged: false };
const { getDesktopRuntimeConfig } = require("./runtimeConfig");

const DEFAULT_LOCAL_URL = "http://localhost:5173";
const runtimeConfig = getDesktopRuntimeConfig();
const DEFAULT_API_URL = runtimeConfig.apiUrl;
const DEFAULT_WEB_URL = runtimeConfig.appUrl || DEFAULT_LOCAL_URL;

function desktopRoot() {
  return path.resolve(__dirname, "..");
}

function canOpen(url) {
  const http = require("http");
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if (await canOpen(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

function isProjectRoot(candidate) {
  return (
    Boolean(candidate) &&
    fs.existsSync(path.join(candidate, "package.json")) &&
    fs.existsSync(path.join(candidate, "apps", "backend", "package.json"))
  );
}

function addNearbyProjectCandidates(candidates, base) {
  if (!base || !fs.existsSync(base)) return;
  candidates.push(base);
  const parent = path.dirname(base);
  candidates.push(parent);
  try {
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(parent, entry.name);
      candidates.push(full);
      if (/SOM[_ -]?PRO/i.test(entry.name))
        candidates.push(path.join(full, "SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed"));
    }
  } catch {}
}

function projectRootCandidates() {
  const candidates = [
    process.env.SOM_PRO_PROJECT_ROOT,
    path.resolve(__dirname, "..", "..", ".."),
    path.join(process.resourcesPath || "", "project")
  ].filter(Boolean);
  addNearbyProjectCandidates(candidates, path.dirname(process.execPath || ""));
  addNearbyProjectCandidates(candidates, process.cwd());
  const home = process.env.USERPROFILE || process.env.HOME;
  if (home) {
    addNearbyProjectCandidates(candidates, path.join(home, "Downloads"));
    addNearbyProjectCandidates(candidates, path.join(home, "Desktop"));
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

function findProjectRootDeep(base, maxDepth = 3) {
  if (!base || !fs.existsSync(base) || maxDepth < 0) return null;
  if (isProjectRoot(base)) return base;
  let entries = [];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return null;
  }
  const likely = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(base, entry.name))
    .sort((a, b) => (/SOM[_ -]?PRO/i.test(b) ? 1 : 0) - (/SOM[_ -]?PRO/i.test(a) ? 1 : 0));
  for (const candidate of likely) {
    if (isProjectRoot(candidate)) return candidate;
    if (maxDepth > 0) {
      const found = findProjectRootDeep(candidate, maxDepth - 1);
      if (found) return found;
    }
  }
  return null;
}
function findProjectRoot() {
  const direct = projectRootCandidates().find(isProjectRoot);
  if (direct) return direct;
  const home = process.env.USERPROFILE || process.env.HOME;
  const searchRoots = [process.cwd()];
  if (home) searchRoots.push(path.join(home, "Downloads"), path.join(home, "Desktop"));
  for (const base of searchRoots) {
    const found = findProjectRootDeep(base, 3);
    if (found) return found;
  }
  return null;
}

function bundledWebIndex() {
  const packagedPath = path.join(process.resourcesPath || "", "web", "index.html");
  const devPath = path.join(desktopRoot(), "web", "index.html");
  const frontendDistPath = path.join(__dirname, "..", "..", "frontend", "dist", "index.html");
  if (app.isPackaged && fs.existsSync(packagedPath)) return packagedPath;
  if (fs.existsSync(devPath)) return devPath;
  if (fs.existsSync(frontendDistPath)) return frontendDistPath;
  return null;
}

module.exports = {
  DEFAULT_API_URL,
  DEFAULT_WEB_URL,
  runtimeConfig,
  canOpen,
  waitForUrl,
  findProjectRoot,
  bundledWebIndex,
  desktopRoot
};
