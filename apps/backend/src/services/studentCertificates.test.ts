import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCertificatePersistenceData,
  calculateCertificateAverage,
  certificateGradeKeyFromAverage,
  certificateResultFromAverage,
  serializeCertificate,
  normalizeCertificateRows
} from "./studentCertificates";
import { buildStudentCertificateContext } from "./studentCertificateContext";

test("student certificate helpers calculate averages and results consistently", () => {
  const rows = normalizeCertificateRows([
    { id: "1", subjectId: "math", subjectName: "Math", mark: "38", maxScore: 40, grade: "", note: "" },
    { id: "2", subjectId: "arabic", subjectName: "Arabic", mark: "85", maxScore: 100, grade: "", note: "" }
  ]);

  assert.equal(calculateCertificateAverage(rows), 90);
  assert.equal(certificateGradeKeyFromAverage(90), "certificates.grades.excellent");
  assert.equal(certificateResultFromAverage(90), "PASS");
});

test("student certificate boundaries classify pass and fail edges correctly", () => {
  assert.equal(certificateGradeKeyFromAverage(49.9), "certificates.grades.needsWork");
  assert.equal(certificateResultFromAverage(49.9), "REVIEW");
  assert.equal(certificateGradeKeyFromAverage(50), "certificates.grades.pass");
  assert.equal(certificateResultFromAverage(50), "PASS_WITH_WARNING");
  assert.equal(certificateGradeKeyFromAverage(89.9), "certificates.grades.veryGood");
  assert.equal(certificateResultFromAverage(89.9), "PASS_WITH_WARNING");
  assert.equal(certificateGradeKeyFromAverage(90), "certificates.grades.excellent");
  assert.equal(certificateResultFromAverage(90), "PASS");
  assert.equal(certificateResultFromAverage(44.9), "INCOMPLETE");
});

test("student certificate helpers ignore invalid marks and pending data safely", () => {
  const rows = normalizeCertificateRows([
    { id: "bad", subjectId: "math", subjectName: "Math", mark: "x", maxScore: 40, grade: "", note: "" },
    { id: "good", subjectId: "science", subjectName: "Science", mark: "20", maxScore: 40, grade: "", note: "" }
  ]);

  assert.equal(calculateCertificateAverage(rows), 50);
  assert.equal(certificateGradeKeyFromAverage(null), "certificates.grades.pending");
  assert.equal(certificateResultFromAverage(null), "INCOMPLETE");
});

test("certificate persistence data and serialization preserve the saved marks flow", () => {
  const persistence = buildCertificatePersistenceData({
    studentId: "student-a",
    certificateType: "TERM1_BIMONTHLY",
    academicYear: "2025/2026",
    issueDate: "2026-06-30",
    schoolNumber: "662452",
    presentDays: 22,
    absentDays: 1,
    lateDays: 2,
    earlyExitDays: 1,
    behaviorLevel: "GOOD",
    behaviorNote: "Good",
    teacherNotes: "Teacher",
    adminNotes: "Admin",
    teacherSignature: "Homeroom",
    principalSignature: "Principal",
    average: null,
    grade: "",
    result: "PASS_WITH_WARNING",
    saved: true,
    published: false,
    subjectRows: [
      { id: "math", subjectId: "math", subjectName: "Math", mark: "40", maxScore: 40, grade: "", note: "" },
      { id: "science", subjectId: "science", subjectName: "Science", mark: "18", maxScore: 20, grade: "", note: "" }
    ]
  } as never);

  const serialized = serializeCertificate({
    id: "certificate-a",
    studentId: "student-a",
    certificateType: persistence.certificateType,
    academicYear: persistence.academicYear,
    issueDate: persistence.issueDate,
    schoolNumber: persistence.schoolNumber,
    presentDays: persistence.presentDays,
    absentDays: persistence.absentDays,
    lateDays: persistence.lateDays,
    earlyExitDays: persistence.earlyExitDays,
    behaviorLevel: persistence.behaviorLevel,
    behaviorNote: persistence.behaviorNote,
    teacherNotes: persistence.teacherNotes,
    adminNotes: persistence.adminNotes,
    teacherSignature: persistence.teacherSignature,
    principalSignature: persistence.principalSignature,
    average: persistence.average,
    grade: persistence.grade,
    result: persistence.result,
    saved: persistence.saved,
    published: persistence.published,
    subjectRows: persistence.subjectRows,
    createdAt: new Date("2026-06-30T00:00:00.000Z"),
    updatedAt: new Date("2026-06-30T00:00:00.000Z")
  });

  assert.equal(persistence.average, 95);
  assert.equal(persistence.result, "PASS_WITH_WARNING");
  assert.equal(serialized.average, 95);
  assert.equal(serialized.result, "PASS_WITH_WARNING");
  assert.equal(serialized.subjectRows.length, 2);
  assert.equal(serialized.subjectRows[0].subjectName, "Math");
  assert.equal(serialized.subjectRows[1].subjectName, "Science");
});

test("student certificate helpers ignore blank rows and preserve meaningful data", () => {
  const rows = normalizeCertificateRows([
    { id: "blank", subjectId: "", subjectName: "", mark: "", grade: "", note: "" },
    {
      id: "filled",
      subjectId: "science",
      subjectName: "Science",
      mark: "70",
      maxScore: 100,
      grade: "certificates.grades.good",
      note: "Good progress"
    }
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].subjectName, "Science");
  assert.equal(rows[0].mark, "70");
});

