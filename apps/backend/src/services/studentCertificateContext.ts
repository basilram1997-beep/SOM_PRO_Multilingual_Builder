import type { StudentCertificateBehaviorLevel } from "@som/shared";

type AttendanceRecordLike = {
  status: string;
};

type BehaviorRecordLike = {
  category: string;
  tone: string;
  template: string;
  note?: string | null;
};

export type StudentCertificateContext = {
  attendanceSummary: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
    earlyExitDays: number;
    totalDays: number;
  };
  behaviorSummary: {
    total: number;
    positive: number;
    negative: number;
    suggestedLevel: StudentCertificateBehaviorLevel;
    categorySummary: Array<{
      category: string;
      total: number;
      positive: number;
      negative: number;
    }>;
    noteSuggestions: string[];
  };
};

function dedupeSuggestions(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function suggestBehaviorLevel(positive: number, negative: number): StudentCertificateBehaviorLevel {
  if (positive === 0 && negative === 0) return "GOOD";
  if (negative === 0) return positive >= 6 ? "EXCELLENT" : "VERY_GOOD";
  if (positive >= negative * 4) return "EXCELLENT";
  if (positive >= negative * 2) return "VERY_GOOD";
  if (positive >= negative) return "GOOD";
  return "NEEDS_ATTENTION";
}

export function buildStudentCertificateContext(
  attendanceRecords: AttendanceRecordLike[],
  behaviorRecords: BehaviorRecordLike[]
): StudentCertificateContext {
  const attendanceSummary = attendanceRecords.reduce(
    (accumulator, record) => {
      if (record.status === "PRESENT") accumulator.presentDays += 1;
      if (record.status === "ABSENT_EXCUSED" || record.status === "ABSENT_UNEXCUSED") accumulator.absentDays += 1;
      if (record.status === "LATE") accumulator.lateDays += 1;
      if (record.status === "LEFT_EARLY") accumulator.earlyExitDays += 1;
      accumulator.totalDays += 1;
      return accumulator;
    },
    {
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      earlyExitDays: 0,
      totalDays: 0
    }
  );

  const behaviorSummary = behaviorRecords.reduce(
    (accumulator, record) => {
      accumulator.total += 1;
      if (record.tone === "POSITIVE") accumulator.positive += 1;
      if (record.tone === "NEGATIVE") accumulator.negative += 1;
      const current = accumulator.categorySummaryMap.get(record.category) || {
        category: record.category,
        total: 0,
        positive: 0,
        negative: 0
      };
      current.total += 1;
      if (record.tone === "POSITIVE") current.positive += 1;
      if (record.tone === "NEGATIVE") current.negative += 1;
      accumulator.categorySummaryMap.set(record.category, current);

      const suggestion = [record.template, record.note]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" — ");
      if (suggestion) accumulator.noteSuggestions.push(suggestion);

      return accumulator;
    },
    {
      total: 0,
      positive: 0,
      negative: 0,
      categorySummaryMap: new Map<string, { category: string; total: number; positive: number; negative: number }>(),
      noteSuggestions: [] as string[]
    }
  );

  return {
    attendanceSummary,
    behaviorSummary: {
      total: behaviorSummary.total,
      positive: behaviorSummary.positive,
      negative: behaviorSummary.negative,
      suggestedLevel: suggestBehaviorLevel(behaviorSummary.positive, behaviorSummary.negative),
      categorySummary: Array.from(behaviorSummary.categorySummaryMap.values()).sort((left, right) =>
        left.category.localeCompare(right.category)
      ),
      noteSuggestions: dedupeSuggestions(behaviorSummary.noteSuggestions).slice(0, 8)
    }
  };
}
