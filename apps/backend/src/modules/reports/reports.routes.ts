import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { StudentCertificateTypeSchema } from "@som/shared";
import { prisma } from "../../db/prisma";
import { canRole } from "../../services/accessPolicy";
import { recordAuditLog } from "../../services/auditLog";
import { createReportExportRecord } from "../../services/artifactRecords";
import { getRequestSchoolId } from "../../services/schoolContext";

export const reportsRouter = Router();

type Lang = "ar" | "en" | "he";

const ExportEventSchema = z.object({
  page: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(200),
  kind: z.enum(["PDF", "HTML", "XLSX"]),
  permission: z.enum(["read", "manageTeachers", "manageSchedules", "manageSettings", "manageLicense", "manageLessons"]),
  expiresInMinutes: z.coerce.number().int().min(1).max(120).optional(),
  privacyWarningAccepted: z.literal(true)
});

const ReportDateRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

const AttendanceReportQuerySchema = ReportDateRangeSchema.extend({
  classId: z.string().trim().min(1).optional()
});

const GradesReportQuerySchema = z.object({
  classId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  certificateType: StudentCertificateTypeSchema.optional()
});

const ClassroomLogsReportQuerySchema = ReportDateRangeSchema.extend({
  classId: z.string().trim().min(1).optional()
});

const EntityReportQuerySchema = ReportDateRangeSchema.extend({
  dimension: z.enum(["class", "student", "teacher", "subject", "homeroom"]),
  classId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional()
});

const ExportReportSchema = z.object({
  reportType: z.enum(["attendance", "grades", "classroom-logs", "security", "daily"]),
  title: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(200),
  kind: z.enum(["PDF", "HTML", "XLSX"]),
  permission: z.enum(["read", "manageTeachers", "manageSchedules", "manageSettings", "manageLicense", "manageLessons"]),
  expiresInMinutes: z.coerce.number().int().min(1).max(120).optional(),
  privacyWarningAccepted: z.literal(true),
  filters: z.record(z.string(), z.unknown()).optional()
});

reportsRouter.post("/export-events", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!req.user) {
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "تسجيل الدخول مطلوب" });
  }

  const parsed = ExportEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_EXPORT_EVENT", message: "بيانات التصدير غير صحيحة" });
  }

  const { permission, kind, page, title, fileName, expiresInMinutes } = parsed.data;
  if (!canRole(req.user.role, permission)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "لا تملك صلاحية التصدير" });
  }

  const expiresAt = new Date(Date.now() + (expiresInMinutes || 15) * 60_000).toISOString();
  const reportExportId = crypto.randomUUID();
  await createReportExportRecord(prisma, {
    schoolId,
    reportType: page,
    fileType: kind,
    filePath: `reports/${page}/${reportExportId}.${kind.toLowerCase()}`,
    requestedBy: req.user.id,
    status: "REQUESTED",
    expiresAt: new Date(expiresAt)
  });
  await prisma.auditLog.create({
    data: {
      schoolId,
      userId: req.user.id,
      action: `EXPORT ${kind}`,
      entity: "EXPORT",
      after: {
        page,
        title,
        fileName,
        kind,
        permission,
        expiresAt,
        privacyWarningAccepted: true
      }
    }
  });

  res.json({ data: { ok: true, expiresAt, exportId: reportExportId } });
});

const kindLabels: Record<Lang, Record<string, string>> = {
  ar: {
    SAME_CLASS_AND_SUBJECT: "استبدال مثالي: نفس الصف ونفس المادة",
    SAME_CLASS: "المعلم البديل يعلم الصف",
    SAME_GRADE_AND_SUBJECT: "نفس الطبقة ونفس المادة",
    SAME_SUBJECT: "نفس التخصص لكن لا يعلم الصف",
    SAME_GRADE: "نفس الطبقة",
    FREE_ONLY: "معلم متفرغ",
    NO_SUBSTITUTE: "لم يتم تعيين بديل"
  },
  en: {
    SAME_CLASS_AND_SUBJECT: "Ideal substitution: same class and subject",
    SAME_CLASS: "Substitute teaches the class",
    SAME_GRADE_AND_SUBJECT: "Same grade and subject",
    SAME_SUBJECT: "Same specialty, different class",
    SAME_GRADE: "Same grade",
    FREE_ONLY: "Free teacher",
    NO_SUBSTITUTE: "No substitute assigned"
  },
  he: {
    SAME_CLASS_AND_SUBJECT: "החלפה מיטבית: אותה כיתה ואותו מקצוע",
    SAME_CLASS: "המחליף מלמד את הכיתה",
    SAME_GRADE_AND_SUBJECT: "אותה שכבה ואותו מקצוע",
    SAME_SUBJECT: "אותו מקצוע אך לא אותה כיתה",
    SAME_GRADE: "אותה שכבה",
    FREE_ONLY: "מורה פנוי",
    NO_SUBSTITUTE: "לא הוגדר מחליף"
  }
};

function label(kind: string, lang: Lang) {
  return kindLabels[lang][kind] || kind;
}

