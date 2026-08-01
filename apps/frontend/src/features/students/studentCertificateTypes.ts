import type {
  StudentCertificateBehaviorLevel,
  StudentCertificateResult,
  StudentCertificateSubjectRow,
  StudentCertificateType
} from "@som/shared";

export type CertificateType = StudentCertificateType;

export type CertificateResult = StudentCertificateResult;

export type CertificateMarkRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  mark: string;
  maxScore: number;
  grade: string;
  note: string;
};

export type CertificateBehaviorLevel = StudentCertificateBehaviorLevel;
export type CertificateSavedRow = StudentCertificateSubjectRow;

export type CertificateAttendanceSummary = {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyExitDays: number;
  totalDays: number;
};

export type CertificateBehaviorSummary = {
  total: number;
  positive: number;
  negative: number;
  suggestedLevel: CertificateBehaviorLevel;
  categorySummary: Array<{
    category: string;
    total: number;
    positive: number;
    negative: number;
  }>;
  noteSuggestions: string[];
};

export type CertificateStudentContext = {
  attendanceSummary: CertificateAttendanceSummary;
  behaviorSummary: CertificateBehaviorSummary;
};

export const certificateTypeOptions: Array<{ value: CertificateType; labelKey: string; termKey: string }> = [
  { value: "TERM1_BIMONTHLY", labelKey: "certificates.types.term1Bimonthly", termKey: "certificates.term1" },
  { value: "TERM1_FINAL", labelKey: "certificates.types.term1Final", termKey: "certificates.term1" },
  { value: "TERM2_BIMONTHLY", labelKey: "certificates.types.term2Bimonthly", termKey: "certificates.term2" },
  { value: "TERM2_FINAL", labelKey: "certificates.types.term2Final", termKey: "certificates.term2" }
];

export const certificateResultOptions: Array<{ value: CertificateResult; labelKey: string }> = [
  { value: "PASS", labelKey: "certificates.results.pass" },
  { value: "PASS_WITH_WARNING", labelKey: "certificates.results.passWithWarning" },
  { value: "REVIEW", labelKey: "certificates.results.review" },
  { value: "INCOMPLETE", labelKey: "certificates.results.incomplete" }
];

export function certificateTermKey(type: CertificateType) {
  return type === "TERM1_BIMONTHLY" || type === "TERM1_FINAL" ? "certificates.term1" : "certificates.term2";
}

export function gradeKeyFromAverage(average: number | null) {
  if (average === null || Number.isNaN(average)) return "certificates.grades.pending";
  if (average >= 90) return "certificates.grades.excellent";
  if (average >= 80) return "certificates.grades.veryGood";
  if (average >= 70) return "certificates.grades.good";
  if (average >= 50) return "certificates.grades.pass";
  return "certificates.grades.needsWork";
}

export function resultFromAverage(average: number | null): CertificateResult {
  if (average === null || Number.isNaN(average)) return "INCOMPLETE";
  if (average >= 50) return average >= 90 ? "PASS" : "PASS_WITH_WARNING";
  if (average >= 45) return "REVIEW";
  return "INCOMPLETE";
}

export function createCertificateMarkRow(id: string): CertificateMarkRow {
  return {
    id,
    subjectId: "",
    subjectName: "",
    mark: "",
    maxScore: 0,
    grade: "",
    note: ""
  };
}
