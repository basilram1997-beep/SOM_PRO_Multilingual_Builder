import { SubstitutionKind, TeacherStatusType } from "@prisma/client";

export type RuleAssignment = {
  classId: string;
  subjectId: string;
  class: { name: string };
};

export type RuleTeacher = {
  id: string;
  assignments: RuleAssignment[];
};

export type RuleSlot = {
  id: string;
  period: number;
  teacherId: string;
  classId: string;
  subjectId: string;
  class: { name: string };
};

export type RuleEvent = {
  classId: string | null;
  fromPeriod: number;
  toPeriod: number;
};

export const ARABIC_STATUS_LABELS: Record<TeacherStatusType, string> = {
  ABSENT: "غياب",
  LATE: "تأخر",
  LEFT: "مغادرة",
  UNAVAILABLE: "في مهمة"
};

export function repairDisplayText(value: string) {
  if (!/[\u00d8\u00d9\u00c3]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

export function gradeOfClassName(className: string) {
  const clean = repairDisplayText(className);
  if (clean.includes("التاسع")) return "9";
  if (clean.includes("الحادي عشر")) return "11";
  if (clean.includes("الثاني عشر")) return "12";
  if (clean.includes("العاشر")) return "10";
  return "";
}

export function statusReason(type: TeacherStatusType, from: number, to: number) {
  const label = ARABIC_STATUS_LABELS[type] || ARABIC_STATUS_LABELS.UNAVAILABLE;
  if (type === "ABSENT") return label;
  return `${label}: حصة ${from} - حصة ${to}`;
}

export function isEventCoveredSlot(slot: RuleSlot, events: RuleEvent[]) {
  return events.some(
    (event) =>
      (!event.classId || event.classId === slot.classId) &&
      slot.period >= event.fromPeriod &&
      slot.period <= event.toPeriod
  );
}

export function isTeacherBusyInPeriod(
  teacherId: string,
  period: number,
  slots: RuleSlot[],
  coveredSlotIds: Set<string>
) {
  return slots.some((slot) => slot.teacherId === teacherId && slot.period === period && !coveredSlotIds.has(slot.id));
}

export function classifySubstitutionCandidate(teacher: RuleTeacher, slot: RuleSlot): SubstitutionKind {
  const sameClass = teacher.assignments.some((a) => a.classId === slot.classId);
  const sameSubject = teacher.assignments.some((a) => a.subjectId === slot.subjectId);
  const slotGrade = gradeOfClassName(slot.class.name);
  const sameGrade = Boolean(slotGrade) && teacher.assignments.some((a) => gradeOfClassName(a.class.name) === slotGrade);

  if (sameClass && sameSubject) return "SAME_CLASS_AND_SUBJECT";
  if (sameClass) return "SAME_CLASS";
  if (sameGrade && sameSubject) return "SAME_GRADE_AND_SUBJECT";
  if (sameGrade) return "SAME_GRADE";
  if (sameSubject) return "SAME_SUBJECT";
  return "FREE_ONLY";
}

export const substitutionKindWeight: Record<SubstitutionKind, number> = {
  SAME_CLASS_AND_SUBJECT: 1,
  SAME_CLASS: 2,
  SAME_GRADE_AND_SUBJECT: 3,
  SAME_GRADE: 4,
  SAME_SUBJECT: 5,
  FREE_ONLY: 6,
  NO_SUBSTITUTE: 99
};
