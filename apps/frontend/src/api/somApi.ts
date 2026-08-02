import { api } from "./http";
import type { AuthUser } from "../features/auth/authTypes";
import type { ArchiveRow } from "../features/archive/archiveTypes";
import type { DailyLoadResult } from "../features/daily/dailyScheduleHelpers";
import type { DailyBaseSlot, DailyEvent, DailySubstitution, TeacherProgram } from "../features/daily/dailyTypes";
import type { DutyRow } from "../features/duties/dutiesTypes";
import type { LessonTodayResponse, LessonTodayForm, LessonTodayRow } from "../features/lessons/lessonTodayTypes";
import type {
  HomeworkPreparationForm,
  HomeworkPreparationResponse,
  HomeworkSubmissionForm,
  HomeworkSubmissionListResponse,
  HomeworkPreparationRow,
  HomeworkPreparationDetailRow
} from "../features/lessons/homeworkPreparationTypes";
import type {
  ExamScheduleForm,
  ExamScheduleResponse,
  ExamScheduleSaveResponse
} from "../features/lessons/examScheduleTypes";
import type {
  AcademicListResponse,
  AttendanceRecord,
  BehaviorListResponse,
  StudentAcademicForm,
  StudentAcademicRecord,
  StudentAttendanceRow,
  StudentBehaviorForm,
  StudentBehaviorRecord,
  StudentContextResponse,
  StudentImportRow,
  StudentNotificationListResponse,
  StudentNotificationMessageForm,
  StudentPledgeForm,
  StudentPledgeRow,
  StudentRow,
  TeacherPermissionForm,
  TeacherPermissionRow
} from "../features/students/studentTypes";
import type { CertificateStudentContext } from "../features/students/studentCertificateTypes";
import type {
  GradeEntry,
  GradeScheme,
  GradeSchemeContextResponse,
  GradeSchemeResponse
} from "../features/students/gradeEntryTypes";
import type {
  AttendanceReportResponse,
  ClassroomLogsReportResponse,
  ChartItem,
  EntityReportResponse,
  GradeReportResponse,
  ReportCharts,
  ReportExportRequest,
  ReportExportResponse,
  SchoolOperationsResponse,
  SecurityIncidentCreateRequest,
  SecurityIncidentListResponse,
  SecurityIncidentRow,
  SecurityIncidentUpdateRequest,
  SecurityReport
} from "../features/reports/reportTypes";
import type { OperatorHealthResponse } from "../features/operatorHealth/operatorHealthTypes";
import type { SchoolInfo, SettingPeriod } from "../features/settings/settingsTypes";
import type {
  Teacher,
  SchoolClass,
  Subject,
  GenerateDailyScheduleInput,
  SchoolSettings,
  PeriodDefinition,
  HomeroomAssignment,
  DutyAssignment,
  Student,
  StudentAttendance,
  StudentCertificate
} from "@som/shared";

type BootstrapLicenseResponse = {
  ok: boolean;
  adminAccount: { name?: string; email?: string; password?: string; role?: string } | null;
  adminUser: { id?: string; schoolId?: string; name?: string; email?: string; role?: string } | null;
};

type LicenseState = {
  id?: string;
  status?: string;
  plan?: string;
  expiresAt?: string;
  readOnly?: boolean;
  readOnlyReason?: string | null;
  gracePeriodUntil?: string | null;
  deviceFingerprint?: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  maxDevices?: number;
  activeDevicesCount?: number | null;
  schoolName?: string | null;
  institutionCode?: string | null;
  message?: string | null;
  serverTime?: string | null;
};

type ScheduleSlot = DailyBaseSlot;
type ScheduleSwapPreview = {
  ok: boolean;
  conflicts: string[];
  canSwap: boolean;
  affectedPeriods: number[];
};
type ScheduleCopyPreview = {
  ok: boolean;
  conflicts: string[];
  canCopy: boolean;
  copiedCount: number;
};

type TeacherProgramsResponse = {
  daily: { id: string; date: string; day: string; createdAt?: string | Date; updatedAt?: string | Date } | null;
  programs: TeacherProgram[];
};

