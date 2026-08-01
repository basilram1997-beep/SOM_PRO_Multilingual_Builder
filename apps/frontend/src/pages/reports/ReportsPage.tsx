import { useEffect, useMemo, useState } from "react";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { exportSectionPdf } from "../../features/daily/dailyHelpers";
import { buildExportNotice } from "../../features/exports/exportAudit";
import { ReportHorizontalChart } from "../../features/reports/ReportHorizontalChart";
import { ReportPieChart } from "../../features/reports/ReportPieChart";
import { ReportVerticalChart } from "../../features/reports/ReportVerticalChart";
import { chartTitle } from "../../features/reports/reportLabels";
import { SecurityMonitoringPanel } from "../../features/reports/SecurityMonitoringPanel";
import { useReports } from "../../features/reports/useReports";
import { useSecurityMonitoring } from "../../features/reports/useSecurityMonitoring";
import type {
  AttendanceReportResponse,
  ClassroomLogsReportResponse,
  EntityReportResponse,
  GradeReportResponse
} from "../../features/reports/reportTypes";
import { gradeCertificateTypeOptions } from "../../features/students/gradeEntryTypes";

type ReportTab = "daily" | "attendance" | "grades" | "classroomLogs" | "summary" | "security";
type SummaryDimension = "class" | "teacher" | "subject" | "homeroom";
type LookupOption = { id: string; name: string };

const reportTabs: Array<{ key: ReportTab; labelKey: string }> = [
  { key: "daily", labelKey: "reports.tabDaily" },
  { key: "attendance", labelKey: "reports.tabAttendance" },
  { key: "grades", labelKey: "reports.tabGrades" },
  { key: "classroomLogs", labelKey: "reports.tabClassroomLogs" },
  { key: "summary", labelKey: "reports.tabScheduleStaff" },
  { key: "security", labelKey: "reports.tabSecurity" }
];

const summaryDimensionOptions: Array<{ value: SummaryDimension; labelKey: string }> = [
  { value: "class", labelKey: "reports.summaryDimensionClass" },
  { value: "teacher", labelKey: "reports.summaryDimensionTeacher" },
  { value: "subject", labelKey: "reports.summaryDimensionSubject" },
  { value: "homeroom", labelKey: "reports.summaryDimensionHomeroom" }
];

const summaryColumnKeys: Record<SummaryDimension, Array<{ key: string; labelKey: string }>> = {
  class: [
    { key: "name", labelKey: "reports.summaryName" },
    { key: "gradeLevel", labelKey: "reports.summaryGradeLevel" },
    { key: "homeroomTeacherName", labelKey: "reports.summaryHomeroomTeacher" },
    { key: "studentCount", labelKey: "reports.summaryStudents" },
    { key: "attendanceCount", labelKey: "reports.summaryAttendance" },
    { key: "gradeCount", labelKey: "reports.summaryGrades" },
    { key: "lessonCount", labelKey: "reports.summaryLessons" },
    { key: "homeworkCount", labelKey: "reports.summaryHomework" },
    { key: "examCount", labelKey: "reports.summaryExams" }
  ],
  teacher: [
    { key: "name", labelKey: "reports.summaryName" },
    { key: "assignmentCount", labelKey: "reports.summaryAssignments" },
    { key: "homeroomCount", labelKey: "reports.summaryHomeroomAssignments" },
    { key: "lessonCount", labelKey: "reports.summaryLessons" },
    { key: "homeworkCount", labelKey: "reports.summaryHomework" },
    { key: "examCount", labelKey: "reports.summaryExams" },
    { key: "dutyCount", labelKey: "reports.summaryDuties" },
    { key: "statusCount", labelKey: "reports.summaryStatuses" },
    { key: "substitutionCount", labelKey: "reports.summarySubstitutions" }
  ],
  subject: [
    { key: "name", labelKey: "reports.summaryName" },
    { key: "code", labelKey: "reports.summaryCode" },
    { key: "lessonCount", labelKey: "reports.summaryLessons" },
    { key: "homeworkCount", labelKey: "reports.summaryHomework" },
    { key: "examCount", labelKey: "reports.summaryExams" },
    { key: "gradeEntryCount", labelKey: "reports.summaryGrades" }
  ],
  homeroom: [
    { key: "teacherName", labelKey: "reports.summaryTeacher" },
    { key: "className", labelKey: "reports.summaryClass" },
    { key: "weeklyDay", labelKey: "reports.summaryDay" },
    { key: "weeklyPeriod", labelKey: "reports.summaryPeriod" },
    { key: "isActive", labelKey: "reports.summaryActive" }
  ]
};

