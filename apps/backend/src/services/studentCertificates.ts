import type {
  StudentCertificate,
  StudentCertificateBehaviorLevel,
  StudentCertificateResult,
  StudentCertificateSubjectRow
} from "@som/shared";

function parseMark(value: string | null | undefined) {
  if (!value) return Number.NaN;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

export function normalizeCertificateRows(rows: unknown): StudentCertificateSubjectRow[] {
  if (!Array.isArray(rows)) return [];
  const normalizedRows = rows.map<StudentCertificateSubjectRow | null>((row) => {
    if (!row || typeof row !== "object") return null;
    const source = row as {
      id?: unknown;
      subjectId?: unknown;
      subjectName?: unknown;
      mark?: unknown;
      maxScore?: unknown;
      grade?: unknown;
      note?: unknown;
    };
    const subjectId = typeof source.subjectId === "string" ? source.subjectId.trim() : "";
    const subjectName = typeof source.subjectName === "string" ? source.subjectName.trim() : "";
    const mark = typeof source.mark === "string" ? source.mark.trim() : "";
    const maxScore = typeof source.maxScore === "number" && Number.isFinite(source.maxScore) ? source.maxScore : 0;
    const grade = typeof source.grade === "string" ? source.grade.trim() : "";
    const note = typeof source.note === "string" ? source.note.trim() : "";
    if (!subjectId && !subjectName && !mark && !grade && !note) return null;
    return {
      id:
        typeof source.id === "string" && source.id.trim()
          ? source.id.trim()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subjectId,
      subjectName,
      mark,
      maxScore,
      grade,
      note
    };
  });

  return normalizedRows.filter((row): row is StudentCertificateSubjectRow => row !== null);
}

export function calculateCertificateAverage(rows: StudentCertificateSubjectRow[]) {
  const marks = rows
    .map((row) => {
      const mark = parseMark(row.mark);
      if (!Number.isFinite(mark)) return Number.NaN;
      const maxScore = Number(row.maxScore) || 0;
      if (maxScore > 0) return (mark / maxScore) * 100;
      return mark;
    })
    .filter((mark) => Number.isFinite(mark));
  if (marks.length === 0) return null;
  return Math.round((marks.reduce((sum, mark) => sum + mark, 0) / marks.length) * 10) / 10;
}

export function certificateGradeKeyFromAverage(average: number | null) {
  if (average === null || Number.isNaN(average)) return "certificates.grades.pending";
  if (average >= 90) return "certificates.grades.excellent";
  if (average >= 80) return "certificates.grades.veryGood";
  if (average >= 70) return "certificates.grades.good";
  if (average >= 50) return "certificates.grades.pass";
  return "certificates.grades.needsWork";
}

export function certificateResultFromAverage(average: number | null): StudentCertificateResult {
  if (average === null || Number.isNaN(average)) return "INCOMPLETE";
  if (average >= 50) return average >= 90 ? "PASS" : "PASS_WITH_WARNING";
  if (average >= 45) return "REVIEW";
  return "INCOMPLETE";
}

export function buildCertificatePersistenceData(
  input: StudentCertificate & { subjectRows: StudentCertificateSubjectRow[] }
) {
  const subjectRows = normalizeCertificateRows(input.subjectRows);
  const average = calculateCertificateAverage(subjectRows);
  const grade = certificateGradeKeyFromAverage(average);
  const computedResult = certificateResultFromAverage(average);
  const result = input.result === "PASS" && computedResult !== "PASS" ? computedResult : input.result;

  return {
    certificateType: input.certificateType,
    academicYear: input.academicYear.trim(),
    issueDate: input.issueDate,
    schoolNumber: input.schoolNumber?.trim() || null,
    presentDays: Number.isFinite(input.presentDays) ? input.presentDays : 0,
    absentDays: Number.isFinite(input.absentDays) ? input.absentDays : 0,
    lateDays: Number.isFinite(input.lateDays) ? input.lateDays : 0,
    earlyExitDays: Number.isFinite(input.earlyExitDays) ? input.earlyExitDays : 0,
    behaviorLevel: input.behaviorLevel,
    behaviorNote: input.behaviorNote?.trim() || null,
    teacherNotes: input.teacherNotes?.trim() || null,
    adminNotes: input.adminNotes?.trim() || null,
    teacherSignature: input.teacherSignature?.trim() || null,
    principalSignature: input.principalSignature?.trim() || null,
    average,
    grade,
    result,
    approved: Boolean(input.approved),
    published: Boolean(input.published),
    subjectRows
  };
}

export function serializeCertificate(record: {
  id: string;
  studentId: string;
  certificateType: string;
  academicYear: string;
  issueDate: string;
  schoolNumber: string | null;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyExitDays: number;
  behaviorLevel: StudentCertificateBehaviorLevel;
  behaviorNote: string | null;
  teacherNotes: string | null;
  adminNotes: string | null;
  teacherSignature: string | null;
  principalSignature: string | null;
  average: number | null;
  grade: string | null;
  result: StudentCertificateResult;
  approved: boolean;
  published: boolean;
  subjectRows: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: record.id,
    studentId: record.studentId,
    certificateType: record.certificateType,
    academicYear: record.academicYear,
    issueDate: record.issueDate,
    schoolNumber: record.schoolNumber,
    presentDays: record.presentDays,
    absentDays: record.absentDays,
    lateDays: record.lateDays,
    earlyExitDays: record.earlyExitDays,
    behaviorLevel: record.behaviorLevel,
    behaviorNote: record.behaviorNote,
    teacherNotes: record.teacherNotes,
    adminNotes: record.adminNotes,
    teacherSignature: record.teacherSignature,
    principalSignature: record.principalSignature,
    average: record.average,
    grade: record.grade,
    result: record.result,
    approved: record.approved,
    published: record.published,
    subjectRows: normalizeCertificateRows(record.subjectRows)
  };
}
