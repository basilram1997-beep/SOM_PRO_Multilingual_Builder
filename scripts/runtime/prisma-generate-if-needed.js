const { existsSync, statSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const sourceSchemaPath = path.join(projectRoot, "apps", "backend", "prisma", "schema.prisma");
const generatedSchemaPath = path.join(projectRoot, "node_modules", ".prisma", "client", "schema.prisma");

function generatedClientMatchesSchema() {
  if (!existsSync(generatedSchemaPath)) return false;
  return statSync(generatedSchemaPath).mtimeMs >= statSync(sourceSchemaPath).mtimeMs;
}

if (generatedClientMatchesSchema()) {
  console.log("[SOM PRO] Prisma client is already current; skipping generate.");
  process.exit(0);
}

const result = spawnSync(process.execPath, [path.join(__dirname, "prisma-cli.js"), "generate"], {
  cwd: path.join(projectRoot, "apps", "backend"),
  stdio: "inherit",
  shell: false,
  windowsHide: true
});

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status || 0;
}