function statusLabel(type: string, lang: Lang) {
  const labels: Record<Lang, Record<string, string>> = {
    ar: {
      ABSENT: "غياب",
      LATE: "تأخر",
      LEFT: "مغادرة",
      UNAVAILABLE: "في مهمة"
    },
    en: {
      ABSENT: "absence",
      LATE: "lateness",
      LEFT: "early leave",
      UNAVAILABLE: "on task"
    },
    he: {
      ABSENT: "היעדרות",
      LATE: "איחור",
      LEFT: "עזיבה מוקדמת",
      UNAVAILABLE: "במשימה"
    }
  };
  return labels[lang][type] || type;
}
function inc(map: Map<string, number>, key?: string | null) {
  const safeKey = key || "-";
  map.set(safeKey, (map.get(safeKey) || 0) + 1);
}

function toChart(map: Map<string, number>) {
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

function safeLang(value: unknown): Lang {
  return value === "en" || value === "he" ? value : "ar";
}

function canViewReports(req: Request) {
  return Boolean(req.user && canRole(req.user.role, "manageSettings"));
}

reportsRouter.get("/", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_INDEX_ACCESS_DENIED");
    return res.status(403).json({ error: "FORBIDDEN", message: "التقارير الإدارية محصورة بالإدارة" });
  }

  res.json({
    data: {
      schoolId,
      reports: [
        { key: "attendance", path: "/attendance" },
        { key: "grades", path: "/grades" },
        { key: "classroom-logs", path: "/classroom-logs" },
        { key: "summary", path: "/summary" },
        { key: "security", path: "/security" },
        { key: "daily", path: "/daily/:date" }
      ]
    }
  });
});

async function logReportDenied(req: Request, schoolId: string, action: string) {
  await recordAuditLog(prisma, {
    schoolId,
    userId: req.user?.id || req.user?.userId || null,
    action,
    entity: "Report",
    after: { path: req.path, method: req.method }
  });
}

