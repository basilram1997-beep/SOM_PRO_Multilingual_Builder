import { useEffect, useMemo, useState } from "react";
import { sortSchoolClasses } from "@som/shared";
import { Card } from "../../components/ui/Card";
import { somApi } from "../../api/somApi";
import { ALL_WEEK_DAYS } from "@som/shared";
import {
  localizeClassName,
  localizeDay,
  localizeSubjectName,
  localizeTeacherName,
  repairMojibake
} from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import { teacherColorStyle } from "../../utils/teacherColors";
import type { DailyBaseSlot, DailyEvent, DailySubstitution } from "../../features/daily/dailyTypes";

type PeriodDefinition = {
  period: number;
  label?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

type SettingsResponse = {
  settings: {
    workingDays?: string[] | null;
    periodsPerDay?: number | null;
  };
  periods?: PeriodDefinition[] | null;
};

type TimetableTeacher = { id?: string; name?: string | null } | null | undefined;

type ScheduleSlot = Omit<DailyBaseSlot, "teacher"> & {
  day?: string;
  room?: { name?: string | null } | string | null;
  teacher?: TimetableTeacher;
};

type DailyDetailsResponse = {
  daily?: { id?: string; date?: string; day?: string } | null;
  baseSlots?: DailyBaseSlot[];
  substitutions?: DailySubstitution[];
  events?: DailyEvent[];
  statuses?: Array<{ teacherId: string; type: string; fromPeriod: number; toPeriod: number }>;
};

type StudentContextResponse = {
  student?: { id?: string; name?: string } | null;
  class?: { id?: string; name?: string } | null;
  subjects?: Array<{ id?: string; name?: string }>;
};

type TimetableRow = Omit<DailyBaseSlot, "teacher"> & {
  updated: boolean;
  status: string;
  note: string;
  event?: DailyEvent;
  substitution?: DailySubstitution;
  room?: { name?: string | null } | string | null;
  teacher?: TimetableTeacher;
  day?: string;
};

const canonicalDayOrder: string[] = Array.from(ALL_WEEK_DAYS);

function canonicalDay(value: string) {
  const clean = repairMojibake(value || "").trim();
  if (!clean) return "";
  if (clean === "الاحد") return "الأحد";
  if (clean === "الاثنين") return "الإثنين";
  if (clean === "الاربعاء") return "الأربعاء";
  return clean;
}

function dayRank(value: string) {
  const clean = canonicalDay(value);
  const index = canonicalDayOrder.indexOf(clean);
  return index === -1 ? 999 : index;
}

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : ALL_WEEK_DAYS[(value.getDay() + 1) % 7];
}

function periodTime(periods: PeriodDefinition[], period: number) {
  const item = periods.find((row) => row.period === period);
  if (!item) return "";
  if (!item.startTime && !item.endTime) return "";
  return `${item.startTime || ""} - ${item.endTime || ""}`.trim();
}

function roomLabel(value: { room?: { name?: string | null } | string | null }, fallback: string) {
  const room = value.room;
  if (typeof room === "string") {
    const trimmed = room.trim();
    if (!trimmed || trimmed === "timetable.roomEmpty") return fallback;
    return trimmed;
  }
  if (room && typeof room === "object") {
    const trimmed = (room.name || "").trim();
    if (!trimmed || trimmed === "timetable.roomEmpty") return fallback;
    return trimmed;
  }
  return fallback;
}

function eventTypeLabel(t: (key: string) => string, type?: string) {
  if (type === "EXAM") return t("daily.eventExam");
  if (type === "TRIP") return t("daily.eventTrip");
  return t("daily.eventActivity");
}

function buildDailyRows(baseSlots: ScheduleSlot[], substitutions: DailySubstitution[], events: DailyEvent[]) {
  return baseSlots.map<TimetableRow>((slot) => {
    const substitution = substitutions.find((item) => item.classId === slot.classId && item.period === slot.period);
    const event = events.find(
      (item) =>
        (!item.classId || item.classId === slot.classId) &&
        slot.period >= item.fromPeriod &&
        slot.period <= item.toPeriod
    );

    if (event) {
      return {
        ...slot,
        updated: true,
        status: event.type || "EVENT",
        note: event.note || "",
        teacher: slot.teacher,
        subject: slot.subject,
        class: slot.class,
        event
      };
    }

    if (substitution) {
      return {
        ...slot,
        updated: true,
        status: "SUBSTITUTION",
        note: `${substitution.absentTeacher?.name || ""}${substitution.substituteTeacher?.name ? ` -> ${substitution.substituteTeacher.name}` : ""}`,
        teacher: substitution.substituteTeacher || slot.teacher,
        subject: slot.subject,
        class: slot.class,
        substitution
      };
    }

    return {
      ...slot,
      updated: false,
      status: "UNCHANGED",
      note: "",
      teacher: slot.teacher,
      subject: slot.subject,
      class: slot.class
    };
  });
}

