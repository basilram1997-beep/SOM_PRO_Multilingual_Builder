import { z } from "zod";

export const ALL_WEEK_DAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] as const;

export const ROLE_ALLOWED_PAGES = {
  ADMIN: [
    "dashboard",
    "teachers",
    "students",
    "studentClasses",
    "studentAttendance",
    "studentInvitations",
    "studentInvitation",
    "teacherPermissions",
    "studentPledge",
    "studentAcademicLevel",
    "studentBehaviorPerformance",
    "studentMarks",
    "studentLessonToday",
    "studentHomeworkPreparation",
    "studentExams",
    "studentTimetable",
    "studentCertificates",
    "homeroom",
    "duties",
    "schedules",
    "daily",
    "archive",
    "reports",
    "operations",
    "securityMonitoring",
    "operatorHealth",
    "settings",
    "schoolNotifications",
    "users",
    "license"
  ],
  MANAGER: [
    "dashboard",
    "teachers",
    "students",
    "studentClasses",
    "studentAttendance",
    "studentInvitations",
    "studentInvitation",
    "teacherPermissions",
    "studentPledge",
    "studentAcademicLevel",
    "studentBehaviorPerformance",
    "studentMarks",
    "studentLessonToday",
    "studentHomeworkPreparation",
    "studentExams",
    "studentTimetable",
    "studentCertificates",
    "homeroom",
    "duties",
    "schedules",
    "daily",
    "archive",
    "reports",
    "settings",
    "schoolNotifications"
  ],
  SCHEDULER: ["daily", "homeroom", "duties"],
  TEACHER: [
    "teacherPortal",
    "homeroomPortal",
    "schedules",
    "daily",
    "duties",
    "studentAttendance",
    "studentBehaviorPerformance",
    "studentMarks",
    "studentLessonToday",
    "studentHomeworkPreparation",
    "studentExams",
    "teacherPermissions",
    "studentPledge"
  ],
  STUDENT: [
    "studentPortal",
    "studentMarks",
    "studentHomeworkPreparation",
    "studentTimetable",
    "studentExams",
    "studentAttendance",
    "studentLessonToday"
  ],
  PARENT: [
    "studentPortal",
    "studentMarks",
    "studentHomeworkPreparation",
    "studentTimetable",
    "studentExams",
    "studentAttendance",
    "studentLessonToday"
  ]
} as const;

export type AppRole = keyof typeof ROLE_ALLOWED_PAGES;
export type AppPageKey = (typeof ROLE_ALLOWED_PAGES)[AppRole][number];

export function allowedPagesForRole(role: string | undefined): readonly AppPageKey[] {
  if (!role) return [];
  return ROLE_ALLOWED_PAGES[role as AppRole] || ROLE_ALLOWED_PAGES.ADMIN;
}

export const PeriodSchema = z.number().int().min(1).max(12);

export const SchoolSettingsSchema = z.object({
  workingDays: z.array(z.string()).min(1).max(7),
  offDays: z.array(z.string()).max(7).default([]),
  periodsPerDay: z.number().int().min(1).max(12),
  maxTeachers: z.number().int().min(1).max(500).default(100),
  notes: z.string().optional().nullable(),
  adminMfaRequired: z.boolean().default(false)
});

export const SchoolInfoSchema = z.object({
  name: z.string().min(1),
  managerName: z.string().optional().nullable(),
  institutionCode: z.string().optional().nullable(),
  address: z.string().optional().nullable()
});

export const PeriodDefinitionSchema = z.object({
  period: PeriodSchema,
  label: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
});

