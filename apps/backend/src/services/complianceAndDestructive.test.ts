import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ClassSchema, SchoolInfoSchema, StudentAttendanceSchema, StudentSchema, TeacherSchema } from "@som/shared";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

function has(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, label);
}

test("compliance readiness keeps privacy, legal, and commercial controls documented", () => {
  const complianceDoc = read("../../docs/COMPLIANCE_AND_DESTRUCTIVE_TESTING.md");
  const privacyRequirements = read("../../docs/PRIVACY_REQUIREMENTS.md");
  const securityRequirements = read("../../docs/SECURITY_REQUIREMENTS.md");
  const securityResponsibilities = read("../../docs/SECURITY_RESPONSIBILITIES.md");
  const securityTesting = read("../../docs/SECURITY_TESTING.md");
  const externalReviewPack = read("../../docs/EXTERNAL_REVIEW_PACK_AR.md");
  const retentionPolicy = read("../../docs/RETENTION_AND_DELETION_POLICY.md");
  const decisionLog = read("../../docs/DECISION_LOG_TEMPLATE.md");
  const terms = read("../../docs/TERMS_OF_USE_AR_EN_HE.md");
  const privacyPolicy = read("../../docs/PRIVACY_POLICY_AR_EN_HE.md");
  const backupSecurity = read("../../docs/BACKUP_RESTORE_SECURITY_AR.md");
  const siem = read("../../docs/SIEM_LOG_EXPORT_FORMAT.md");
  const securityUpdates = read("../../docs/SECURITY_UPDATES.md");

  has(complianceDoc, /legal certification/i, "readiness doc must avoid certification claims");
  has(complianceDoc, /GDPR/i, "GDPR should be part of the compliance scope");
  has(complianceDoc, /HIPAA/i, "HIPAA should be part of the compliance scope");
  has(complianceDoc, /PCI-DSS/i, "PCI-DSS should be part of the compliance scope");
  has(complianceDoc, /external review and approval/i, "readiness doc should frame the pack for external review");
  has(complianceDoc, /masked or fake staging data only/i, "staging data must stay masked");
  has(complianceDoc, /export, deletion, and backup workflows/i, "commercial controls should include export and backup");
  has(complianceDoc, /audit trails/i, "audit trails should be part of compliance scope");
  has(
    externalReviewPack,
    /external privacy, security, and commercial review/i,
    "external review pack must be explicit"
  );
  has(externalReviewPack, /ready for external review and approval/i, "external review pack must say review-ready");
  has(
    retentionPolicy,
    /explicit, logged, school-scoped/i,
    "retention policy must keep deletion school-scoped and logged"
  );
  has(decisionLog, /compliance, security, or release readiness/i, "decision log template must be available");

  has(privacyRequirements, /Export must be permission-protected/i, "export must stay permission protected");
  has(privacyRequirements, /Deletion must require explicit confirmation/i, "deletion must stay confirm gated");
  has(
    privacyRequirements,
    /deployment, retention, deletion, and export rules/i,
    "ownership boundary must stay explicit"
  );
  has(securityRequirements, /masking or anonymization/i, "production-to-nonproduction copies must be masked");
  has(securityRequirements, /must fail closed/i, "production cloning must fail closed unless sanitized");
  has(securityRequirements, /Output warning rule/i, "export warning policy must remain documented");
  has(securityResponsibilities, /vendor security owner/i, "security owner role must remain defined");
  has(securityResponsibilities, /school \/ authority contact/i, "school or authority approval must remain defined");
  has(securityTesting, /external penetration test/i, "external PT remains required");
  has(securityTesting, /limited DAST/i, "limited DAST should stay in scope");
  has(privacyPolicy, /retention/i, "privacy policy should mention retention");
  has(terms, /privacy policy/i, "terms should reference privacy policy");
  has(backupSecurity, /masking/i, "backup restore policy must stay masked");
  has(backupSecurity, /anonymization/i, "backup restore policy must stay masked");
  has(siem, /append-only/i, "audit exports should stay append-only in practice");
  has(securityUpdates, /review them before release/i, "security updates should require review");
});

