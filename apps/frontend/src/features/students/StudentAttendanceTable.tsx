import { BadgeCheck, Check, Clock3, LogOut, X } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { attendanceText } from "./attendanceText";
import type { AttendanceStatus, StudentAttendanceRow } from "./studentTypes";
import type { LanguageCode, TranslationKey } from "../../i18n/i18n";

type Props = {
  t: (key: TranslationKey) => string;
  language: LanguageCode;
  rows: StudentAttendanceRow[];
  loading: boolean;
  savingStudentId: string | null;
  onMark: (studentId: string, status: AttendanceStatus) => void;
  readOnly?: boolean;
};

export function StudentAttendanceTable({
  t,
  language,
  rows,
  loading,
  savingStudentId,
  onMark,
  readOnly = false
}: Props) {
  const studentsTitle = attendanceText(t, language, "attendance.studentsTitle", "طلاب الصف", "תלמידי הכיתה");
  const presentLabel = attendanceText(t, language, "attendance.present", "حاضر", "נוכח");
  const lateLabel = attendanceText(t, language, "attendance.late", "متأخر", "מאחר");
  const absentExcusedLabel = attendanceText(t, language, "attendance.absentExcused", "غياب بعذر", "נעדר באישור");
  const absentUnexcusedLabel = attendanceText(
    t,
    language,
    "attendance.absentUnexcused",
    "غياب بدون عذر",
    "נעדר ללא אישור"
  );
  const earlyExitLabel = attendanceText(t, language, "attendance.earlyExit", "انصراف مبكر", "יציאה מוקדמת");
  const recordedStatusLabel = attendanceText(t, language, "attendance.recordedStatus", "الحالة المسجلة", "מצב שנרשם");
  const lateTimeLabel = attendanceText(t, language, "attendance.lateTime", "وقت التأخير", "שעת איחור");
  const leftTimeLabel = attendanceText(t, language, "attendance.leftTime", "وقت الانصراف", "שעת יציאה");
  const emptyClassLabel = attendanceText(
    t,
    language,
    "attendance.emptyClass",
    "لا يوجد طلاب في هذا الصف",
    "אין תלמידים בכיתה הזו"
  );
  const notRecordedLabel = attendanceText(t, language, "attendance.notRecorded", "غير مسجل", "לא נרשם");
  const statusLabel = (status: AttendanceStatus | undefined) => {
    if (!status) return notRecordedLabel;
    return attendanceText(
      t,
      language,
      `attendance.status.${status}`,
      status === "PRESENT"
        ? "حاضر"
        : status === "LATE"
          ? "متأخر"
          : status === "ABSENT_EXCUSED"
            ? "غياب بعذر"
            : status === "ABSENT_UNEXCUSED"
              ? "غياب بدون عذر"
              : "انصراف مبكر",
      status === "PRESENT"
        ? "נוכח"
        : status === "LATE"
          ? "מאחר"
          : status === "ABSENT_EXCUSED"
            ? "נעדר באישור"
            : status === "ABSENT_UNEXCUSED"
              ? "נעדר ללא אישור"
              : "יציאה מוקדמת"
    );
  };

  return (
    <Card title={studentsTitle}>
      <div className="table-wrap attendance-table-wrap">
        <table className="student-attendance-table">
          <thead>
            <tr>
              <th>{t("students.name")}</th>
              <th>{presentLabel}</th>
              <th>{lateLabel}</th>
              <th>{absentExcusedLabel}</th>
              <th>{absentUnexcusedLabel}</th>
              <th>{earlyExitLabel}</th>
              <th>{recordedStatusLabel}</th>
              <th>{lateTimeLabel}</th>
              <th>{leftTimeLabel}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>{t("common.loading")}</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8}>{emptyClassLabel}</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const status = row.attendance?.status;
                const disabled = savingStudentId === row.id;
                return (
                  <tr key={row.id} data-e2e={`attendance-row-${row.id}`}>
                    <td className="student-attendance-name">{row.name}</td>
                    <td>
                      <button
                        data-e2e={`attendance-present-${row.id}`}
                        type="button"
                        className={`attendance-button present ${status === "PRESENT" ? "selected" : ""}`}
                        disabled={readOnly || disabled}
                        onClick={readOnly ? undefined : () => onMark(row.id, "PRESENT")}
                        title={presentLabel}
                      >
                        <Check size={12} />
                      </button>
                    </td>
                    <td>
                      <button
                        data-e2e={`attendance-late-${row.id}`}
                        type="button"
                        className={`attendance-button late ${status === "LATE" ? "selected" : ""}`}
                        disabled={readOnly || disabled}
                        onClick={readOnly ? undefined : () => onMark(row.id, "LATE")}
                        title={lateLabel}
                      >
                        <Clock3 size={12} />
                      </button>
                    </td>
                    <td>
                      <button
                        data-e2e={`attendance-absent-excused-${row.id}`}
                        type="button"
                        className={`attendance-button absent ${status === "ABSENT_EXCUSED" ? "selected" : ""}`}
                        disabled={readOnly || disabled}
                        onClick={readOnly ? undefined : () => onMark(row.id, "ABSENT_EXCUSED")}
                        title={absentExcusedLabel}
                      >
                        <BadgeCheck size={12} />
                      </button>
                    </td>
                    <td>
                      <button
                        data-e2e={`attendance-absent-unexcused-${row.id}`}
                        type="button"
                        className={`attendance-button absent ${status === "ABSENT_UNEXCUSED" ? "selected" : ""}`}
                        disabled={readOnly || disabled}
                        onClick={readOnly ? undefined : () => onMark(row.id, "ABSENT_UNEXCUSED")}
                        title={absentUnexcusedLabel}
                      >
                        <X size={12} />
                      </button>
                    </td>
                    <td>
                      <button
                        data-e2e={`attendance-early-exit-${row.id}`}
                        type="button"
                        className={`attendance-button late ${status === "LEFT_EARLY" ? "selected" : ""}`}
                        disabled={readOnly || disabled}
                        onClick={readOnly ? undefined : () => onMark(row.id, "LEFT_EARLY")}
                        title={earlyExitLabel}
                      >
                        <LogOut size={12} />
                      </button>
                    </td>
                    <td>{statusLabel(status)}</td>
                    <td>{status === "LATE" ? row.attendance?.lateAt || "-" : "-"}</td>
                    <td>{status === "LEFT_EARLY" ? row.attendance?.leftAt || "-" : "-"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
