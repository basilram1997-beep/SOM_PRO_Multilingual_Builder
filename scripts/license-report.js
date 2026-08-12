const fs = require("node:fs");
const path = require("node:path");
const { success, warn } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "reports", "security");
const lockPath = path.join(root, "package-lock.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packageNameFromLockPath(lockPathKey, value) {
  if (value.name) return value.name;
  const parts = lockPathKey.split("node_modules/");
  return parts[parts.length - 1] || lockPathKey;
}

function packageJsonPath(lockPathKey) {
  if (!lockPathKey) return path.join(root, "package.json");
  return path.join(root, lockPathKey, "package.json");
}

function normalizeLicense(value) {
  if (!value) return "UNKNOWN";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeLicense).join(" OR ");
  if (value.type) return value.type;
  return "UNKNOWN";
}

function main() {
  if (!fs.existsSync(lockPath)) {
    throw new Error("package-lock.json is required to generate a license report");
  }

  const lock = readJson(lockPath);
  const rows = Object.entries(lock.packages || {})
    .filter(([key, value]) => key && value && value.version)
    .map(([key, value]) => {
      let manifest = {};
      const manifestPath = packageJsonPath(key);
      if (fs.existsSync(manifestPath)) {
        manifest = readJson(manifestPath);
      }
      return {
        name: packageNameFromLockPath(key, value),
        version: value.version,
        license: normalizeLicense(manifest.license),
        repository: manifest.repository?.url || manifest.repository || null,
        path: key
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  const unknown = rows.filter((row) => row.license === "UNKNOWN");
  const report = {
    generatedAt: new Date().toISOString(),
    source: "package-lock.json plus installed package manifests",
    totalPackages: rows.length,
    unknownLicenseCount: unknown.length,
    packages: rows
  };

  fs.mkdirSync(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, "license-report.json");
  const markdownPath = path.join(reportDir, "license-report.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    markdownPath,
    [
      "# Dependency License Report",
      "",
      `Generated at: ${report.generatedAt}`,
      "",
      `Packages: ${rows.length}`,
      "",
      `Unknown licenses: ${unknown.length}`,
      "",
      "| Package | Version | License |",
      "| ------- | ------- | ------- |",
      ...rows.map((row) => `| ${row.name} | ${row.version} | ${row.license} |`),
      ""
    ].join("\n")
  );

  if (unknown.length) {
    warn("License report contains UNKNOWN licenses:", String(unknown.length));
  }
  success("License report generated:", path.relative(root, jsonPath));
}

main();
