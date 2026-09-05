const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

const issues = [];

const mobileEnvExample = exists("apps/frontend/.env.mobile.example")
  ? readText("apps/frontend/.env.mobile.example")
  : "";
if (!/VITE_API_URL\s*=\s*https:\/\//i.test(mobileEnvExample)) {
  issues.push("apps/frontend/.env.mobile.example must point to a public HTTPS API.");
}

if (!exists("capacitor.config.ts")) {
  issues.push("capacitor.config.ts is missing.");
}

if (!exists("assets/icon-only.png") || !exists("assets/splash.png") || !exists("assets/splash-dark.png")) {
  issues.push("Mobile icon and splash source assets are missing from assets/.");
}

if (!exists("android/key.properties.example")) {
  issues.push("android/key.properties.example is missing.");
}

if (!exists("store/google-play.json") || !exists("store/app-store.json")) {
  issues.push("Store metadata templates are missing from store/.");
}

if (issues.length > 0) {
  console.error("[mobile-release-check] Issues found:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("[mobile-release-check] Mobile release templates are present and consistent.");