function sortRows(rows: TimetableRow[]) {
  return [...rows].sort(
    (left, right) =>
      dayRank(left.day || "") - dayRank(right.day || "") ||
      left.period - right.period ||
      (left.class?.name || "").localeCompare(right.class?.name || "", "ar")
  );
}

type Props = {
  currentUser: AuthUser;
};

export function TimetablePage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const isStudentViewer = currentUser.role === "STUDENT" || currentUser.role === "PARENT";
  const [date] = useState(new Date().toISOString().slice(0, 10));
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [baseDay, setBaseDay] = useState("");
  const [periodDefinitions, setPeriodDefinitions] = useState<PeriodDefinition[]>([]);
  const [baseSlots, setBaseSlots] = useState<ScheduleSlot[]>([]);
  const [dailyDetails, setDailyDetails] = useState<DailyDetailsResponse | null>(null);
  const [studentClassId, setStudentClassId] = useState("");
  const [studentClassName, setStudentClassName] = useState("");
  const [studentContextLoaded, setStudentContextLoaded] = useState(!isStudentViewer);
  const [loading, setLoading] = useState(false);
  const [, setMessage] = useState("");

  const day = useMemo(() => dayForDate(date), [date]);

  useEffect(() => {
    let active = true;
    somApi.settings
      .get()
      .then((response) => {
        if (!active) return;
        const data = response.data as SettingsResponse;
        setWorkingDays((data.settings.workingDays || []).map(canonicalDay).filter(Boolean));
        setPeriodDefinitions(data.periods || []);
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("timetable.loadFailed"));
      });
    somApi.schedules
      .base()
      .then((response) => {
        if (!active) return;
        setBaseSlots((response.data || []) as ScheduleSlot[]);
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("timetable.loadFailed"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!isStudentViewer) {
      setStudentClassId("");
      setStudentClassName("");
      setStudentContextLoaded(true);
      return;
    }

    const linkedStudentId = currentUser.studentId || currentUser.studentIds?.[0] || "";
    if (!linkedStudentId) {
      setStudentClassId("");
      setStudentClassName("");
      setStudentContextLoaded(true);
      return;
    }

    let active = true;
    setStudentContextLoaded(false);
    somApi.students
      .context(linkedStudentId)
      .then((response) => {
        if (!active) return;
        const context = (response.data || {}) as StudentContextResponse;
        setStudentClassId(context.class?.id || "");
        setStudentClassName(context.class?.name || "");
      })
      .catch(() => {
        if (!active) return;
        setStudentClassId("");
        setStudentClassName("");
      })
      .finally(() => {
        if (active) setStudentContextLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [currentUser.studentId, currentUser.studentIds, isStudentViewer]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    somApi.daily
      .get(date)
      .then((response) => {
        if (!active) return;
        setDailyDetails((response.data || null) as DailyDetailsResponse | null);
      })
      .catch(() => {
        if (!active) return;
        setDailyDetails(null);
        setMessage(t("timetable.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, t]);

  const weeklyRows = useMemo(
    () =>
      [...baseSlots].sort(
        (left, right) =>
          dayRank(left.day || "") - dayRank(right.day || "") ||
          left.period - right.period ||
          (left.class?.name || "").localeCompare(right.class?.name || "", "ar")
      ),
    [baseSlots]
  );

  const baseDayOptions = useMemo(() => {
    const daysFromSlots = weeklyRows.map((slot) => canonicalDay(slot.day || "")).filter(Boolean);
    const options = workingDays.length > 0 ? workingDays : daysFromSlots;
    return Array.from(new Set(options)).sort((left, right) => dayRank(left) - dayRank(right));
  }, [weeklyRows, workingDays]);

  useEffect(() => {
    if (baseDayOptions.length === 0) return;
    setBaseDay((current) => (current && baseDayOptions.includes(current) ? current : day || baseDayOptions[0]));
  }, [baseDayOptions, day]);

  const currentDailyBaseRows = useMemo(() => {
    if (!day) return [];
    return weeklyRows.filter((slot) => canonicalDay(slot.day || "") === day);
  }, [day, weeklyRows]);

  const selectedBaseDayRows = useMemo(() => {
    if (!baseDay) return [];
    const rows = weeklyRows.filter((slot) => canonicalDay(slot.day || "") === baseDay);
    if (!isStudentViewer) return rows;
    return studentContextLoaded && studentClassId ? rows.filter((slot) => slot.classId === studentClassId) : [];
  }, [baseDay, isStudentViewer, studentClassId, studentContextLoaded, weeklyRows]);

  const selectedDailyDayRows = useMemo(() => {
    const sourceRows =
      dailyDetails?.baseSlots && dailyDetails.baseSlots.length > 0 ? (dailyDetails.baseSlots as ScheduleSlot[]) : currentDailyBaseRows;
    const rows = isStudentViewer
      ? studentContextLoaded && studentClassId
        ? sourceRows.filter((slot) => slot.classId === studentClassId)
        : []
      : sourceRows;
    return sortRows(buildDailyRows(rows, dailyDetails?.substitutions || [], dailyDetails?.events || []));
  }, [currentDailyBaseRows, dailyDetails?.baseSlots, dailyDetails?.events, dailyDetails?.substitutions, isStudentViewer, studentClassId, studentContextLoaded]);

  const baseColumnCount = isStudentViewer ? 5 : 6;
  const dailyColumnCount = isStudentViewer ? 7 : 8;

  return (
    <div className="page timetable-page daily-page">
      <h2>{isStudentViewer ? t("nav.studentTimetable") : t("timetable.title")}</h2>
      <p className="muted">{t("timetable.info")}</p>

      <Card title={isStudentViewer ? `${t("timetable.title")} - ${studentClassName || t("common.class")}` : t("nav.teacherBaseSchedule")}>
        <div className="timetable-base-controls">
          <label>
            <span>{t("timetable.day")}:</span>
            <select value={baseDay} onChange={(event) => setBaseDay(event.target.value)}>
              {baseDayOptions.map((option) => (
                <option key={option} value={option}>
                  {localizeDay(option, language)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-wrap lesson-table-wrap">
          <table className="daily-grid-table timetable-grid timetable-day-table">
            <thead>
              <tr>
                <th>{t("common.period")}</th>
                <th>{t("timetable.time")}</th>
                {!isStudentViewer && <th>{t("common.class")}</th>}
                <th>{t("timetable.subject")}</th>
                <th>{t("timetable.teacher")}</th>
                <th>{t("timetable.room")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedBaseDayRows.length === 0 && (
                <tr>
                  <td colSpan={baseColumnCount}>{t("timetable.emptyWeekly")}</td>
                </tr>
              )}
              {selectedBaseDayRows.map((slot) => (
                <tr key={`${slot.classId}-${slot.period}`}>
                  <th className="period-time-header">
                    {t("common.period")} {slot.period}
                  </th>
                  <td>{periodTime(periodDefinitions, slot.period) || "-"}</td>
                  {!isStudentViewer && <td>{localizeClassName(slot.class?.name || "", language)}</td>}
                  <td className="teacher-color-cell" style={teacherColorStyle(slot.teacher)}>
                    {localizeSubjectName(slot.subject?.name || "", language)}
                  </td>
                  <td>{localizeTeacherName(slot.teacher?.name || "", language)}</td>
                  <td>{roomLabel(slot, t("timetable.roomEmpty"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("timetable.dailyTitle")}>
        <div className="table-wrap lesson-table-wrap">
          <table className="daily-grid-table timetable-grid timetable-day-table">
            <thead>
              <tr>
                <th>{t("common.period")}</th>
                <th>{t("timetable.time")}</th>
                {!isStudentViewer && <th>{t("common.class")}</th>}
                <th>{t("timetable.subject")}</th>
                <th>{t("timetable.teacher")}</th>
                <th>{t("timetable.room")}</th>
                <th>{t("timetable.updated")}</th>
                <th>{t("common.details")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={dailyColumnCount}>{t("common.loading")}</td>
                </tr>
              )}
              {!loading && selectedDailyDayRows.length === 0 && (
                <tr>
                  <td colSpan={dailyColumnCount}>{t("timetable.emptyDaily")}</td>
                </tr>
              )}
              {!loading &&
                selectedDailyDayRows.map((slot) => {
                  const subjectLabel = slot.event
                    ? eventTypeLabel(t, slot.event.type)
                    : localizeSubjectName(slot.subject?.name || "", language);
                  const teacherLabel = slot.teacher?.name ? localizeTeacherName(slot.teacher.name, language) : "";
                  const roomText = roomLabel(slot, t("timetable.roomEmpty"));
                  const statusText = slot.event
                    ? t("timetable.updated")
                    : slot.updated
                      ? t("timetable.updated")
                      : t("timetable.notUpdated");
                  const detailsText = slot.event
                    ? slot.event.note || t("timetable.updatedNote")
                    : slot.note || t("timetable.noChanges");
                  const cellClass = slot.event
                    ? `daily-cell event-cell event-${String(slot.event.type || "").toLowerCase()}`
                    : slot.updated
                      ? "daily-cell teacher-color-cell"
                      : "free-period";

                  return (
                    <tr key={`${slot.classId}-${slot.period}-${slot.subject?.name || "subject"}`}>
                      <th className="period-time-header">
                        {t("common.period")} {slot.period}
                      </th>
                      <td>{periodTime(periodDefinitions, slot.period) || "-"}</td>
                      {!isStudentViewer && <td>{localizeClassName(slot.class?.name || "", language)}</td>}
                      <td className={cellClass} style={!slot.event ? teacherColorStyle(slot.teacher) : undefined}>
                        {subjectLabel}
                      </td>
                      <td>{teacherLabel}</td>
                      <td>{roomText}</td>
                      <td>
                        <span className={slot.updated ? "timetable-status-badge" : "timetable-status-muted"}>
                          {statusText}
                        </span>
                      </td>
                      <td>{detailsText}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
