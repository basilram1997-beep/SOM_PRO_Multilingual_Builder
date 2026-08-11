import type { Teacher } from "@som/shared";
import { localizeClassName } from "../../i18n/displayNames.ts";
import type { AppLanguage, TeacherWithAssignments } from "./teacherTypes";

export const blankTeacher: Teacher = {
  name: "",
  employeeNumber: "",
  targetLoad: 25,
  releaseHours: 0,
  employmentRatio: 100,
  workDays: [],
  preferredDays: [],
  preferredClasses: [],
  preferredPeriods: []
};

export const arabicDays = [
  "Ø§Ù„Ø£Ø­Ø¯",
  "Ø§Ù„Ø¥Ø«Ù†ÙŠÙ†",
  "Ø§Ù„Ø«Ù„Ø§Ø«Ø§Ø¡",
  "Ø§Ù„Ø£Ø±Ø¨Ø¹Ø§Ø¡",
  "Ø§Ù„Ø®Ù…ÙŠØ³",
  "Ø§Ù„Ø¬Ù…Ø¹Ø©",
  "Ø§Ù„Ø³Ø¨Øª"
];

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12)
    .sort((left, right) => left - right);
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.trunc(parsed);
  return Math.min(max, Math.max(min, integer));
}

export function normalizeTeacherForm(teacher?: Partial<Teacher> | null): Teacher {
  const adminRole = normalizeNullableText(teacher?.adminRole);
  const targetLoad = normalizeInteger(teacher?.targetLoad, 25, 0);
  const requestedReleaseHours = normalizeInteger(teacher?.releaseHours, 0, 0);
  return {
    ...blankTeacher,
    ...(teacher || {}),
    name: normalizeText(teacher?.name),
    nationalId: normalizeNullableText(teacher?.nationalId),
    employeeNumber: normalizeNullableText(teacher?.employeeNumber),
    specialty: normalizeNullableText(teacher?.specialty),
    adminRole,
    employmentRatio: normalizeInteger(teacher?.employmentRatio, 100, 0, 100),
    workDays: normalizeStringArray(teacher?.workDays),
    preferredDays: normalizeStringArray(teacher?.preferredDays),
    preferredClasses: normalizeStringArray(teacher?.preferredClasses),
    preferredPeriods: normalizeNumberArray(teacher?.preferredPeriods),
    releaseHours: adminRole ? Math.min(requestedReleaseHours, targetLoad) : 0,
    targetLoad,
    notes: normalizeNullableText(teacher?.notes)
  };
}

export function normalizeTeacherRecord<T extends Teacher | TeacherWithAssignments>(teacher: T): T {
  return {
    ...teacher,
    ...normalizeTeacherForm(teacher)
  } as T;
}

export function assignmentText(
  teacher: TeacherWithAssignments,
  kind: "subjects" | "classes",
  language: AppLanguage = "ar",
  classes: { id: string; name: string }[] = [],
  subjects: { id: string; name: string }[] = []
) {
  const classNameById = new Map(classes.map((item) => [item.id, item.name]));
  const subjectNameById = new Map(subjects.map((item) => [item.id, item.name]));
  const values = (teacher.assignments || []).map((assignment) => {
    if (kind === "subjects") {
      return assignment.subject?.name || (assignment.subjectId ? subjectNameById.get(assignment.subjectId) || "" : "");
    }
    const className = assignment.class?.name || (assignment.classId ? classNameById.get(assignment.classId) || "" : "");
    return className ? localizeClassName(className, language) : "";
  });
  return Array.from(new Set(values)).join("ØŒ ");
}

export function preferredClassText(
  teacher: Teacher,
  classes: { id: string; name: string }[],
  language: AppLanguage = "ar"
) {
  const selected = classes.filter((item) => (teacher.preferredClasses || []).includes(item.id));
  return selected.map((item) => localizeClassName(item.name, language)).join("ØŒ ");
}

export function effectiveLoad(teacher?: Pick<Teacher, "targetLoad" | "releaseHours"> | null) {
  return Math.max(0, (teacher?.targetLoad || 0) - (teacher?.releaseHours || 0));
}

export function releaseHoursUsed(teacher?: Pick<Teacher, "adminRole" | "releaseHours"> | null) {
  if (!teacher?.adminRole?.trim()) return 0;
  return Math.max(0, teacher.releaseHours || 0);
}
