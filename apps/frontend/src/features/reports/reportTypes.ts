export type ChartItem = { label: string; value: number };

export type ReportCharts = {
  classes: ChartItem[];
  subjects: ChartItem[];
  teachers: ChartItem[];
};

export type EntityReportDimension = "class" | "student" | "teacher" | "subject" | "homeroom";

export type EntityReportRow = Record<string, string | number | boolean | null>;

export type EntityReportResponse = {
  range: { from: string; to: string };
  dimension: EntityReportDimension;
  totals: Record<string, number>;
  rows: EntityReportRow[];
  chart: ChartItem[];
};

export type SecurityAuditEvent = {
  id: string;
  action: string;
  entity: string;
  path: string;
  method: string;
  createdAt: string;
  details?: Record<string, unknown> | null;
};

export type SecurityIncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SecurityIncidentStatus = "SUSPECTED" | "UNDER_REVIEW" | "CONTAINED" | "RESOLVED" | "CLOSED";

export type SecurityIncidentRow = {
  id: string;
  schoolId: string;
  title: string;
  summary: string;
  severity: SecurityIncidentSeverity;
  status: SecurityIncidentStatus;
  detectedAt: string;
  reportedAt: string;
  notifiedAt: string | null;
  attackVector: string | null;
  evidenceNotes: string | null;
  systemsAffected: string[];
  dataAffected: string[];
  vulnerabilities: string[];
  reportedBy: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SecurityIncidentCreateRequest = {
  title: string;
  summary: string;
  severity: SecurityIncidentSeverity;
  detectedAt?: string;
  systemsAffected: string[];
  dataAffected: string[];
  attackVector?: string | null;
  vulnerabilities: string[];
  evidenceNotes?: string | null;
};

export type SecurityIncidentUpdateRequest = Partial<SecurityIncidentCreateRequest> & {
  status?: SecurityIncidentStatus;
  notifiedAt?: string | null;
};

export type SecurityIncidentListResponse = {
  total: number;
  counts: Record<string, number>;
  items: SecurityIncidentRow[];
};

export type SecurityReport = {
  days: number;
  total: number;
  blockedMultipart: number;
  rateLimited: number;
  text: string;
  events: SecurityAuditEvent[];
  chart: ChartItem[];
  byPath: ChartItem[];
};

export type AttendanceReportRow = {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  day: string;
  status: "PRESENT" | "LATE" | "ABSENT_EXCUSED" | "ABSENT_UNEXCUSED" | "LEFT_EARLY";
  lateAt: string | null;
  leftAt?: string | null;
  createdAt: string;
};

export type AttendanceReportResponse = {
  range: { from: string; to: string };
  classId: string | null;
  totalStudents: number;
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    absentExcused: number;
    absentUnexcused: number;
    earlyExit: number;
  };
  rows: AttendanceReportRow[];
  chart: ChartItem[];
  byClass: ChartItem[];
};

export type GradeReportRow = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  certificateType: string;
  sectionCount: number;
  studentCount: number;
  filledStudents: number;
  updatedAt: string;
};

export type GradeReportDetailRow = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  marks: Record<string, string>;
  filledSections: number;
  totalSections: number;
  completion: number;
};

export type GradeReportResponse = {
  filters: {
    classId: string | null;
    subjectId: string | null;
    certificateType: string | null;
  };
  totals: {
    schemes: number;
    entries: number;
    classes: number;
    subjects: number;
  };
  rows: GradeReportRow[];
  detailedRows: GradeReportDetailRow[];
  summary: {
    byClass: ChartItem[];
    bySubject: ChartItem[];
    byType: ChartItem[];
  };
};

export type ClassroomLogsReportRow = {
  type: "LESSON_TODAY" | "HOMEWORK" | "EXAM";
  id: string;
  date: string;
  day: string;
  teacherName: string;
  className: string;
  subjectName: string;
  title: string;
  details: Record<string, unknown>;
};

export type ClassroomLogsReportResponse = {
  range: { from: string; to: string };
  classId: string | null;
  totals: {
    lessons: number;
    homework: number;
    exams: number;
    all: number;
  };
  rows: ClassroomLogsReportRow[];
  summary: {
    byType: ChartItem[];
    byClass: ChartItem[];
  };
};

export type ReportExportRequest = {
  reportType: "attendance" | "grades" | "classroom-logs" | "security" | "daily";
  title: string;
  fileName: string;
  kind: "PDF" | "HTML" | "XLSX";
  permission: "read" | "manageTeachers" | "manageSchedules" | "manageSettings" | "manageLicense" | "manageLessons";
  expiresInMinutes?: number;
  privacyWarningAccepted: true;
  filters?: Record<string, unknown>;
};

export type ReportExportResponse = {
  ok: boolean;
  expiresAt: string;
  reportType: string;
};

export type SchoolOperationReportItem = {
  id: string;
  reportType: string;
  fileType: string;
  filePath: string;
  requestedBy: string | null;
  requestedByName: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
};

export type SchoolBackupJobItem = {
  id: string;
  backupType: string;
  filePath: string;
  checksum: string;
  encrypted: boolean;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
};

export type SchoolOperationsResponse = {
  schoolId: string;
  generatedAt: string;
  school: {
    id: string;
    name: string | null;
    institutionCode: string | null;
  };
  auditLogExport: {
    path: string;
    format: string;
    privacyWarning: boolean;
    expiresImmediately: boolean;
  };
  reportExports: SchoolOperationReportItem[];
  backupJobs: SchoolBackupJobItem[];
};