function normalizeDateRange(query: { from?: string; to?: string }, fallbackDays = 7) {
  const today = new Date();
  const to = query.to || today.toISOString().slice(0, 10);
  const from =
    query.from || new Date(today.getTime() - (fallbackDays - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

async function classBelongsToSchool(schoolId: string, classId: string) {
  return Boolean(await prisma.schoolClass.findFirst({ where: { id: classId, schoolId }, select: { id: true } }));
}

async function subjectBelongsToSchool(schoolId: string, subjectId: string) {
  return Boolean(await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } }));
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildCountMap<T>(items: T[], keyGetter: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyGetter(item) || "-";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function resolveRange(query: { from?: string; to?: string }) {
  return normalizeDateRange(query);
}

async function buildEntitySummaryReport(schoolId: string, parsed: z.infer<typeof EntityReportQuerySchema>) {
  const { from, to } = await resolveRange(parsed);

  if (parsed.dimension === "class") {
    if (parsed.classId && !(await classBelongsToSchool(schoolId, parsed.classId))) {
      return { notFound: "CLASS_NOT_FOUND" as const };
    }

    const classes = await prisma.schoolClass.findMany({
      where: {
        schoolId,
        ...(parsed.classId ? { id: parsed.classId } : {})
      },
      include: {
        students: true,
        homeroomAssignments: { where: { isActive: true }, include: { teacher: true } }
      },
      orderBy: { name: "asc" }
    });
    const attendance = await prisma.studentAttendance.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { student: { classId: parsed.classId } } : {})
      },
      include: { student: true }
    });
    const grades = await prisma.studentGradeEntry.findMany({
      where: {
        schoolId,
        ...(parsed.classId ? { classId: parsed.classId } : {})
      }
    });
    const lessons = await prisma.teacherLessonToday.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { classId: parsed.classId } : {})
      }
    });
    const homeworks = await prisma.teacherHomework.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { classId: parsed.classId } : {})
      }
    });
    const exams = await prisma.teacherExam.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { classId: parsed.classId } : {})
      }
    });

    const attendanceByClass = buildCountMap(attendance, (row) => row.student.classId);
    const gradesByClass = buildCountMap(grades, (row) => row.classId);
    const lessonsByClass = buildCountMap(lessons, (row) => row.classId);
    const homeworkByClass = buildCountMap(homeworks, (row) => row.classId);
    const examsByClass = buildCountMap(exams, (row) => row.classId);

    return {
      range: { from, to },
      dimension: "class" as const,
      totals: {
        classes: classes.length,
        students: classes.reduce((sum, item) => sum + item.students.length, 0),
        attendance: attendance.length,
        grades: grades.length,
        lessons: lessons.length,
        homework: homeworks.length,
        exams: exams.length
      },
      rows: classes.map((item) => {
        const homeroomTeacherName = item.homeroomAssignments[0]?.teacher?.name || null;
        return {
          id: item.id,
          name: item.name,
          gradeLevel: item.gradeLevel,
          homeroomTeacherName,
          studentCount: item.students.length,
          attendanceCount: attendanceByClass.get(item.id) || 0,
          gradeCount: gradesByClass.get(item.id) || 0,
          lessonCount: lessonsByClass.get(item.id) || 0,
          homeworkCount: homeworkByClass.get(item.id) || 0,
          examCount: examsByClass.get(item.id) || 0
        };
      }),
      chart: toChart(new Map(classes.map((item) => [item.name, item.students.length])))
    };
  }

  if (parsed.dimension === "student") {
    if (parsed.classId && !(await classBelongsToSchool(schoolId, parsed.classId))) {
      return { notFound: "CLASS_NOT_FOUND" as const };
    }
    if (parsed.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: parsed.studentId, schoolId },
        include: { class: true }
      });
      if (!student) return { notFound: "STUDENT_NOT_FOUND" as const };

      const attendance = await prisma.studentAttendance.findMany({
        where: { schoolId, studentId: student.id, date: { gte: from, lte: to } }
      });
      const attendanceSummary = attendance.reduce(
        (acc, item) => {
          acc.total += 1;
          if (item.status === "PRESENT") acc.present += 1;
          if (item.status === "LATE") acc.late += 1;
          if (item.status === "ABSENT_EXCUSED") acc.absentExcused += 1;
          if (item.status === "ABSENT_UNEXCUSED") acc.absentUnexcused += 1;
          if (item.status === "LEFT_EARLY") acc.earlyExit += 1;
          return acc;
        },
        { total: 0, present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyExit: 0 }
      );
      const grades = await prisma.studentGradeEntry.count({ where: { schoolId, classId: student.classId } });
      const academic = await prisma.studentAcademicRecord.count({
        where: { schoolId, studentId: student.id, date: { gte: from, lte: to } }
      });
      const behavior = await prisma.studentBehaviorRecord.count({
        where: { schoolId, studentId: student.id, date: { gte: from, lte: to } }
      });
      const certificates = await prisma.studentCertificate.count({ where: { schoolId, studentId: student.id } });
      return {
        range: { from, to },
        dimension: "student" as const,
        totals: { students: 1 },
        rows: [
          {
            id: student.id,
            name: student.name,
            className: student.class.name,
            attendanceCount: attendanceSummary.total,
            presentCount: attendanceSummary.present,
            lateCount: attendanceSummary.late,
            absentCount: attendanceSummary.absentExcused + attendanceSummary.absentUnexcused,
            absentExcusedCount: attendanceSummary.absentExcused,
            absentUnexcusedCount: attendanceSummary.absentUnexcused,
            earlyExitCount: attendanceSummary.earlyExit,
            gradeEntriesCount: grades,
            academicCount: academic,
            behaviorCount: behavior,
            certificateCount: certificates
          }
        ],
        chart: toChart(new Map([[student.name, attendanceSummary.total]]))
      };
    }

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        ...(parsed.classId ? { classId: parsed.classId } : {})
      },
      include: { class: true },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }]
    });
    const attendance = await prisma.studentAttendance.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { student: { classId: parsed.classId } } : {})
      }
    });
    const academic = await prisma.studentAcademicRecord.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { student: { classId: parsed.classId } } : {})
      }
    });
    const behavior = await prisma.studentBehaviorRecord.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(parsed.classId ? { student: { classId: parsed.classId } } : {})
      }
    });
    const attendanceByStudent = buildCountMap(attendance, (item) => item.studentId);
    const academicByStudent = buildCountMap(academic, (item) => item.studentId);
    const behaviorByStudent = buildCountMap(behavior, (item) => item.studentId);
    return {
      range: { from, to },
      dimension: "student" as const,
      totals: {
        students: students.length,
        attendance: attendance.length,
        academic: academic.length,
        behavior: behavior.length
      },
      rows: students.map((student) => ({
        id: student.id,
        name: student.name,
        className: student.class.name,
        attendanceCount: attendanceByStudent.get(student.id) || 0,
        academicCount: academicByStudent.get(student.id) || 0,
        behaviorCount: behaviorByStudent.get(student.id) || 0
      })),
      chart: toChart(new Map(students.map((item) => [item.name, attendanceByStudent.get(item.id) || 0])))
    };
  }

  if (parsed.dimension === "teacher") {
    if (parsed.teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: parsed.teacherId, schoolId },
        include: {
          assignments: { include: { class: true, subject: true } },
          homeroomAssignments: { include: { class: true } }
        }
      });
      if (!teacher) return { notFound: "TEACHER_NOT_FOUND" as const };

      const lessonCount = await prisma.teacherLessonToday.count({
        where: { schoolId, teacherId: teacher.id, date: { gte: from, lte: to } }
      });
      const homeworkCount = await prisma.teacherHomework.count({
        where: { schoolId, teacherId: teacher.id, date: { gte: from, lte: to } }
      });
      const examCount = await prisma.teacherExam.count({
        where: { schoolId, teacherId: teacher.id, date: { gte: from, lte: to } }
      });
      const dutyCount = await prisma.dutyAssignment.count({ where: { schoolId, teacherId: teacher.id } });
      const statusCount = await prisma.dailyTeacherStatus.count({
        where: {
          schoolId,
          teacherId: teacher.id,
          dailySchedule: { date: { gte: from, lte: to } }
        }
      });
      const substitutionCount = await prisma.substitution.count({
        where: {
          schoolId,
          dailySchedule: { date: { gte: from, lte: to } },
          OR: [{ absentTeacherId: teacher.id }, { substituteTeacherId: teacher.id }]
        }
      });
      return {
        range: { from, to },
        dimension: "teacher" as const,
        totals: { teachers: 1 },
        rows: [
          {
            id: teacher.id,
            name: teacher.name,
            assignmentCount: teacher.assignments.length,
            homeroomCount: teacher.homeroomAssignments.length,
            lessonCount,
            homeworkCount,
            examCount,
            dutyCount,
            statusCount,
            substitutionCount
          }
        ],
        chart: toChart(new Map([[teacher.name, lessonCount + homeworkCount + examCount]]))
      };
    }

    const teachers = await prisma.teacher.findMany({
      where: { schoolId, ...(parsed.classId ? { assignments: { some: { classId: parsed.classId } } } : {}) },
      include: { assignments: true, homeroomAssignments: true },
      orderBy: { name: "asc" }
    });
    const lessonCountByTeacher = await prisma.teacherLessonToday.findMany({
      where: { schoolId, date: { gte: from, lte: to } }
    });
    const homeworkCountByTeacher = await prisma.teacherHomework.findMany({
      where: { schoolId, date: { gte: from, lte: to } }
    });
    const examCountByTeacher = await prisma.teacherExam.findMany({ where: { schoolId, date: { gte: from, lte: to } } });
    const lessonCountMap = buildCountMap(lessonCountByTeacher, (item) => item.teacherId);
    const homeworkCountMap = buildCountMap(homeworkCountByTeacher, (item) => item.teacherId);
    const examCountMap = buildCountMap(examCountByTeacher, (item) => item.teacherId);
    return {
      range: { from, to },
      dimension: "teacher" as const,
      totals: {
        teachers: teachers.length,
        lessons: lessonCountByTeacher.length,
        homework: homeworkCountByTeacher.length,
        exams: examCountByTeacher.length
      },
      rows: teachers.map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        assignmentCount: teacher.assignments.length,
        homeroomCount: teacher.homeroomAssignments.length,
        lessonCount: lessonCountMap.get(teacher.id) || 0,
        homeworkCount: homeworkCountMap.get(teacher.id) || 0,
        examCount: examCountMap.get(teacher.id) || 0
      })),
      chart: toChart(new Map(teachers.map((item) => [item.name, lessonCountMap.get(item.id) || 0])))
    };
  }

  if (parsed.dimension === "subject") {
    if (parsed.subjectId && !(await subjectBelongsToSchool(schoolId, parsed.subjectId))) {
      return { notFound: "SUBJECT_NOT_FOUND" as const };
    }
    const subjects = await prisma.subject.findMany({
      where: { schoolId, ...(parsed.subjectId ? { id: parsed.subjectId } : {}) },
      orderBy: { name: "asc" }
    });
    const lessons = await prisma.teacherLessonToday.findMany({
      where: { schoolId, date: { gte: from, lte: to }, ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}) }
    });
    const homework = await prisma.teacherHomework.findMany({
      where: { schoolId, date: { gte: from, lte: to }, ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}) }
    });
    const exams = await prisma.teacherExam.findMany({
      where: { schoolId, date: { gte: from, lte: to }, ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}) }
    });
    const grades = await prisma.studentGradeEntry.findMany({
      where: { schoolId, ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}) }
    });
    const lessonCountMap = buildCountMap(lessons, (item) => item.subjectId);
    const homeworkCountMap = buildCountMap(homework, (item) => item.subjectId);
    const examCountMap = buildCountMap(exams, (item) => item.subjectId);
    const gradeCountMap = buildCountMap(grades, (item) => item.subjectId);

    return {
      range: { from, to },
      dimension: "subject" as const,
      totals: {
        subjects: subjects.length,
        lessons: lessons.length,
        homework: homework.length,
        exams: exams.length,
        grades: grades.length
      },
      rows: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        lessonCount: lessonCountMap.get(subject.id) || 0,
        homeworkCount: homeworkCountMap.get(subject.id) || 0,
        examCount: examCountMap.get(subject.id) || 0,
        gradeEntryCount: gradeCountMap.get(subject.id) || 0
      })),
      chart: toChart(new Map(subjects.map((item) => [item.name, gradeCountMap.get(item.id) || 0])))
    };
  }

  const homeroomAssignments = await prisma.homeroomAssignment.findMany({
    where: {
      schoolId,
      ...(parsed.teacherId ? { teacherId: parsed.teacherId } : {}),
      ...(parsed.classId ? { classId: parsed.classId } : {})
    },
    include: { teacher: true, class: true },
    orderBy: [{ class: { name: "asc" } }, { weeklyDay: "asc" }, { weeklyPeriod: "asc" }]
  });

  return {
    range: { from, to },
    dimension: "homeroom" as const,
    totals: { homeroomAssignments: homeroomAssignments.length },
    rows: homeroomAssignments.map((item) => ({
      id: item.id,
      teacherId: item.teacherId,
      teacherName: item.teacher.name,
      classId: item.classId,
      className: item.class.name,
      weeklyDay: item.weeklyDay,
      weeklyPeriod: item.weeklyPeriod,
      isActive: item.isActive
    })),
    chart: toChart(new Map(homeroomAssignments.map((item) => [item.class.name, 1])))
  };
}

