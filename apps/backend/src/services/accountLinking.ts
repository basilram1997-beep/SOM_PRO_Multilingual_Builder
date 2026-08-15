import { Prisma, PrismaClient } from "@prisma/client";

export type LinkedStudent = {
  id: string;
  name: string;
  nationalId: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  guardianPhone: string | null;
  studentPhone: string | null;
};

export function normalizeIdentity(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export async function findActiveStudentByNationalId(
  prisma: PrismaClient,
  schoolId: string,
  nationalId: string
): Promise<LinkedStudent | null> {
  const cleanNationalId = normalizeIdentity(nationalId);
  if (!cleanNationalId) return null;

  return prisma.student.findFirst({
    where: {
      schoolId,
      status: "ACTIVE",
      nationalId: cleanNationalId
    },
    select: {
      id: true,
      name: true,
      nationalId: true,
      fatherPhone: true,
      motherPhone: true,
      guardianPhone: true,
      studentPhone: true
    }
  });
}

export async function resolveActiveStudentsByNationalIds(
  prisma: PrismaClient,
  schoolId: string,
  nationalIds: string[]
) {
  const cleanNationalIds = uniqueNonEmpty(nationalIds.map(normalizeIdentity));
  if (cleanNationalIds.length === 0) return { students: [], missingNationalIds: [] };

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      status: "ACTIVE",
      nationalId: { in: cleanNationalIds }
    },
    select: {
      id: true,
      name: true,
      nationalId: true,
      fatherPhone: true,
      motherPhone: true,
      guardianPhone: true,
      studentPhone: true
    }
  });

  const foundNationalIds = new Set(students.map((student) => normalizeIdentity(student.nationalId)));
  const missingNationalIds = cleanNationalIds.filter((nationalId) => !foundNationalIds.has(nationalId));
  return { students, missingNationalIds };
}

export function studentNameMatches(recordName: string, inputName: string) {
  const normalizeName = (value: string) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  return normalizeName(recordName) === normalizeName(inputName);
}

export function parentPhoneMatchesStudent(student: LinkedStudent, guardianPhone: string) {
  const cleanGuardianPhone = normalizePhone(guardianPhone);
  if (!cleanGuardianPhone) return false;
  return [student.fatherPhone, student.motherPhone, student.guardianPhone]
    .map(normalizePhone)
    .some((phone) => phone && phone === cleanGuardianPhone);
}

export function primaryStudentId(studentIds: string[]) {
  return uniqueNonEmpty(studentIds)[0] || null;
}

export async function getParentStudentIds(prisma: PrismaClient, schoolId: string, parentId: string) {
  const rows = await prisma.$queryRaw<Array<{ student_id: string }>>(
    Prisma.sql`SELECT "student_id" FROM "parent_student_links" WHERE "school_id" = ${schoolId} AND "parent_id" = ${parentId}`
  );
  return rows.map((row) => row.student_id);
}

export async function replaceParentStudentLinks(
  prisma: PrismaClient,
  schoolId: string,
  parentId: string,
  studentIds: string[],
  verifiedBy = "ADMIN"
) {
  const uniqueIds = uniqueNonEmpty(studentIds);
  if (uniqueIds.length === 0) {
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "parent_student_links" WHERE "school_id" = ${schoolId} AND "parent_id" = ${parentId}`
    );
    return;
  }

  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "parent_student_links"
      WHERE "school_id" = ${schoolId}
        AND "parent_id" = ${parentId}
        AND "student_id" NOT IN (${Prisma.join(uniqueIds)})`
  );

  for (const studentId of uniqueIds) {
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO "parent_student_links" ("id", "school_id", "parent_id", "student_id", "verified_by", "created_at", "updated_at")
        VALUES (${`parent-link-${parentId}-${studentId}`}, ${schoolId}, ${parentId}, ${studentId}, ${verifiedBy}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("school_id", "parent_id", "student_id")
        DO UPDATE SET "verified_by" = ${verifiedBy}, "updated_at" = CURRENT_TIMESTAMP`
    );
  }
}