export function repairDisplayText(value: string) {
  if (!/[\u00d8\u00d9\u00c3]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

type SchoolClassLike = {
  name: string;
  grade?: string | null;
  section?: string | null;
};

const classGradeOrder: Record<string, number> = {
  الأول: 1,
  الاول: 1,
  الثاني: 2,
  الثالث: 3,
  الرابع: 4,
  الخامس: 5,
  السادس: 6,
  السابع: 7,
  الثامن: 8,
  التاسع: 9,
  العاشر: 10,
  "الحادي عشر": 11,
  "الثاني عشر": 12
};

const classSectionOrder: Record<string, number> = {
  أ: 1,
  A: 1,
  ب: 2,
  B: 2,
  ج: 3,
  C: 3,
  د: 4,
  D: 4
};

function normalizeClassName(value: string | null | undefined) {
  return repairDisplayText(typeof value === "string" ? value : "").trim();
}

function normalizeClassTokens(value: string) {
  return normalizeClassName(value)
    .replace(/[/-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function classGradeRank(value: string | null | undefined) {
  const clean = normalizeClassName(value);
  if (!clean) return Number.MAX_SAFE_INTEGER;
  const numeric = Number(clean);
  if (Number.isFinite(numeric)) return numeric;
  for (const token of normalizeClassTokens(clean)) {
    const compactToken = token.replace(/[^\p{L}\p{N}]/gu, "");
    const directNumber = compactToken.match(/^(1[0-2]|[1-9])(?:st|nd|rd|th)?(?:[أبجدA-D])?$/i);
    if (directNumber) return Number(directNumber[1]);
    const gradeWord = classGradeOrder[compactToken as keyof typeof classGradeOrder];
    if (gradeWord) return gradeWord;
  }
  for (const [key, rank] of Object.entries(classGradeOrder)) {
    if (clean.includes(key.replaceAll("_", " "))) return rank;
  }
  return Number.MAX_SAFE_INTEGER - 2;
}

function classSectionRank(value: string | null | undefined) {
  const clean = normalizeClassName(value);
  if (!clean) return Number.MAX_SAFE_INTEGER;
  const lastToken = normalizeClassTokens(clean).at(-1) || "";
  const compact = lastToken.replace(/[^\p{L}]/gu, "");
  const directSection =
    classSectionOrder[lastToken as keyof typeof classSectionOrder] ??
    classSectionOrder[compact as keyof typeof classSectionOrder];
  if (directSection) return directSection;
  const trailingLetter = compact.slice(-1);
  return classSectionOrder[trailingLetter as keyof typeof classSectionOrder] ?? Number.MAX_SAFE_INTEGER - 1;
}

function classSortLabel(item: SchoolClassLike) {
  const normalizedName = normalizeClassName(item.name);
  const [classPart] = normalizedName.split("/").map((part) => part.trim());
  const gradePart = normalizeClassName(item.grade) || classPart;
  const sectionPart = normalizeClassName(item.section) || classPart.split(/\s+/).at(-1) || "";
  return {
    gradeRank: classGradeRank(gradePart),
    sectionRank: classSectionRank(sectionPart),
    label: classPart || normalizedName
  };
}

const classNameCollator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });

export function compareSchoolClasses(left: SchoolClassLike, right: SchoolClassLike) {
  const leftSort = classSortLabel(left);
  const rightSort = classSortLabel(right);
  if (leftSort.gradeRank !== rightSort.gradeRank) return leftSort.gradeRank - rightSort.gradeRank;
  if (leftSort.sectionRank !== rightSort.sectionRank) return leftSort.sectionRank - rightSort.sectionRank;
  return classNameCollator.compare(leftSort.label, rightSort.label);
}

export function sortSchoolClasses<T extends SchoolClassLike>(classes: T[]) {
  return [...classes]
    .map((item) => ({ item, sort: classSortLabel(item) }))
    .sort((left, right) => {
      if (left.sort.gradeRank !== right.sort.gradeRank) return left.sort.gradeRank - right.sort.gradeRank;
      if (left.sort.sectionRank !== right.sort.sectionRank) return left.sort.sectionRank - right.sort.sectionRank;
      return classNameCollator.compare(left.sort.label, right.sort.label);
    })
    .map((entry) => entry.item);
}

export const TeacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  nationalId: z.string().optional().nullable(),
  employeeNumber: z.string().trim().optional().nullable(),
  specialty: z.string().optional().nullable(),
  adminRole: z.string().optional().nullable(),
  employmentRatio: z.number().int().min(0).max(100).default(100),
  workDays: z.array(z.string()).default([]),
  preferredDays: z.array(z.string()).default([]),
  preferredClasses: z.array(z.string()).default([]),
  preferredPeriods: z.array(z.number().int().min(1).max(12)).default([]),
  releaseHours: z.number().int().min(0).default(0),
  targetLoad: z.number().int().min(0).default(25),
  notes: z.string().optional().nullable()
});

export const ClassSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  grade: z.string().trim().optional().nullable(),
  section: z.string().trim().optional().nullable(),
  maxStudents: z.coerce.number().int().min(1).max(500).optional().nullable()
});

