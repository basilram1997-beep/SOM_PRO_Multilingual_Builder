import type {
  SchoolClass,
  Student,
  StudentAcademicRecord as SharedStudentAcademicRecord,
  StudentAttendance,
  StudentBehaviorRecord as SharedStudentBehaviorRecord,
  Subject
} from "@som/shared";

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT_EXCUSED" | "ABSENT_UNEXCUSED" | "LEFT_EARLY";

export type StudentRow = Student & {
  id: string;
  class?: SchoolClass | null;
};

export type StudentImportRow = Omit<Student, "id" | "classId">;

export type AttendanceRecord = StudentAttendance & {
  id: string;
};

export type StudentNotificationRow = {
  id: string;
  schoolId: string;
  studentId: string | null;
  studentName: string | null;
  eventType: string;
  channel: string;
  recipientType: string;
  status: string;
  title: string;
  message: string;
  recipientPhones: Array<{ label: string; phone: string }>;
  recipientNames?: Array<{ label: string; name: string | null }> | null;
  payload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentNotificationListResponse = StudentNotificationRow[];

export type StudentNotificationMessageForm = {
  classId: string;
  title: string;
  message: string;
};

export type TeacherPermissionStatus = "ABSENT" | "LATE" | "LEFT" | "UNAVAILABLE";

export type TeacherPermissionForm = {
  date: string;
  day: string;
  status: TeacherPermissionStatus;
  fromPeriod: number;
  toPeriod: number;
  reason: string;
  note: string;
};

export type TeacherPermissionRow = StudentNotificationRow & {
  payload?: {
    teacherId?: string;
    teacherName?: string;
    date?: string;
    day?: string;
    status?: TeacherPermissionStatus;
    fromPeriod?: number;
    toPeriod?: number;
    reason?: string;
    note?: string;
  } | null;
};

export type StudentPledgeForm = {
  classId: string;
  studentId: string;
  date: string;
  title: string;
  pledgeText: string;
  note: string;
  homeroomTeacherName: string;
  principalName: string;
};

export type StudentPledgeRow = StudentNotificationRow & {
  payload?: {
    classId?: string;
    className?: string;
    studentName?: string;
    date?: string;
    title?: string;
    pledgeText?: string;
    note?: string;
    homeroomTeacherName?: string;
    principalName?: string;
  } | null;
};

export type StudentAttendanceRow = StudentRow & {
  attendance: AttendanceRecord | null;
};

export type AcademicRow = StudentRow & {
  academic: SharedStudentAcademicRecord | null;
};

export type AcademicSubjectSummary = {
  subjectId: string;
  subjectName: string;
  total: number;
  positive: number;
  negative: number;
};

export type AcademicListResponse = {
  rows: AcademicRow[];
  summary: {
    total: number;
    positive: number;
    negative: number;
  };
  subjectSummary: AcademicSubjectSummary[];
};

export type StudentAcademicForm = SharedStudentAcademicRecord & {
  classId?: string;
};

export type StudentAcademicRecord = SharedStudentAcademicRecord;

export type StudentBehaviorRecord = SharedStudentBehaviorRecord;

export type BehaviorRow = StudentRow & {
  behaviorRecords: StudentBehaviorRecord[];
};

export type BehaviorCategorySummary = {
  category: string;
  total: number;
  positive: number;
  negative: number;
};

export type BehaviorListResponse = {
  rows: BehaviorRow[];
  summary: {
    total: number;
    positive: number;
    negative: number;
  };
  categorySummary: BehaviorCategorySummary[];
};

export type StudentContextResponse = {
  student: StudentRow | null;
  class: SchoolClass | null;
  subjects: Subject[];
};

export type StudentBehaviorForm = StudentBehaviorRecord & {
  classId?: string;
};

export const emptyStudentForm: Student = {
  name: "",
  nationalId: "",
  classId: "",
  fatherName: "",
  motherName: "",
  residence: "",
  fatherPhone: "",
  motherPhone: "",
  guardianPhone: "",
  healthFund: "",
  studentPhone: ""
};

export const emptyAcademicForm: StudentAcademicForm = {
  studentId: "",
  subjectId: "",
  date: new Date().toISOString().slice(0, 10),
  day: "",
  tone: "POSITIVE",
  strengths: "",
  weaknesses: "",
  assignments: "",
  lessonProgress: "",
  certificate: "",
  note: ""
};

export const emptyBehaviorForm: StudentBehaviorForm = {
  studentId: "",
  date: new Date().toISOString().slice(0, 10),
  day: "",
  category: "",
  tone: "POSITIVE",
  template: "",
  note: ""
};

export const emptyTeacherPermissionForm: TeacherPermissionForm = {
  date: new Date().toISOString().slice(0, 10),
  day: "",
  status: "ABSENT",
  fromPeriod: 1,
  toPeriod: 1,
  reason: "",
  note: ""
};

export const emptyPledgeForm: StudentPledgeForm = {
  classId: "",
  studentId: "",
  date: new Date().toISOString().slice(0, 10),
  title: "تعهد طالب وولي أمر",
  pledgeText: "",
  note: "",
  homeroomTeacherName: "",
  principalName: ""
};
