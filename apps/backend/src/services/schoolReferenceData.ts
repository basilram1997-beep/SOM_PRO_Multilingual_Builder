import { prisma } from "../db/prisma";

export type SchoolClassReference = {
  id: string;
  name: string;
  grade?: string | null;
  section?: string | null;
  maxStudents?: number | null;
  homeroomTeacherId?: string | null;
};

export type SchoolSubjectReference = {
  id: string;
  name: string;
};

export type SchoolTeacherReference = {
  id: string;
  name: string;
  specialty?: string | null;
};

export type SchoolReferenceData = {
  classes: SchoolClassReference[];
  subjects: SchoolSubjectReference[];
  teachers: SchoolTeacherReference[];
  classMap: Map<string, SchoolClassReference>;
  subjectMap: Map<string, SchoolSubjectReference>;
  teacherMap: Map<string, SchoolTeacherReference>;
};

const referenceDataCache = new Map<string, Promise<SchoolReferenceData>>();

function buildReferenceData(schoolId: string): Promise<SchoolReferenceData> {
  return Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        grade: true,
        section: true,
        maxStudents: true,
        homeroomTeacherId: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.subject.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        specialty: true
      },
      orderBy: { name: "asc" }
    })
  ]).then(([classes, subjects, teachers]) => ({
    classes,
    subjects,
    teachers,
    classMap: new Map(classes.map((row) => [row.id, row])),
    subjectMap: new Map(subjects.map((row) => [row.id, row])),
    teacherMap: new Map(teachers.map((row) => [row.id, row]))
  }));
}

export function getSchoolReferenceData(schoolId: string) {
  const cached = referenceDataCache.get(schoolId);
  if (cached) return cached;

  const promise = buildReferenceData(schoolId).catch((error) => {
    referenceDataCache.delete(schoolId);
    throw error;
  });
  referenceDataCache.set(schoolId, promise);
  return promise;
}

export function invalidateSchoolReferenceData(schoolId: string) {
  referenceDataCache.delete(schoolId);
}
