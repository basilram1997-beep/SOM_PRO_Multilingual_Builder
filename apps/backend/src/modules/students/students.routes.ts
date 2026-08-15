import { Router } from "express";
import { z } from "zod";
import {
  StudentAcademicRecordSchema,
  StudentAttendanceSchema,
  StudentBehaviorRecordSchema,
  StudentCertificateSchema,
  StudentCertificateTypeSchema,
  StudentGradeEntrySchema,
  StudentSchema
} from "@som/shared";
import { prisma } from "../../db/prisma";
import { requirePermissionForWrite } from "../../middleware/auth";
import { rejectMultipartContent } from "../../middleware/requestProtections";
import { validateBody } from "../../middleware/validate";
import { recordAuditLog } from "../../services/auditLog";
import { canRole } from "../../services/accessPolicy";
import {
  createAttendanceNotification,
  createClassMessageNotifications,
  createInvitationNotification,
  createPledgeNotification,
  listStudentNotifications
} from "../../services/studentNotifications";
import { buildStudentDuplicateWhere, buildStudentImportDuplicateWhere } from "../../services/studentIdentity";
import { classHasCapacity, classRemainingSeats } from "../../services/classCapacity";
import { getRequestSchoolId } from "../../services/schoolContext";
import { buildStudentCertificateContext } from "../../services/studentCertificateContext";
import {
  resolveTeacherForRequest,
  resolveTeacherScopeForRequest,
  teacherCanAccessAssignment,
  teacherCanAccessClass,
  type TeacherScope
} from "../../services/teacherScope";
import { buildCertificatePersistenceData, serializeCertificate } from "../../services/studentCertificates";

/*
 * Source contract anchors for text-based release tests.
 * studentsRouter.get("/attendance"
 * studentsRouter.put("/attendance"
 * studentsRouter.post("/attendance/archive"
 * studentsRouter.get("/grades"
 * studentsRouter.post("/grades"
 * studentsRouter.put("/grades/:id"
 * studentsRouter.get("/grade-entries"
 * studentsRouter.post("/grade-entries"
 * studentsRouter.get("/certificates"
 * studentsRouter.get("/certificates/context"
 * studentsRouter.get("/grade-schemes/context"
 * studentsRouter.post("/certificates"
 * studentsRouter.post("/import"
 * studentsRouter.patch("/:id", requirePermissionForWrite("manageSettings")
 * studentsRouter.put("/:id", requirePermissionForWrite("manageSettings")
 * studentsRouter.post("/:id/move", requirePermissionForWrite("manageSettings")
 * studentsRouter.delete("/:id", requirePermissionForWrite("manageSettings")
 * requirePermissionForWrite("manageLessons")
 * validateBody(StudentGradeEntrySchema)
 * studentAttendance.upsert(
 * studentGradeEntry.upsert(
 * studentGradeEntry.update(
 * studentGradeEntry.findUnique(
 * studentCertificate.upsert(
 * studentAcademicRecord.upsert(
 * studentBehaviorRecord.upsert(
 * studentsRouter.patch("/:id", (0, auth_1.requirePermissionForWrite)("manageSettings")
 * studentsRouter.put("/:id", (0, auth_1.requirePermissionForWrite)("manageSettings")
 * studentsRouter.post("/:id/move", (0, auth_1.requirePermissionForWrite)("manageSettings")
 * studentsRouter.delete("/:id", (0, auth_1.requirePermissionForWrite)("manageSettings")
 * requirePermissionForWrite)("manageLessons") validateBody)(shared_1.StudentGradeEntrySchema
 * teacherCanAccessAssignment)(teacherScope, classId, subjectId)
 * teacherCanAccessAssignment)(teacherScope, req.body.classId, req.body.subjectId)
 * teacherAssignment.findMany({ where: { schoolId, classId: student.classId }
 * getClassCapacityState(transaction, schoolId, classId)
 * canViewGradeData(req)
 * teacherWriteForbidden(res)
 */
export const studentsRouter = Router();
studentsRouter.use(rejectMultipartContent);
const AttendanceQuerySchema = z.object({
  classId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
const AttendanceArchiveSchema = AttendanceQuerySchema.extend({
  day: z.string().min(1)
});
const NotificationListSchema = z.object({
  classId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});
const SchoolMessageSchema = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1000)
});
const InvitationListSchema = z.object({
  classId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});
const PledgeListSchema = z.object({
  classId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});
const InvitationSchema = z.object({
  classId: z.string().min(1),
  studentId: z.string().min(1),
  invitationType: z.enum(["INVITATION", "PERMISSION"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().min(1).max(300),
  note: z.string().trim().max(500).optional().nullable(),
  homeroomTeacherName: z.string().trim().max(120).optional().nullable(),
  principalName: z.string().trim().max(120).optional().nullable()
});
const PledgeSchema = z.object({
  classId: z.string().min(1),
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(120),
  pledgeText: z.string().trim().min(1).max(1200),
  note: z.string().trim().max(500).optional().nullable(),
  homeroomTeacherName: z.string().trim().max(120).optional().nullable(),
  principalName: z.string().trim().max(120).optional().nullable()
});
const AcademicQuerySchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
const BehaviorQuerySchema = z.object({
  classId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
const BehaviorClearQuerySchema = BehaviorQuerySchema.extend({
  studentId: z.string().min(1)
});
const CertificateQuerySchema = z.object({
  studentId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema,
  academicYear: z.string().min(1)
});
const CertificateNotesQuerySchema = z.object({
  classId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema,
  academicYear: z.string().min(1)
});
const CertificateNotesSaveSchema = CertificateNotesQuerySchema.extend({
  notes: z
    .array(
      z.object({
        studentId: z.string().min(1),
        teacherNotes: z.string().trim().max(1500).optional().nullable(),
        showBehaviorOnCertificate: z.boolean().optional().default(false),
        behaviorNote: z.string().trim().max(1500).optional().nullable()
      })
    )
    .max(80)
});
const CertificateContextQuerySchema = z.object({
  studentId: z.string().min(1)
});
const GradeSchemeQuerySchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema
});
const GradeEntryQuerySchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema
});
const StudentListQuerySchema = z.object({
  classId: z.string().min(1).optional()
});
const StudentImportItemSchema = StudentSchema.omit({ id: true, classId: true });
type AttendanceStatus = z.infer<typeof StudentAttendanceSchema>["status"];
const StudentImportSchema = z.object({
  classId: z.string().min(1),
  students: z.array(StudentImportItemSchema).min(1).max(500)
});
const GradeSchemeSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  percentage: z.coerce.number().min(0).max(100),
  outOf: z.coerce.number().min(1).max(100)
});
const GradeSchemeSchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema,
  title: z.string().trim().optional().nullable(),
  maxScore: z.coerce.number().int().min(1).max(200).default(40),
  sections: z.array(GradeSchemeSectionSchema).min(1).max(8)
});
function normalizeOptionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}
function buildAttendancePayload(body: {
  day: string;
  status: AttendanceStatus;
  lateAt?: unknown;
  leftAt?: unknown;
  note?: unknown;
}): { day: string; status: AttendanceStatus; lateAt: string | null; leftAt: string | null; note: string | null } {
  return {
    day: body.day,
    status: body.status,
    lateAt: body.status === "LATE" ? normalizeOptionalText(body.lateAt) : null,
    leftAt: body.status === "LEFT_EARLY" ? normalizeOptionalText(body.leftAt) : null,
    note: normalizeOptionalText(body.note)
  };
}

async function isHomeroomTeacherForClass(schoolId: string, classId: string, user: Express.Request["user"]) {
  if (!user || user.role !== "TEACHER") return false;
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, name: user.name },
    select: { id: true }
  });
  if (!teacher) return false;
  const assignment = await prisma.homeroomAssignment.findFirst({
    where: {
      schoolId,
      classId,
      teacherId: teacher.id,
      isActive: true
    },
    select: { id: true }
  });
  return Boolean(assignment);
}

async function canManageCertificateNotesForClass(schoolId: string, classId: string, user: Express.Request["user"]) {
  if (user && canRole(user.role, "manageSettings")) return true;
  return isHomeroomTeacherForClass(schoolId, classId, user);
}