export const SubjectBaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  isHomeroom: z.boolean().default(false),
  maxMark: z.coerce.number().int().min(1).max(500).optional().nullable(),
  passMark: z.coerce.number().int().min(0).max(500).optional().nullable()
});

export const SubjectSchema = SubjectBaseSchema.superRefine((value, context) => {
  if (value.maxMark != null && value.passMark != null && value.passMark > value.maxMark) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["passMark"],
      message: "passMark must not exceed maxMark"
    });
  }
});

export const TeacherAssignmentSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string(),
  classId: z.string(),
  subjectId: z.string(),
  weeklyPeriods: z.number().int().min(0).max(40).default(0)
});

export const HomeroomAssignmentSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string(),
  classId: z.string(),
  weeklyDay: z.string().optional().nullable(),
  weeklyPeriod: PeriodSchema.optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable()
});

export const DutyAssignmentSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string(),
  day: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  place: z.string().min(1),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
});

export const BaseScheduleSlotSchema = z.object({
  id: z.string().optional(),
  day: z.string().min(1),
  period: PeriodSchema,
  classId: z.string(),
  subjectId: z.string(),
  teacherId: z.string(),
  room: z.string().trim().optional().nullable()
});

export const StudentSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  nationalId: z.string().trim().optional().nullable(),
  classId: z.string().min(1),
  fatherName: z.string().trim().optional().nullable(),
  motherName: z.string().trim().optional().nullable(),
  residence: z.string().trim().optional().nullable(),
  fatherPhone: z.string().trim().optional().nullable(),
  motherPhone: z.string().trim().optional().nullable(),
  guardianPhone: z.string().trim().optional().nullable(),
  healthFund: z.string().trim().optional().nullable(),
  studentPhone: z.string().trim().optional().nullable()
});

export const StudentAttendanceSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  status: z.enum(["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "LEFT_EARLY"]),
  lateAt: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  leftAt: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  note: z.string().trim().optional().nullable()
});

export const StudentAcademicToneSchema = z.enum(["POSITIVE", "NEGATIVE"]);

export const StudentAcademicRecordSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  tone: StudentAcademicToneSchema.default("POSITIVE"),
  strengths: z.string().trim().optional().nullable(),
  weaknesses: z.string().trim().optional().nullable(),
  assignments: z.string().trim().optional().nullable(),
  lessonProgress: z.string().trim().optional().nullable(),
  certificate: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable()
});

export const StudentBehaviorRecordSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  category: z.string().min(1),
  tone: StudentAcademicToneSchema.default("POSITIVE"),
  template: z.string().trim().min(1),
  note: z.string().trim().optional().nullable()
});

export const StudentCertificateTypeSchema = z.enum([
  "TERM1_BIMONTHLY",
  "TERM1_FINAL",
  "TERM2_BIMONTHLY",
  "TERM2_FINAL"
]);

export const StudentCertificateResultSchema = z.enum(["PASS", "PASS_WITH_WARNING", "REVIEW", "INCOMPLETE"]);