test("student certificate persistence payload normalizes text and computes averages", () => {
  const payload = buildCertificatePersistenceData({
    studentId: "student-a",
    certificateType: "TERM1_FINAL",
    academicYear: "2025/2026",
    issueDate: "2026-06-30",
    schoolNumber: "  662452  ",
    presentDays: 20,
    absentDays: 1,
    lateDays: 2,
    behaviorLevel: "GOOD",
    behaviorNote: "  Keep it up  ",
    teacherNotes: "  Teacher note  ",
    adminNotes: "  Admin note  ",
    teacherSignature: "  Teacher  ",
    principalSignature: "  Principal  ",
    average: null,
    grade: "",
    result: "PASS_WITH_WARNING",
    saved: true,
    published: false,
    subjectRows: [
      { id: "row-1", subjectId: "math", subjectName: "Math", mark: "100", maxScore: 100, grade: "", note: "" },
      { id: "row-1b", subjectId: "science", subjectName: "Science", mark: "40", maxScore: 40, grade: "", note: "" },
      { id: "row-2", subjectId: "", subjectName: "", mark: "", grade: "", note: "" }
    ]
  } as never);

  assert.equal(payload.schoolNumber, "662452");
  assert.equal(payload.average, 100);
  assert.equal(payload.grade, "certificates.grades.excellent");
  assert.equal(payload.subjectRows.length, 2);
  assert.equal(payload.subjectRows[0].subjectName, "Math");
  assert.equal(payload.subjectRows[1].subjectName, "Science");
});

test("student certificate persistence keeps saving and publication flags intact through serialization", () => {
  const payload = buildCertificatePersistenceData({
    studentId: "student-a",
    certificateType: "TERM2_FINAL",
    academicYear: "2025/2026",
    issueDate: "2026-07-20",
    schoolNumber: "662452",
    presentDays: 23,
    absentDays: 2,
    lateDays: 1,
    earlyExitDays: 0,
    behaviorLevel: "VERY_GOOD",
    behaviorNote: "Strong conduct",
    teacherNotes: "Ready for saving",
    adminNotes: "Reviewed by administration",
    teacherSignature: "Homeroom",
    principalSignature: "Principal",
    average: null,
    grade: "",
    result: "PASS",
    saved: true,
    published: true,
    subjectRows: [
      { id: "math", subjectId: "math", subjectName: "Math", mark: "40", maxScore: 40, grade: "", note: "" },
      { id: "science", subjectId: "science", subjectName: "Science", mark: "36", maxScore: 40, grade: "", note: "" }
    ]
  } as never);

  const serialized = serializeCertificate({
    id: "certificate-a",
    studentId: "student-a",
    certificateType: payload.certificateType,
    academicYear: payload.academicYear,
    issueDate: payload.issueDate,
    schoolNumber: payload.schoolNumber,
    presentDays: payload.presentDays,
    absentDays: payload.absentDays,
    lateDays: payload.lateDays,
    earlyExitDays: payload.earlyExitDays,
    behaviorLevel: payload.behaviorLevel,
    behaviorNote: payload.behaviorNote,
    teacherNotes: payload.teacherNotes,
    adminNotes: payload.adminNotes,
    teacherSignature: payload.teacherSignature,
    principalSignature: payload.principalSignature,
    average: payload.average,
    grade: payload.grade,
    result: payload.result,
    saved: payload.saved,
    published: payload.published,
    subjectRows: payload.subjectRows,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z")
  });

  assert.equal(payload.saved, true);
  assert.equal(payload.published, true);
  assert.equal(serialized.saved, true);
  assert.equal(serialized.published, true);
  assert.equal(serialized.result, "PASS");
  assert.equal(serialized.subjectRows.length, 2);
});

test("student certificate context summarizes attendance and behavior from database rows", () => {
  const context = buildStudentCertificateContext(
    [
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "ABSENT_EXCUSED" },
      { status: "LEFT_EARLY" }
    ],
    [
      { category: "discipline", tone: "POSITIVE", template: "Arrives on time", note: "" },
      { category: "discipline", tone: "NEGATIVE", template: "Late to class", note: "Needs follow-up" },
      { category: "respect", tone: "POSITIVE", template: "Speaks respectfully", note: null }
    ]
  );

  assert.deepEqual(context.attendanceSummary, {
    presentDays: 2,
    absentDays: 1,
    lateDays: 1,
    earlyExitDays: 1,
    totalDays: 5
  });
  assert.equal(context.behaviorSummary.total, 3);
  assert.equal(context.behaviorSummary.positive, 2);
  assert.equal(context.behaviorSummary.negative, 1);
  assert.equal(context.behaviorSummary.suggestedLevel, "VERY_GOOD");
  assert.equal(context.behaviorSummary.categorySummary.length, 2);
  assert.equal(context.behaviorSummary.noteSuggestions[0], "Arrives on time");
  assert.equal(context.behaviorSummary.noteSuggestions[1], "Late to class — Needs follow-up");
});
