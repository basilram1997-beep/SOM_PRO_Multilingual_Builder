import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { somApi } from "../../api/somApi";
import { ALL_WEEK_DAYS } from "@som/shared";
import { localizeDay, localizeSubjectName, localizeTeacherName, repairMojibake } from "../../i18n/displayNames";
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
  if (typeof room === "string") return room || fallback;
  if (room && typeof room === "object") return room.name || fallback;
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

  const selectedBaseRows = useMemo(() => {
    if (!baseDay) return [];
    return weeklyRows.filter((slot) => canonicalDay(slot.day || "") === baseDay);
  }, [baseDay, weeklyRows]);

  const currentDailyBaseRows = useMemo(() => {
    if (!day) return [];
    return weeklyRows.filter((slot) => canonicalDay(slot.day || "") === day);
  }, [day, weeklyRows]);

  const dailyRows = useMemo(() => {
    const slots =
      dailyDetails?.baseSlots && dailyDetails.baseSlots.length > 0
        ? (dailyDetails.baseSlots as ScheduleSlot[])
        : currentDailyBaseRows;
    return sortRows(buildDailyRows(slots, dailyDetails?.substitutions || [], dailyDetails?.events || []));
  }, [currentDailyBaseRows, dailyDetails?.baseSlots, dailyDetails?.events, dailyDetails?.substitutions]);

  return (
    <div className="page timetable-page">
      <h2>{isStudentViewer ? t("nav.studentTimetable") : t("timetable.title")}</h2>

      <Card title={t("nav.teacherBaseSchedule")}>
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
          <table className="lesson-table timetable-table">
            <thead>
              <tr>
                <th>{t("timetable.day")}</th>
                <th>{t("timetable.period")}</th>
                <th>{t("timetable.time")}</th>
                {!isStudentViewer && <th>{t("timetable.subject")}</th>}
                <th>{t("timetable.teacher")}</th>
                <th>{t("timetable.room")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedBaseRows.map((slot) => (
                <tr key={`${slot.day || ""}-${slot.period}-${slot.classId}`}>
                  <td>{localizeDay(slot.day || "", language)}</td>
                  <td>{slot.period}</td>
                  <td>{periodTime(periodDefinitions, slot.period) || "-"}</td>
                  {!isStudentViewer && <td>{localizeSubjectName(slot.subject?.name || "", language)}</td>}
                  <td>
                    <span className="teacher-name" style={teacherColorStyle(slot.teacher)}>
                      {localizeTeacherName(slot.teacher?.name || "", language)}
                    </span>
                  </td>
                  <td>{roomLabel(slot, t("timetable.roomEmpty"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("timetable.dailyTitle")}>
        <div className="table-wrap lesson-table-wrap">
          <table className="lesson-table timetable-table">
            <thead>
              <tr>
                <th>{t("timetable.day")}</th>
                <th>{t("timetable.period")}</th>
                <th>{t("timetable.time")}</th>
                {!isStudentViewer && <th>{t("timetable.subject")}</th>}
                <th>{t("timetable.teacher")}</th>
                <th>{t("timetable.room")}</th>
                <th>{t("timetable.status")}</th>
                <th>{t("timetable.details")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isStudentViewer ? 7 : 8}>{t("common.loading")}</td>
                </tr>
              )}
              {!loading &&
                dailyRows.map((slot) => (
                  <tr
                    key={`${slot.day || ""}-${slot.period}-${slot.classId}`}
                    className={slot.updated ? "timetable-updated-row" : ""}
                  >
                    <td>{localizeDay(slot.day || day, language)}</td>
                    <td>{slot.period}</td>
                    <td>{periodTime(periodDefinitions, slot.period) || "-"}</td>
                    {!isStudentViewer && <td>{localizeSubjectName(slot.subject?.name || "", language)}</td>}
                    <td>
                      <span className="teacher-name" style={teacherColorStyle(slot.teacher)}>
                        {localizeTeacherName(slot.teacher?.name || "", language)}
                      </span>
                    </td>
                    <td>{roomLabel(slot, t("timetable.roomEmpty"))}</td>
                    <td>
                      {slot.updated ? (
                        <span className="timetable-status-badge">{t("timetable.updated")}</span>
                      ) : (
                        <span className="timetable-status-muted">{t("timetable.notUpdated")}</span>
                      )}
                    </td>
                    <td>
                      <div className="timetable-detail-cell">
                        <strong>
                          {slot.event
                            ? eventTypeLabel(t, slot.event.type)
                            : slot.status === "SUBSTITUTION"
                              ? t("timetable.substitutionChange")
                              : t("timetable.noChange")}
                        </strong>
                        {slot.note ? <span>{slot.note}</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