export const StudentCertificateBehaviorLevelSchema = z.enum(["EXCELLENT", "VERY_GOOD", "GOOD", "NEEDS_ATTENTION"]);

export const StudentCertificateSubjectRowSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().optional().nullable().default(""),
  subjectName: z.string().optional().nullable().default(""),
  mark: z.string().optional().nullable().default(""),
  maxScore: z.coerce.number().int().min(0).max(200).optional().nullable().default(0),
  grade: z.string().optional().nullable().default(""),
  note: z.string().optional().nullable().default("")
});

export const StudentGradeEntryStudentMarksSchema = z.record(z.string(), z.string()).default({});

export const StudentGradeEntryRowsSchema = z.record(z.string(), StudentGradeEntryStudentMarksSchema).default({});

export const StudentGradeEntrySchema = z.object({
  id: z.string().optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema,
  rows: StudentGradeEntryRowsSchema
});

export const StudentCertificateSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  certificateType: StudentCertificateTypeSchema,
  academicYear: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  schoolNumber: z.string().trim().optional().nullable(),
  presentDays: z.coerce.number().int().min(0).default(0),
  absentDays: z.coerce.number().int().min(0).default(0),
  lateDays: z.coerce.number().int().min(0).default(0),
  earlyExitDays: z.coerce.number().int().min(0).default(0),
  behaviorLevel: StudentCertificateBehaviorLevelSchema.default("GOOD"),
  behaviorNote: z.string().trim().optional().nullable(),
  teacherNotes: z.string().trim().optional().nullable(),
  adminNotes: z.string().trim().optional().nullable(),
  teacherSignature: z.string().trim().optional().nullable(),
  principalSignature: z.string().trim().optional().nullable(),
  average: z.number().nullable().optional(),
  grade: z.string().trim().optional().nullable(),
  result: StudentCertificateResultSchema.default("PASS"),
  approved: z.boolean().default(false),
  published: z.boolean().default(false),
  subjectRows: z.array(StudentCertificateSubjectRowSchema).default([])
});

export const TeacherLessonTodayStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);

export const TeacherLessonTodaySchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  period: z.number().int().min(1).max(12),
  title: z.string().trim().min(1),
  summary: z.string().trim().optional().nullable(),
  status: TeacherLessonTodayStatusSchema.default("NOT_STARTED"),
  note: z.string().trim().optional().nullable(),
  attachments: z.string().trim().optional().nullable()
});

export const TeacherHomeworkKindSchema = z.enum(["HOMEWORK", "PREPARATION"]);

export const TeacherHomeworkSubmissionStatusSchema = z.enum(["SOLVED", "UNSOLVED", "LATE"]);

export const TeacherHomeworkSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  kind: TeacherHomeworkKindSchema.default("HOMEWORK"),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  attachment: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

export const TeacherHomeworkSubmissionSchema = z.object({
  id: z.string().optional(),
  homeworkId: z.string().min(1),
  studentId: z.string().min(1),
  status: TeacherHomeworkSubmissionStatusSchema.default("UNSOLVED"),
  note: z.string().trim().optional().nullable(),
  grade: z.string().trim().optional().nullable()
});

export const TeacherExamSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.string().min(1),
  title: z.string().trim().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  instructions: z.string().trim().optional().nullable()
});

export const DailyStatusSchema = z.object({
  teacherId: z.string(),
  type: z.enum(["ABSENT", "LATE", "LEFT", "UNAVAILABLE"]),
  fromPeriod: PeriodSchema.default(1),
  toPeriod: PeriodSchema.optional().nullable(),
  reason: z.string().optional().nullable()
});

export const GenerateDailyScheduleSchema = z.object({
  date: z.string().min(1),
  day: z.string().min(1),
  statuses: z.array(DailyStatusSchema).default([]),
  manualSubstitutions: z
    .array(
      z.object({
        baseScheduleSlotId: z.string(),
        substituteTeacherId: z.string().nullable()
      })
    )
    .default([])
});

