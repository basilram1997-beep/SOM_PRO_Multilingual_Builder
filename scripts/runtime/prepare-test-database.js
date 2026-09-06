const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { error, success } = require("../cli-output");
const { DEFAULT_DATABASE_URL } = require("./database-config");
const { ensureLocalDataServices } = require("./local-data-services");
const { shellCommand } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");

function run(commandLine, options = {}) {
  const shell = shellCommand(commandLine);
  return spawnSync(shell.command, shell.args, {
    cwd: options.cwd || projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL
    },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    timeout: options.timeoutMs || 120_000
  });
}

async function main() {
  const services = await ensureLocalDataServices();
  if (!services.ok) {
    error(services.message || "Local PostgreSQL/Redis services are not ready for integration tests.");
    process.exitCode = 1;
    return;
  }

  const migrate = run("npm run prisma:migrate:deploy -w apps/backend", { timeoutMs: 180_000 });
  if (migrate.status !== 0) {
    error("Prisma migrations could not be applied to the local test database.");
    process.exitCode = migrate.status || 1;
    return;
  }

  success("Local test database is ready.");
}

if (require.main === module) {
  main().catch((failure) => {
    error(failure instanceof Error ? failure.message : String(failure));
    process.exitCode = 1;
  });
}
