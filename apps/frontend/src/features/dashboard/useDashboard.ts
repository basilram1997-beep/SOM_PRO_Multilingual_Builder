import { useCallback, useEffect, useMemo, useState } from "react";
import { somApi } from "../../api/somApi";
import type { LanguageCode } from "../../i18n/i18n";
import { localizeSubjectName, normalizeVisibleName, uniqueVisibleNameOptions } from "../../i18n/displayNames";
import { sortSchoolClasses } from "@som/shared";

export type DashboardStatusType = "ABSENT" | "LATE" | "LEFT";

export type DashboardTeacher = {
  id?: string;
  name?: string;
};

export type DashboardStatus = {
  id: string;
  type: DashboardStatusType;
  teacher?: DashboardTeacher;
  fromPeriod: number;
  toPeriod?: number;
};

export type DashboardSchool = {
  name?: string;
  managerName?: string;
  institutionCode?: string;
  address?: string;
};

export type DashboardStats = {
  school?: DashboardSchool;
  workingDays?: string[];
  periodsPerDay?: number;
  teachers?: number;
  today?: {
    absent?: number;
    late?: number;
    left?: number;
    substitutions?: number;
    affectedClasses?: number;
  };
  schoolDetails?: {
    classes?: number;
    subjects?: number;
    weeklyLessons?: number;
    monthlyLessons?: number;
    termLessons?: number;
    yearlyLessons?: number;
    homeroomTeachers?: number;
  };
};

export type DashboardClass = {
  id: string;
  name: string;
};

export type DashboardSubject = {
  id: string;
  name: string;
};

export type DashboardSlot = {
  id?: string;
  classId: string;
  subjectId: string;
};

export type DashboardTeacherRequest = {
  id: string;
  createdAt: string;
  status: string;
  title: string;
  message: string;
  payload?: {
    teacherId?: string;
    teacherName?: string;
    date?: string;
    day?: string;
    status?: string;
    fromPeriod?: number;
    toPeriod?: number;
    reason?: string;
    note?: string;
  } | null;
};

type TodayInfo = {
  iso: string;
  day: string;
};

type DashboardDailyResponse = {
  statuses?: DashboardStatus[];
};

function resolveLocale(language: string) {
  if (language === "he") return "he-IL";
  if (language === "en") return "en-US";
  return "ar";
}

function todayInfo(language: string): TodayInfo {
  const d = new Date();
  return {
    iso: d.toISOString().slice(0, 10),
    day: d.toLocaleDateString(resolveLocale(language), { weekday: "long" })
  };
}

function emptyDaily(): DashboardDailyResponse {
  return { statuses: [] };
}

export function useDashboard(language: LanguageCode) {
  const today = useMemo(() => todayInfo(language), [language]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [daily, setDaily] = useState<DashboardDailyResponse | null>(null);
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [subjects, setSubjects] = useState<DashboardSubject[]>([]);
  const [slots, setSlots] = useState<DashboardSlot[]>([]);
  const [teacherRequests, setTeacherRequests] = useState<DashboardTeacherRequest[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [detailType, setDetailType] = useState<DashboardStatusType | null>(null);

  const load = useCallback(async () => {
    try {
      const [
        statsResponse,
        classesResponse,
        subjectsResponse,
        baseScheduleResponse,
        dailyResponse,
        teacherRequestsResponse
      ] = await Promise.all([
        somApi.stats.get(today.iso),
        somApi.classes.list(),
        somApi.subjects.list(),
        somApi.schedules.base(),
        somApi.daily.get(today.iso).catch(() => ({ data: null })),
        somApi.teachers.permissions.list(8).catch(() => ({ data: [] }))
      ]);

      const nextClasses = sortSchoolClasses((classesResponse.data || []) as DashboardClass[]);
      const nextSubjects = uniqueVisibleNameOptions((subjectsResponse.data || []) as DashboardSubject[]).filter(
        (subject, index, allSubjects) => {
          const visibleName = normalizeVisibleName(localizeSubjectName(subject.name, language)).toLocaleLowerCase();
          return (
            visibleName &&
            allSubjects.findIndex(
              (item) =>
                normalizeVisibleName(localizeSubjectName(item.name, language)).toLocaleLowerCase() === visibleName
            ) === index
          );
        }
      );
      const nextSlots = (baseScheduleResponse.data || []) as unknown as DashboardSlot[];

      setStats(statsResponse.data || null);
      setClasses(nextClasses);
      setSubjects(nextSubjects);
      setSlots(nextSlots);
      setTeacherRequests((teacherRequestsResponse.data || []) as DashboardTeacherRequest[]);
      setDaily((dailyResponse.data || emptyDaily()) as DashboardDailyResponse);
      setSelectedClassId(nextClasses[0]?.id || "");
      setSelectedSubjectId(nextSubjects[0]?.id || "");
    } catch (error) {
      console.error(error);
      setStats(null);
      setClasses([]);
      setSubjects([]);
      setSlots([]);
      setTeacherRequests([]);
      setDaily(emptyDaily());
      setSelectedClassId("");
      setSelectedSubjectId("");
    }
  }, [today.iso]);

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, [load, language]);

  const specificCount = useCallback(() => {
    if (!selectedClassId || !selectedSubjectId) return 0;
    return slots.filter((slot) => slot.classId === selectedClassId && slot.subjectId === selectedSubjectId).length;
  }, [slots, selectedClassId, selectedSubjectId]);

  return {
    today,
    stats,
    daily,
    classes,
    subjects,
    slots,
    teacherRequests,
    selectedClassId,
    selectedSubjectId,
    detailType,
    setSelectedClassId,
    setSelectedSubjectId,
    setDetailType,
    specificCount
  };
}