reportsRouter.get("/security", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const lang = safeLang(req.query.lang);
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_SECURITY_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message:
        lang === "en"
          ? "Administrative security report is restricted."
          : lang === "he"
            ? "דוח האבטחה המנהלי מוגבל למנהלים."
            : "التقرير الأمني الإداري مخصص للإدارة فقط."
    });
  }

  const days = Math.min(30, Math.max(1, Number(req.query.days || 7) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await prisma.auditLog.findMany({
    where: {
      schoolId,
      entity: "HTTP_SECURITY",
      createdAt: { gte: since }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  const byAction = new Map<string, number>();
  const byPath = new Map<string, number>();
  let blockedMultipart = 0;
  let rateLimited = 0;
  for (const event of events) {
    inc(byAction, event.action);
    const path = String((event.after as Record<string, unknown> | null)?.path || "-");
    inc(byPath, path);
    if (event.action === "BLOCKED MULTIPART") blockedMultipart += 1;
    if (String(event.action).startsWith("RATE LIMITED")) rateLimited += 1;
  }

  const total = events.length;

  const text =
    lang === "ar"
      ? `تقرير أمني لآخر ${days} يومًا. عدد الأحداث ${total}. محاولات الحظر الصريحة ${blockedMultipart}. محاولات التجاوز المحدودة ${rateLimited}.`
      : lang === "he"
        ? `דוח אבטחה ל-${days} הימים האחרונים. סך האירועים ${total}. חסימות multipart: ${blockedMultipart}. ניסיונות חריגה ממגבלה: ${rateLimited}.`
        : `Security report for the last ${days} days. Total events: ${total}. Multipart blocks: ${blockedMultipart}. Rate-limited attempts: ${rateLimited}.`;

  res.json({
    data: {
      days,
      total,
      blockedMultipart,
      rateLimited,
      text,
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        entity: event.entity,
        path: String((event.after as Record<string, unknown> | null)?.path || "-"),
        method: String((event.after as Record<string, unknown> | null)?.method || "-"),
        createdAt: event.createdAt.toISOString(),
        details: event.after
      })),
      chart: toChart(byAction),
      byPath: toChart(byPath)
    }
  });
});

