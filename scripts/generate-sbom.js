const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { success } = require("./cli-output");

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

function packageType(name) {
  if (name.startsWith("@som/")) return "application";
  return "library";
}

function packageUrl(name, version) {
  const encoded = name.startsWith("@")
    ? `@${encodeURIComponent(name.slice(1).split("/")[0])}/${encodeURIComponent(name.split("/")[1])}`
    : encodeURIComponent(name);
  return `pkg:npm/${encoded}@${encodeURIComponent(version || "0.0.0")}`;
}

function externalReferences(pkg) {
  const refs = [];
  if (pkg.resolved && /^https?:\/\//i.test(pkg.resolved)) {
    refs.push({ type: "distribution", url: pkg.resolved });
  }
  return refs;
}

function makeComponent(lockPathKey, pkg) {
  const name = packageNameFromLockPath(lockPathKey, pkg);
  const version = pkg.version || "0.0.0";
  const hashes = [];
  if (pkg.integrity) {
    hashes.push({ alg: "SRI", content: pkg.integrity });
  }
  return {
    type: packageType(name),
    "bom-ref": `${name}@${version}`,
    name,
    version,
    purl: packageUrl(name, version),
    hashes,
    externalReferences: externalReferences(pkg)
  };
}

function main() {
  if (!fs.existsSync(lockPath)) {
    throw new Error("package-lock.json is required to generate a release SBOM");
  }

  const lock = readJson(lockPath);
  const components = Object.entries(lock.packages || {})
    .filter(([key, value]) => key && value && value.version)
    .map(([key, value]) => makeComponent(key, value))
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "SOM PRO",
          name: "scripts/generate-sbom.js",
          version: "1.0.0"
        }
      ],
      component: {
        type: "application",
        name: lock.name || "som-pro",
        version: lock.version || "0.0.0"
      }
    },
    components
  };

  fs.mkdirSync(reportDir, { recursive: true });
  const outputPath = path.join(reportDir, "sbom.cyclonedx.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(bom, null, 2)}\n`);
  success("SBOM generated:", path.relative(root, outputPath), `(${components.length} components)`);
}

main();
