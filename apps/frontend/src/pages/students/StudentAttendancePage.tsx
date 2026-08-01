import { Card } from "../../components/ui/Card";
import { StudentAttendanceTable } from "../../features/students/StudentAttendanceTable";
import { attendanceText } from "../../features/students/attendanceText";
import { useStudentAttendance } from "../../features/students/useStudentAttendance";
import { exportSectionPdf } from "../../features/daily/dailyHelpers";
import { localizeClassName, localizeDay } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";

type Props = {
  currentUser: AuthUser;
};

export function StudentAttendancePage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const attendance = useStudentAttendance();
  const isStudentViewer = currentUser.role === "STUDENT" || currentUser.role === "PARENT";
  const pageTitle = attendanceText(t, language, "attendance.title", "الحضور والغياب", "נוכחות והיעדרות");
  const exportPdfLabel = attendanceText(
    t,
    language,
    "attendance.exportPdf",
    "تصدير تقرير الحضور بصيغة PDF",
    "ייצוא דוח נוכחות כ־PDF"
  );
  const summaryTitle = attendanceText(t, language, "attendance.summaryTitle", "ملخص الصف", "סיכום הכיתה");
  const totalStudentsLabel = attendanceText(
    t,
    language,
    "attendance.totalStudents",
    "عدد طلاب الصف",
    "מספר תלמידי הכיתה"
  );
  const presentLabel = attendanceText(t, language, "attendance.present", "حاضر", "נוכח");
  const lateLabel = attendanceText(t, language, "attendance.late", "متأخر", "מאחר");
  const absentLabel = attendanceText(t, language, "attendance.absent", "غائب", "נעדר");
  const absentExcusedLabel = attendanceText(t, language, "attendance.absentExcused", "غياب بعذر", "נעדר באישור");
  const absentUnexcusedLabel = attendanceText(
    t,
    language,
    "attendance.absentUnexcused",
    "غياب بدون عذر",
    "נעדר ללא אישור"
  );
  const earlyExitLabel = attendanceText(t, language, "attendance.earlyExit", "انصراف مبكر", "יציאה מוקדמת");
  const archiveTitle = attendanceText(
    t,
    language,
    "attendance.archiveTitle",
    "حفظ وأرشفة الحضور",
    "שמירה וארכוב נוכחות"
  );
  const archiveSaveLabel = attendanceText(
    t,
    language,
    "attendance.archiveSave",
    "حفظ وأرشفة اليوم",
    "שמירת וארכוב היום"
  );
  const archiveClassLabel = attendanceText(t, language, "attendance.archiveClass", "الصف", "כיתה");
  const archiveTeacherLabel = attendanceText(t, language, "attendance.archiveTeacher", "مربي الصف", "מחנך הכיתה");
  const archiveIssuesLabel = attendanceText(t, language, "attendance.archiveIssues", "عدد الحالات", "מספר מקרים");
  const archivePresentLabel = attendanceText(t, language, "attendance.archivePresent", "حاضر", "נוכח");
  const archiveLateLabel = attendanceText(t, language, "attendance.archiveLate", "متأخر", "מאחר");
  const archiveAbsentLabel = attendanceText(t, language, "attendance.archiveAbsent", "غائب", "נעדר");
  const notificationsTitle = attendanceText(
    t,
    language,
    "attendance.notificationsTitle",
    "إرسال إشعارات ولي الأمر",
    "שליחת הודעות להורים"
  );
  const notificationTitleLabel = attendanceText(
    t,
    language,
    "attendance.notificationTitle",
    "عنوان الإشعار",
    "כותרת ההודעה"
  );
  const notificationMessageLabel = attendanceText(
    t,
    language,
    "attendance.notificationMessage",
    "نص الرسالة",
    "טקסט ההודעה"
  );
  const sendMessageLabel = attendanceText(t, language, "attendance.sendMessage", "إرسال الرسالة", "שליחת ההודעה");
  const sendingMessageLabel = attendanceText(t, language, "attendance.sendingMessage", "جارٍ الإرسال...", "שולח...");

  return (
    <div className="page student-attendance-page">
      <div className="page-title-row">
        <h2>{pageTitle}</h2>
        <button
          type="button"
          className="secondary"
          onClick={() => void exportSectionPdf("attendance-report-print", pageTitle)}
        >
          {exportPdfLabel}
        </button>
      </div>

      <div id="attendance-report-print" className="attendance-report-print">
        <Card>
          <div className="attendance-controls">
            <label>
              {t("common.class")}
              <select
                data-e2e="attendance-class-select"
                value={attendance.classId}
                onChange={(event) => attendance.setClassId(event.target.value)}
                disabled={isStudentViewer}
              >
                <option value="">{t("students.selectClass")}</option>
                {attendance.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeClassName(item.name, language)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("common.date")}
              <input
                data-e2e="attendance-date-input"
                type="date"
                value={attendance.date}
                onChange={(event) => attendance.setDate(event.target.value)}
                disabled={isStudentViewer}
              />
            </label>
            <label>
              {t("common.day")}
              <input
                data-e2e="attendance-day-input"
                value={localizeDay(attendance.day, language)}
                readOnly
                aria-readonly="true"
              />
            </label>
          </div>
        </Card>

        <Card title={summaryTitle}>
          <div className="attendance-summary">
            <div className="attendance-summary-card">
              <span>{totalStudentsLabel}</span>
              <strong>{attendance.summary.total}</strong>
            </div>
            <div className="attendance-summary-card attendance-summary-present">
              <span>{presentLabel}</span>
              <strong>{attendance.summary.present}</strong>
            </div>
            <div className="attendance-summary-card attendance-summary-late">
              <span>{lateLabel}</span>
              <strong>{attendance.summary.late}</strong>
            </div>
            <div className="attendance-summary-card attendance-summary-absent">
              <span>{absentLabel}</span>
              <strong>{attendance.summary.absentExcused + attendance.summary.absentUnexcused}</strong>
            </div>
            <div className="attendance-summary-card attendance-summary-absent">
              <span>{absentExcusedLabel}</span>
              <strong>{attendance.summary.absentExcused}</strong>
            </div>
            <div className="attendance-summary-card attendance-summary-absent">
              <span>{absentUnexcusedLabel}</span>
              <strong>{attendance.summary.absentUnexcused}</strong>
            </div>
            <div className="attendance-summary-card attendance-summary-late">
              <span>{earlyExitLabel}</span>
              <strong>{attendance.summary.earlyExit}</strong>
            </div>
          </div>
        </Card>

        <StudentAttendanceTable
          t={t}
          language={language}
          rows={attendance.rows}
          loading={attendance.loading}
          savingStudentId={attendance.savingStudentId}
          onMark={attendance.mark}
          readOnly={isStudentViewer}
        />

        {!isStudentViewer && (
          <>
            <Card title={archiveTitle}>
              <div className="attendance-archive-panel">
                <button
                  data-e2e="attendance-archive-save"
                  type="button"
                  className="primary attendance-archive-button"
                  onClick={attendance.archiveAttendance}
                  disabled={attendance.loading || attendance.archiving || !attendance.classId}
                >
                  {attendance.archiving
                    ? attendanceText(t, language, "attendance.archiving", "جارٍ الأرشفة...", "מארכב...")
                    : archiveSaveLabel}
                </button>
                {attendance.archiveReport && (
                  <div className="attendance-archive-report">
                    <div>
                      <span>{archiveClassLabel}</span>
                      <strong>{attendance.archiveReport.className}</strong>
                    </div>
                    <div>
                      <span>{archiveTeacherLabel}</span>
                      <strong>{attendance.archiveReport.homeroomTeacherName || t("common.none")}</strong>
                    </div>
                    <div>
                      <span>{archiveIssuesLabel}</span>
                      <strong>{attendance.archiveReport.issues}</strong>
                    </div>
                    <div>
                      <span>{archivePresentLabel}</span>
                      <strong>{attendance.archiveReport.present}</strong>
                    </div>
                    <div>
                      <span>{archiveLateLabel}</span>
                      <strong>{attendance.archiveReport.late}</strong>
                    </div>
                    <div>
                      <span>{archiveAbsentLabel}</span>
                      <strong>{attendance.archiveReport.absent}</strong>
                    </div>
                    <div>
                      <span>{absentExcusedLabel}</span>
                      <strong>{attendance.archiveReport.absentExcused}</strong>
                    </div>
                    <div>
                      <span>{absentUnexcusedLabel}</span>
                      <strong>{attendance.archiveReport.absentUnexcused}</strong>
                    </div>
                    <div>
                      <span>{earlyExitLabel}</span>
                      <strong>{attendance.archiveReport.earlyExit}</strong>
                    </div>
                  </div>
                )}
                {attendance.message && (
                  <div className="form-message" role="status" aria-live="polite">
                    {attendance.message}
                  </div>
                )}
              </div>
            </Card>

            <div className="attendance-notifications-wrap">
              <Card title={notificationsTitle}>
                <div className="attendance-notification-panel">
                  <div className="attendance-notification-form">
                    <label className="attendance-notification-field">
                      <span>{notificationTitleLabel}</span>
                      <input
                        data-e2e="attendance-notification-title"
                        value={attendance.notificationTitle}
                        onChange={(event) => attendance.setNotificationTitle(event.target.value)}
                      />
                    </label>
                    <label className="attendance-notification-field">
                      <span>{notificationMessageLabel}</span>
                      <textarea
                        data-e2e="attendance-notification-message"
                        rows={4}
                        value={attendance.notificationMessage}
                        onChange={(event) => attendance.setNotificationMessage(event.target.value)}
                      />
                    </label>
                    <button
                      data-e2e="attendance-send-notification"
                      type="button"
                      className="primary"
                      onClick={attendance.sendNotificationMessage}
                      disabled={
                        attendance.sendingMessage ||
                        !attendance.classId ||
                        !attendance.notificationTitle.trim() ||
                        !attendance.notificationMessage.trim()
                      }
                    >
                      {attendance.sendingMessage ? sendingMessageLabel : sendMessageLabel}
                    </button>
                  </div>
                  <div className="attendance-notification-list">
                    {attendance.notifications.map((notification) => (
                      <div key={notification.id} className="attendance-notification-item">
                        <div className="attendance-notification-head">
                          <strong>{notification.title}</strong>
                          <span>{notification.status}</span>
                        </div>
                        <div className="attendance-notification-body">{notification.message}</div>
                        <div className="attendance-notification-meta">
                          <span>{notification.studentName || t("common.none")}</span>
                          <span>{notification.createdAt.slice(0, 10)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
