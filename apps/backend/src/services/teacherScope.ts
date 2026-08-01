import { prisma } from "../db/prisma";

type TeacherScopeAssignment = {
  classId: string;
  subjectId: string;
};

export type TeacherScope = {
  id: string;
  assignments: TeacherScopeAssignment[];
  classIds: string[];
  subjectIds: string[];
};

export type ResolvedTeacherForRequest = {
  id: string;
  name: string;
  assignments: Array<{
    id: string;
    classId: string;
    subjectId: string;
    weeklyPeriods: number;
    class: { name: string };
    subject: { name: string };
  }>;
};

export async function resolveTeacherScopeForRequest(schoolId: string, user: NonNullable<Express.Request["user"]>) {
  if (user.role !== "TEACHER") return null;

  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, name: user.name },
    select: {
      id: true,
      assignments: {
        select: {
          classId: true,
          subjectId: true
        }
      }
    }
  });

  if (!teacher) return null;

  const classIds = Array.from(new Set(teacher.assignments.map((item) => item.classId)));
  const subjectIds = Array.from(new Set(teacher.assignments.map((item) => item.subjectId)));

  return {
    id: teacher.id,
    assignments: teacher.assignments,
    classIds,
    subjectIds
  } satisfies TeacherScope;
}

export async function resolveTeacherForRequest(
  schoolId: string,
  user: NonNullable<Express.Request["user"]>,
  teacherId?: string
): Promise<ResolvedTeacherForRequest | null> {
  const teacherRecord =
    user.role === "TEACHER"
      ? await prisma.teacher.findFirst({
          where: { schoolId, name: user.name },
          include: { assignments: { include: { class: true, subject: true } } }
        })
      : (await prisma.teacher.findFirst({
          where: {
            schoolId,
            ...(teacherId ? { id: teacherId } : {})
          },
          include: { assignments: { include: { class: true, subject: true } } }
        })) ||
        (await prisma.teacher.findFirst({
          where: { schoolId },
          include: { assignments: { include: { class: true, subject: true } } }
        }));

  if (!teacherRecord) return null;

  return {
    id: teacherRecord.id,
    name: teacherRecord.name,
    assignments: teacherRecord.assignments
  };
}

export function teacherCanAccessClass(scope: TeacherScope | null, classId: string) {
  if (!scope) return true;
  return scope.classIds.includes(classId);
}

export function teacherCanAccessSubject(scope: TeacherScope | null, subjectId: string) {
  if (!scope) return true;
  return scope.subjectIds.includes(subjectId);
}

export function teacherCanAccessAssignment(scope: TeacherScope | null, classId: string, subjectId: string) {
  if (!scope) return true;
  return scope.assignments.some((item) => item.classId === classId && item.subjectId === subjectId);
}