reportsRouter.get("/attendance", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_ATTENDANCE_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "تقرير الحضور محصور بالإدارة"
    });
  }

  const parsed = AttendanceReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_ATTENDANCE_REPORT_QUERY",
      message: "بيانات تقرير الحضور غير صحيحة"
    });
  }

  const { from, to } = normalizeDateRange(parsed.data);
  if (parsed.data.classId && !(await classBelongsToSchool(schoolId, parsed.data.classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      ...(parsed.data.classId ? { classId: parsed.data.classId } : {})
    },
    include: { class: true },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }]
  });

  const attendanceRows = await prisma.studentAttendance.findMany({
    where: {
      schoolId,
      date: { gte: from, lte: to },
      studentId: { in: students.map((student) => student.id) }
    },
    include: { student: { include: { class: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  const byStatus = new Map<string, number>();
  const byClass = new Map<string, number>();
  for (const row of attendanceRows) {
    inc(byStatus, row.status);
    inc(byClass, row.student.class.name);
  }

  const summary = attendanceRows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "PRESENT") acc.present += 1;
      if (row.status === "LATE") acc.late += 1;
      if (row.status === "ABSENT_EXCUSED") acc.absentExcused += 1;
      if (row.status === "ABSENT_UNEXCUSED") acc.absentUnexcused += 1;
      if (row.status === "LEFT_EARLY") acc.earlyExit += 1;
      return acc;
    },
    { total: 0, present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyExit: 0 }
  );

  res.json({
    data: {
      range: { from, to },
      classId: parsed.data.classId || null,
      totalStudents: students.length,
      summary: {
        ...summary,
        absent: summary.absentExcused + summary.absentUnexcused
      },
      rows: attendanceRows.map((row) => ({
        id: row.id,
        studentId: row.studentId,
        studentName: row.student.name,
        classId: row.student.classId,
        className: row.student.class.name,
        date: row.date,
        day: row.day,
        status: row.status,
        lateAt: row.lateAt,
        leftAt: row.leftAt,
        createdAt: row.createdAt.toISOString()
      })),
      chart: toChart(byStatus),
      byClass: toChart(byClass)
    }
  });
});

