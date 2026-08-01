import { useEffect, useMemo, useState } from "react";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { localizePeriodName } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";

type ScheduleClass = { id?: string; name: string };
type ScheduleSlot = {
  classId: string;
  period: number;
  class: { id?: string; name: string };
  subjectId?: string;
  teacherId?: string;
  updatedAt?: string;
  subject?: { id?: string; name?: string | null } | null;
  teacher?: { id?: string; name?: string } | null;
  room?: string | null;
};
type PeriodDefinition = {
  period: number;
  label?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

const DEFAULT_WORKING_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export function useSchedules(language: AppLanguage) {
  const [workingDays, setWorkingDays] = useState<string[]>(DEFAULT_WORKING_DAYS);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [periodDefinitions, setPeriodDefinitions] = useState<PeriodDefinition[]>([]);
  const [day, setDay] = useState("الاثنين");
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const periods = useMemo(() => Array.from({ length: periodsPerDay }, (_, i) => i + 1), [periodsPerDay]);

  async function loadSettings() {
    const res = await somApi.settings.get();
    const days = res.data.settings.workingDays || [];
    setWorkingDays(days);
    setPeriodsPerDay(res.data.settings.periodsPerDay || 7);
    setPeriodDefinitions(res.data.periods || []);
    const firstDay = days[0] || "الاثنين";
    setDay((current) => (days.includes(current) ? current : firstDay));
  }

  async function loadBase(selectedDay = day) {
    const res = await somApi.schedules.base(selectedDay);
    setSlots(res.data || []);
  }

  async function validate() {
    const res = await somApi.schedules.validateBase();
    setConflicts(res.data.conflicts || []);
    if (res.data.ok) alert("لا توجد تعارضات في البرنامج الثابت");
  }

  function periodDisplay(period: number) {
    const def = periodDefinitions.find((item) => item.period === period);
    const name = localizePeriodName(def?.label || undefined, period, language);
    const time = def?.startTime || def?.endTime ? `${def?.startTime || ""} - ${def?.endTime || ""}` : "";
    return { name, time };
  }

  const classes = useMemo(() => {
    const map = new Map<string, ScheduleClass>();
    slots.forEach((slot) => map.set(slot.classId, slot.class));
    return sortSchoolClasses(Array.from(map.values()) as ScheduleClass[]);
  }, [slots]);

  function slotFor(classId: string, period: number) {
    return slots.find((slot) => slot.classId === classId && slot.period === period);
  }

  useEffect(() => {
    loadSettings().catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    loadBase(day).catch((error) => console.error(error));
  }, [day]);

  return {
    workingDays,
    periodsPerDay,
    periodDefinitions,
    day,
    slots,
    conflicts,
    periods,
    classes,
    setDay,
    setConflicts,
    loadSettings,
    loadBase,
    validate,
    periodDisplay,
    slotFor
  };
}
