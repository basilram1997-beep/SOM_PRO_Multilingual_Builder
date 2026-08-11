import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

type RepairStep = {
  tableName: string;
  backfill: () => Promise<void>;
};

const allowedRepairTables = new Set(["DailyTeacherStatus", "Substitution", "TeacherAssignment", "DailyEvent"]);

function assertAllowedRepairTarget(tableName: string) {
  if (!allowedRepairTables.has(tableName)) {
    throw new Error(`Unsupported repair target: ${tableName}`);
  }
}

function quotedIdentifier(value: string) {
  return Prisma.raw(`"${value}"`);
}

async function columnExists(tableName: string, columnName: string) {
  assertAllowedRepairTarget(tableName);
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function nullCount(tableName: string, columnName: string) {
  assertAllowedRepairTarget(tableName);
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM ${quotedIdentifier(tableName)} WHERE ${quotedIdentifier(columnName)} IS NULL`
  );
  return Number(rows[0]?.count || 0);
}

async function defaultSchoolId() {
  const schools = await prisma.school.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 2
  });
  return schools.length === 1 ? schools[0]?.id || null : null;
}

async function ensureSchoolIdRepair(tableName: string, backfill: () => Promise<void>) {
  assertAllowedRepairTarget(tableName);
  const hasColumn = await columnExists(tableName, "schoolId");
  if (!hasColumn) {
    await prisma.$executeRaw(
      Prisma.sql`ALTER TABLE ${quotedIdentifier(tableName)} ADD COLUMN ${quotedIdentifier("schoolId")} TEXT`
    );
  }

  await backfill();

  const unresolved = await nullCount(tableName, "schoolId");
  if (unresolved > 0) {
    const fallbackSchoolId = await defaultSchoolId();
    if (!fallbackSchoolId) {
      throw new Error(
        `${tableName}: could not resolve schoolId for ${unresolved} rows and there is no single fallback school.`
      );
    }

    await prisma.$executeRaw(
      Prisma.sql`UPDATE ${quotedIdentifier(tableName)} SET ${quotedIdentifier("schoolId")} = ${fallbackSchoolId} WHERE ${quotedIdentifier("schoolId")} IS NULL`
    );
  }

  const remaining = await nullCount(tableName, "schoolId");
  if (remaining > 0) {
    throw new Error(`${tableName}: ${remaining} rows still have null schoolId after repair.`);
  }

  await prisma.$executeRaw(
    Prisma.sql`CREATE INDEX IF NOT EXISTS ${quotedIdentifier(`${tableName}_schoolId_idx`)} ON ${quotedIdentifier(tableName)}(${quotedIdentifier("schoolId")})`
  );
}

async function repairDailyTeacherStatus() {
  await ensureSchoolIdRepair("DailyTeacherStatus", async () => {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("DailyTeacherStatus")} dts
        SET ${quotedIdentifier("schoolId")} = ds.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("DailySchedule")} ds
        WHERE dts.${quotedIdentifier("schoolId")} IS NULL
          AND dts.${quotedIdentifier("dailyScheduleId")} = ds.id
          AND ds.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("DailyTeacherStatus")} dts
        SET ${quotedIdentifier("schoolId")} = t.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("Teacher")} t
        WHERE dts.${quotedIdentifier("schoolId")} IS NULL
          AND dts.${quotedIdentifier("teacherId")} = t.id
          AND t.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );
  });
}

async function repairSubstitution() {
  await ensureSchoolIdRepair("Substitution", async () => {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("Substitution")} s
        SET ${quotedIdentifier("schoolId")} = ds.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("DailySchedule")} ds
        WHERE s.${quotedIdentifier("schoolId")} IS NULL
          AND s.${quotedIdentifier("dailyScheduleId")} = ds.id
          AND ds.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("Substitution")} s
        SET ${quotedIdentifier("schoolId")} = c.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("SchoolClass")} c
        WHERE s.${quotedIdentifier("schoolId")} IS NULL
          AND s.${quotedIdentifier("classId")} = c.id
          AND c.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("Substitution")} s
        SET ${quotedIdentifier("schoolId")} = t.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("Teacher")} t
        WHERE s.${quotedIdentifier("schoolId")} IS NULL
          AND s.${quotedIdentifier("absentTeacherId")} = t.id
          AND t.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );
  });
}

async function repairTeacherAssignment() {
  await ensureSchoolIdRepair("TeacherAssignment", async () => {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("TeacherAssignment")} ta
        SET ${quotedIdentifier("schoolId")} = t.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("Teacher")} t
        WHERE ta.${quotedIdentifier("schoolId")} IS NULL
          AND ta.${quotedIdentifier("teacherId")} = t.id
          AND t.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("TeacherAssignment")} ta
        SET ${quotedIdentifier("schoolId")} = c.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("SchoolClass")} c
        WHERE ta.${quotedIdentifier("schoolId")} IS NULL
          AND ta.${quotedIdentifier("classId")} = c.id
          AND c.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("TeacherAssignment")} ta
        SET ${quotedIdentifier("schoolId")} = s.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("Subject")} s
        WHERE ta.${quotedIdentifier("schoolId")} IS NULL
          AND ta.${quotedIdentifier("subjectId")} = s.id
          AND s.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );
  });
}

async function repairDailyEvent() {
  await ensureSchoolIdRepair("DailyEvent", async () => {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("DailyEvent")} de
        SET ${quotedIdentifier("schoolId")} = ds.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("DailySchedule")} ds
        WHERE de.${quotedIdentifier("schoolId")} IS NULL
          AND de.${quotedIdentifier("dailyScheduleId")} = ds.id
          AND ds.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${quotedIdentifier("DailyEvent")} de
        SET ${quotedIdentifier("schoolId")} = c.${quotedIdentifier("schoolId")}
        FROM ${quotedIdentifier("SchoolClass")} c
        WHERE de.${quotedIdentifier("schoolId")} IS NULL
          AND de.${quotedIdentifier("classId")} = c.id
          AND c.${quotedIdentifier("schoolId")} IS NOT NULL
      `
    );
  });
}

export async function repairLocalSchoolColumns() {
  if (process.env.NODE_ENV === "production") return;

  const steps: RepairStep[] = [
    { tableName: "DailyTeacherStatus", backfill: repairDailyTeacherStatus },
    { tableName: "Substitution", backfill: repairSubstitution },
    { tableName: "TeacherAssignment", backfill: repairTeacherAssignment },
    { tableName: "DailyEvent", backfill: repairDailyEvent }
  ];

  for (const step of steps) {
    await step.backfill();
  }
}