type ReportResponse = {
  text: string;
  chart: ChartItem[];
  charts: ReportCharts;
};

type UserRow = AuthUser;
type SettingsResponse = { settings: SchoolSettings; school: SchoolInfo | null; periods: SettingPeriod[] };
type ArchiveListItem = ArchiveRow;
type DutyListItem = DutyRow;
type DailyResponse = DailyLoadResult;
type CreateEventResponse = DailyEvent[];
type ApiRecord = Record<string, unknown>;

function optionalLoginLicenseFields(licenseCode?: string) {
  const clean = String(licenseCode || "").trim();
  return clean ? { licenseCode: clean, licenseKey: clean } : {};
}

export const somApi = {
  auth: {
    login: (email: string, password: string, licenseCode?: string) =>
      api.post<{ data: { token: string; user: AuthUser } }>("/api/auth/login", {
        email,
        password,
        ...optionalLoginLicenseFields(licenseCode)
      }),
    register: (data: {
      name: string;
      email: string;
      password: string;
      role: "STUDENT" | "PARENT" | "TEACHER";
      licenseCode?: string;
    }) =>
      api.post<{ data: { token: string; user: AuthUser } }>("/api/auth/register", {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        ...optionalLoginLicenseFields(data.licenseCode)
      }),
    me: () => api.get<{ data: { user: AuthUser } }>("/api/auth/me"),
    bootstrapLicense: (licenseCode: string) =>
      api.post<{ data: BootstrapLicenseResponse }>(
        "/api/auth/bootstrap-license",
        optionalLoginLicenseFields(licenseCode)
      ),
    recover: (licenseCode: string, email?: string) =>
      api.post<{ data: { email: string; temporaryPassword: string; name: string } }>("/api/auth/recover", {
        ...optionalLoginLicenseFields(licenseCode),
        ...(String(email || "").trim() ? { email } : {})
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post<{ data: { ok: boolean } }>("/api/auth/change-password", { currentPassword, newPassword })
  },
  license: {
    status: () => api.get<{ data: LicenseState }>("/api/license/status"),
    activate: (licenseCode: string) =>
      api.post<{ data: LicenseState }>("/api/license/activate", optionalLoginLicenseFields(licenseCode))
  },
  stats: {
    get: (date?: string) => api.get<{ data: ApiRecord }>(`/api/stats${date ? `?date=${encodeURIComponent(date)}` : ""}`)
  },
  settings: {
    get: () => api.get<{ data: SettingsResponse }>("/api/settings"),
    update: (data: SchoolSettings) => api.patch<{ data: SchoolSettings }>("/api/settings", data),
    updateSchool: (data: SchoolInfo) => api.patch<{ data: SchoolInfo }>("/api/settings/school", data),
    updatePeriods: (data: PeriodDefinition[]) => api.put<{ data: SettingPeriod[] }>("/api/settings/periods", data),
    users: () => api.get<{ data: UserRow[] }>("/api/settings/users"),
    suggestUsername: (role: string) =>
      api.get<{ data: { username: string; role: string } }>(
        `/api/settings/users/suggest-username?role=${encodeURIComponent(role)}`
      ),
    createUser: (data: { name: string; email: string; password: string; role: string; studentId?: string | null }) =>
      api.post<{ data: UserRow }>("/api/settings/users", data),
    removeUser: (id: string) => api.delete<void>(`/api/settings/users/${id}`)
  },
  teachers: {
    list: () => api.get<{ data: Teacher[] }>("/api/teachers"),
    create: (data: Teacher) => api.post<{ data: Teacher }>("/api/teachers", data),
    update: (id: string, data: Partial<Teacher>) => api.patch<{ data: Teacher }>(`/api/teachers/${id}`, data),
    assignSubject: (teacherId: string, data: { classId: string; subjectId: string; weeklyPeriods?: number }) =>
      api.post<{ data: ApiRecord }>(`/api/teachers/${teacherId}/assign-subject`, data),
    permissions: {
      list: (limit = 20) =>
        api.get<{ data: TeacherPermissionRow[] }>(
          `/api/teachers/permissions?limit=${encodeURIComponent(String(limit))}`
        ),
      save: (data: TeacherPermissionForm) => api.post<{ data: TeacherPermissionRow }>("/api/teachers/permissions", data)
    },
    removeAssignment: (teacherId: string, assignmentId: string) =>
      api.delete<void>(`/api/teachers/${teacherId}/assignments/${assignmentId}`),
    updateAssignmentWeeklyPeriods: (teacherId: string, assignmentId: string, weeklyPeriods: number) =>
      api.patch<{ data: ApiRecord }>(`/api/teachers/${teacherId}/assignments/${assignmentId}/weekly-periods`, {
        weeklyPeriods
      }),
    remove: (id: string) => api.delete<void>(`/api/teachers/${id}`)
  },
  students: {
    list: (classId?: string) =>
      api.get<{ data: StudentRow[] }>(`/api/students${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`),
    context: (id: string) =>
      api.get<{ data: StudentContextResponse }>(`/api/students/${encodeURIComponent(id)}/context`),
    create: (data: Student) => api.post<{ data: StudentRow }>("/api/students", data),
    update: (id: string, data: Student) => api.patch<{ data: StudentRow }>(`/api/students/${id}`, data),
    move: (id: string, classId: string) => api.post<{ data: StudentRow }>(`/api/students/${id}/move`, { classId }),
    remove: (id: string) => api.delete<void>(`/api/students/${id}`),
    import: (classId: string, students: StudentImportRow[]) =>
      api.post<{ data: { created: number; updated: number; total: number; students: StudentRow[] } }>(
        "/api/students/import",
        { classId, students }
      ),
    attendance: (classId: string, date: string) =>
      api.get<{ data: StudentAttendanceRow[] }>(
        `/api/students/attendance?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`
      ),
    markAttendance: (data: StudentAttendance) => api.put<{ data: AttendanceRecord }>("/api/students/attendance", data),
    notifications: (classId?: string, limit = 20, eventType?: string) => {
      const params = new URLSearchParams();
      if (classId) params.set("classId", classId);
      if (eventType) params.set("eventType", eventType);
      params.set("limit", String(limit));
      const query = params.toString();
      return api.get<{ data: StudentNotificationListResponse }>(
        `/api/students/notifications${query ? `?${query}` : ""}`
      );
    },
    sendMessage: (data: StudentNotificationMessageForm) =>
      api.post<{ data: { created: number } }>("/api/students/notifications/message", data),
    pledges: {
      list: (classId?: string, limit = 20) => {
        const params = new URLSearchParams();
        if (classId) params.set("classId", classId);
        params.set("limit", String(limit));
        const query = params.toString();
        return api.get<{ data: StudentPledgeRow[] }>(`/api/students/pledges${query ? `?${query}` : ""}`);
      },
      save: (data: StudentPledgeForm) => api.post<{ data: StudentPledgeRow | null }>("/api/students/pledges", data)
    },
    archiveAttendance: (data: { classId: string; date: string; day: string }) =>
      api.post<{
        data: {
          date: string;
          day: string;
          classId: string;
          className: string;
          homeroomTeacherName: string | null;
          totalStudents: number;
          recordedStudents: number;
          issues: number;
          present: number;
          late: number;
          absent: number;
          absentExcused: number;
          absentUnexcused: number;
          earlyExit: number;
          savedAt: string;
        };
      }>("/api/students/attendance/archive", data),
    academic: {
      list: (classId: string, subjectId: string, date: string) =>
        api.get<{ data: AcademicListResponse }>(
          `/api/students/academic?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}&date=${encodeURIComponent(date)}`
        ),
      save: (data: StudentAcademicForm) => api.put<{ data: StudentAcademicRecord }>("/api/students/academic", data)
    },
    behavior: {
      list: (classId: string, date: string) =>
        api.get<{ data: BehaviorListResponse }>(
          `/api/students/behavior?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`
        ),
      save: (data: StudentBehaviorForm) => api.put<{ data: StudentBehaviorRecord }>("/api/students/behavior", data),
      clear: (studentId: string, classId: string, date: string) =>
        api.delete<{ data: { ok: boolean; deleted: number } }>(
          `/api/students/behavior?studentId=${encodeURIComponent(studentId)}&classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`
        )
    },
    certificate: {
      get: (studentId: string, certificateType: string, academicYear: string) =>
        api.get<{ data: StudentCertificate | null }>(
          `/api/students/certificates?studentId=${encodeURIComponent(studentId)}&certificateType=${encodeURIComponent(certificateType)}&academicYear=${encodeURIComponent(academicYear)}`
        ),
      context: (studentId: string) =>
        api.get<{ data: CertificateStudentContext }>(
          `/api/students/certificates/context?studentId=${encodeURIComponent(studentId)}`
        ),
      save: (data: StudentCertificate) => api.post<{ data: StudentCertificate }>("/api/students/certificates", data)
    },
    gradeSchemes: {
      context: () => api.get<{ data: GradeSchemeContextResponse }>("/api/students/grade-schemes/context"),
      get: (classId: string, subjectId: string, certificateType: string) =>
        api.get<GradeSchemeResponse>(
          `/api/students/grade-schemes?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}&certificateType=${encodeURIComponent(certificateType)}`
        ),
      save: (data: GradeScheme) => api.post<{ data: GradeScheme }>("/api/students/grade-schemes", data)
    },
    gradeEntries: {
      get: (classId: string, subjectId: string, certificateType: string) =>
        api.get<{ data: GradeEntry | null }>(
          `/api/students/grade-entries?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}&certificateType=${encodeURIComponent(certificateType)}`
        ),
      save: (data: GradeEntry) => api.post<{ data: GradeEntry }>("/api/students/grade-entries", data)
    }
  },
  classes: {
    list: () => api.get<{ data: SchoolClass[] }>("/api/classes"),
    create: (data: SchoolClass) => api.post<{ data: SchoolClass }>("/api/classes", data),
    update: (id: string, data: Partial<SchoolClass>) => api.patch<{ data: SchoolClass }>(`/api/classes/${id}`, data),
    remove: async (id: string) => {
      try {
        await api.delete<void>(`/api/classes/${id}`);
      } catch {
        await api.post<void>(`/api/classes/${id}/delete`, {});
      }
    }
  },
  subjects: {
    list: () => api.get<{ data: Subject[] }>("/api/subjects")
  },
  duties: {
    list: () => api.get<{ data: DutyListItem[] }>("/api/duties"),
    save: (data: DutyAssignment) => api.post<{ data: DutyListItem }>("/api/duties", data),
    remove: (id: string) => api.delete<void>(`/api/duties/${id}`),
    daily: (date: string, day?: string) =>
      api.get<{ data: DutyListItem[] }>(`/api/duties/daily/${date}${day ? `?day=${encodeURIComponent(day)}` : ""}`)
  },
  homeroom: {
    list: () => api.get<{ data: HomeroomAssignment[] }>("/api/homeroom"),
    save: (data: HomeroomAssignment) => api.post<{ data: ApiRecord }>("/api/homeroom", data),
    remove: (id: string) => api.delete<void>(`/api/homeroom/${id}`),
    applyToBaseSchedule: (overwriteConflicts = false, classIds: string[] = []) =>
      api.post<{ data: { applied: number; conflicts: string[]; slots: ApiRecord[] } }>(
        "/api/homeroom/apply-to-base-schedule",
        { overwriteConflicts, classIds }
      )
  },
  lessons: {
    today: {
      list: (date: string, teacherId?: string) =>
        api.get<{ data: LessonTodayResponse }>(
          `/api/lessons?date=${encodeURIComponent(date)}${teacherId ? `&teacherId=${encodeURIComponent(teacherId)}` : ""}`
        ),
      save: (data: LessonTodayForm) => api.post<{ data: LessonTodayRow }>("/api/lessons", data),
      remove: (id: string) => api.delete<void>(`/api/lessons/${id}`)
    }
  },
  homework: {
    list: (date: string, teacherId?: string) =>
      api.get<{ data: HomeworkPreparationResponse }>(
        `/api/lessons/homework?date=${encodeURIComponent(date)}${teacherId ? `&teacherId=${encodeURIComponent(teacherId)}` : ""}`
      ),
    save: (data: HomeworkPreparationForm) => api.post<{ data: HomeworkPreparationRow }>("/api/lessons/homework", data),
    remove: (id: string) => api.delete<void>(`/api/lessons/homework/${id}`),
    submissions: (id: string) =>
      api.get<{ data: HomeworkSubmissionListResponse }>(`/api/lessons/homework/${id}/submissions`),
    saveSubmissions: (id: string, data: { submissions: HomeworkSubmissionForm[] }) =>
      api.put<{ data: HomeworkPreparationDetailRow }>(`/api/lessons/homework/${id}/submissions`, data)
  },
  exams: {
    list: (date: string, teacherId?: string) =>
      api.get<{ data: ExamScheduleResponse }>(
        `/api/lessons/exams?date=${encodeURIComponent(date)}${teacherId ? `&teacherId=${encodeURIComponent(teacherId)}` : ""}`
      ),
    save: (data: ExamScheduleForm) => api.post<{ data: ExamScheduleSaveResponse }>("/api/lessons/exams", data),
    remove: (id: string) => api.delete<void>(`/api/lessons/exams/${id}`)
  },
  schedules: {
    base: (day?: string) =>
      api.get<{ data: ScheduleSlot[] }>(`/api/schedules/base${day ? `?day=${encodeURIComponent(day)}` : ""}`),
    saveBase: (data: {
      day: string;
      period: number;
      classId: string;
      subjectId: string;
      teacherId: string;
      room?: string | null;
      expectedUpdatedAt?: string | null;
    }) => api.post<{ data: ScheduleSlot }>("/api/schedules/base", data),
    copyWeek: (data: { fromDay: string; toDay: string; overwriteConflicts?: boolean }) =>
      api.post<{ data: { copied: number; slots: ScheduleSlot[] } }>("/api/schedules/base/copy-week", data),
    previewCopyWeek: (data: { fromDay: string; toDay: string; overwriteConflicts?: boolean }) =>
      api.post<{ data: ScheduleCopyPreview }>("/api/schedules/base/copy-week/preview", data),
    swapPeriods: (data: { day: string; classId: string; firstPeriod: number; secondPeriod: number }) =>
      api.post<{ data: { swapped: number } }>("/api/schedules/base/swap-periods", data),
    previewSwapPeriods: (data: { day: string; classId: string; firstPeriod: number; secondPeriod: number }) =>
      api.post<{ data: ScheduleSwapPreview }>("/api/schedules/base/swap-periods/preview", data),
    validateBase: () => api.post<{ data: { ok: boolean; conflicts: string[] } }>("/api/schedules/base/validate")
  },
  daily: {
    generate: (data: GenerateDailyScheduleInput) => api.post<{ data: DailyResponse }>("/api/daily/generate", data),
    get: (date: string) => api.get<{ data: DailyResponse }>(`/api/daily/${date}`),
    generateTeacherPrograms: (date: string, options?: { day?: string }) =>
      api.post<{ data: TeacherProgramsResponse }>(`/api/daily/${date}/teacher-programs/generate`, options || {}),
    teacherPrograms: (date: string) =>
      api.get<{ data: TeacherProgramsResponse }>(`/api/daily/${date}/teacher-programs`),
    updateSubstitution: (id: string, substituteTeacherId: string | null) =>
      api.patch<{ data: DailySubstitution }>(`/api/daily/substitutions/${id}`, { substituteTeacherId }),
    createEvent: (date: string, data: Record<string, unknown>) =>
      api.post<{ data: CreateEventResponse }>(`/api/daily/${date}/events`, data),
    removeEvent: (id: string) => api.delete<void>(`/api/daily/events/${id}`)
  },
  archive: {
    list: () => api.get<{ data: ArchiveListItem[] }>("/api/archive"),
    archiveDay: (date: string) => api.post<{ data: ApiRecord }>(`/api/archive/${date}`, {}),
    removeDay: (date: string) => api.delete<void>(`/api/archive/${date}`)
  },
  auditLogs: {
    export: (filters?: { action?: string; entity?: string; entityId?: string; from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (filters?.action) params.set("action", filters.action);
      if (filters?.entity) params.set("entity", filters.entity);
      if (filters?.entityId) params.set("entityId", filters.entityId);
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      const query = params.toString();
      return api.download(`/api/audit-logs/export${query ? `?${query}` : ""}`);
    }
  },
  reports: {
    daily: (date: string, language?: string) =>
      api.get<{ data: ReportResponse }>(
        `/api/reports/daily/${date}${language ? `?lang=${encodeURIComponent(language)}` : ""}`
      ),
    security: (days = 7, language?: string) =>
      api.get<{ data: SecurityReport }>(
        `/api/reports/security?days=${encodeURIComponent(days)}${language ? `&lang=${encodeURIComponent(language)}` : ""}`
      ),
    securityIncidents: (filters?: { limit?: number; status?: string; severity?: string }) => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.status) params.set("status", filters.status);
      if (filters?.severity) params.set("severity", filters.severity);
      const query = params.toString();
      return api.get<{ data: SecurityIncidentListResponse }>(`/api/security-incidents${query ? `?${query}` : ""}`);
    },
    createSecurityIncident: (data: SecurityIncidentCreateRequest) =>
      api.post<{ data: SecurityIncidentRow }>("/api/security-incidents", data),
    updateSecurityIncident: (id: string, data: SecurityIncidentUpdateRequest) =>
      api.patch<{ data: SecurityIncidentRow }>(`/api/security-incidents/${id}`, data),
    attendance: (filters: { from?: string; to?: string; classId?: string }) => {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.classId) params.set("classId", filters.classId);
      const query = params.toString();
      return api.get<{ data: AttendanceReportResponse }>(`/api/reports/attendance${query ? `?${query}` : ""}`);
    },
    grades: (filters: { classId?: string; subjectId?: string; certificateType?: string }) => {
      const params = new URLSearchParams();
      if (filters.classId) params.set("classId", filters.classId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.certificateType) params.set("certificateType", filters.certificateType);
      const query = params.toString();
      return api.get<{ data: GradeReportResponse }>(`/api/reports/grades${query ? `?${query}` : ""}`);
    },
    classroomLogs: (filters: { from?: string; to?: string; classId?: string }) => {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.classId) params.set("classId", filters.classId);
      const query = params.toString();
      return api.get<{ data: ClassroomLogsReportResponse }>(`/api/reports/classroom-logs${query ? `?${query}` : ""}`);
    },
    summary: (filters: {
      dimension: "class" | "student" | "teacher" | "subject" | "homeroom";
      from?: string;
      to?: string;
      classId?: string;
      studentId?: string;
      teacherId?: string;
      subjectId?: string;
    }) => {
      const params = new URLSearchParams();
      params.set("dimension", filters.dimension);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.classId) params.set("classId", filters.classId);
      if (filters.studentId) params.set("studentId", filters.studentId);
      if (filters.teacherId) params.set("teacherId", filters.teacherId);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      const query = params.toString();
      return api.get<{ data: EntityReportResponse }>(`/api/reports/summary${query ? `?${query}` : ""}`);
    },
    export: (data: ReportExportRequest) => api.post<{ data: ReportExportResponse }>("/api/reports/export", data),
    recordExport: (data: {
      page: string;
      title: string;
      fileName: string;
      kind: "PDF" | "HTML" | "XLSX";
      permission: "read" | "manageTeachers" | "manageSchedules" | "manageSettings" | "manageLicense" | "manageLessons";
      expiresInMinutes?: number;
      privacyWarningAccepted: true;
    }) => api.post<{ data: { ok: boolean; expiresAt: string } }>("/api/reports/export-events", data)
  },
  schools: {
    operations: () => api.get<{ data: SchoolOperationsResponse }>("/api/schools/operations"),
    operatorHealth: () => api.get<{ data: OperatorHealthResponse }>("/api/schools/operator-health")
  }
};
