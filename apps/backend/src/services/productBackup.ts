import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";

type ProductBackupInput = {
  schoolId: string;
  createdBy: string | null;
};

export type ProductBackupResult = {
  backupDir: string;
  checksum: string;
  encrypted: boolean;
  manifestPath: string;
  postgresDumpPath: string;
  licenseDataCopied: boolean;
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function projectPath(...parts: string[]) {
  const cwd = process.cwd();
  const fromBackendWorkspace = path.basename(cwd) === "backend" && path.basename(path.dirname(cwd)) === "apps";
  const root = fromBackendWorkspace ? path.resolve(cwd, "..", "..") : cwd;
  return path.resolve(root, ...parts);
}

function resolveBackupRoot() {
  return path.resolve(process.env.SOM_BACKUP_DIR || projectPath("deploy", "backup", "product"));
}

function resolveLicenseDataDir() {
  return path.resolve(process.env.SOM_LICENSE_DATA_DIR || projectPath("apps", "license-server", "data"));
}

function commandError(command: string, status: number | null, stderr: string) {
  const cleanStderr = stderr.trim();
  return `${command} failed${status === null ? "" : ` with status ${status}`}${cleanStderr ? `: ${cleanStderr}` : ""}`;
}

function runProcess(command: string, args: string[], stderrLabel: string) {
  const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const stderrChunks: string[] = [];
  child.stderr?.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  return new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => {
      if (status === 0) {
        resolve();
        return;
      }
      reject(new Error(commandError(stderrLabel, status, stderrChunks.join(""))));
    });
  });
}

async function runNativePgDump(outputPath: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const pgDump = process.env.SOM_PG_DUMP_PATH || "pg_dump";
  await runProcess(pgDump, ["--dbname", databaseUrl, "--no-owner", "--no-acl", "--clean", "--if-exists", "--file", outputPath], pgDump);
}

async function runDockerPgDump(outputPath: string) {
  const docker = process.env.SOM_DOCKER_PATH || (process.platform === "win32" ? "docker.exe" : "docker");
  const child = spawn(
    docker,
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "sh",
      "-c",
      'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --clean --if-exists'
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  const stderrChunks: string[] = [];
  child.stderr?.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  if (!child.stdout) {
    throw new Error(commandError(docker, null, "docker stdout unavailable"));
  }

  const outputStream = fs.createWriteStream(outputPath);
  await Promise.all([
    pipeline(child.stdout, outputStream),
    once(child, "close").then(([status]) => {
      if (status === 0) return;
      throw new Error(commandError(docker, status as number | null, stderrChunks.join("")));
    })
  ]);
}

async function createPostgresDump(outputPath: string) {
  try {
    await runNativePgDump(outputPath);
  } catch (nativeError) {
    try {
      await runDockerPgDump(outputPath);
    } catch (dockerError) {
      throw new Error(
        `PostgreSQL backup failed. pg_dump: ${
          nativeError instanceof Error ? nativeError.message : String(nativeError)
        }. docker fallback: ${dockerError instanceof Error ? dockerError.message : String(dockerError)}`,
        { cause: dockerError }
      );
    }
  }
}

async function copyLicenseData(targetDir: string) {
  const sourceDir = resolveLicenseDataDir();
  if (!fs.existsSync(sourceDir)) {
    return false;
  }

  await fs.promises.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (source) => !path.basename(source).toLowerCase().endsWith(".env")
  });
  return true;
}

async function listFilesRecursive(root: string): Promise<string[]> {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(fullPath);
      if (entry.isFile() && entry.name !== "manifest.json") return [fullPath];
      return [];
    })
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function checksumBackup(backupDir: string) {
  const hash = crypto.createHash("sha256");
  for (const filePath of await listFilesRecursive(backupDir)) {
    hash.update(path.relative(backupDir, filePath).replace(/\\/g, "/"));
    hash.update(await fs.promises.readFile(filePath));
  }
  return hash.digest("hex");
}

function backupEncryptionKey() {
  const source =
    process.env.SOM_BACKUP_ENCRYPTION_KEY ||
    process.env.SOM_BACKUP_PASSPHRASE ||
    process.env.SOM_PRO_AUTH_SECRET ||
    process.env.SOM_PRO_LICENSE_SECRET;
  if (!source && process.env.NODE_ENV === "production") {
    throw new Error("SOM_BACKUP_ENCRYPTION_KEY or SOM_BACKUP_PASSPHRASE is required for production backups.");
  }
  return crypto
    .createHash("sha256")
    .update(source || "development-backup-encryption-key")
    .digest();
}

async function encryptFileInPlace(filePath: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", backupEncryptionKey(), iv);
  const plaintext = await fs.promises.readFile(filePath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encryptedPath = `${filePath}.enc`;
  await fs.promises.writeFile(encryptedPath, Buffer.concat([Buffer.from("SOMENC1:"), iv, tag, encrypted]));
  await fs.promises.rm(filePath, { force: true });
  return encryptedPath;
}

async function encryptFilesRecursive(root: string) {
  for (const filePath of await listFilesRecursive(root)) {
    if (filePath.endsWith(".enc")) continue;
    await encryptFileInPlace(filePath);
  }
}

export async function createProductBackup(input: ProductBackupInput): Promise<ProductBackupResult> {
  const backupRoot = resolveBackupRoot();
  const backupDir = path.join(backupRoot, `sompro-product-backup-${timestampForFile()}`);
  const postgresDumpPath = path.join(backupDir, "postgres.sql");
  const licenseTargetDir = path.join(backupDir, "license-data");
  const manifestPath = path.join(backupDir, "manifest.json");

  await fs.promises.mkdir(backupDir, { recursive: true });
  await createPostgresDump(postgresDumpPath);
  const licenseDataCopied = await copyLicenseData(licenseTargetDir);
  const encryptedPostgresDumpPath = await encryptFileInPlace(postgresDumpPath);
  if (licenseDataCopied) {
    await encryptFilesRecursive(licenseTargetDir);
  }
  const checksum = await checksumBackup(backupDir);

  await fs.promises.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        createdAt: new Date().toISOString(),
        schoolId: input.schoolId,
        createdBy: input.createdBy,
        encrypted: true,
        encryption: {
          algorithm: "aes-256-gcm",
          keySource: process.env.SOM_BACKUP_ENCRYPTION_KEY
            ? "SOM_BACKUP_ENCRYPTION_KEY"
            : process.env.SOM_BACKUP_PASSPHRASE
              ? "SOM_BACKUP_PASSPHRASE"
              : "development-fallback"
        },
        checksum,
        includes: {
          postgres: true,
          licenseData: licenseDataCopied
        },
        files: (await listFilesRecursive(backupDir)).map((filePath) => path.relative(backupDir, filePath).replace(/\\/g, "/"))
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    backupDir,
    checksum,
    encrypted: true,
    manifestPath,
    postgresDumpPath: encryptedPostgresDumpPath,
    licenseDataCopied
  };
}
