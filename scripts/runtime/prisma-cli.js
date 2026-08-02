const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const prismaCli = require.resolve("prisma/build/index.js", {
  paths: [process.cwd(), projectRoot]
});

const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
  windowsHide: true,
  env: {
    ...process.env,
    PRISMA_HIDE_UPDATE_MESSAGE: process.env.PRISMA_HIDE_UPDATE_MESSAGE || "true"
  }
});

if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status || 0;
}
