import { prisma } from "../db/prisma";

type TeacherDirectoryRow = Awaited<ReturnType<typeof prisma.teacher.findMany>>[number] & {
  assignments: Array<{
    id: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    weeklyPeriods: number;
    baseSchedulePeriods: number;
  }>;
};

type TeacherDirectoryResponse = {
  data: TeacherDirectoryRow[];
};

type CachedTeacherDirectory = {
  expiresAt: number;
  promise?: Promise<TeacherDirectoryResponse>;
  value?: TeacherDirectoryResponse;
};

const teacherDirectoryCache = new Map<string, CachedTeacherDirectory>();
const TEACHER_DIRECTORY_TTL_MS = 10_000;

function cacheKey(schoolId: string) {
  return schoolId;
}

export function invalidateTeacherDirectoryCache(schoolId: string) {
  teacherDirectoryCache.delete(cacheKey(schoolId));
}

export async function getTeacherDirectoryResponse(schoolId: string, loader: () => Promise<TeacherDirectoryResponse>) {
  const key = cacheKey(schoolId);
  const cached = teacherDirectoryCache.get(key);
  const now = Date.now();
  if (cached?.value && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loader();
  teacherDirectoryCache.set(key, { promise, expiresAt: now + TEACHER_DIRECTORY_TTL_MS });
  try {
    const value = await promise;
    teacherDirectoryCache.set(key, { value, expiresAt: Date.now() + TEACHER_DIRECTORY_TTL_MS });
    return value;
  } catch (error) {
    teacherDirectoryCache.delete(key);
    throw error;
  }
}