test("destructive inputs are rejected by the core schemas", () => {
  assert.throws(() => TeacherSchema.parse({ name: "" }));
  assert.throws(() => TeacherSchema.parse({ name: "Teacher", employmentRatio: -1 }));
  assert.throws(() => TeacherSchema.parse({ name: "Teacher", preferredPeriods: [0] }));
  assert.throws(() => TeacherSchema.parse({ name: "Teacher", releaseHours: -1 }));

  assert.throws(() => ClassSchema.parse({ name: "" }));
  assert.throws(() => ClassSchema.parse({ name: "Class", maxStudents: 0 }));
  assert.throws(() => ClassSchema.parse({ name: "Class", maxStudents: 501 }));

  assert.throws(() => StudentSchema.parse({ name: "", classId: "class-a" }));
  assert.throws(() => StudentSchema.parse({ name: "Student" }));

  assert.throws(() =>
    StudentAttendanceSchema.parse({
      studentId: "student-1",
      date: "2026/08/11",
      day: "Monday",
      status: "PRESENT"
    })
  );
  assert.throws(() =>
    StudentAttendanceSchema.parse({
      studentId: "student-1",
      date: "2026-08-11",
      day: "Monday",
      status: "DELETED"
    })
  );

  assert.doesNotThrow(() =>
    SchoolInfoSchema.parse({
      name: "SOM School",
      managerName: "Manager",
      institutionCode: "12345",
      address: "Main Street"
    })
  );
});

test("destructive and compliance-sensitive routes remain confirmation gated and school scoped", () => {
  const schoolsRoutes = read("src/modules/schools/schools.routes.ts");
  const classesRoutes = read("src/modules/classes/classes.routes.ts");
  const teachersRoutes = read("src/modules/teachers/teachers.routes.ts");
  const reportsRoutes = read("src/modules/reports/reports.routes.ts");
  const requestProtections = read("src/middleware/requestProtections.ts");
  const appSource = read("src/app.ts");

  has(schoolsRoutes, /confirm: z\.literal\(true\)/, "school deletion must require explicit confirmation");
  has(
    schoolsRoutes,
    /mode: z\.enum\(\["DELETE", "ANONYMIZE"\]\)/,
    "school deletion must only allow delete or anonymize"
  );
  has(schoolsRoutes, /deleteSchoolData\(schoolId\)/, "school delete must go through the centralized cleanup path");
  has(schoolsRoutes, /anonymizeSchoolData\(schoolId, snapshot\)/, "school anonymize path must stay available");
  has(schoolsRoutes, /exportSchoolData\(schoolId\)/, "school export must stay available for audit and backup");
  has(schoolsRoutes, /recordAuditLog\(prisma, \{[\s\S]*SCHOOL_DELETE_DATA/, "school delete must be audited");
  has(schoolsRoutes, /recordAuditLog\(prisma, \{[\s\S]*SCHOOL_ANONYMIZE_DATA/, "school anonymize must be audited");

  has(
    classesRoutes,
    /teacherLessonToday\.deleteMany\(\{ where: \{ schoolId, classId \} \}\)/,
    "class delete must clear lessons"
  );
  has(
    classesRoutes,
    /studentGradeEntry\.deleteMany\(\{ where: \{ schoolId, classId \} \}\)/,
    "class delete must clear grades"
  );
  has(classesRoutes, /student\.deleteMany\(\{ where: \{ schoolId, classId \} \}\)/, "class delete must clear students");
  has(
    classesRoutes,
    /schoolClass\.delete\(\{ where: \{ id: classId \} \}\)/,
    "class delete must end with the class row"
  );
  has(classesRoutes, /P2003/, "class delete must still guard foreign-key conflicts");

  has(
    teachersRoutes,
    /dailyTeacherStatus\.deleteMany\(\{ where: \{ schoolId, teacherId \} \}\)/,
    "teacher delete must clear status rows"
  );
  has(teachersRoutes, /substitution\.deleteMany\(\{/, "teacher delete must clear substitutions");
  has(
    teachersRoutes,
    /OR: \[\{ absentTeacherId: teacherId \}, \{ substituteTeacherId: teacherId \}\]/,
    "teacher delete must clear both absent and substitute references"
  );
  has(
    teachersRoutes,
    /teacherAssignment\.deleteMany\(\{ where: \{ schoolId, teacherId \} \}\)/,
    "teacher delete must clear assignments"
  );
  has(
    teachersRoutes,
    /teacher\.delete\(\{ where: \{ id: teacherId \} \}\)/,
    "teacher delete must end with the teacher row"
  );
  has(teachersRoutes, /P2003/, "teacher delete must still guard foreign-key conflicts");

  has(
    reportsRoutes,
    /privacyWarningAccepted: z\.literal\(true\)/,
    "report exports must require privacy acknowledgement"
  );
  has(requestProtections, /rejectSchoolContextOverride/, "request protections must reject school override attempts");
  has(
    appSource,
    /requirePermission\("manageSettings"\), securityIncidentsRouter/,
    "security routes must remain permission gated"
  );
  has(
    appSource,
    /requirePermission\("manageSettings"\), auditLogsRouter/,
    "audit log routes must remain permission gated"
  );
});