reportsRouter.get("/grades", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_GRADES_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "تقرير العلامات محصور بالإدارة"
    });
  }

  const parsed = GradesReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_GRADES_REPORT_QUERY",
      message: "بيانات تقرير العلامات غير صحيحة"
    });
  }

  if (parsed.data.classId && !(await classBelongsToSchool(schoolId, parsed.data.classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }
  if (parsed.data.subjectId && !(await subjectBelongsToSchool(schoolId, parsed.data.subjectId))) {
    return res.status(404).json({ error: "SUBJECT_NOT_FOUND", message: "المادة غير موجودة" });
  }

  const [classes, subjects, schemes, entries, students] = await Promise.all([
    prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.studentGradeScheme.findMany({
      where: {
        schoolId,
        ...(parsed.data.classId ? { classId: parsed.data.classId } : {}),
        ...(parsed.data.subjectId ? { subjectId: parsed.data.subjectId } : {}),
        ...(parsed.data.certificateType ? { certificateType: parsed.data.certificateType } : {})
      },
      orderBy: [{ classId: "asc" }, { subjectId: "asc" }]
    }),
    prisma.studentGradeEntry.findMany({
      where: {
        schoolId,
        ...(parsed.data.classId ? { classId: parsed.data.classId } : {}),
        ...(parsed.data.subjectId ? { subjectId: parsed.data.subjectId } : {}),
        ...(parsed.data.certificateType ? { certificateType: parsed.data.certificateType } : {})
      },
      orderBy: [{ classId: "asc" }, { subjectId: "asc" }, { certificateType: "asc" }]
    }),
    parsed.data.classId
      ? prisma.student.findMany({
          where: { schoolId, classId: parsed.data.classId },
          include: { class: true },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([])
  ]);

  const classMap = new Map(classes.map((item) => [item.id, item]));
  const subjectMap = new Map(subjects.map((item) => [item.id, item]));
  const schemeMap = new Map(schemes.map((item) => [`${item.classId}:${item.subjectId}:${item.certificateType}`, item]));

  const byClass = new Map<string, number>();
  const bySubject = new Map<string, number>();
  const byType = new Map<string, number>();

  const rows = entries.map((entry) => {
    const key = `${entry.classId}:${entry.subjectId}:${entry.certificateType}`;
    const scheme = schemeMap.get(key);
    const schemeSections = Array.isArray(scheme?.sections) ? scheme.sections : [];
    const marksByStudent = (entry.rows || {}) as Record<string, Record<string, string>>;
    const filledStudents = Object.values(marksByStudent).filter((row) =>
      Object.values(row || {}).some((value) => String(value).trim().length > 0)
    ).length;
    inc(byClass, classMap.get(entry.classId)?.name || entry.classId);
    inc(bySubject, subjectMap.get(entry.subjectId)?.name || entry.subjectId);
    inc(byType, entry.certificateType);
    return {
      id: entry.id,
      classId: entry.classId,
      className: classMap.get(entry.classId)?.name || entry.classId,
      subjectId: entry.subjectId,
      subjectName: subjectMap.get(entry.subjectId)?.name || entry.subjectId,
      certificateType: entry.certificateType,
      sectionCount: schemeSections.length,
      studentCount: Object.keys(marksByStudent).length,
      filledStudents,
      updatedAt: entry.updatedAt.toISOString()
    };
  });

  const detailedEntry =
    parsed.data.classId && parsed.data.subjectId && parsed.data.certificateType
      ? entries.find(
          (entry) =>
            entry.classId === parsed.data.classId &&
            entry.subjectId === parsed.data.subjectId &&
            entry.certificateType === parsed.data.certificateType
        )
      : null;

  const detailedScheme =
    parsed.data.classId && parsed.data.subjectId && parsed.data.certificateType
      ? schemes.find(
          (scheme) =>
            scheme.classId === parsed.data.classId &&
            scheme.subjectId === parsed.data.subjectId &&
            scheme.certificateType === parsed.data.certificateType
        )
      : null;

  const detailedRows =
    parsed.data.classId && detailedEntry
      ? students.map((student) => {
          const marksByStudent = (detailedEntry.rows || {}) as Record<string, Record<string, string>>;
          const marks = marksByStudent[student.id] || {};
          const filledSections = Object.values(marks).filter((value) => String(value).trim().length > 0).length;
          const totalSections = Array.isArray(detailedScheme?.sections) ? detailedScheme.sections.length : 0;
          return {
            studentId: student.id,
            studentName: student.name,
            classId: student.classId,
            className: student.class.name,
            marks,
            filledSections,
            totalSections,
            completion: totalSections > 0 ? Math.round((filledSections / totalSections) * 100) : 0
          };
        })
      : [];

  res.json({
    data: {
      filters: {
        classId: parsed.data.classId || null,
        subjectId: parsed.data.subjectId || null,
        certificateType: parsed.data.certificateType || null
      },
      totals: {
        schemes: schemes.length,
        entries: entries.length,
        classes: classMap.size,
        subjects: subjectMap.size
      },
      rows,
      detailedRows,
      summary: {
        byClass: toChart(byClass),
        bySubject: toChart(bySubject),
        byType: toChart(byType)
      }
    }
  });
});

reportsRouter.get("/classroom-logs", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_CLASSROOM_LOGS_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "سجل الصفوف محصور بالإدارة"
    });
  }

  const parsed = ClassroomLogsReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_CLASSROOM_LOGS_QUERY",
      message: "بيانات سجل الصفوف غير صحيحة"
    });
  }

  const { from, to } = normalizeDateRange(parsed.data);
  if (parsed.data.classId && !(await classBelongsToSchool(schoolId, parsed.data.classId))) {
    return res.status(404).json({ error: "CLASS_NOT_FOUND", message: "الصف غير موجود" });
  }

  const classFilter = parsed.data.classId || undefined;
  const [lessons, homeworks, exams] = await Promise.all([
    prisma.teacherLessonToday.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(classFilter ? { classId: classFilter } : {})
      },
      include: { teacher: true, class: true, subject: true },
      orderBy: [{ date: "desc" }, { period: "asc" }, { createdAt: "asc" }]
    }),
    prisma.teacherHomework.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(classFilter ? { classId: classFilter } : {})
      },
      include: { teacher: true, class: true, subject: true },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }]
    }),
    prisma.teacherExam.findMany({
      where: {
        schoolId,
        date: { gte: from, lte: to },
        ...(classFilter ? { classId: classFilter } : {})
      },
      include: { teacher: true, class: true, subject: true },
      orderBy: [{ date: "desc" }, { startTime: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const rows = [
    ...lessons.map((item) => ({
      type: "LESSON_TODAY" as const,
      id: item.id,
      date: item.date,
      day: item.day,
      teacherName: item.teacher.name,
      className: item.class.name,
      subjectName: item.subject.name,
      title: item.title,
      details: {
        status: item.status,
        note: item.note,
        summary: item.summary,
        attachments: item.attachments,
        period: item.period
      }
    })),
    ...homeworks.map((item) => ({
      type: "HOMEWORK" as const,
      id: item.id,
      date: item.date,
      day: item.day,
      teacherName: item.teacher.name,
      className: item.class.name,
      subjectName: item.subject.name,
      title: item.title,
      details: {
        kind: item.kind,
        description: item.description,
        dueDate: item.dueDate,
        notes: item.notes,
        attachment: item.attachment
      }
    })),
    ...exams.map((item) => ({
      type: "EXAM" as const,
      id: item.id,
      date: item.date,
      day: item.day,
      teacherName: item.teacher.name,
      className: item.class.name,
      subjectName: item.subject.name,
      title: item.title,
      details: {
        startTime: item.startTime,
        endTime: item.endTime,
        room: item.room,
        notes: item.notes,
        instructions: item.instructions
      }
    }))
  ].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date);
    if (dateCompare !== 0) return dateCompare;
    return left.type.localeCompare(right.type);
  });

  const byType = new Map<string, number>();
  const byClass = new Map<string, number>();
  for (const row of rows) {
    inc(byType, row.type);
    inc(byClass, row.className);
  }

  res.json({
    data: {
      range: { from, to },
      classId: parsed.data.classId || null,
      totals: {
        lessons: lessons.length,
        homework: homeworks.length,
        exams: exams.length,
        all: rows.length
      },
      rows,
      summary: {
        byType: toChart(byType),
        byClass: toChart(byClass)
      }
    }
  });
});

