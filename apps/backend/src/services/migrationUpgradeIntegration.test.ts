import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

type DockerResult = ReturnType<typeof spawnSync>;

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function runDockerCommand(args: string[], options?: { input?: string }) {
  const dockerConfigDir = path.join(tmpdir(), "som-docker-config");
  mkdirSync(dockerConfigDir, { recursive: true });
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    input: options?.input,
    env: {
      ...process.env,
      DOCKER_CONFIG: dockerConfigDir
    }
  });
}

function assertDockerResult(result: DockerResult, label: string) {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with code ${result.status ?? "unknown"}: ${(result.stderr || result.stdout || "").toString().slice(0, 1000)}`
    );
  }
}

function createTemporaryDatabase(databaseName: string) {
  const result = runDockerCommand([
    "exec",
    "sompro_postgres",
    "psql",
    "-U",
    "som_user",
    "-d",
    "som",
    "-c",
    `CREATE DATABASE ${databaseName};`
  ]);
  assertDockerResult(result, `create database ${databaseName}`);
}

function dropTemporaryDatabase(databaseName: string) {
  const result = runDockerCommand([
    "exec",
    "sompro_postgres",
    "psql",
    "-U",
    "som_user",
    "-d",
    "som",
    "-c",
    `DROP DATABASE IF EXISTS ${databaseName};`
  ]);
  assertDockerResult(result, `drop database ${databaseName}`);
}

function execSql(databaseName: string, sql: string) {
  const result = runDockerCommand(
    ["exec", "-i", "sompro_postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "som_user", "-d", databaseName],
    { input: sql }
  );
  assertDockerResult(result, `exec sql on ${databaseName}`);
}

function createClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
}

function runBaselineResolution(databaseUrl: string) {
  const result = spawnSync(process.execPath, [path.resolve("..", "..", "scripts", "ensure-prisma-baseline.js")], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  assert.equal(
    result.status,
    0,
    `ensure-prisma-baseline failed with code ${result.status ?? "unknown"}: ${(result.stderr || result.stdout || "").toString().slice(0, 1000)}`
  );
}

function runMigrations(databaseUrl: string) {
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", "npm.cmd run prisma:migrate:deploy"], {
    cwd: path.resolve("..", ".."),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  assert.equal(
    result.status,
    0,
    `prisma migrate deploy failed with code ${result.status ?? "unknown"}: ${(result.stderr || result.stdout || "").toString().slice(0, 1000)}`
  );
}

function canUseDocker() {
  const result = runDockerCommand(["version"]);
  if (result.status === 0) {
    return true;
  }

  const output = `${result.stderr || result.stdout || ""}`.toLowerCase();
  if (output.includes("permission denied while trying to connect to the docker api")) {
    return false;
  }

  throw new Error(`docker version failed with code ${result.status ?? "unknown"}: ${output.slice(0, 500)}`);
}

const runMigrationUpgradeTest = canUseDocker() ? test : test.skip;

runMigrationUpgradeTest("legacy baseline data survives migrations and reads with the current enum values", async () => {
  const runId = makeRunId();
  const databaseName = `som_migration_${runId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const databaseUrl = `postgresql://som_user:som_password@localhost:5432/${databaseName}?schema=public`;
  const baselineMigration = readFileSync(
    "prisma/migrations/20260718175000_baseline_current_schema/migration.sql",
    "utf8"
  );
  let prisma = createClient(databaseUrl);

  try {
    createTemporaryDatabase(databaseName);
    execSql(databaseName, baselineMigration);
    execSql(
      databaseName,
      `
INSERT INTO "School" ("id", "name", "address", "managerName", "institutionCode", "isActive", "createdAt", "updatedAt")
VALUES ('legacy-school-${runId}', 'Legacy Migration School', 'Legacy address', 'Legacy Manager', 'LEG-${runId}', true, NOW(), NOW());

INSERT INTO "Teacher" ("id", "schoolId", "name", "nationalId", "specialty", "employmentRatio", "releaseHours", "targetLoad", "createdAt", "updatedAt")
VALUES ('legacy-teacher-${runId}', 'legacy-school-${runId}', 'Legacy Teacher', 'T-${runId}', 'Math', 100, 0, 25, NOW(), NOW());

INSERT INTO "SchoolClass" ("id", "schoolId", "name", "grade", "section", "createdAt", "updatedAt")
VALUES ('legacy-class-${runId}', 'legacy-school-${runId}', '1A', '1', 'A', NOW(), NOW());

INSERT INTO "Subject" ("id", "schoolId", "name", "isHomeroom", "createdAt", "updatedAt")
VALUES ('legacy-subject-${runId}', 'legacy-school-${runId}', 'Mathematics', false, NOW(), NOW());

INSERT INTO "Student" ("id", "schoolId", "classId", "name", "nationalId", "fatherName", "motherName", "guardianPhone", "createdAt", "updatedAt")
VALUES ('legacy-student-${runId}', 'legacy-school-${runId}', 'legacy-class-${runId}', 'Legacy Student', 'S-${runId}', 'Parent One', 'Parent Two', '0500000000', NOW(), NOW());

INSERT INTO "StudentAttendance" ("id", "schoolId", "studentId", "date", "day", "status", "createdAt", "updatedAt")
VALUES ('legacy-attendance-${runId}', 'legacy-school-${runId}', 'legacy-student-${runId}', '2026-07-20', 'Monday', 'ABSENT', NOW(), NOW());
`
    );

    runBaselineResolution(databaseUrl);
    runMigrations(databaseUrl);

    prisma = createClient(databaseUrl);
    const attendance = await prisma.studentAttendance.findUnique({
      where: {
        schoolId_studentId_date: {
          schoolId: `legacy-school-${runId}`,
          studentId: `legacy-student-${runId}`,
          date: "2026-07-20"
        }
      }
    });
    const school = await prisma.school.findUnique({
      where: { id: `legacy-school-${runId}` }
    });
    const student = await prisma.student.findUnique({
      where: { id: `legacy-student-${runId}` }
    });

    assert.equal(school?.name, "Legacy Migration School");
    assert.equal(student?.name, "Legacy Student");
    assert.equal(attendance?.status, "ABSENT_UNEXCUSED");
    assert.equal(attendance?.day, "Monday");
    assert.equal(attendance?.lateAt, null);
    assert.equal(attendance?.leftAt, null);
  } finally {
    await prisma.$disconnect().catch(() => null);
    dropTemporaryDatabase(databaseName);
  }
});
