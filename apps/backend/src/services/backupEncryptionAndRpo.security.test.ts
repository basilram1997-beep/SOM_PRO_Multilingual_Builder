import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

test("backup scripts encrypt artifacts, write manifests, and block plaintext restore by default", () => {
  const postgresBackup = read("../../deploy/scripts/backup-postgres.sh");
  const licenseBackup = read("../../deploy/scripts/backup-license-data.sh");
  const postgresRestore = read("../../deploy/scripts/restore-postgres.sh");
  const cryptoLib = read("../../deploy/scripts/backup-crypto.sh");

  assert.match(postgresBackup, /backup-crypto\.sh/, "PostgreSQL backup should use the shared crypto library");
  assert.match(postgresBackup, /\.sql\.enc/, "PostgreSQL backup should produce encrypted SQL artifacts");
  assert.match(postgresBackup, /write_backup_manifest/, "PostgreSQL backup should write a manifest");
  assert.match(postgresBackup, /rm -f "\$tmp_sql"/, "PostgreSQL plaintext dump should be removed");

  assert.match(licenseBackup, /backup-crypto\.sh/, "license backup should use the shared crypto library");
  assert.match(licenseBackup, /\.tar\.gz\.enc/, "license backup should produce encrypted archives");
  assert.match(licenseBackup, /write_backup_manifest/, "license backup should write a manifest");
  assert.match(licenseBackup, /rm -f "\$tmp_archive"/, "license plaintext archive should be removed");

  assert.match(cryptoLib, /SOM_BACKUP_PASSPHRASE is required/, "production scripts should require a backup passphrase");
  assert.match(cryptoLib, /openssl enc -aes-256-cbc -salt -pbkdf2/, "script encryption should use OpenSSL PBKDF2");
  assert.match(cryptoLib, /artifactSha256/, "manifest should record encrypted artifact checksum");
  assert.match(cryptoLib, /plaintextSha256/, "manifest should record plaintext checksum for restore verification");
  assert.match(cryptoLib, /SOM_BACKUP_RPO_MINUTES/, "manifest should include RPO target");
  assert.match(cryptoLib, /SOM_BACKUP_RTO_MINUTES/, "manifest should include RTO target");

  assert.match(postgresRestore, /decrypt_backup_file/, "restore should decrypt encrypted backups");
  assert.match(postgresRestore, /Plaintext restore files are blocked/, "restore should reject plaintext by default");
  assert.match(
    postgresRestore,
    /ALLOW_PLAINTEXT_RESTORE=yes only for isolated tests/,
    "plaintext restore override must be explicit"
  );
});

test("backend product backups encrypt PostgreSQL and license artifacts before recording backup jobs", () => {
  const productBackup = read("src/services/productBackup.ts");
  const schoolsRoutes = read("src/modules/schools/schools.routes.ts");
  const scheduler = read("src/services/productBackupScheduler.ts");
  const updateManager = read("../../scripts/runtime/update-manager.js");

  assert.match(productBackup, /createCipheriv\("aes-256-gcm"/, "product backup should use authenticated encryption");
  assert.match(productBackup, /encryptFileInPlace\(postgresDumpPath\)/, "PostgreSQL dump should be encrypted in place");
  assert.match(
    productBackup,
    /encryptFilesRecursive\(licenseTargetDir\)/,
    "license files should be encrypted recursively"
  );
  assert.match(
    productBackup,
    /fs\.rmSync\(filePath, \{ force: true \}\)/,
    "plaintext product backup files should be deleted"
  );
  assert.match(productBackup, /encrypted:\s*true/, "product backup manifest should declare encryption");
  assert.doesNotMatch(productBackup, /postgresDumpPath:\s*postgresDumpPath/, "result must not expose raw SQL path");

  assert.match(schoolsRoutes, /encrypted:\s*result\.encrypted/, "manual backup job should be marked encrypted");
  assert.match(scheduler, /encrypted:\s*result\.encrypted/, "scheduled backup job should be marked encrypted");

  assert.match(updateManager, /encryptBackupFile\(backupFile\)/, "safe update backups should be encrypted");
  assert.match(updateManager, /Plaintext restore files are blocked/, "safe update restore should reject plaintext");
  assert.match(
    updateManager,
    /SOM_BACKUP_ENCRYPTION_KEY or SOM_BACKUP_PASSPHRASE/,
    "production update backups should require a key"
  );
});
