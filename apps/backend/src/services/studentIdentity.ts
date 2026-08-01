import type { Prisma } from "@prisma/client";

type StudentIdentityInput = {
  name: string;
  nationalId?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  fatherPhone?: string | null;
  motherPhone?: string | null;
  guardianPhone?: string | null;
  studentPhone?: string | null;
};

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildStudentDuplicateWhere(
  schoolId: string,
  classId: string,
  student: StudentIdentityInput,
  excludedStudentId?: string
): Prisma.StudentWhereInput {
  const name = normalize(student.name);
  const nationalId = normalize(student.nationalId);
  const fatherName = normalize(student.fatherName);
  const motherName = normalize(student.motherName);
  const fatherPhone = normalize(student.fatherPhone);
  const motherPhone = normalize(student.motherPhone);
  const guardianPhone = normalize(student.guardianPhone);
  const studentPhone = normalize(student.studentPhone);

  const duplicateCandidates: Prisma.StudentWhereInput[] = [];
  if (nationalId) duplicateCandidates.push({ nationalId });
  if (name) {
    duplicateCandidates.push({
      name,
      ...(fatherName ? { fatherName } : {}),
      ...(motherName ? { motherName } : {}),
      ...(fatherPhone ? { fatherPhone } : {}),
      ...(motherPhone ? { motherPhone } : {}),
      ...(guardianPhone ? { guardianPhone } : {}),
      ...(studentPhone ? { studentPhone } : {})
    });
  }

  return {
    schoolId,
    classId,
    ...(excludedStudentId ? { id: { not: excludedStudentId } } : {}),
    OR: duplicateCandidates
  };
}

export function buildStudentImportDuplicateWhere(
  schoolId: string,
  student: StudentIdentityInput
): Prisma.StudentWhereInput {
  const name = normalize(student.name);
  const nationalId = normalize(student.nationalId);
  const fatherName = normalize(student.fatherName);
  const motherName = normalize(student.motherName);
  const fatherPhone = normalize(student.fatherPhone);
  const motherPhone = normalize(student.motherPhone);
  const guardianPhone = normalize(student.guardianPhone);
  const studentPhone = normalize(student.studentPhone);

  const duplicateCandidates: Prisma.StudentWhereInput[] = [];
  if (nationalId) duplicateCandidates.push({ nationalId });
  if (name) {
    duplicateCandidates.push({
      name,
      ...(fatherName ? { fatherName } : {}),
      ...(motherName ? { motherName } : {}),
      ...(fatherPhone ? { fatherPhone } : {}),
      ...(motherPhone ? { motherPhone } : {}),
      ...(guardianPhone ? { guardianPhone } : {}),
      ...(studentPhone ? { studentPhone } : {})
    });
  }

  return {
    schoolId,
    OR: duplicateCandidates
  };
}
