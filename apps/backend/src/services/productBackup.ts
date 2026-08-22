import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function runNativePgDump(outputPath: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const pgDump = process.env.SOM_PG_DUMP_PATH || "pg_dump";
  const result = spawnSync(
    pgDump,
    ["--dbname", databaseUrl, "--no-owner", "--no-acl", "--clean", "--if-exists", "--file", outputPath],
    { encoding: "utf8", windowsHide: true, maxBuffer: 512 * 1024 * 1024 }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(commandError(pgDump, result.status, result.stderr || ""));
  }
}

function runDockerPgDump(outputPath: string) {
  const docker = process.env.SOM_DOCKER_PATH || (process.platform === "win32" ? "docker.exe" : "docker");
  const result = spawnSync(
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
    { encoding: "buffer", windowsHide: true, maxBuffer: 512 * 1024 * 1024 }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 || !result.stdout?.length) {
    throw new Error(commandError(docker, result.status, result.stderr?.toString("utf8") || ""));
  }

  fs.writeFileSync(outputPath, result.stdout);
}

function createPostgresDump(outputPath: string) {
  try {
    runNativePgDump(outputPath);
  } catch (nativeError) {
    try {
      runDockerPgDump(outputPath);
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

function copyLicenseData(targetDir: string) {
  const sourceDir = resolveLicenseDataDir();
  if (!fs.existsSync(sourceDir)) {
    return false;
  }

  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (source) => !path.basename(source).toLowerCase().endsWith(".env")
  });
  return true;
}

function listFilesRecursive(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries
    .flatMap((entry): string[] => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(fullPath);
      if (entry.isFile() && entry.name !== "manifest.json") return [fullPath];
      return [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function checksumBackup(backupDir: string) {
  const hash = crypto.createHash("sha256");
  for (const filePath of listFilesRecursive(backupDir)) {
    hash.update(path.relative(backupDir, filePath).replace(/\\/g, "/"));
    hash.update(fs.readFileSync(filePath));
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

function encryptFileInPlace(filePath: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", backupEncryptionKey(), iv);
  const plaintext = fs.readFileSync(filePath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encryptedPath = `${filePath}.enc`;
  fs.writeFileSync(encryptedPath, Buffer.concat([Buffer.from("SOMENC1:"), iv, tag, encrypted]));
  fs.rmSync(filePath, { force: true });
  return encryptedPath;
}

function encryptFilesRecursive(root: string) {
  for (const filePath of listFilesRecursive(root)) {
    if (filePath.endsWith(".enc")) continue;
    encryptFileInPlace(filePath);
  }
}

export async function createProductBackup(input: ProductBackupInput): Promise<ProductBackupResult> {
  const backupRoot = resolveBackupRoot();
  const backupDir = path.join(backupRoot, `sompro-product-backup-${timestampForFile()}`);
  const postgresDumpPath = path.join(backupDir, "postgres.sql");
  const licenseTargetDir = path.join(backupDir, "license-data");
  const manifestPath = path.join(backupDir, "manifest.json");

  fs.mkdirSync(backupDir, { recursive: true });
  createPostgresDump(postgresDumpPath);
  const licenseDataCopied = copyLicenseData(licenseTargetDir);
  const encryptedPostgresDumpPath = encryptFileInPlace(postgresDumpPath);
  if (licenseDataCopied) {
    encryptFilesRecursive(licenseTargetDir);
  }
  const checksum = checksumBackup(backupDir);

  fs.writeFileSync(
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
        files: listFilesRecursive(backupDir).map((filePath) => path.relative(backupDir, filePath).replace(/\\/g, "/"))
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
