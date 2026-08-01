import type { Prisma } from "@prisma/client";

type TeacherIdentityInput = {
  nationalId?: string | null;
  employeeNumber?: string | null;
};

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildTeacherDuplicateWhere(
  schoolId: string,
  teacher: TeacherIdentityInput,
  excludedTeacherId?: string
): Prisma.TeacherWhereInput | null {
  const nationalId = normalize(teacher.nationalId);
  const employeeNumber = normalize(teacher.employeeNumber);
  const duplicateCandidates: Prisma.TeacherWhereInput[] = [];

  if (nationalId) duplicateCandidates.push({ nationalId });
  if (employeeNumber) duplicateCandidates.push({ employeeNumber });

  if (duplicateCandidates.length === 0) return null;

  return {
    schoolId,
    ...(excludedTeacherId ? { id: { not: excludedTeacherId } } : {}),
    OR: duplicateCandidates
  };
}
