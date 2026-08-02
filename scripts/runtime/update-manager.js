const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { success, warn, error, section } = require("../cli-output");
const { ensureLocalDataServices } = require("./local-data-services");
const { normalizeWindowsEnv } = require("./services");

const projectRoot = path.resolve(__dirname, "..", "..");
const backupRoot = path.join(projectRoot, "deploy", "backup", "postgres");
const runRoot = path.join(projectRoot, "deploy", "backup", "update-runs");
const backendRoot = path.join(projectRoot, "apps", "backend");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    backupOnly: false,
    restoreFile: "",
    skipRollback: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--backup-only") args.backupOnly = true;
    else if (arg === "--skip-rollback") args.skipRollback = true;
    else if (arg === "--restore") {
      args.restoreFile = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--restore=")) {
      args.restoreFile = arg.slice("--restore=".length);
    }
  }

  return args;
}

function ensureDirs() {
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.mkdirSync(runRoot, { recursive: true });
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    stdio: options.stdio || "inherit",
    shell: false,
    windowsHide: true,
    env: normalizeWindowsEnv({ ...process.env, ...options.env }),
    input: options.input,
    encoding: options.encoding,
    maxBuffer: options.maxBuffer || 512 * 1024 * 1024,
    timeout: options.timeoutMs
  });
}

function hasCommand(command) {
  const result = run(command, ["--version"], { stdio: "ignore", timeoutMs: 10_000 });
  return result.status === 0;
}

function databaseUrl() {
  return process.env.DATABASE_URL || "postgresql://som_user:som_password@localhost:5432/som?schema=public";
}

function writeManifest(manifestPath, patch) {
  const current = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  fs.writeFileSync(manifestPath, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`);
}

function backupWithPgDump(backupFile) {
  return run(
    "pg_dump",
    ["--dbname", databaseUrl(), "--no-owner", "--no-acl", "--clean", "--if-exists", "--file", backupFile],
    {
      timeoutMs: Number(process.env.SOM_UPDATE_BACKUP_TIMEOUT_MS || 180_000)
    }
  );
}

function backupWithDocker(backupFile) {
  const result = run(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "sh",
      "-c",
      'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --clean --if-exists'
    ],
    {
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
      timeoutMs: Number(process.env.SOM_UPDATE_BACKUP_TIMEOUT_MS || 180_000)
    }
  );

  if (result.status === 0 && result.stdout) {
    fs.writeFileSync(backupFile, result.stdout, "utf8");
  }
  return result;
}

function createBackup() {
  ensureDirs();
  const backupFile = path.join(backupRoot, `sompro-pre-update-${timestamp()}.sql`);

  section("Creating pre-update backup");
  const result = hasCommand("pg_dump") ? backupWithPgDump(backupFile) : backupWithDocker(backupFile);
  if (result.status !== 0 || !fs.existsSync(backupFile) || fs.statSync(backupFile).size === 0) {
    throw new Error("Pre-update backup failed; update stopped before migrations.");
  }

  success(`Backup saved: ${backupFile}`);
  return backupFile;
}

function restoreWithPsql(backupFile) {
  return run("psql", ["--dbname", databaseUrl(), "-v", "ON_ERROR_STOP=1", "--file", backupFile], {
    timeoutMs: Number(process.env.SOM_UPDATE_RESTORE_TIMEOUT_MS || 180_000)
  });
}

function restoreWithDocker(backupFile) {
  return run(
    "docker",
    ["compose", "exec", "-T", "postgres", "sh", "-c", 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    {
      stdio: ["pipe", "inherit", "inherit"],
      input: fs.readFileSync(backupFile, "utf8"),
      encoding: "utf8",
      timeoutMs: Number(process.env.SOM_UPDATE_RESTORE_TIMEOUT_MS || 180_000)
    }
  );
}

function restoreBackup(backupFile) {
  if (!backupFile || !fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile || "-"}`);
  }

  section("Restoring backup");
  const result = hasCommand("psql") ? restoreWithPsql(backupFile) : restoreWithDocker(backupFile);
  if (result.status !== 0) {
    throw new Error(`Restore failed with exit code ${result.status || 1}`);
  }
  success("Rollback restore completed.");
}

function runMigration() {
  section("Applying migrations");
  const result =
    process.platform === "win32"
      ? run("cmd.exe", ["/d", "/s", "/c", "npm.cmd run prisma:migrate:deploy -w apps/backend"], {
          timeoutMs: Number(process.env.SOM_UPDATE_MIGRATION_TIMEOUT_MS || 180_000)
        })
      : run("npm", ["run", "prisma:migrate:deploy", "-w", "apps/backend"], {
          timeoutMs: Number(process.env.SOM_UPDATE_MIGRATION_TIMEOUT_MS || 180_000)
        });
  if (result.status !== 0) {
    throw new Error(result.error?.message || `Migration failed with exit code ${result.status || 1}`);
  }
  success("Migrations applied.");
}

async function verifyDatabase() {
  section("Verifying database health");
  const clientModulePath = require.resolve("@prisma/client", { paths: [backendRoot, projectRoot] });
  const { PrismaClient } = require(clientModulePath);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    success("Database health check passed.");
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyBackendHealth() {
  const requireBackend = process.env.SOM_UPDATE_REQUIRE_BACKEND_HEALTH === "true";
  const url = process.env.SOM_UPDATE_HEALTH_URL || "http://127.0.0.1:4000/health";
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    success(`Backend health check passed: ${url}`);
  } catch (failure) {
    if (requireBackend) throw failure;
    warn(`Backend health check skipped/unavailable: ${url}`);
  }
}

async function safeUpdate(args) {
  ensureDirs();
  const manifestPath = path.join(runRoot, `update-${timestamp()}.json`);
  writeManifest(manifestPath, {
    startedAt: new Date().toISOString(),
    status: "STARTED",
    dryRun: args.dryRun
  });

  if (args.dryRun) {
    success("Dry run completed. No backup, migration, or restore was executed.");
    writeManifest(manifestPath, { completedAt: new Date().toISOString(), status: "DRY_RUN_OK" });
    return;
  }

  const services = await ensureLocalDataServices();
  if (!services.ok) throw new Error(services.message);

  const backupFile = createBackup();
  writeManifest(manifestPath, { backupFile, status: "BACKUP_OK" });
  if (args.backupOnly) {
    writeManifest(manifestPath, { completedAt: new Date().toISOString(), status: "BACKUP_ONLY_OK" });
    return;
  }

  try {
    runMigration();
    writeManifest(manifestPath, { status: "MIGRATION_OK" });
    await verifyDatabase();
    await verifyBackendHealth();
    writeManifest(manifestPath, { completedAt: new Date().toISOString(), status: "UPDATE_OK" });
    success("Safe update completed.");
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    error(`Update failed: ${message}`);
    writeManifest(manifestPath, { status: "FAILED", error: message });

    if (args.skipRollback) {
      warn("Rollback skipped by --skip-rollback.");
      throw failure;
    }

    restoreBackup(backupFile);
    writeManifest(manifestPath, {
      completedAt: new Date().toISOString(),
      status: "ROLLED_BACK",
      rollbackFrom: backupFile
    });
    throw new Error(`Update failed and rollback was completed. Original error: ${message}`, { cause: failure });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.restoreFile) {
    restoreBackup(path.resolve(projectRoot, args.restoreFile));
    return;
  }

  await safeUpdate(args);
}

main().catch((failure) => {
  error(failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
});