const summaryTotalLabelMap: Record<string, string> = {
  classes: "reports.totalClasses",
  teachers: "reports.totalTeachers",
  subjects: "reports.totalSubjects",
  homeroomAssignments: "reports.totalHomeroomAssignments",
  students: "reports.totalStudents",
  attendance: "reports.totalRecords",
  grades: "reports.totalEntries",
  lessons: "reports.summaryLessons",
  homework: "reports.summaryHomework",
  exams: "reports.summaryExams"
};

function isoDateShift(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function metric(value: number | string, label: string) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function summaryRowValue(value: unknown, language: string) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value
      ? language === "en"
        ? "Yes"
        : language === "he"
          ? "כן"
          : "نعم"
      : language === "en"
        ? "No"
        : language === "he"
          ? "לא"
          : "لا";
  }
  return String(value);
}

export function ReportsPage() {
  const { t, language } = useI18n();
  const daily = useReports(language);
  const security = useSecurityMonitoring(language);
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [classes, setClasses] = useState<LookupOption[]>([]);
  const [subjects, setSubjects] = useState<LookupOption[]>([]);
  const [teachers, setTeachers] = useState<LookupOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState("");

  const [attendanceFrom, setAttendanceFrom] = useState(isoDateShift(-6));
  const [attendanceTo, setAttendanceTo] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceClassId, setAttendanceClassId] = useState("");
  const [attendanceData, setAttendanceData] = useState<AttendanceReportResponse | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  const [gradesClassId, setGradesClassId] = useState("");
  const [gradesSubjectId, setGradesSubjectId] = useState("");
  const [gradesCertificateType, setGradesCertificateType] = useState("TERM1_BIMONTHLY");
  const [gradesData, setGradesData] = useState<GradeReportResponse | null>(null);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError] = useState("");

  const [logsFrom] = useState(isoDateShift(-6));
  const [logsTo] = useState(new Date().toISOString().slice(0, 10));
  const [logsClassId, setLogsClassId] = useState("");
  const [logsData, setLogsData] = useState<ClassroomLogsReportResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const [summaryDimension, setSummaryDimension] = useState<SummaryDimension>("teacher");
  const [summaryFrom, setSummaryFrom] = useState(isoDateShift(-6));
  const [summaryTo, setSummaryTo] = useState(new Date().toISOString().slice(0, 10));
  const [summaryClassId, setSummaryClassId] = useState("");
  const [summaryTeacherId, setSummaryTeacherId] = useState("");
  const [summarySubjectId, setSummarySubjectId] = useState("");
  const [summaryData, setSummaryData] = useState<EntityReportResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const attendanceClassName = useMemo(
    () => classes.find((item) => item.id === attendanceClassId)?.name || "",
    [attendanceClassId, classes]
  );

  useEffect(() => {
    void daily.load();
  }, [daily.load]);

  useEffect(() => {
    let canceled = false;
    setLookupsLoading(true);
    setLookupsError("");
    void Promise.all([somApi.classes.list(), somApi.subjects.list(), somApi.teachers.list()])
      .then(([classesRes, subjectsRes, teachersRes]) => {
        if (canceled) return;
        setClasses(
          sortSchoolClasses(
            (classesRes.data || [])
              .map((item) => ({ id: item.id || "", name: item.name || "" }))
              .filter((item) => item.id && item.name)
          )
        );
        setSubjects(
          (subjectsRes.data || [])
            .map((item) => ({ id: item.id || "", name: item.name || "" }))
            .filter((item) => item.id && item.name)
        );
        setTeachers(
          (teachersRes.data || [])
            .map((item) => ({ id: item.id || "", name: item.name || "" }))
            .filter((item) => item.id && item.name)
        );
      })
      .catch(() => {
        if (!canceled) setLookupsError(t("reports.lookupsFailed"));
      })
      .finally(() => {
        if (!canceled) setLookupsLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [t]);

  async function loadAttendance() {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const response = await somApi.reports.attendance({
        from: attendanceFrom,
        to: attendanceTo,
        classId: attendanceClassId || undefined
      });
      setAttendanceData(response.data);
    } catch {
      setAttendanceData(null);
      setAttendanceError(t("reports.loadFailed"));
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function loadGrades() {
    setGradesLoading(true);
    setGradesError("");
    try {
      const response = await somApi.reports.grades({
        classId: gradesClassId || undefined,
        subjectId: gradesSubjectId || undefined,
        certificateType: gradesCertificateType || undefined
      });
      setGradesData(response.data);
    } catch {
      setGradesData(null);
      setGradesError(t("reports.loadFailed"));
    } finally {
      setGradesLoading(false);
    }
  }

  async function loadClassroomLogs() {
    setLogsLoading(true);
    setLogsError("");
    try {
      const response = await somApi.reports.classroomLogs({
        from: logsFrom,
        to: logsTo,
        classId: logsClassId || undefined
      });
      setLogsData(response.data);
    } catch {
      setLogsData(null);
      setLogsError(t("reports.loadFailed"));
    } finally {
      setLogsLoading(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const response = await somApi.reports.summary({
        dimension: summaryDimension,
        from: summaryFrom,
        to: summaryTo,
        classId: summaryClassId || undefined,
        teacherId: summaryTeacherId || undefined,
        subjectId: summarySubjectId || undefined
      });
      setSummaryData(response.data);
    } catch {
      setSummaryData(null);
      setSummaryError(t("reports.loadFailed"));
    } finally {
      setSummaryLoading(false);
    }
  }

  async function exportWithAudit(options: {
    reportType: "attendance" | "grades" | "classroom-logs" | "security";
    sectionId: string;
    title: string;
    fileName: string;
    filters: Record<string, unknown>;
  }) {
    try {
      const response = await somApi.reports.export({
        reportType: options.reportType,
        title: options.title,
        fileName: options.fileName,
        kind: "PDF",
        permission: "manageSettings",
        expiresInMinutes: 15,
        privacyWarningAccepted: true,
        filters: options.filters
      });
      const notice = buildExportNotice(t("reports.exportWarning"), response.data.expiresAt);
      await exportSectionPdf(options.sectionId, options.title, notice, { skipAudit: true });
    } catch {
      await exportSectionPdf(options.sectionId, options.title, undefined, { skipAudit: true });
    }
  }

  const reportTitle = t("reports.title");
  const dailyTitle = t("reports.daily");
  const attendanceTitle = t("reports.attendanceTitle");
  const gradesTitle = t("reports.gradesTitle");
  const logsTitle = t("reports.classroomLogsTitle");
  const summaryTitle = t("reports.summaryTitle");
  const securityTitle = t("reports.securityTitle");
  const classOptions = [{ id: "", name: t("reports.allClasses") }, ...classes];

  return (
    <div className="page" data-e2e="reports-page">
      <h2>{reportTitle}</h2>

      <div className="report-tabs no-print">
        {reportTabs.map((tab) => (
          <button
            key={tab.key}
            data-e2e={`report-tab-${tab.key}`}
            type="button"
            className={activeTab === tab.key ? "active" : "secondary"}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {lookupsError ? <p className="muted">{lookupsError}</p> : null}
      {lookupsLoading ? <p className="muted">{t("reports.loadingLookups")}</p> : null}

      {activeTab === "daily" && (
        <Card
          title={dailyTitle}
          actions={
            <button
              className="secondary"
              type="button"
              onClick={() => void exportSectionPdf("daily-report-print", dailyTitle)}
            >
              {t("common.exportPdf")}
            </button>
          }
        >
          <div className="form-row no-print">
            <input
              data-e2e="report-daily-date"
              type="date"
              value={daily.date}
              onChange={(e) => daily.setDate(e.target.value)}
            />
            <button data-e2e="report-daily-show" type="button" onClick={() => void daily.load()}>
              {t("reports.show")}
            </button>
          </div>
          <div id="daily-report-print">
            <pre className="report-text">{daily.text || t("reports.placeholder")}</pre>
            <h3>{t("reports.chartTitle")}</h3>
            {daily.chart.length === 0 && <p className="muted">{t("reports.noChart")}</p>}
            {daily.chart.length > 0 && (
              <div className="report-chart">
                {daily.chart.map((item) => (
                  <div className="chart-row" key={item.label}>
                    <span>{item.label}</span>
                    <div className="bar">
                      <b
                        style={{
                          width: `${Math.max(8, (item.value / Math.max(1, ...daily.chart.map((x) => x.value))) * 100)}%`
                        }}
                      />
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="report-triple-grid">
              <ReportVerticalChart title={chartTitle("classes", language)} data={daily.charts.classes} />
              <ReportPieChart title={chartTitle("subjects", language)} data={daily.charts.subjects} />
              <ReportHorizontalChart title={chartTitle("teachers", language)} data={daily.charts.teachers} />
            </div>
          </div>
        </Card>
      )}

      {activeTab === "attendance" && (
        <Card
          title={attendanceTitle}
          actions={
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void exportWithAudit({
                  reportType: "attendance",
                  sectionId: "attendance-report-print",
                  title: attendanceTitle,
                  fileName: "attendance-report.pdf",
                  filters: { from: attendanceFrom, to: attendanceTo, classId: attendanceClassId || null }
                })
              }
            >
              {t("common.exportPdf")}
            </button>
          }
        >
          <div className="form-row no-print report-filter-grid">
            <label>
              <span>{t("reports.from")}</span>
              <input
                data-e2e="attendance-from-filter"
                type="date"
                value={attendanceFrom}
                onChange={(e) => setAttendanceFrom(e.target.value)}
              />
            </label>
            <label>
              <span>{t("reports.to")}</span>
              <input
                data-e2e="attendance-to-filter"
                type="date"
                value={attendanceTo}
                onChange={(e) => setAttendanceTo(e.target.value)}
              />
            </label>
            <label>
              <span>{t("reports.classFilter")}</span>
              <select
                data-e2e="attendance-class-filter"
                value={attendanceClassId}
                onChange={(e) => setAttendanceClassId(e.target.value)}
              >
                {classOptions.map((item) => (
                  <option key={item.id || "all"} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              data-e2e="attendance-show"
              type="button"
              onClick={() => void loadAttendance()}
              disabled={attendanceLoading}
            >
              {attendanceLoading ? t("reports.loading") : t("reports.show")}
            </button>
          </div>
          {attendanceError ? <p className="muted">{attendanceError}</p> : null}
          {attendanceData && (
            <div id="attendance-report-print" className="report-stack">
              <div className="report-header">
                <div>
                  <strong>{attendanceTitle}</strong>
                  <div className="muted">{attendanceClassName || t("reports.allClasses")}</div>
                </div>
                <div className="muted">
                  {attendanceFrom} - {attendanceTo}
                </div>
              </div>
              <div className="teacher-kpis">
                {metric(attendanceData.summary.total, t("reports.totalRecords"))}
                {metric(attendanceData.summary.present, t("attendance.present"))}
                {metric(attendanceData.summary.late, t("attendance.late"))}
                {metric(attendanceData.summary.absent, t("attendance.absent"))}
                {metric(attendanceData.summary.absentExcused, t("attendance.absentExcused"))}
                {metric(attendanceData.summary.absentUnexcused, t("attendance.absentUnexcused"))}
                {metric(attendanceData.summary.earlyExit, t("attendance.earlyExit"))}
              </div>
              <div className="report-triple-grid">
                <ReportVerticalChart title={t("reports.byClass")} data={attendanceData.byClass} />
                <ReportPieChart title={t("reports.attendanceSummary")} data={attendanceData.chart} />
              </div>
              <div className="small-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("attendance.student")}</th>
                      <th>{t("attendance.class")}</th>
                      <th>{t("attendance.date")}</th>
                      <th>{t("attendance.day")}</th>
                      <th>{t("attendance.status")}</th>
                      <th>{t("attendance.lateTime")}</th>
                      <th>{t("attendance.leftTime")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.studentName}</td>
                        <td>{row.className}</td>
                        <td>{row.date}</td>
                        <td>{row.day}</td>
                        <td>{t(`attendance.status.${row.status}`)}</td>
                        <td>{row.lateAt || "-"}</td>
                        <td>{row.leftAt || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === "grades" && (
        <Card
          title={gradesTitle}
          actions={
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void exportWithAudit({
                  reportType: "grades",
                  sectionId: "grades-report-print",
                  title: gradesTitle,
                  fileName: "grades-report.pdf",
                  filters: {
                    classId: gradesClassId || null,
                    subjectId: gradesSubjectId || null,
                    certificateType: gradesCertificateType || null
                  }
                })
              }
            >
              {t("common.exportPdf")}
            </button>
          }
        >
          <div className="form-row no-print report-filter-grid">
            <label>
              <span>{t("reports.classFilter")}</span>
              <select
                data-e2e="grades-class-filter"
                value={gradesClassId}
                onChange={(e) => setGradesClassId(e.target.value)}
              >
                <option value="">{t("reports.allClasses")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("reports.subjectFilter")}</span>
              <select
                data-e2e="grades-subject-filter"
                value={gradesSubjectId}
                onChange={(e) => setGradesSubjectId(e.target.value)}
              >
                <option value="">{t("reports.allSubjects")}</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("reports.certificateTypeFilter")}</span>
              <select
                data-e2e="grades-certificate-filter"
                value={gradesCertificateType}
                onChange={(e) => setGradesCertificateType(e.target.value)}
              >
                {gradeCertificateTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <button data-e2e="grades-show" type="button" onClick={() => void loadGrades()} disabled={gradesLoading}>
              {gradesLoading ? t("reports.loading") : t("reports.show")}
            </button>
          </div>
          {gradesError ? <p className="muted">{gradesError}</p> : null}
          {gradesData && (
            <div id="grades-report-print" className="report-stack">
              <div className="teacher-kpis">
                {metric(gradesData.totals.schemes, t("reports.totalSchemes"))}
                {metric(gradesData.totals.entries, t("reports.totalEntries"))}
                {metric(gradesData.totals.classes, t("reports.totalClasses"))}
                {metric(gradesData.totals.subjects, t("reports.totalSubjects"))}
              </div>
              <div className="report-triple-grid">
                <ReportVerticalChart title={t("reports.byClass")} data={gradesData.summary.byClass} />
                <ReportPieChart title={t("reports.bySubject")} data={gradesData.summary.bySubject} />
                <ReportHorizontalChart title={t("reports.byType")} data={gradesData.summary.byType} />
              </div>
              <div className="small-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("reports.classFilter")}</th>
                      <th>{t("reports.subjectFilter")}</th>
                      <th>{t("reports.certificateTypeFilter")}</th>
                      <th>{t("reports.totalStudents")}</th>
                      <th>{t("reports.filledStudents")}</th>
                      <th>{t("reports.updatedAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradesData.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.className}</td>
                        <td>{row.subjectName}</td>
                        <td>
                          {t(
                            `gradeEntry.${row.certificateType === "TERM1_BIMONTHLY" ? "marksTerm1Bimonthly" : row.certificateType === "TERM1_FINAL" ? "marksTerm1Final" : row.certificateType === "TERM2_BIMONTHLY" ? "marksTerm2Bimonthly" : "marksTerm2Final"}`
                          )}
                        </td>
                        <td>{row.studentCount}</td>
                        <td>
                          {row.filledStudents}/{row.studentCount}
                        </td>
                        <td>{row.updatedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {gradesData.detailedRows.length > 0 && (
                <div className="small-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("students.name")}</th>
                        <th>{t("reports.classFilter")}</th>
                        <th>{t("reports.completion")}</th>
                        <th>{t("reports.marks")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradesData.detailedRows.map((row) => (
                        <tr key={`${row.classId}:${row.studentId}`}>
                          <td>{row.studentName}</td>
                          <td>{row.className}</td>
                          <td>{row.completion}%</td>
                          <td>
                            {Object.entries(row.marks)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(" | ") || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {activeTab === "classroomLogs" && (
        <Card
          title={logsTitle}
          actions={
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void exportWithAudit({
                  reportType: "classroom-logs",
                  sectionId: "classroom-logs-report-print",
                  title: logsTitle,
                  fileName: "classroom-logs-report.pdf",
                  filters: { from: logsFrom, to: logsTo, classId: logsClassId || null }
                })
              }
            >
              {t("common.exportPdf")}
            </button>
          }
        >
          <div className="form-row no-print report-filter-grid">
            <label>
              <span>{t("reports.from")}</span>
              <input data-e2e="classroom-logs-from-filter" type="date" value={logsFrom} readOnly />
            </label>
            <label>
              <span>{t("reports.to")}</span>
              <input data-e2e="classroom-logs-to-filter" type="date" value={logsTo} readOnly />
            </label>
            <label>
              <span>{t("reports.classFilter")}</span>
              <select
                data-e2e="classroom-logs-class-filter"
                value={logsClassId}
                onChange={(e) => setLogsClassId(e.target.value)}
              >
                <option value="">{t("reports.allClasses")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              data-e2e="classroom-logs-show"
              type="button"
              onClick={() => void loadClassroomLogs()}
              disabled={logsLoading}
            >
              {logsLoading ? t("reports.loading") : t("reports.show")}
            </button>
          </div>
          {logsError ? <p className="muted">{logsError}</p> : null}
          {logsData && (
            <div id="classroom-logs-report-print" className="report-stack">
              <div className="teacher-kpis">
                {metric(logsData.totals.all, t("reports.totalRecords"))}
                {metric(logsData.totals.lessons, t("reports.lessons"))}
                {metric(logsData.totals.homework, t("reports.homework"))}
                {metric(logsData.totals.exams, t("reports.exams"))}
              </div>
              <div className="report-triple-grid">
                <ReportVerticalChart title={t("reports.byClass")} data={logsData.summary.byClass} />
                <ReportPieChart title={t("reports.byType")} data={logsData.summary.byType} />
              </div>
              <div className="small-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("reports.kind")}</th>
                      <th>{t("reports.date")}</th>
                      <th>{t("reports.day")}</th>
                      <th>{t("reports.teacher")}</th>
                      <th>{t("reports.classFilter")}</th>
                      <th>{t("reports.subjectFilter")}</th>
                      <th>{t("reports.entryTitle")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{t(`reports.kind.${row.type}`)}</td>
                        <td>{row.date}</td>
                        <td>{row.day}</td>
                        <td>{row.teacherName}</td>
                        <td>{row.className}</td>
                        <td>{row.subjectName}</td>
                        <td>{row.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === "summary" && (
        <Card title={summaryTitle}>
          <p className="muted">{t("reports.summaryHint")}</p>
          <div className="form-row no-print report-filter-grid">
            <label>
              <span>{t("reports.summaryDimensionLabel")}</span>
              <select
                data-e2e="summary-dimension-filter"
                value={summaryDimension}
                onChange={(e) => setSummaryDimension(e.target.value as SummaryDimension)}
              >
                {summaryDimensionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("reports.from")}</span>
              <input
                data-e2e="summary-from-filter"
                type="date"
                value={summaryFrom}
                onChange={(e) => setSummaryFrom(e.target.value)}
              />
            </label>
            <label>
              <span>{t("reports.to")}</span>
              <input
                data-e2e="summary-to-filter"
                type="date"
                value={summaryTo}
                onChange={(e) => setSummaryTo(e.target.value)}
              />
            </label>
            <label>
              <span>{t("reports.summaryClass")}</span>
              <select
                data-e2e="summary-class-filter"
                value={summaryClassId}
                onChange={(e) => setSummaryClassId(e.target.value)}
              >
                <option value="">{t("common.all")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("reports.summaryTeacher")}</span>
              <select
                data-e2e="summary-teacher-filter"
                value={summaryTeacherId}
                onChange={(e) => setSummaryTeacherId(e.target.value)}
              >
                <option value="">{t("common.all")}</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("reports.summarySubject")}</span>
              <select
                data-e2e="summary-subject-filter"
                value={summarySubjectId}
                onChange={(e) => setSummarySubjectId(e.target.value)}
              >
                <option value="">{t("common.all")}</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button data-e2e="summary-show" type="button" onClick={() => void loadSummary()} disabled={summaryLoading}>
              {summaryLoading ? t("reports.loading") : t("reports.show")}
            </button>
          </div>
          {summaryError ? <p className="muted">{summaryError}</p> : null}
          {summaryData && (
            <div className="report-stack" data-e2e="summary-report-print">
              <div className="teacher-kpis">
                {Object.entries(summaryData.totals).map(([key, value]) => (
                  <div key={key}>{metric(value, t(summaryTotalLabelMap[key] || key))}</div>
                ))}
              </div>
              <div className="report-triple-grid">
                <ReportVerticalChart title={t("reports.summaryChartTitle")} data={summaryData.chart} />
              </div>
              <div className="small-table">
                <table>
                  <thead>
                    <tr>
                      {summaryColumnKeys[summaryDimension].map((column) => (
                        <th key={column.key}>{t(column.labelKey)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.rows.map((row, index) => (
                      <tr key={String(row.id || row.name || index)}>
                        {summaryColumnKeys[summaryDimension].map((column) => (
                          <td key={column.key}>{summaryRowValue(row[column.key], language)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === "security" && (
        <Card
          title={securityTitle}
          actions={
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void exportWithAudit({
                  reportType: "security",
                  sectionId: "security-report-print",
                  title: securityTitle,
                  fileName: "security-report.pdf",
                  filters: { days: security.days }
                })
              }
            >
              {t("common.exportPdf")}
            </button>
          }
        >
          <div className="form-row no-print">
            <input
              type="number"
              min={1}
              max={30}
              data-e2e="security-days-filter"
              value={security.days}
              onChange={(event) => security.setDays(Math.max(1, Math.min(30, Number(event.target.value) || 7)))}
              aria-label={t("reports.securityDays")}
            />
            <button data-e2e="security-show" type="button" onClick={() => void security.load()}>
              {t("reports.show")}
            </button>
          </div>
          {security.error ? <p className="muted">{security.error}</p> : null}
          <SecurityMonitoringPanel monitoring={security} />
        </Card>
      )}
    </div>
  );
}