export type SchoolInfo = z.infer<typeof SchoolInfoSchema>;
export type SchoolSettings = z.infer<typeof SchoolSettingsSchema>;
export type PeriodDefinition = z.infer<typeof PeriodDefinitionSchema>;
export type Teacher = z.infer<typeof TeacherSchema>;
export type SchoolClass = z.infer<typeof ClassSchema>;
export type SubjectBase = z.infer<typeof SubjectBaseSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type TeacherAssignment = z.infer<typeof TeacherAssignmentSchema>;
export type HomeroomAssignment = z.infer<typeof HomeroomAssignmentSchema>;
export type DutyAssignment = z.infer<typeof DutyAssignmentSchema>;
export type Student = z.infer<typeof StudentSchema>;
export type StudentAttendance = z.infer<typeof StudentAttendanceSchema>;
export type StudentAcademicTone = z.infer<typeof StudentAcademicToneSchema>;
export type StudentAcademicRecord = z.infer<typeof StudentAcademicRecordSchema>;
export type StudentBehaviorRecord = z.infer<typeof StudentBehaviorRecordSchema>;
export type StudentCertificateType = z.infer<typeof StudentCertificateTypeSchema>;
export type StudentCertificateResult = z.infer<typeof StudentCertificateResultSchema>;
export type StudentCertificateBehaviorLevel = z.infer<typeof StudentCertificateBehaviorLevelSchema>;
export type StudentCertificateSubjectRow = z.infer<typeof StudentCertificateSubjectRowSchema>;
export type StudentGradeEntryStudentMarks = z.infer<typeof StudentGradeEntryStudentMarksSchema>;
export type StudentGradeEntryRows = z.infer<typeof StudentGradeEntryRowsSchema>;
export type StudentGradeEntry = z.infer<typeof StudentGradeEntrySchema>;
export type StudentCertificate = z.infer<typeof StudentCertificateSchema>;
export type TeacherLessonTodayStatus = z.infer<typeof TeacherLessonTodayStatusSchema>;
export type TeacherLessonToday = z.infer<typeof TeacherLessonTodaySchema>;
export type TeacherHomeworkKind = z.infer<typeof TeacherHomeworkKindSchema>;
export type TeacherHomeworkSubmissionStatus = z.infer<typeof TeacherHomeworkSubmissionStatusSchema>;
export type TeacherHomework = z.infer<typeof TeacherHomeworkSchema>;
export type TeacherHomeworkSubmission = z.infer<typeof TeacherHomeworkSubmissionSchema>;
export type TeacherExam = z.infer<typeof TeacherExamSchema>;
export type BaseScheduleSlot = z.infer<typeof BaseScheduleSlotSchema>;
export type DailyStatus = z.infer<typeof DailyStatusSchema>;
export type GenerateDailyScheduleInput = z.infer<typeof GenerateDailyScheduleSchema>;

export type SubstitutionKind =
  | "SAME_CLASS_AND_SUBJECT"
  | "SAME_CLASS"
  | "SAME_GRADE_AND_SUBJECT"
  | "SAME_SUBJECT"
  | "SAME_GRADE"
  | "FREE_ONLY"
  | "NO_SUBSTITUTE";

export type TeacherProgramLessonType = "ORIGINAL" | "SUBSTITUTION" | "UNAVAILABLE_ORIGINAL";

export type TeacherProgramLesson = {
  period: number;
  className: string;
  subjectName: string;
  lessonType: TeacherProgramLessonType;
  originalTeacherName?: string | null;
  substituteForName?: string | null;
  note?: string | null;
};

export type TeacherDailyProgram = {
  teacherId: string;
  teacherName: string;
  specialty?: string | null;
  status?: string | null;
  lessons: TeacherProgramLesson[];
  totalOriginalLessons: number;
  totalSubstitutions: number;
  totalLessons: number;
};
