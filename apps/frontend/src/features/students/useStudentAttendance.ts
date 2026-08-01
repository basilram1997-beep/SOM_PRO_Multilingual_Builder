import { useEffect, useMemo, useState } from "react";
import type { SchoolClass } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import { attendanceText } from "./attendanceText";
import type { AttendanceStatus, StudentAttendanceRow, StudentNotificationRow } from "./studentTypes";

const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : dayNames[value.getDay()];
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function useStudentAttendance() {
  const { t, language } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<StudentAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notifications, setNotifications] = useState<StudentNotificationRow[]>([]);
  const [archiveReport, setArchiveReport] = useState<null | {
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
  }>(null);
  const [message, setMessage] = useState("");
  const day = useMemo(() => dayForDate(date), [date]);
  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) || null, [classes, classId]);
  const loadFailedLabel = attendanceText(
    t,
    language,
    "attendance.loadFailed",
    "تعذر تحميل الحضور",
    "לא ניתן לטעון נוכחות"
  );
  const savedLabel = attendanceText(t, language, "attendance.saved", "تم حفظ حالة الطالب", "מצב התלמיד נשמר");
  const saveFailedLabel = attendanceText(
    t,
    language,
    "attendance.saveFailed",
    "تعذر حفظ الحضور",
    "לא ניתן לשמור נוכחות"
  );
  const archivedLabel = attendanceText(
    t,
    language,
    "attendance.archived",
    "تم حفظ حضور الصف وأرشفته بنجاح",
    "נוכחות הכיתה נשמרה ונאחסנה בהצלחה"
  );
  const archiveFailedLabel = attendanceText(
    t,
    language,
    "attendance.archiveFailed",
    "تعذر حفظ الحضور وأرشفته",
    "לא ניתן לשמור ולארכב את הנוכחות"
  );
  const messageSentLabel = attendanceText(
    t,
    language,
    "attendance.messageSent",
    "تم إرسال الرسالة وتسجيلها في الإشعارات",
    "ההודעה נשלחה ונשמרה בהתראות"
  );
  const messageFailedLabel = attendanceText(
    t,
    language,
    "attendance.messageFailed",
    "تعذر إرسال الرسالة",
    "לא ניתן לשלוח את ההודעה"
  );
  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.total += 1;
          const status = row.attendance?.status;
          if (status === "PRESENT") acc.present += 1;
          if (status === "LATE") acc.late += 1;
          if (status === "ABSENT_EXCUSED") acc.absentExcused += 1;
          if (status === "ABSENT_UNEXCUSED") acc.absentUnexcused += 1;
          if (status === "LEFT_EARLY") acc.earlyExit += 1;
          return acc;
        },
        { total: 0, present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyExit: 0 }
      ),
    [rows]
  );

  function buildArchiveReport(homeroomTeacherName: string | null = null) {
    const issues = summary.late + summary.absentUnexcused + summary.earlyExit;
    return {
      className: selectedClass?.name || classId || "",
      homeroomTeacherName,
      totalStudents: summary.total,
      recordedStudents: summary.total,
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

  useEffect(() => {
    let active = true;
    somApi.classes
      .list()
      .then((response) => {
        if (!active) return;
        const nextClasses = sortSchoolClasses((response.data || []) as SchoolClass[]);
        setClasses(nextClasses);
        setClassId((previous) => previous || nextClasses[0]?.id || "");
      })
      .catch(() => {
        if (active)
          setMessage(attendanceText(t, language, "students.loadFailed", "تعذر تحميل الطلاب", "לא ניתן לטעון תלמידים"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!classId || !date) {
      setRows([]);
      setNotifications([]);
      setArchiveReport(null);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    setArchiveReport(null);
    somApi.students
      .attendance(classId, date)
      .then((response) => {
        if (active) setRows(response.data || []);
      })
      .catch(() => {
        if (active) setMessage(loadFailedLabel);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    somApi.students
      .notifications(classId, 12)
      .then((response) => {
        if (active) setNotifications(response.data || []);
      })
      .catch(() => {
        if (active) setNotifications([]);
      });
    return () => {
      active = false;
    };
  }, [classId, date, t]);

  async function mark(studentId: string, status: AttendanceStatus) {
    if (savingStudentId || !day) return;
    setSavingStudentId(studentId);
    setMessage("");
    try {
      const lateAt = status === "LATE" ? currentTime() : null;
      const leftAt = status === "LEFT_EARLY" ? currentTime() : null;
      const response = await somApi.students.markAttendance({
        studentId,
        date,
        day,
        status,
        lateAt,
        leftAt,
        note: null
      });
      setRows((previous) =>
        previous.map((row) => (row.id === studentId ? { ...row, attendance: response.data } : row))
      );
      setMessage(savedLabel);
    } catch {
      setMessage(saveFailedLabel);
    } finally {
      setSavingStudentId(null);
    }
  }

  async function archiveAttendance() {
    if (archiving || !classId || !date || !day) return;
    setArchiving(true);
    setMessage("");
    try {
      const response = await somApi.students.archiveAttendance({ classId, date, day });
      setArchiveReport(response.data);
      setMessage(archivedLabel);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error || "");
      if (!errorMessage.includes("Cannot POST /api/students/attendance/archive")) {
        setMessage(archiveFailedLabel);
        return;
      }
      setArchiveReport(buildArchiveReport());
      setMessage(archivedLabel);
    } finally {
      setArchiving(false);
    }
  }

  async function sendNotificationMessage() {
    if (sendingMessage || !classId || !notificationTitle.trim() || !notificationMessage.trim()) return;
    setSendingMessage(true);
    setMessage("");
    try {
      const response = await somApi.students.sendMessage({
        classId,
        title: notificationTitle.trim(),
        message: notificationMessage.trim()
      });
      setMessage(messageSentLabel);
      setNotificationMessage("");
      if (response.data?.created) {
        const refreshed = await somApi.students.notifications(classId, 12);
        setNotifications(refreshed.data || []);
      }
    } catch {
      setMessage(messageFailedLabel);
    } finally {
      setSendingMessage(false);
    }
  }

  return {
    classes,
    classId,
    date,
    day,
    rows,
    loading,
    savingStudentId,
    archiving,
    sendingMessage,
    message,
    selectedClass,
    summary,
    archiveReport,
    notifications,
    notificationTitle,
    notificationMessage,
    setClassId,
    setDate,
    setNotificationTitle,
    setNotificationMessage,
    mark,
    archiveAttendance,
    sendNotificationMessage
  };
}