reportsRouter.get("/summary", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_SUMMARY_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "التقارير التحليلية محصورة بالإدارة"
    });
  }

  const parsed = EntityReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_REPORT_SUMMARY_QUERY",
      message: "بيانات تقرير الملخص غير صحيحة"
    });
  }

  const result = await buildEntitySummaryReport(schoolId, parsed.data);
  if ("notFound" in result) {
    const message =
      result.notFound === "CLASS_NOT_FOUND"
        ? "الصف غير موجود"
        : result.notFound === "STUDENT_NOT_FOUND"
          ? "الطالب غير موجود"
          : result.notFound === "TEACHER_NOT_FOUND"
            ? "المعلم غير موجود"
            : "المنطقة غير موجودة";
    return res.status(404).json({ error: result.notFound, message });
  }

  res.json({ data: result });
});

reportsRouter.post("/export", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!req.user) {
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "تسجيل الدخول مطلوب" });
  }

  const parsed = ExportReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_REPORT_EXPORT", message: "بيانات التصدير غير صحيحة" });
  }

  const { permission, kind, reportType, title, fileName, expiresInMinutes, filters } = parsed.data;
  if (!canRole(req.user.role, permission)) {
    await logReportDenied(req, schoolId, "REPORT_EXPORT_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "لا تملك صلاحية تصدير هذا التقرير"
    });
  }

  const expiresAt = new Date(Date.now() + (expiresInMinutes || 15) * 60_000).toISOString();
  const reportExportId = crypto.randomUUID();
  await createReportExportRecord(prisma, {
    schoolId,
    reportType,
    fileType: kind,
    filePath: `reports/${reportType}/${reportExportId}.${kind.toLowerCase()}`,
    requestedBy: req.user.id,
    status: "REQUESTED",
    expiresAt: new Date(expiresAt)
  });
  await recordAuditLog(prisma, {
    schoolId,
    userId: req.user.id,
    action: `EXPORT REPORT ${reportType.toUpperCase()}`,
    entity: "ReportExport",
    after: {
      reportType,
      title,
      fileName,
      kind,
      permission,
      expiresAt,
      privacyWarningAccepted: true,
      filters: toJsonInput(filters)
    }
  });

  res.json({
    data: {
      ok: true,
      reportType,
      expiresAt,
      exportId: reportExportId
    }
  });
});

