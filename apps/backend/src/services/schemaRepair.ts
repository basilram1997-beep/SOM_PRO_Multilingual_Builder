import { prisma } from "../db/prisma";

type RepairStep = {
  tableName: string;
  backfill: () => Promise<void>;
};

async function columnExists(tableName: string, columnName: string) {
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
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "${tableName}" WHERE "${columnName}" IS NULL`
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
  const hasColumn = await columnExists(tableName, "schoolId");
  if (!hasColumn) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "schoolId" TEXT`);
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

    await prisma.$executeRawUnsafe(
      `UPDATE "${tableName}" SET "schoolId" = $1 WHERE "schoolId" IS NULL`,
      fallbackSchoolId
    );
  }

  const remaining = await nullCount(tableName, "schoolId");
  if (remaining > 0) {
    throw new Error(`${tableName}: ${remaining} rows still have null schoolId after repair.`);
  }

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "${tableName}_schoolId_idx" ON "${tableName}"("schoolId")`
  );
}

async function repairDailyTeacherStatus() {
  await ensureSchoolIdRepair("DailyTeacherStatus", async () => {
    await prisma.$executeRawUnsafe(`
      UPDATE "DailyTeacherStatus" dts
      SET "schoolId" = ds."schoolId"
      FROM "DailySchedule" ds
      WHERE dts."schoolId" IS NULL
        AND dts."dailyScheduleId" = ds.id
        AND ds."schoolId" IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "DailyTeacherStatus" dts
      SET "schoolId" = t."schoolId"
      FROM "Teacher" t
      WHERE dts."schoolId" IS NULL
        AND dts."teacherId" = t.id
        AND t."schoolId" IS NOT NULL
    `);
  });
}

async function repairSubstitution() {
  await ensureSchoolIdRepair("Substitution", async () => {
    await prisma.$executeRawUnsafe(`
      UPDATE "Substitution" s
      SET "schoolId" = ds."schoolId"
      FROM "DailySchedule" ds
      WHERE s."schoolId" IS NULL
        AND s."dailyScheduleId" = ds.id
        AND ds."schoolId" IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "Substitution" s
      SET "schoolId" = c."schoolId"
      FROM "SchoolClass" c
      WHERE s."schoolId" IS NULL
        AND s."classId" = c.id
        AND c."schoolId" IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "Substitution" s
      SET "schoolId" = t."schoolId"
      FROM "Teacher" t
      WHERE s."schoolId" IS NULL
        AND s."absentTeacherId" = t.id
        AND t."schoolId" IS NOT NULL
    `);
  });
}

async function repairTeacherAssignment() {
  await ensureSchoolIdRepair("TeacherAssignment", async () => {
    await prisma.$executeRawUnsafe(`
      UPDATE "TeacherAssignment" ta
      SET "schoolId" = t."schoolId"
      FROM "Teacher" t
      WHERE ta."schoolId" IS NULL
        AND ta."teacherId" = t.id
        AND t."schoolId" IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "TeacherAssignment" ta
      SET "schoolId" = c."schoolId"
      FROM "SchoolClass" c
      WHERE ta."schoolId" IS NULL
        AND ta."classId" = c.id
        AND c."schoolId" IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "TeacherAssignment" ta
      SET "schoolId" = s."schoolId"
      FROM "Subject" s
      WHERE ta."schoolId" IS NULL
        AND ta."subjectId" = s.id
        AND s."schoolId" IS NOT NULL
    `);
  });
}

async function repairDailyEvent() {
  await ensureSchoolIdRepair("DailyEvent", async () => {
    await prisma.$executeRawUnsafe(`
      UPDATE "DailyEvent" de
      SET "schoolId" = ds."schoolId"
      FROM "DailySchedule" ds
      WHERE de."schoolId" IS NULL
        AND de."dailyScheduleId" = ds.id
        AND ds."schoolId" IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "DailyEvent" de
      SET "schoolId" = c."schoolId"
      FROM "SchoolClass" c
      WHERE de."schoolId" IS NULL
        AND de."classId" = c.id
        AND c."schoolId" IS NOT NULL
    `);
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
