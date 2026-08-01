import type { GradeSection } from "./gradeEntryTypes";

export type GradeEntryStudentMarks = Record<string, string>;

export type GradeEntryDraft = {
  rows: Record<string, GradeEntryStudentMarks>;
  updatedAt: string;
};

const draftMemory = new Map<string, GradeEntryDraft>();

function nowISO() {
  return new Date().toISOString();
}

export function buildGradeEntryStorageKey(params: {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  certificateType: string;
}) {
  return [
    "som-pro",
    "grade-entry",
    params.schoolId,
    params.teacherId,
    params.classId,
    params.subjectId,
    params.certificateType
  ].join(":");
}

export function createEmptyGradeEntryDraft(): GradeEntryDraft {
  return { rows: {}, updatedAt: nowISO() };
}

export function readGradeEntryDraft(raw: string | null): GradeEntryDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GradeEntryDraft> | null;
    if (!parsed || typeof parsed !== "object" || !parsed.rows || typeof parsed.rows !== "object") return null;
    return {
      rows: Object.entries(parsed.rows).reduce<Record<string, GradeEntryStudentMarks>>(
        (accumulator, [studentId, row]) => {
          if (!row || typeof row !== "object") return accumulator;
          accumulator[studentId] = Object.entries(row as Record<string, unknown>).reduce<GradeEntryStudentMarks>(
            (marks, [sectionId, value]) => {
              marks[sectionId] = typeof value === "string" ? value : "";
              return marks;
            },
            {}
          );
          return accumulator;
        },
        {}
      ),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowISO()
    };
  } catch {
    return null;
  }
}

export function normalizeGradeEntryDraft(
  draft: GradeEntryDraft | null | undefined,
  studentIds: string[],
  sections: GradeSection[]
): GradeEntryDraft {
  const rows = studentIds.reduce<Record<string, GradeEntryStudentMarks>>((accumulator, studentId) => {
    const sourceRow = draft?.rows?.[studentId] || {};
    accumulator[studentId] = sections.reduce<GradeEntryStudentMarks>((row, section) => {
      row[section.id] = typeof sourceRow[section.id] === "string" ? sourceRow[section.id] : "";
      return row;
    }, {});
    return accumulator;
  }, {});

  return {
    rows,
    updatedAt: draft?.updatedAt || nowISO()
  };
}

export function saveGradeEntryDraft(storageKey: string, draft: GradeEntryDraft) {
  draftMemory.set(storageKey, { ...draft, updatedAt: nowISO() });
}

export function loadGradeEntryDraft(storageKey: string) {
  return draftMemory.get(storageKey) || null;
}

export function clearGradeEntryDraft(storageKey: string) {
  draftMemory.delete(storageKey);
}

export function countCompletedMarks(
  rows: Record<string, GradeEntryStudentMarks>,
  studentIds: string[],
  sectionId: string
) {
  return studentIds.reduce((count, studentId) => {
    const value = rows[studentId]?.[sectionId]?.trim();
    return value ? count + 1 : count;
  }, 0);
}

export function isCompletionBadgeComplete(filled: number, total: number) {
  return total > 0 && filled === total;
}

export function isCompletionBadgeEmpty(filled: number) {
  return filled === 0;
}

export function calculateWeightedTotal(marks: Record<string, string>, sections: GradeSection[], maxScore: number) {
  if (sections.length === 0) return null;

  let total = 0;
  for (const section of sections) {
    const rawValue = marks[section.id]?.trim();
    if (!rawValue) return null;
    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value)) return null;
    const base = Number(section.outOf) || 0;
    if (base <= 0) return null;
    total += (value / base) * (Number(section.percentage) || 0);
  }

  const normalized = Math.min(Math.max(total, 0), maxScore);
  return Math.round(normalized * 10) / 10;
}