reportsRouter.get("/daily/:date", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  const lang = (req.query.lang === "en" || req.query.lang === "he" ? req.query.lang : "ar") as Lang;
  if (!canViewReports(req)) {
    await logReportDenied(req, schoolId, "REPORT_DAILY_ACCESS_DENIED");
    return res.status(403).json({
      error: "FORBIDDEN",
      message:
        lang === "en"
          ? "Daily report is restricted."
          : lang === "he"
            ? "×“×•×— ×”×“×•×— ×”×™×•×ž×™ ×ž×•×’×‘×œ."
            : "تقرير اليومي محصور للإدارة."
    });
  }
  const daily = await prisma.dailySchedule.findUnique({
    where: { schoolId_date: { schoolId, date: req.params.date } },
    include: {
      statuses: { include: { teacher: true } },
      substitutions: {
        include: { class: true, subject: true, absentTeacher: true, substituteTeacher: true }
      }
    }
  });

  if (!daily) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }

  const baseSlots = await prisma.baseScheduleSlot.findMany({
    where: { schoolId },
    include: { class: true, subject: true, teacher: true }
  });

  const lines: string[] = [];
  const byKind = new Map<string, number>();
  const byClass = new Map<string, number>();
  const bySubject = new Map<string, number>();
  const byTeacher = new Map<string, number>();
  const affectedByTeacher = new Map<string, typeof daily.substitutions>();
  const baseCountByClassSubject = new Map<string, number>();
  const affectedCountByClassSubject = new Map<string, number>();

  for (const base of baseSlots) {
    const key = `${base.classId}:${base.subjectId}`;
    baseCountByClassSubject.set(key, (baseCountByClassSubject.get(key) || 0) + 1);
  }

  for (const sub of daily.substitutions) {
    inc(byKind, label(sub.kind, lang));
    inc(byClass, sub.class?.name);
    inc(bySubject, sub.subject?.name);
    inc(byTeacher, sub.absentTeacher?.name);
    if (!affectedByTeacher.has(sub.absentTeacherId)) affectedByTeacher.set(sub.absentTeacherId, []);
    affectedByTeacher.get(sub.absentTeacherId)!.push(sub);
    const key = `${sub.classId}:${sub.subjectId}`;
    affectedCountByClassSubject.set(key, (affectedCountByClassSubject.get(key) || 0) + 1);
  }

  if (lang === "ar") {
    lines.push(`تقرير البرنامج اليومي ليوم ${daily.day} بتاريخ ${daily.date}.`);
    if (daily.statuses.length === 0) {
      lines.push(
        "لم تُسجل أي حالة غياب أو تأخر أو مغادرة أو مهمة في هذا اليوم، لذلك بقي البرنامج اليومي مطابقًا للبرنامج الثابت."
      );
    }
    for (const st of daily.statuses) {
      const affected = affectedByTeacher.get(st.teacherId) || [];
      const classes = Array.from(new Set(affected.map((sub) => sub.class?.name))).join("، ") || "لا توجد صفوف متأثرة";
      const subjects =
        Array.from(new Set(affected.map((sub) => sub.subject?.name))).join("، ") || "لا توجد مواد متأثرة";
      lines.push(
        `سجلت حالة ${statusLabel(st.type, lang)} للمعلم ${st.teacher.name} من الحصة ${st.fromPeriod} حتى الحصة ${st.toPeriod}. الحصص المتأثرة تشمل ${subjects} للصفوف: ${classes}.`
      );
    }
    if (daily.substitutions.length > 0) {
      lines.push("تفصيل الاستبدالات:");
    }
    for (const sub of daily.substitutions) {
      const key = `${sub.classId}:${sub.subjectId}`;
      const weeklyOriginal = baseCountByClassSubject.get(key) || 0;
      const affectedSame = affectedCountByClassSubject.get(key) || 0;
      const remaining = Math.max(0, weeklyOriginal - affectedSame);
      const substituteName = sub.substituteTeacher?.name || "لم يتم تعيين بديل";
      lines.push(
        `في الحصة ${sub.period}، تأثرت حصة ${sub.subject.name} للصف ${sub.class.name} بسبب ${sub.absentTeacher.name}. أُسندت الحصة إلى ${substituteName}. تصنيف الاستبدال: ${label(sub.kind, lang)}. لهذه المادة ${weeklyOriginal} حصص أسبوعية في البرنامج الثابت، وتأثر منها ${affectedSame}، والباقي غير المتأثر ${remaining}.`
      );
    }
    lines.push(`الخلاصة: عدد الاستبدالات ${daily.substitutions.length}، وعدد الصفوف المتأثرة ${byClass.size}.`);
  } else if (lang === "en") {
    lines.push(`Daily schedule report for ${daily.day}, ${daily.date}.`);
    if (daily.statuses.length === 0) {
      lines.push(
        "No absence, lateness, early leave, or task was recorded today, so the daily schedule stayed identical to the base schedule."
      );
    }
    for (const st of daily.statuses) {
      const affected = affectedByTeacher.get(st.teacherId) || [];
      const classes = Array.from(new Set(affected.map((sub) => sub.class?.name))).join(", ") || "no affected classes";
      const subjects =
        Array.from(new Set(affected.map((sub) => sub.subject?.name))).join(", ") || "no affected subjects";
      lines.push(
        `${statusLabel(st.type, lang)} was recorded for ${st.teacher.name} from period ${st.fromPeriod} to period ${st.toPeriod}. Affected lessons include ${subjects} for: ${classes}.`
      );
    }
    lines.push(`Summary: ${daily.substitutions.length} substitutions were created, affecting ${byClass.size} classes.`);
  } else {
    lines.push(`تقرير البرنامج اليومي ليوم ${daily.day}، بتاريخ ${daily.date}.`);
    if (daily.statuses.length === 0) {
      lines.push(
        "لم تُسجل أي حالة غياب أو تأخر أو مغادرة أو مهمة في هذا اليوم، لذلك بقي البرنامج اليومي مطابقًا للبرنامج الثابت."
      );
    }
    for (const st of daily.statuses) {
      const affected = affectedByTeacher.get(st.teacherId) || [];
      const classes = Array.from(new Set(affected.map((sub) => sub.class?.name))).join("، ") || "لا توجد صفوف متأثرة";
      const subjects =
        Array.from(new Set(affected.map((sub) => sub.subject?.name))).join("، ") || "لا توجد مواد متأثرة";
      lines.push(
        `${statusLabel(st.type, lang)} سجلت للمعلم ${st.teacher.name} من الحصة ${st.fromPeriod} حتى الحصة ${st.toPeriod}. الحصص المتأثرة تشمل ${subjects} للصفوف: ${classes}.`
      );
    }
    lines.push(`الملخص: نُفذت ${daily.substitutions.length} عملية استبدال، وتأثرت ${byClass.size} صفوف.`);
  }

  res.json({
    data: {
      text: lines.join("\n"),
      daily,
      chart: toChart(byKind),
      charts: {
        classes: toChart(byClass),
        subjects: toChart(bySubject),
        teachers: toChart(byTeacher)
      }
    }
  });
});