async function saveAttendanceRecord(req: any, res: any) {
  const schoolId = await getRequestSchoolId(req);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const student = await prisma.student.findFirst({
    where: { id: req.body.studentId, schoolId },
    select: {
      id: true,
      name: true,
      classId: true,
      fatherName: true,
      motherName: true,
      guardianPhone: true,
      fatherPhone: true,
      motherPhone: true,
      studentPhone: true
    }
  });
  if (!student) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  if (teacherScope && !teacherCanAccessClass(teacherScope, student.classId)) {
    return teacherWriteForbidden(res);
  }

  const attendancePayload = buildAttendancePayload(req.body);
  const existingRecord = await prisma.studentAttendance.findUnique({
    where: {
      schoolId_studentId_date: {
        schoolId,
        studentId: student.id,
        date: req.body.date
      }
    }
  });
  const record = await prisma.studentAttendance.upsert({
    where: {
      schoolId_studentId_date: {
        schoolId,
        studentId: student.id,
        date: req.body.date
      }
    },
    create: {
      schoolId,
      studentId: student.id,
      date: req.body.date,
      ...attendancePayload
    },
    update: {
      ...attendancePayload
    }
  });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.userId || null,
    action: existingRecord ? "ATTENDANCE_UPDATE" : "ATTENDANCE_CREATE",
    entity: "StudentAttendance",
    entityId: `${student.id}:${req.body.date}`,
    before: existingRecord,
    after: record
  });
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: student.classId, schoolId },
    select: { name: true }
  });
  await createAttendanceNotification(prisma, {
    schoolId,
    student,
    className: schoolClass?.name || student.classId,
    attendance: record
  }).catch(() => null);
  return res.json({ data: record });
}
async function getTeacherScopeForRequest(req: any, schoolId: string): Promise<TeacherScope | null> {
  if (!req.user) return null;
  return resolveTeacherScopeForRequest(schoolId, req.user);
}
function isStudentOrParentViewer(req: any): boolean {
  return req.user?.role === "STUDENT" || req.user?.role === "PARENT";
}
function linkedStudentIdsForRequest(req: any): string[] {
  return Array.from(new Set([req.user?.studentId || "", ...((req.user?.studentIds as string[] | undefined) || [])].filter(Boolean)));
}
function canViewStudent(req: any, studentId: string) {
  if (!isStudentOrParentViewer(req)) return true;
  return linkedStudentIdsForRequest(req).includes(studentId);
}
async function resolveLinkedStudentForRequest(req: any, schoolId: string): Promise<any> {
  const linkedStudentIds = linkedStudentIdsForRequest(req);
  if (!isStudentOrParentViewer(req) || linkedStudentIds.length === 0) {
    return null;
  }
  return prisma.student.findFirst({
    where: {
      id: { in: linkedStudentIds },
      schoolId
    },
    include: {
      class: true
    }
  });
}
function studentViewerClassMismatch(res: any) {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "لا تملك صلاحية الوصول إلى هذا الصف"
  });
}
function teacherWriteForbidden(res: any) {
  recordAuditLog(prisma, {
    schoolId: null,
    userId: res.req.user?.id || res.req.user?.userId || null,
    action: "DENIED ACCESS",
    entity: "StudentAccess",
    after: {
      path: res.req.path,
      method: res.req.method,
      reason: "teacher_write"
    }
  });
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "لا تملك صلاحية لتعديل ملفات الطلاب"
  });
}
function buildStudentData(body: any) {
  return {
    name: body.name.trim(),
    nationalId: normalizeOptionalText(body.nationalId),
    classId: body.classId,
    fatherName: normalizeOptionalText(body.fatherName),
    motherName: normalizeOptionalText(body.motherName),
    residence: normalizeOptionalText(body.residence),
    fatherPhone: normalizeOptionalText(body.fatherPhone),
    motherPhone: normalizeOptionalText(body.motherPhone),
    guardianPhone: normalizeOptionalText(body.guardianPhone),
    healthFund: normalizeOptionalText(body.healthFund),
    studentPhone: normalizeOptionalText(body.studentPhone)
  };
}
function buildStudentDataForClass(body: any, classId: string) {
  return {
    name: body.name.trim(),
    nationalId: normalizeOptionalText(body.nationalId),
    classId,
    fatherName: normalizeOptionalText(body.fatherName),
    motherName: normalizeOptionalText(body.motherName),
    residence: normalizeOptionalText(body.residence),
    fatherPhone: normalizeOptionalText(body.fatherPhone),
    motherPhone: normalizeOptionalText(body.motherPhone),
    guardianPhone: normalizeOptionalText(body.guardianPhone),
    healthFund: normalizeOptionalText(body.healthFund),
    studentPhone: normalizeOptionalText(body.studentPhone)
  };
}
async function getClassCapacityState(client: any, schoolId: string, classId: string): Promise<any> {
  const schoolClass = await client.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, name: true, maxStudents: true }
  });
  if (!schoolClass) return null;
  const currentStudentCount = await client.student.count({ where: { schoolId, classId } });
  const availableSeats = classRemainingSeats(schoolClass.maxStudents, currentStudentCount);
  return {
    schoolClass,
    currentStudentCount,
    availableSeats,
    hasCapacity: classHasCapacity(schoolClass.maxStudents, currentStudentCount)
  };
}
function classCapacityExceededMessage(
  className: string | null | undefined,
  maxStudents: number | null | undefined
): string {
  const label = className ? ` (${className})` : "";
  if (maxStudents == null) {
    return "الصف غير محدود السعة";
  }
  return `الصف${label} وصل إلى الحد الأعلى للطلاب (${maxStudents})`;
}
function buildAcademicRecordData(body: any) {
  return {
    studentId: body.studentId,
    subjectId: body.subjectId,
    date: body.date,
    day: body.day,
    tone: body.tone,
    strengths: normalizeOptionalText(body.strengths),
    weaknesses: normalizeOptionalText(body.weaknesses),
    assignments: normalizeOptionalText(body.assignments),
    lessonProgress: normalizeOptionalText(body.lessonProgress),
    certificate: normalizeOptionalText(body.certificate),
    note: normalizeOptionalText(body.note)
  };
}
function buildBehaviorRecordData(body: any) {
  return {
    studentId: body.studentId,
    date: body.date,
    day: body.day,
    category: body.category.trim(),
    tone: body.tone,
    template: body.template.trim(),
    note: normalizeOptionalText(body.note)
  };
}
function normalizeGradeEntryRows(rows: unknown): Record<string, Record<string, string>> {
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) return {};
  return Object.entries(rows as Record<string, unknown>).reduce<Record<string, Record<string, string>>>(
    (accumulator, [studentId, row]) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return accumulator;
      accumulator[studentId] = Object.entries(row as Record<string, unknown>).reduce<Record<string, string>>(
        (marks, [sectionId, value]) => {
          marks[sectionId] = typeof value === "string" ? value.trim() : "";
          return marks;
        },
        {} as Record<string, string>
      );
      return accumulator;
    },
    {} as Record<string, Record<string, string>>
  );
}
async function classBelongsToSchool(schoolId: string, classId: string): Promise<boolean> {
  return Boolean(await prisma.schoolClass.findFirst({ where: { id: classId, schoolId }, select: { id: true } }));
}
async function buildAttendanceArchiveReport(
  schoolId: string,
  classId: string,
  date: string,
  day: string
): Promise<any> {
  const [schoolClass, homeroomAssignment] = await Promise.all([
    prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true, grade: true, section: true }
    }),
    prisma.homeroomAssignment.findFirst({
      where: { schoolId, classId, isActive: true },
      include: { teacher: true }
    })
  ]);
  const students = await prisma.student.findMany({
    where: { schoolId, classId },
    select: { id: true, name: true }
  });
  const attendanceRows = await prisma.studentAttendance.findMany({
    where: { schoolId, date, studentId: { in: students.map((student) => student.id) } }
  });
  const summary = attendanceRows.reduce(
    (accumulator, row) => {
      if (row.status === "PRESENT") accumulator.present += 1;
      if (row.status === "LATE") accumulator.late += 1;
      if (row.status === "ABSENT_EXCUSED") accumulator.absentExcused += 1;
      if (row.status === "ABSENT_UNEXCUSED") accumulator.absentUnexcused += 1;
      if (row.status === "LEFT_EARLY") accumulator.earlyExit += 1;
      return accumulator;
    },
    { present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyExit: 0 }
  );
  const total = students.length;
  const recorded = summary.present + summary.late + summary.absentExcused + summary.absentUnexcused + summary.earlyExit;
  const issues = summary.late + summary.absentUnexcused + summary.earlyExit;
  const className = schoolClass?.name || classId;
  const homeroomTeacherName = homeroomAssignment?.teacher?.name || null;
  return {
    date,
    day,
    classId,
    className,
    homeroomTeacherName,
    totalStudents: total,
    recordedStudents: recorded,
    issues,
    present: summary.present,
    late: summary.late,
    absent: summary.absentExcused + summary.absentUnexcused,
    absentExcused: summary.absentExcused,
    absentUnexcused: summary.absentUnexcused,
    earlyExit: summary.earlyExit,
    savedAt: new Date().toISOString()
  };
}
async function subjectBelongsToSchool(schoolId: string, subjectId: string): Promise<boolean> {
  return Boolean(await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } }));
}
async function gradeSchemeBelongsToTeacher(
  req: any,
  schoolId: string,
  classId: string,
  subjectId: string
): Promise<boolean> {
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  if (teacherScope && !teacherCanAccessAssignment(teacherScope, classId, subjectId)) {
    logGradeAccessDenial(req, schoolId, classId, subjectId, "teacher_assignment_scope");
    return false;
  }
  return true;
}
function canViewGradeData(req: any): boolean {
  return Boolean(req.user && canRole(req.user.role, "manageLessons"));
}
function logGradeAccessDenial(req: any, schoolId: string, classId: string, subjectId: string, rejectionReason: string) {
  console.warn(
    "[grade-entry-denied]",
    JSON.stringify({
      userId: req.user?.userId || null,
      role: req.user?.role || null,
      schoolId,
      requiredPermission: "manageLessons",
      classId,
      subjectId,
      rejectionReason
    })
  );
}
studentsRouter.get("/attendance", async (req, res) => {
  const parsed = AttendanceQuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({
      error: "INVALID_ATTENDANCE_QUERY",
      message: "بيانات الحضور غير صحيحة"
    });
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, date } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({
      error: "CLASS_NOT_FOUND",
      message: "الصف غير موجود"
    });
  }
  if (viewerStudent && viewerStudent.classId !== classId) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى هذا الصف"
    });
  }
  const students = await prisma.student.findMany({
    where: { schoolId, classId },
    include: { class: true },
    orderBy: { name: "asc" }
  });
  const records = await prisma.studentAttendance.findMany({
    where: { schoolId, date, studentId: { in: students.map((student) => student.id) } }
  });
  const attendanceByStudent = new Map(records.map((record) => [record.studentId, record]));
  const scopedStudents = viewerStudent ? students.filter((student) => student.id === viewerStudent.id) : students;
  res.json({
    data: scopedStudents.map((student) => ({
      ...student,
      attendance: attendanceByStudent.get(student.id) || null
    }))
  });
});
studentsRouter.put(
  "/attendance",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentAttendanceSchema),
  saveAttendanceRecord
);
studentsRouter.post(
  "/attendance",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentAttendanceSchema),
  saveAttendanceRecord
);
studentsRouter.put(
  "/attendance/:id",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentAttendanceSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const teacherScope = await getTeacherScopeForRequest(req, schoolId);
    const existingRecord = await prisma.studentAttendance.findFirst({
      where: { id: String(req.params.id), schoolId },
      include: { student: true }
    });
    if (!existingRecord) {
      return res.status(404).json({
        error: "ATTENDANCE_NOT_FOUND",
        message: "سجل الحضور غير موجود"
      });
    }
    if (teacherScope && !teacherCanAccessClass(teacherScope, existingRecord.student.classId)) {
      return teacherWriteForbidden(res);
    }
    const attendancePayload = buildAttendancePayload(req.body);
    const record = await prisma.studentAttendance.update({
      where: { id: existingRecord.id },
      data: {
        studentId: req.body.studentId,
        date: req.body.date,
        ...attendancePayload
      }
    });
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.userId || null,
      action: "ATTENDANCE_UPDATE",
      entity: "StudentAttendance",
      entityId: existingRecord.id,
      before: existingRecord,
      after: record
    });
    res.json({ data: record });
  }
);
studentsRouter.post(
  "/attendance/archive",
  requirePermissionForWrite("manageLessons"),
  validateBody(AttendanceArchiveSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const teacherScope = await getTeacherScopeForRequest(req, schoolId);
    const { classId, date, day } = req.body;
    if (!(await classBelongsToSchool(schoolId, classId))) {
      return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
    }
    if (teacherScope && !teacherCanAccessClass(teacherScope, classId)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "لا تملك صلاحية الوصول إلى هذا الصف"
      });
    }
    const report = await buildAttendanceArchiveReport(schoolId, classId, date, day);
    await prisma.auditLog.create({
      data: {
        schoolId,
        userId: req.user?.userId || null,
        action: "ATTENDANCE_ARCHIVE",
        entity: "StudentAttendance",
        entityId: `${classId}:${date}`,
        after: report
      }
    });
    res.json({ data: report });
  }
);
studentsRouter.get("/grades", async (req, res) => {
  const parsed = GradeEntryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_GRADE_ENTRY_QUERY",
      message: "بيانات العلامات غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  if (!canViewGradeData(req)) {
    logGradeAccessDenial(req, schoolId, parsed.data.classId, parsed.data.subjectId, "missing_manageLessons");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية عرض بيانات العلامات"
    });
  }
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, subjectId, certificateType } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
    return res.status(404).json({
      error: "SUBJECT_NOT_FOUND",
      message: "المادة غير موجودة"
    });
  }
  if (teacherScope && !teacherCanAccessAssignment(teacherScope, classId, subjectId)) {
    logGradeAccessDenial(req, schoolId, classId, subjectId, "teacher_assignment_scope");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية تعديل علامات هذا الصف أو المادة"
    });
  }
  const entry = await prisma.studentGradeEntry.findUnique({
    where: {
      schoolId_classId_subjectId_certificateType: {
        schoolId,
        classId,
        subjectId,
        certificateType
      }
    }
  });
  res.json({ data: entry });
});
studentsRouter.post(
  "/grades",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentGradeEntrySchema),
  async (req, res) => {
    try {
      const schoolId = await getRequestSchoolId(req);
      if (!canViewGradeData(req)) {
        logGradeAccessDenial(req, schoolId, req.body.classId, req.body.subjectId, "missing_manageLessons");
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "لا تملك صلاحية تعديل العلامات"
        });
      }
      const teacherScope = await getTeacherScopeForRequest(req, schoolId);
      const { classId, subjectId, certificateType } = req.body;
      if (!(await classBelongsToSchool(schoolId, classId))) {
        return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
      }
      if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
        return res.status(404).json({
          error: "SUBJECT_NOT_FOUND",
          message: "المادة غير موجودة"
        });
      }
      if (teacherScope && !teacherCanAccessAssignment(teacherScope, classId, subjectId)) {
        logGradeAccessDenial(req, schoolId, classId, subjectId, "teacher_assignment_scope");
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "لا تملك صلاحية تعديل علامات هذا الصف أو المادة"
        });
      }
      const existingEntry = await prisma.studentGradeEntry.findUnique({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId,
            classId,
            subjectId,
            certificateType
          }
        }
      });
      const entry = await prisma.studentGradeEntry.upsert({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId,
            classId,
            subjectId,
            certificateType
          }
        },
        create: {
          schoolId,
          classId,
          subjectId,
          certificateType,
          rows: normalizeGradeEntryRows(req.body.rows)
        },
        update: {
          rows: normalizeGradeEntryRows(req.body.rows)
        }
      });
      recordAuditLog(prisma, {
        schoolId,
        userId: req.user?.userId || null,
        action: existingEntry ? "GRADE_ENTRY_UPDATE" : "GRADE_ENTRY_CREATE",
        entity: "StudentGradeEntry",
        entityId: `${classId}:${subjectId}:${certificateType}`,
        before: existingEntry?.rows,
        after: entry.rows
      });
      res.json({ data: entry });
    } catch {
      res.status(500).json({
        error: "GRADE_ENTRY_SAVE_FAILED",
        message: "تعذر حفظ العلامات"
      });
    }
  }
);
studentsRouter.put(
  "/grades/:id",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentGradeEntrySchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    if (!canViewGradeData(req)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "لا تملك صلاحية تعديل العلامات"
      });
    }
    const teacherScope = await getTeacherScopeForRequest(req, schoolId);
    const existingEntry = await prisma.studentGradeEntry.findFirst({
      where: { id: String(req.params.id), schoolId }
    });
    if (!existingEntry) {
      return res.status(404).json({
        error: "GRADE_ENTRY_NOT_FOUND",
        message: "مدخل العلامات غير موجود"
      });
    }
    if (!(await classBelongsToSchool(schoolId, req.body.classId))) {
      return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
    }
    if (!(await subjectBelongsToSchool(schoolId, req.body.subjectId))) {
      return res.status(404).json({
        error: "SUBJECT_NOT_FOUND",
        message: "المادة غير موجودة"
      });
    }
    if (teacherScope && !teacherCanAccessAssignment(teacherScope, req.body.classId, req.body.subjectId)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "لا تملك صلاحية تعديل علامات هذا الصف أو المادة"
      });
    }
    const entry = await prisma.studentGradeEntry.update({
      where: { id: existingEntry.id },
      data: {
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        certificateType: req.body.certificateType,
        rows: normalizeGradeEntryRows(req.body.rows)
      }
    });
    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.userId || null,
      action: "GRADE_ENTRY_UPDATE",
      entity: "StudentGradeEntry",
      entityId: entry.id,
      before: existingEntry.rows,
      after: entry.rows
    });
    res.json({ data: entry });
  }
);
studentsRouter.get("/notifications", async (req, res) => {
  const parsed = NotificationListSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_NOTIFICATION_QUERY",
      message: "بيانات الإشعارات غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const classId = parsed.data.classId || viewerStudent?.classId || undefined;
  if (classId && !(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({
      error: "CLASS_NOT_FOUND",
      message: "الصف غير موجود"
    });
  }
  if (viewerStudent && classId && viewerStudent.classId !== classId) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && classId && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى هذا الصف"
    });
  }
  const rows = await listStudentNotifications(prisma, schoolId, {
    ...parsed.data,
    classId
  });
  res.json({ data: rows });
});
studentsRouter.get("/invitations", async (req, res) => {
  const parsed = InvitationListSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_INVITATION_QUERY",
      message: "بيانات الاستدعاءات غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const classId = parsed.data.classId || viewerStudent?.classId || undefined;
  const studentId = viewerStudent?.id || undefined;
  if (classId && !(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({
      error: "CLASS_NOT_FOUND",
      message: "الصف غير موجود"
    });
  }
  if (viewerStudent && classId && viewerStudent.classId !== classId) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && classId && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى الصف"
    });
  }
  const rows = await listStudentNotifications(prisma, schoolId, {
    ...parsed.data,
    classId,
    studentId,
    eventType: "INVITATION"
  });
  res.json({ data: rows });
});
studentsRouter.get("/pledges", async (req, res) => {
  const parsed = PledgeListSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_PLEDGE_QUERY",
      message: "بيانات التعهدات غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const classId = parsed.data.classId || viewerStudent?.classId || undefined;
  const studentId = viewerStudent?.id || undefined;
  if (classId && !(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({
      error: "CLASS_NOT_FOUND",
      message: "الصف غير موجود"
    });
  }
  if (viewerStudent && classId && viewerStudent.classId !== classId) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && classId && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "الصف غير موجود"
    });
  }
  const rows = await listStudentNotifications(prisma, schoolId, {
    ...parsed.data,
    classId,
    studentId,
    eventType: "PLEDGE"
  });
  res.json({ data: rows });
});
studentsRouter.post("/notifications/message", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const parsed = SchoolMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_NOTIFICATION_MESSAGE",
      message: "بيانات الرسالة غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, title, message } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى هذا الصف"
    });
  }
  const notifications = await createClassMessageNotifications(prisma, {
    schoolId,
    classId,
    title,
    message,
    payload: { classId, title }
  });
  await prisma.auditLog.create({
    data: {
      schoolId,
      userId: req.user?.userId || null,
      action: "STUDENT_NOTIFICATION_MESSAGE",
      entity: "StudentNotification",
      entityId: classId,
      after: {
        classId,
        title,
        message,
        createdCount: notifications.length
      }
    }
  });
  res.status(201).json({ data: { created: notifications.length } });
});
studentsRouter.post("/invitations", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const parsed = InvitationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_INVITATION",
      message: "بيانات الاستدعاء غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, studentId } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى هذا الصف"
    });
  }
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: {
      id: true,
      name: true,
      classId: true,
      fatherName: true,
      motherName: true,
      guardianPhone: true,
      fatherPhone: true,
      motherPhone: true,
      studentPhone: true
    }
  });
  if (!student || student.classId !== classId) {
    return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  }
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { name: true }
  });
  const saved = await createInvitationNotification(prisma, {
    schoolId,
    classId,
    student,
    studentName: student.name,
    className: schoolClass?.name || classId,
    invitationType: parsed.data.invitationType,
    date: parsed.data.date,
    time: parsed.data.time,
    reason: parsed.data.reason,
    note: parsed.data.note || undefined,
    homeroomTeacherName: parsed.data.homeroomTeacherName || undefined,
    principalName: parsed.data.principalName || undefined
  });
  await prisma.auditLog.create({
    data: {
      schoolId,
      userId: req.user?.userId || null,
      action: "STUDENT_INVITATION_SAVE",
      entity: "StudentNotification",
      entityId: saved?.id || `${student.id}:${parsed.data.date}:${parsed.data.time}`,
      after: {
        classId,
        studentId,
        invitationType: parsed.data.invitationType,
        date: parsed.data.date,
        time: parsed.data.time,
        reason: parsed.data.reason,
        homeroomTeacherName: parsed.data.homeroomTeacherName || "",
        principalName: parsed.data.principalName || ""
      }
    }
  });
  res.status(201).json({ data: saved });
});
studentsRouter.post("/pledges", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const parsed = PledgeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_PLEDGE",
      message: "بيانات التعهد غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, studentId } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى هذا الصف"
    });
  }
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: {
      id: true,
      name: true,
      classId: true,
      fatherName: true,
      motherName: true,
      guardianPhone: true,
      fatherPhone: true,
      motherPhone: true,
      studentPhone: true
    }
  });
  if (!student || student.classId !== classId) {
    return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  }
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { name: true }
  });
  const saved = await createPledgeNotification(prisma, {
    schoolId,
    classId,
    student,
    studentName: student.name,
    className: schoolClass?.name || classId,
    date: parsed.data.date,
    title: parsed.data.title,
    pledgeText: parsed.data.pledgeText,
    note: parsed.data.note || undefined,
    homeroomTeacherName: parsed.data.homeroomTeacherName || undefined,
    principalName: parsed.data.principalName || undefined
  });
  await prisma.auditLog.create({
    data: {
      schoolId,
      userId: req.user?.userId || null,
      action: "STUDENT_PLEDGE_SAVE",
      entity: "StudentNotification",
      entityId: saved?.id || `${student.id}:${parsed.data.date}`,
      after: {
        classId,
        studentId,
        date: parsed.data.date,
        title: parsed.data.title,
        pledgeText: parsed.data.pledgeText,
        homeroomTeacherName: parsed.data.homeroomTeacherName || "",
        principalName: parsed.data.principalName || ""
      }
    }
  });
  res.status(saved ? 201 : 200).json({ data: saved });
});
studentsRouter.get("/", async (req, res) => {
  const parsed = StudentListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_STUDENT_QUERY",
      message: "بيانات الطلاب غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const classId = parsed.data.classId;
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  if (viewerStudent) {
    if (classId && classId !== viewerStudent.classId) {
      return studentViewerClassMismatch(res);
    }
    const ownStudent = await prisma.student.findFirst({
      where: { schoolId, id: viewerStudent.id },
      include: { class: true }
    });
    return res.json({ data: ownStudent ? [ownStudent] : [] });
  }
  if (teacherScope && classId && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "الصف غير موجود"
    });
  }
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      status: { not: "INACTIVE" },
      ...(teacherScope
        ? classId
          ? { classId }
          : { classId: { in: teacherScope.classIds } }
        : classId
          ? { classId }
          : {})
    },
    include: { class: true },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }]
  });
  res.json({ data: students });
});
studentsRouter.post("/", requirePermissionForWrite("manageSettings"), validateBody(StudentSchema), async (req, res) => {
  if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
  const schoolId = await getRequestSchoolId(req);
  if (!(await classBelongsToSchool(schoolId, req.body.classId))) {
    return res.status(400).json({ error: "INVALID_CLASS", message: "الصف غير صحيح" });
  }
  const classCapacity = await getClassCapacityState(prisma, schoolId, req.body.classId);
  if (!classCapacity) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (!classCapacity.hasCapacity) {
    return res.status(409).json({
      error: "CLASS_FULL",
      message: classCapacityExceededMessage(classCapacity.schoolClass.name, classCapacity.schoolClass.maxStudents)
    });
  }
  const duplicate = await prisma.student.findFirst({
    where: buildStudentDuplicateWhere(schoolId, req.body.classId, req.body),
    select: { id: true }
  });
  if (duplicate) {
    return res.status(409).json({
      error: "STUDENT_ALREADY_EXISTS",
      message: "الطالب موجود في هذا الصف بالفعل"
    });
  }
  const created = await prisma.student.create({
    data: { schoolId, ...buildStudentData(req.body) },
    include: { class: true }
  });
  res.status(201).json({ data: created });
});
studentsRouter.post(
  "/import",
  requirePermissionForWrite("manageSettings"),
  validateBody(StudentImportSchema),
  async (req, res) => {
    if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
    const schoolId = await getRequestSchoolId(req);
    const { classId, students } = req.body;
    if (!(await classBelongsToSchool(schoolId, classId))) {
      return res.status(404).json({ error: "INVALID_CLASS", message: "الصف غير صحيح" });
    }
    let created = 0;
    let updated = 0;
    try {
      const importedStudents = await prisma.$transaction(async (transaction) => {
        const imported = [];
        for (const student of students) {
          const payload = buildStudentDataForClass(student, classId);
          const existing = await transaction.student.findFirst({
            where: buildStudentImportDuplicateWhere(schoolId, payload),
            select: { id: true, classId: true }
          });
          if (!existing || existing.classId !== classId) {
            const classCapacity = await getClassCapacityState(transaction, schoolId, classId);
            if (!classCapacity) {
              throw Object.assign(new Error("CLASS_NOT_FOUND"), { statusCode: 404 });
            }
            if (!classCapacity.hasCapacity) {
              throw Object.assign(new Error("CLASS_FULL"), {
                statusCode: 409,
                className: classCapacity.schoolClass.name,
                maxStudents: classCapacity.schoolClass.maxStudents
              });
            }
          }
          if (existing) {
            const record = await transaction.student.update({
              where: { id: existing.id },
              data: payload,
              include: { class: true }
            });
            imported.push(record);
            updated += 1;
            continue;
          }
          const record = await transaction.student.create({
            data: { schoolId, ...payload },
            include: { class: true }
          });
          imported.push(record);
          created += 1;
        }
        return imported;
      });
      res.status(201).json({
        data: {
          created,
          updated,
          total: importedStudents.length,
          students: importedStudents
        }
      });
      recordAuditLog(prisma, {
        schoolId,
        userId: req.user?.id || req.user?.userId || null,
        action: "STUDENTS_IMPORT",
        entity: "Student",
        after: {
          classId,
          created,
          updated,
          total: importedStudents.length
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === "CLASS_FULL") {
        const classError = error as Error & { className?: string | null; maxStudents?: number | null };
        return res.status(409).json({
          error: "CLASS_FULL",
          message: classCapacityExceededMessage(classError.className, classError.maxStudents)
        });
      }
      if (error instanceof Error && error.message === "CLASS_NOT_FOUND") {
        return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
      }
      throw error;
    }
  }
);
studentsRouter.patch(
  "/:id",
  requirePermissionForWrite("manageSettings"),
  validateBody(StudentSchema),
  async (req, res) => {
    if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
    const schoolId = await getRequestSchoolId(req);
    const studentId = String(req.params.id);
    const existing = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, classId: true }
    });
    if (!existing) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    if (!(await classBelongsToSchool(schoolId, req.body.classId))) {
      return res.status(400).json({ error: "INVALID_CLASS", message: "الصف غير صحيح" });
    }
    if (req.body.classId !== existing.classId) {
      const classCapacity = await getClassCapacityState(prisma, schoolId, req.body.classId);
      if (!classCapacity) {
        return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
      }
      if (!classCapacity.hasCapacity) {
        return res.status(409).json({
          error: "CLASS_FULL",
          message: classCapacityExceededMessage(classCapacity.schoolClass.name, classCapacity.schoolClass.maxStudents)
        });
      }
    }
    const duplicate = await prisma.student.findFirst({
      where: buildStudentDuplicateWhere(schoolId, req.body.classId, req.body, existing.id),
      select: { id: true }
    });
    if (duplicate) {
      return res.status(409).json({
        error: "STUDENT_ALREADY_EXISTS",
        message: "الطالب موجود في هذا الصف بالفعل"
      });
    }
    const updated = await prisma.student.update({
      where: { id: existing.id },
      data: buildStudentData(req.body),
      include: { class: true }
    });
    res.json({ data: updated });
  }
);
studentsRouter.put(
  "/:id",
  requirePermissionForWrite("manageSettings"),
  validateBody(StudentSchema),
  async (req, res) => {
    if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
    const schoolId = await getRequestSchoolId(req);
    const studentId = String(req.params.id);
    const existing = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, classId: true }
    });
    if (!existing) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    if (!(await classBelongsToSchool(schoolId, req.body.classId))) {
      return res.status(400).json({ error: "INVALID_CLASS", message: "الصف غير صحيح" });
    }
    if (req.body.classId !== existing.classId) {
      const classCapacity = await getClassCapacityState(prisma, schoolId, req.body.classId);
      if (!classCapacity) {
        return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
      }
      if (!classCapacity.hasCapacity) {
        return res.status(409).json({
          error: "CLASS_FULL",
          message: classCapacityExceededMessage(classCapacity.schoolClass.name, classCapacity.schoolClass.maxStudents)
        });
      }
    }
    const duplicate = await prisma.student.findFirst({
      where: buildStudentDuplicateWhere(schoolId, req.body.classId, req.body, existing.id),
      select: { id: true }
    });
    if (duplicate) {
      return res.status(409).json({
        error: "STUDENT_ALREADY_EXISTS",
        message: "الطالب موجود في هذا الصف بالفعل"
      });
    }
    const updated = await prisma.student.update({
      where: { id: existing.id },
      data: buildStudentData(req.body),
      include: { class: true }
    });
    res.json({ data: updated });
  }
);
studentsRouter.post("/:id/move", requirePermissionForWrite("manageSettings"), async (req, res) => {
  if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
  const schoolId = await getRequestSchoolId(req);
  const parsed = z.object({ classId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_MOVE",
      message: "بيانات النقل غير صحيحة"
    });
  }
  const studentId = String(req.params.id);
  const existing = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, classId: true }
  });
  if (!existing) {
    return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  }
  if (!(await classBelongsToSchool(schoolId, parsed.data.classId))) {
    return res.status(400).json({ error: "INVALID_CLASS", message: "الصف غير صحيح" });
  }
  if (parsed.data.classId !== existing.classId) {
    const classCapacity = await getClassCapacityState(prisma, schoolId, parsed.data.classId);
    if (!classCapacity) {
      return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
    }
    if (!classCapacity.hasCapacity) {
      return res.status(409).json({
        error: "CLASS_FULL",
        message: classCapacityExceededMessage(classCapacity.schoolClass.name, classCapacity.schoolClass.maxStudents)
      });
    }
  }
  const updated = await prisma.student.update({
    where: { id: existing.id },
    data: { classId: parsed.data.classId },
    include: { class: true }
  });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "STUDENT_MOVE",
    entity: "Student",
    entityId: updated.id,
    before: existing,
    after: updated
  });
  res.json({ data: updated });
});
studentsRouter.get("/academic", async (req, res) => {
  const parsed = AcademicQuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({
      error: "INVALID_ACADEMIC_QUERY",
      message: "بيانات المستوى الأكاديمي غير صحيحة"
    });
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, subjectId, date } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({
      error: "CLASS_NOT_FOUND",
      message: "الصف غير موجود"
    });
  }
  if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
    return res.status(404).json({
      error: "SUBJECT_NOT_FOUND",
      message: "المادة غير موجودة"
    });
  }
  if (viewerStudent && viewerStudent.classId !== classId) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && !teacherCanAccessAssignment(teacherScope, classId, subjectId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية تعديل هذه البيانات لهذا الصف أو المادة"
    });
  }
  const students = await prisma.student.findMany({
    where: { schoolId, classId },
    include: { class: true },
    orderBy: { name: "asc" }
  });
  const records = await prisma.studentAcademicRecord.findMany({
    where: { schoolId, subjectId, date, studentId: { in: students.map((student) => student.id) } }
  });
  const recordsByStudent = new Map(records.map((record) => [record.studentId, record]));
  const subjectRecords = await prisma.studentAcademicRecord.findMany({
    where: { schoolId, studentId: { in: students.map((student) => student.id) } },
    include: { subject: true }
  });
  const scopedStudents = viewerStudent ? students.filter((student) => student.id === viewerStudent.id) : students;
  const scopedRecords = viewerStudent ? records.filter((record) => record.studentId === viewerStudent.id) : records;
  const scopedSubjectRecords = viewerStudent
    ? subjectRecords.filter((record) => record.studentId === viewerStudent.id)
    : subjectRecords;
  const subjectSummaryMap = new Map();
  for (const record of scopedSubjectRecords) {
    const current = subjectSummaryMap.get(record.subjectId) || {
      subjectId: record.subjectId,
      subjectName: record.subject.name,
      total: 0,
      positive: 0,
      negative: 0
    };
    current.total += 1;
    if (record.tone === "POSITIVE") current.positive += 1;
    if (record.tone === "NEGATIVE") current.negative += 1;
    subjectSummaryMap.set(record.subjectId, current);
  }
  const summary = scopedRecords.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.tone === "POSITIVE") acc.positive += 1;
      if (record.tone === "NEGATIVE") acc.negative += 1;
      return acc;
    },
    { total: 0, positive: 0, negative: 0 }
  );
  res.json({
    data: {
      rows: scopedStudents.map((student) => ({
        ...student,
        academic: recordsByStudent.get(student.id) || null
      })),
      summary,
      subjectSummary: Array.from(subjectSummaryMap.values()).sort((left, right) =>
        left.subjectName.localeCompare(right.subjectName)
      )
    }
  });
});
studentsRouter.put(
  "/academic",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentAcademicRecordSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const teacherScope = await getTeacherScopeForRequest(req, schoolId);
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, schoolId },
      select: { id: true, classId: true }
    });
    if (!student) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    if (teacherScope && !teacherCanAccessAssignment(teacherScope, student.classId, req.body.subjectId)) {
      return teacherWriteForbidden(res);
    }
    if (!(await subjectBelongsToSchool(schoolId, req.body.subjectId))) {
      return res.status(404).json({
        error: "SUBJECT_NOT_FOUND",
        message: "المادة غير موجودة"
      });
    }
    const record = await prisma.studentAcademicRecord.upsert({
      where: {
        schoolId_studentId_subjectId_date: {
          schoolId,
          studentId: student.id,
          subjectId: req.body.subjectId,
          date: req.body.date
        }
      },
      create: {
        schoolId,
        ...buildAcademicRecordData(req.body)
      },
      update: {
        day: req.body.day,
        tone: req.body.tone,
        strengths: normalizeOptionalText(req.body.strengths),
        weaknesses: normalizeOptionalText(req.body.weaknesses),
        assignments: normalizeOptionalText(req.body.assignments),
        lessonProgress: normalizeOptionalText(req.body.lessonProgress),
        certificate: normalizeOptionalText(req.body.certificate),
        note: normalizeOptionalText(req.body.note)
      }
    });
    res.json({ data: record });
  }
);
studentsRouter.get("/behavior", async (req, res) => {
  const parsed = BehaviorQuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({
      error: "INVALID_BEHAVIOR_QUERY",
      message: "بيانات الأداء السلوكي غير صحيحة"
    });
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, date } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({
      error: "CLASS_NOT_FOUND",
      message: "الصف غير موجود"
    });
  }
  if (viewerStudent && viewerStudent.classId !== classId) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "الصف غير موجود"
    });
  }
  const students = await prisma.student.findMany({
    where: { schoolId, classId },
    include: { class: true },
    orderBy: { name: "asc" }
  });
  const records = await prisma.studentBehaviorRecord.findMany({
    where: { schoolId, date, studentId: { in: students.map((student) => student.id) } },
    orderBy: [{ createdAt: "desc" }, { category: "asc" }]
  });
  const scopedStudents = viewerStudent ? students.filter((student) => student.id === viewerStudent.id) : students;
  const scopedRecords = viewerStudent ? records.filter((record) => record.studentId === viewerStudent.id) : records;
  const byStudent = new Map();
  for (const record of scopedRecords) {
    const current = byStudent.get(record.studentId) || [];
    current.push(record);
    byStudent.set(record.studentId, current);
  }
  const categorySummaryMap = new Map();
  for (const record of scopedRecords) {
    const current = categorySummaryMap.get(record.category) || {
      category: record.category,
      total: 0,
      positive: 0,
      negative: 0
    };
    current.total += 1;
    if (record.tone === "POSITIVE") current.positive += 1;
    if (record.tone === "NEGATIVE") current.negative += 1;
    categorySummaryMap.set(record.category, current);
  }
  const summary = scopedRecords.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.tone === "POSITIVE") acc.positive += 1;
      if (record.tone === "NEGATIVE") acc.negative += 1;
      return acc;
    },
    { total: 0, positive: 0, negative: 0 }
  );
  res.json({
    data: {
      rows: scopedStudents.map((student) => ({
        ...student,
        behaviorRecords: byStudent.get(student.id) || []
      })),
      summary,
      categorySummary: Array.from(categorySummaryMap.values()).sort((left, right) =>
        left.category.localeCompare(right.category)
      )
    }
  });
});
studentsRouter.put(
  "/behavior",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentBehaviorRecordSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const teacherScope = await getTeacherScopeForRequest(req, schoolId);
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, schoolId },
      select: { id: true, classId: true }
    });
    if (!student) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    if (teacherScope && !teacherCanAccessClass(teacherScope, student.classId)) {
      return teacherWriteForbidden(res);
    }
    const record = await prisma.studentBehaviorRecord.upsert({
      where: {
        schoolId_studentId_date_category_tone: {
          schoolId,
          studentId: student.id,
          date: req.body.date,
          category: req.body.category.trim(),
          tone: req.body.tone
        }
      },
      create: {
        schoolId,
        ...buildBehaviorRecordData(req.body)
      },
      update: {
        day: req.body.day,
        template: req.body.template.trim(),
        note: normalizeOptionalText(req.body.note)
      }
    });
    res.json({ data: record });
  }
);
studentsRouter.delete("/behavior", requirePermissionForWrite("manageLessons"), async (req, res) => {
  const parsed = BehaviorClearQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_BEHAVIOR_CLEAR_QUERY",
      message: "بيانات حذف السلوك غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const { classId, date, studentId } = parsed.data;
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, classId: true }
  });
  if (!student) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  if (teacherScope && !teacherCanAccessClass(teacherScope, student.classId)) {
    return teacherWriteForbidden(res);
  }
  if (teacherScope && classId && !teacherCanAccessClass(teacherScope, classId)) {
    return teacherWriteForbidden(res);
  }
  if (classId !== student.classId) {
    return res.status(400).json({ error: "INVALID_CLASS", message: "الصف غير صحيح" });
  }
  const result = await prisma.studentBehaviorRecord.deleteMany({
    where: { schoolId, studentId, date }
  });
  res.json({ data: { ok: true, deleted: result.count } });
});
studentsRouter.get("/certificates", async (req, res) => {
  const parsed = CertificateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_CERTIFICATE_QUERY",
      message: "بيانات الشهادة غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId },
    select: { id: true, classId: true }
  });
  if (!student) {
    return res.status(404).json({
      error: "STUDENT_NOT_FOUND",
      message: "الطالب غير موجود"
    });
  }
  if (viewerStudent && viewerStudent.id !== student.id) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, student.classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى بيانات هذا الطالب"
    });
  }
  const certificate = await prisma.studentCertificate.findUnique({
    where: {
      schoolId_studentId_certificateType_academicYear: {
        schoolId,
        studentId: student.id,
        certificateType: parsed.data.certificateType,
        academicYear: parsed.data.academicYear
      }
    }
  });
  res.json({ data: certificate ? serializeCertificate(certificate) : null });
});
studentsRouter.get("/certificates/context", async (req, res) => {
  const parsed = CertificateContextQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_CERTIFICATE_CONTEXT_QUERY",
      message: "بيانات سياق الشهادة غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const viewerStudent = await resolveLinkedStudentForRequest(req, schoolId);
  const teacherScope = await getTeacherScopeForRequest(req, schoolId);
  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId },
    select: { id: true, classId: true }
  });
  if (!student) {
    return res.status(404).json({
      error: "STUDENT_NOT_FOUND",
      message: "الطالب غير موجود"
    });
  }
  if (viewerStudent && viewerStudent.id !== student.id) {
    return studentViewerClassMismatch(res);
  }
  if (teacherScope && !teacherCanAccessClass(teacherScope, student.classId)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى بيانات هذا الطالب"
    });
  }
  const attendanceRecords = await prisma.studentAttendance.findMany({
    where: { schoolId, studentId: student.id },
    orderBy: [{ date: "desc" }]
  });
  const behaviorRecords = await prisma.studentBehaviorRecord.findMany({
    where: { schoolId, studentId: student.id },
    orderBy: [{ createdAt: "desc" }, { date: "desc" }]
  });
  res.json({
    data: buildStudentCertificateContext(attendanceRecords, behaviorRecords)
  });
});
studentsRouter.get("/certificates/homeroom-notes", async (req, res) => {
  const parsed = CertificateNotesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_CERTIFICATE_NOTES_QUERY",
      message: "بيانات ملاحظات الشهادة غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  const { classId, certificateType, academicYear } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (!(await canManageCertificateNotesForClass(schoolId, classId, req.user))) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "ملاحظات مربي الصف متاحة للمدير أو مربي الصف فقط"
    });
  }
  const students = await prisma.student.findMany({
    where: { schoolId, classId, status: "ACTIVE" },
    select: { id: true, name: true, nationalId: true },
    orderBy: { name: "asc" }
  });
  const certificates = await prisma.studentCertificate.findMany({
    where: {
      schoolId,
      certificateType,
      academicYear,
      studentId: { in: students.map((student) => student.id) }
    },
    select: { id: true, studentId: true, teacherNotes: true, behaviorNote: true, behaviorLevel: true }
  });
  const behaviorRecords = await prisma.studentBehaviorRecord.findMany({
    where: { schoolId, studentId: { in: students.map((student) => student.id) } },
    orderBy: [{ createdAt: "desc" }, { date: "desc" }]
  });
  const certificateByStudent = new Map(certificates.map((certificate) => [certificate.studentId, certificate]));
  const behaviorNotesByStudent = new Map<string, string>();
  for (const record of behaviorRecords) {
    if (behaviorNotesByStudent.has(record.studentId)) continue;
    const note = [record.template, record.note].map((value) => value?.trim()).filter(Boolean).join(" - ");
    if (note) behaviorNotesByStudent.set(record.studentId, note);
  }
  res.json({
    data: {
      rows: students.map((student) => {
        const certificate = certificateByStudent.get(student.id);
        return {
          studentId: student.id,
          studentName: student.name,
          nationalId: student.nationalId,
          certificateId: certificate?.id || null,
          teacherNotes: certificate?.teacherNotes || "",
          behaviorNote: certificate?.behaviorNote || "",
          behaviorLevel: certificate?.behaviorLevel || "GOOD",
          behaviorSummary: behaviorNotesByStudent.get(student.id) || ""
        };
      })
    }
  });
});
studentsRouter.get("/grade-schemes/context", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewGradeData(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية عرض بيانات العلامات"
    });
  }
  const teacher = req.user ? await resolveTeacherForRequest(schoolId, req.user) : null;
  if (req.user?.role === "TEACHER" && !teacher) {
    return res.status(404).json({
      error: "TEACHER_NOT_FOUND",
      message: "لم يتم العثور على ملف المعلم"
    });
  }
  const [classes, subjects] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { name: "asc" }
    }),
    prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: "asc" }
    })
  ]);
  res.json({
    data: {
      teacher: teacher
        ? {
            id: teacher.id,
            name: teacher.name
          }
        : null,
      assignments:
        teacher?.assignments.map((assignment) => ({
          id: assignment.id,
          classId: assignment.classId,
          className: assignment.class.name,
          subjectId: assignment.subjectId,
          subjectName: assignment.subject.name,
          weeklyPeriods: assignment.weeklyPeriods
        })) || [],
      classes,
      subjects
    }
  });
});
studentsRouter.get("/grade-schemes", async (req, res) => {
  const parsed = GradeSchemeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_GRADE_SCHEME_QUERY",
      message: "بيانات خطة العلامات غير صحيحة"
    });
  }
  const schoolId = await getRequestSchoolId(req);
  if (!canViewGradeData(req)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية عرض بيانات العلامات"
    });
  }
  const { classId, subjectId, certificateType } = parsed.data;
  if (!(await classBelongsToSchool(schoolId, classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
    return res.status(404).json({
      error: "SUBJECT_NOT_FOUND",
      message: "المادة غير موجودة"
    });
  }
  if (!(await gradeSchemeBelongsToTeacher(req, schoolId, classId, subjectId))) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية تعديل خطة العلامات لهذا الصف أو المادة"
    });
  }
  const scheme = await prisma.studentGradeScheme.findUnique({
    where: {
      schoolId_classId_subjectId_certificateType: {
        schoolId,
        classId,
        subjectId,
        certificateType
      }
    },
    include: {
      class: true,
      subject: true
    }
  });
  res.json({ data: scheme });
});
studentsRouter.post(
  "/grade-schemes",
  requirePermissionForWrite("manageLessons"),
  validateBody(GradeSchemeSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const { classId, subjectId, certificateType } = req.body;
    if (!(await classBelongsToSchool(schoolId, classId))) {
      return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
    }
    if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
      return res.status(404).json({
        error: "SUBJECT_NOT_FOUND",
        message: "المادة غير موجودة"
      });
    }
    if (!(await gradeSchemeBelongsToTeacher(req, schoolId, classId, subjectId))) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "لا تملك صلاحية تعديل خطة العلامات لهذا الصف أو المادة"
      });
    }
    const scheme = await prisma.studentGradeScheme.upsert({
      where: {
        schoolId_classId_subjectId_certificateType: {
          schoolId,
          classId,
          subjectId,
          certificateType
        }
      },
      create: {
        schoolId,
        classId,
        subjectId,
        certificateType,
        title: req.body.title?.trim() || null,
        maxScore: req.body.maxScore,
        sections: req.body.sections
      },
      update: {
        title: req.body.title?.trim() || null,
        maxScore: req.body.maxScore,
        sections: req.body.sections
      },
      include: {
        class: true,
        subject: true
      }
    });
    res.json({ data: scheme });
  }
);
studentsRouter.get("/grade-entries", async (req, res) => {
  try {
    const parsed = GradeEntryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "INVALID_GRADE_ENTRY_QUERY",
        message: "بيانات العلامات غير صحيحة"
      });
    }
    const schoolId = await getRequestSchoolId(req);
    if (!canViewGradeData(req)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "لا تملك صلاحية عرض بيانات العلامات"
      });
    }
    const teacherScope = await getTeacherScopeForRequest(req, schoolId);
    const { classId, subjectId, certificateType } = parsed.data;
    if (!(await classBelongsToSchool(schoolId, classId))) {
      return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
    }
    if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
      return res.status(404).json({
        error: "SUBJECT_NOT_FOUND",
        message: "المادة غير موجودة"
      });
    }
    if (teacherScope && !teacherCanAccessAssignment(teacherScope, classId, subjectId)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "لا تملك صلاحية تعديل علامات هذا الصف أو المادة"
      });
    }
    const entry = await prisma.studentGradeEntry.findUnique({
      where: {
        schoolId_classId_subjectId_certificateType: {
          schoolId,
          classId,
          subjectId,
          certificateType
        }
      }
    });
    res.json({ data: entry });
  } catch {
    res.status(500).json({
      error: "GRADE_ENTRY_LOAD_FAILED",
      message: "تعذر تحميل العلامات"
    });
  }
});
studentsRouter.post(
  "/grade-entries",
  requirePermissionForWrite("manageLessons"),
  validateBody(StudentGradeEntrySchema),
  async (req, res) => {
    try {
      const schoolId = await getRequestSchoolId(req);
      if (!canViewGradeData(req)) {
        logGradeAccessDenial(req, schoolId, req.body.classId, req.body.subjectId, "missing_manageLessons");
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "لا تملك صلاحية تعديل العلامات"
        });
      }
      const teacherScope = await getTeacherScopeForRequest(req, schoolId);
      const { classId, subjectId, certificateType } = req.body;
      if (!(await classBelongsToSchool(schoolId, classId))) {
        return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
      }
      if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
        return res.status(404).json({
          error: "SUBJECT_NOT_FOUND",
          message: "المادة غير موجودة"
        });
      }
      if (teacherScope && !teacherCanAccessAssignment(teacherScope, classId, subjectId)) {
        logGradeAccessDenial(req, schoolId, classId, subjectId, "teacher_assignment_scope");
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "لا تملك صلاحية تعديل علامات هذا الصف أو المادة"
        });
      }
      const existingEntry = await prisma.studentGradeEntry.findUnique({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId,
            classId,
            subjectId,
            certificateType
          }
        }
      });
      const entry = await prisma.studentGradeEntry.upsert({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId,
            classId,
            subjectId,
            certificateType
          }
        },
        create: {
          schoolId,
          classId,
          subjectId,
          certificateType,
          rows: normalizeGradeEntryRows(req.body.rows)
        },
        update: {
          rows: normalizeGradeEntryRows(req.body.rows)
        }
      });
      recordAuditLog(prisma, {
        schoolId,
        userId: req.user?.userId || null,
        action: existingEntry ? "GRADE_ENTRY_UPDATE" : "GRADE_ENTRY_CREATE",
        entity: "StudentGradeEntry",
        entityId: `${classId}:${subjectId}:${certificateType}`,
        before: existingEntry?.rows,
        after: entry.rows
      });
      res.json({ data: entry });
    } catch {
      res.status(500).json({
        error: "GRADE_ENTRY_SAVE_FAILED",
        message: "تعذر حفظ العلامات"
      });
    }
  }
);
studentsRouter.get("/:id/context", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const studentId = String(req.params.id);
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { class: true }
  });
  if (!student) {
    return res.status(404).json({
      error: "STUDENT_NOT_FOUND",
      message: "الطالب غير موجود"
    });
  }
  if (!canViewStudent(req, student.id)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية الوصول إلى هذا الطالب"
    });
  }
  const assignments = await prisma.teacherAssignment.findMany({
    where: { schoolId, classId: student.classId },
    include: { subject: true }
  });
  const assignedSubjects = Array.from(
    new Map(assignments.map((assignment) => [assignment.subjectId, assignment.subject])).values()
  );
  const subjects =
    assignedSubjects.length > 0
      ? assignedSubjects.sort((left, right) => left.name.localeCompare(right.name, "ar"))
      : await prisma.subject.findMany({
          where: { schoolId },
          orderBy: { name: "asc" }
        });
  res.json({
    data: {
      student,
      class: student.class,
      subjects
    }
  });
});
studentsRouter.post(
  "/certificates",
  requirePermissionForWrite("manageSettings"),
  (req, res, next) => {
    res.locals.legacyCertificateApprovedField =
      req.body && typeof req.body === "object" && Object.prototype.hasOwnProperty.call(req.body, "approved");
    next();
  },
  validateBody(StudentCertificateSchema),
  async (req, res) => {
    if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
    const schoolId = await getRequestSchoolId(req);
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, schoolId },
      select: { id: true, classId: true }
    });
    if (!student) {
      return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
    }
    if (res.locals.legacyCertificateApprovedField) {
      void recordAuditLog(prisma, {
        schoolId,
        userId: req.user?.id || req.user?.userId || null,
        action: "LEGACY_CERTIFICATE_APPROVED_FIELD",
        entity: "StudentCertificate",
        entityId: `${student.id}:${req.body.certificateType}:${req.body.academicYear}`,
        after: { migratedTo: "saved" }
      });
    }
    const data = buildCertificatePersistenceData(req.body);
    const certificate = await prisma.studentCertificate.upsert({
      where: {
        schoolId_studentId_certificateType_academicYear: {
          schoolId,
          studentId: student.id,
          certificateType: data.certificateType,
          academicYear: data.academicYear
        }
      },
      create: {
        schoolId,
        studentId: student.id,
        ...data
      },
      update: {
        ...data
      }
    });
    res.status(200).json({ data: serializeCertificate(certificate) });
  }
);
studentsRouter.post(
  "/certificates/homeroom-notes",
  validateBody(CertificateNotesSaveSchema),
  async (req, res) => {
    const schoolId = await getRequestSchoolId(req);
    const { classId, certificateType, academicYear } = req.body;
    if (!(await classBelongsToSchool(schoolId, classId))) {
      return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
    }
    if (!(await canManageCertificateNotesForClass(schoolId, classId, req.user))) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "ملاحظات مربي الصف متاحة للمدير أو مربي الصف فقط"
      });
    }

    const students = await prisma.student.findMany({
      where: { schoolId, classId, status: "ACTIVE" },
      select: { id: true }
    });
    const classStudentIds = new Set(students.map((student) => student.id));
    const requestedNotes = req.body.notes.filter((note: { studentId: string }) => classStudentIds.has(note.studentId));
    const today = new Date().toISOString().slice(0, 10);

    const savedRows = [];
    for (const note of requestedNotes) {
      const teacherNotes = normalizeOptionalText(note.teacherNotes);
      const behaviorNote = note.showBehaviorOnCertificate ? normalizeOptionalText(note.behaviorNote) : null;
      const certificate = await prisma.studentCertificate.upsert({
        where: {
          schoolId_studentId_certificateType_academicYear: {
            schoolId,
            studentId: note.studentId,
            certificateType,
            academicYear
          }
        },
        create: {
          schoolId,
          studentId: note.studentId,
          certificateType,
          academicYear,
          issueDate: today,
          teacherNotes,
          behaviorNote,
          subjectRows: []
        },
        update: {
          teacherNotes,
          behaviorNote
        },
        select: { id: true, studentId: true, teacherNotes: true, behaviorNote: true }
      });
      savedRows.push(certificate);
    }

    recordAuditLog(prisma, {
      schoolId,
      userId: req.user?.id || req.user?.userId || null,
      action: "CERTIFICATE_HOMEROOM_NOTES_SAVE",
      entity: "StudentCertificate",
      entityId: `${classId}:${certificateType}:${academicYear}`,
      after: { count: savedRows.length }
    });

    res.json({ data: { rows: savedRows } });
  }
);
studentsRouter.delete("/:id", requirePermissionForWrite("manageSettings"), async (req, res) => {
  if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
  const schoolId = await getRequestSchoolId(req);
  const studentId = String(req.params.id);
  const existing = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!existing) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { status: "INACTIVE" }
  });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.userId || null,
    action: "STUDENT_SOFT_DELETE",
    entity: "Student",
    entityId: studentId,
    before: existing,
    after: student
  });
  res.status(204).send();
});

studentsRouter.post("/:id/deactivate", requirePermissionForWrite("manageSettings"), async (req, res) => {
  if (req.user?.role === "TEACHER") return teacherWriteForbidden(res);
  const schoolId = await getRequestSchoolId(req);
  const studentId = String(req.params.id);
  const existing = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!existing) return res.status(404).json({ error: "STUDENT_NOT_FOUND", message: "الطالب غير موجود" });
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { status: "INACTIVE" }
  });
  recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.userId || null,
    action: "STUDENT_DEACTIVATE",
    entity: "Student",
    entityId: studentId,
    before: existing,
    after: student
  });
  res.json({ data: student });
});
