import { useEffect, useMemo, useState } from "react";
import type { Teacher } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { localizeTeacherName } from "../../i18n/displayNames";
import type {
  AppLanguage,
  DailyBaseSlot,
  DailyEvent,
  DailyEventForm,
  DailyStatusDraft,
  DailyStatusType,
  DailySubstitution,
  TeacherProgram
} from "./dailyTypes";
import {
  dailyErrorMessage,
  defaultDay,
  defaultWorkingDays,
  emptyEventForm,
  normalizeDaily,
  type DailyLoadResult
} from "./dailyScheduleHelpers";

type UseDailyScheduleOptions = {
  initialDate: string;
  language: AppLanguage;
  onArchiveComplete?: () => void;
};

function localizePeriodName(language: AppLanguage, label: string | null | undefined, period: number) {
  const normalized = (label || "").trim();
  const periodPrefix = language === "ar" ? "الحصة" : language === "he" ? "שיעור" : "Period";
  const defaultPattern = /^(?:الحصة|שיעور|שיעור|Period)\s*\d+$/i;

  if (!normalized || defaultPattern.test(normalized)) {
    return `${periodPrefix} ${period}`;
  }

  return normalized;
}

function resetScheduleState(
  setResult: (value: DailyLoadResult | null) => void,
  setEvents: (value: DailyEvent[]) => void,
  setStatuses: (value: DailyStatusDraft[]) => void,
  setTeacherPrograms: (value: TeacherProgram[]) => void
) {
  setResult(null);
  setEvents([]);
  setStatuses([]);
  setTeacherPrograms([]);
}

function mapStatuses(statuses: DailyStatusDraft[]) {
  return statuses.map((status) => ({
    teacherId: status.teacherId,
    type: status.type,
    fromPeriod: status.fromPeriod,
    toPeriod: status.toPeriod,
    reason: status.reason || null
  }));
}

export function useDailySchedule({ initialDate, language, onArchiveComplete }: UseDailyScheduleOptions) {
  const [date, setDate] = useState(initialDate);
  const [workingDays, setWorkingDays] = useState<string[]>(defaultWorkingDays);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [periodDefinitions, setPeriodDefinitions] = useState<
    Array<{ period: number; label?: string | null; startTime?: string | null; endTime?: string | null }>
  >([]);
  const [day, setDay] = useState(defaultDay);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [type, setType] = useState<DailyStatusType>("ABSENT");
  const [fromPeriod, setFromPeriod] = useState(1);
  const [toPeriod, setToPeriod] = useState(7);
  const [reason, setReason] = useState("");
  const [statuses, setStatuses] = useState<DailyStatusDraft[]>([]);
  const [result, setResult] = useState<DailyLoadResult | null>(null);
  const [teacherPrograms, setTeacherPrograms] = useState<TeacherProgram[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [showOnlyBusyTeachers, setShowOnlyBusyTeachers] = useState(true);
  const [loadingTeacherPrograms, setLoadingTeacherPrograms] = useState(false);
  const [subModal, setSubModal] = useState<DailySubstitution | null>(null);
  const [allClasses, setAllClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [dayBaseSlots, setDayBaseSlots] = useState<DailyBaseSlot[]>([]);
  const [events, setEvents] = useState<DailyEvent[]>([]);
  const [eventForm, setEventForm] = useState<DailyEventForm>(emptyEventForm());

  const periods = useMemo(() => Array.from({ length: periodsPerDay }, (_, i) => i + 1), [periodsPerDay]);

  useEffect(() => {
    setDate(initialDate);
  }, [initialDate]);

  function periodDisplay(period: number) {
    const def = periodDefinitions.find((p) => p.period === period);
    const name = localizePeriodName(language, def?.label, period);
    const time = def?.startTime || def?.endTime ? `${def?.startTime || ""} - ${def?.endTime || ""}` : "";
    return { name, time };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [teachersResponse, classesResponse, settingsResponse] = await Promise.all([
          somApi.teachers.list(),
          somApi.classes.list(),
          somApi.settings.get()
        ]);
        if (cancelled) return;

        setTeachers(teachersResponse.data || []);
        setAllClasses(
          sortSchoolClasses(
            (classesResponse.data || [])
              .filter((cls: { id?: string; name?: string | null }) => Boolean(cls.id && cls.name))
              .map((cls: { id?: string; name?: string | null }) => ({ id: cls.id as string, name: cls.name as string }))
          )
        );

        const days = settingsResponse.data.settings.workingDays || [];
        setWorkingDays(days);
        setPeriodsPerDay(settingsResponse.data.settings.periodsPerDay || 7);
        setToPeriod(settingsResponse.data.settings.periodsPerDay || 7);
        setDay(days[0] || defaultDay);
        setPeriodDefinitions(settingsResponse.data.periods || []);
      } catch {
        if (!cancelled) {
          setTeachers([]);
          setAllClasses([]);
          setWorkingDays(defaultWorkingDays);
          setPeriodsPerDay(7);
          setToPeriod(7);
          setDay(defaultDay);
          setPeriodDefinitions([]);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadDayBaseSlots(targetDay = day) {
    if (!targetDay) return;
    try {
      const res = await somApi.schedules.base(targetDay);
      setDayBaseSlots(res.data || []);
    } catch {
      setDayBaseSlots([]);
    }
  }

  useEffect(() => {
    loadDayBaseSlots(day).catch(() => {
      setDayBaseSlots([]);
    });
  }, [day]);

  useEffect(() => {
    let cancelled = false;

    async function loadDailyForDate() {
      const existing = await somApi.daily.get(date);
      if (cancelled) return;

      if (existing.data) {
        const normalized = normalizeDaily(existing.data);
        setResult(normalized);
        setEvents(normalized?.events || []);
        setStatuses(mapStatuses(normalized?.statuses || []));
        if (normalized?.daily?.day) setDay(normalized.daily.day);
      } else {
        resetScheduleState(setResult, setEvents, setStatuses, setTeacherPrograms);
      }
    }

    loadDailyForDate().catch(() => {
      if (!cancelled) {
        resetScheduleState(setResult, setEvents, setStatuses, setTeacherPrograms);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [date]);

  function addStatus() {
    if (!teacherId) return alert("اختر معلماً");
    if (fromPeriod > toPeriod) return alert("يجب أن يكون وقت البداية قبل وقت النهاية");
    setStatuses([...statuses, { teacherId, type, fromPeriod, toPeriod, reason: reason.trim() || null }]);
    setTeacherId("");
    setReason("");
  }

  function removeStatus(index: number) {
    setStatuses(statuses.filter((_, i) => i !== index));
  }

  async function generate() {
    try {
      const res = await somApi.daily.generate({ date, day, statuses, manualSubstitutions: [] });
      setResult(res.data as DailyLoadResult);
      setEvents(res.data.events || []);
      setTeacherPrograms([]);
    } catch (error) {
      alert(dailyErrorMessage(error, "فشل توليد برنامج اليومي الجديد"));
    }
  }

  async function ensureDailyScheduleBeforeTeacherPrograms() {
    if (result?.daily) return result;
    const existing = await somApi.daily.get(date);
    if (existing.data) {
      const normalized = normalizeDaily(existing.data);
      setResult(normalized);
      setEvents(normalized?.events || []);
      return normalized;
    }
    const generated = await somApi.daily.generate({ date, day, statuses, manualSubstitutions: [] });
    setResult(generated.data as DailyLoadResult);
    return generated.data;
  }

  async function archiveDay() {
    try {
      await ensureDailyScheduleBeforeTeacherPrograms();
      await somApi.archive.archiveDay(date);
      alert("تم حفظ اليوم في الأرشيف وفتح صفحة الأرشيف");
      onArchiveComplete?.();
    } catch (error: unknown) {
      alert(dailyErrorMessage(error, "لم يتم حفظ اليوم في الأرشيف"));
    }
  }

  async function generateTeacherPrograms() {
    try {
      setLoadingTeacherPrograms(true);
      await ensureDailyScheduleBeforeTeacherPrograms();
      const res = await somApi.daily.generateTeacherPrograms(date, { day });
      const programs = res.data.programs || [];
      setTeacherPrograms(programs);
      if (programs.length === 0) alert("لم يتم العثور على معلمات مخصصات لهذا اليوم");
    } catch (error: unknown) {
      alert(dailyErrorMessage(error, "فشلت عملية توليد برامج المعلمين"));
    } finally {
      setLoadingTeacherPrograms(false);
    }
  }

  function toggleEventClass(classId: string) {
    setEventForm((prev) => ({
      ...prev,
      classIds: prev.classIds.includes(classId)
        ? prev.classIds.filter((id) => id !== classId)
        : [...prev.classIds, classId]
    }));
  }

  async function saveEvent() {
    if (!eventForm.note.trim()) return alert("أدخل عنواناً أو وصفاً للحدث");
    if (eventForm.fromPeriod > eventForm.toPeriod) return alert("يجب أن يكون وقت البداية قبل وقت النهاية");
    try {
      const res = await somApi.daily.createEvent(date, { ...eventForm, day });
      setEvents(res.data || []);
      setResult((prev) => (prev ? { ...prev, events: res.data || [] } : prev));
      setEventForm(emptyEventForm());
    } catch (error) {
      alert(dailyErrorMessage(error, "فشل حفظ الحدث"));
    }
  }

  async function removeEvent(id: string) {
    try {
      await somApi.daily.removeEvent(id);
      setEvents((prev) => prev.filter((event) => event.id !== id));
      setResult((prev) => (prev ? { ...prev, events: (prev.events || []).filter((event) => event.id !== id) } : prev));
    } catch (error) {
      alert(dailyErrorMessage(error, "فشل حذف الحدث"));
    }
  }

  function teacherName(id: string) {
    return localizeTeacherName(teachers.find((t) => t.id === id)?.name || id, language);
  }

  const baseSlots = result?.baseSlots || [];
  const substitutions = result?.substitutions || [];
  const dailyEvents = events.length ? events : result?.events || [];
  const dailyDuties = result?.duties || [];

  const classes = useMemo(() => {
    const map = new Map<string, { id?: string; name: string }>();
    baseSlots.forEach((slot) => map.set(slot.classId, slot.class));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [baseSlots]);

  function slotFor(classId: string, period: number) {
    return baseSlots.find((slot) => slot.classId === classId && slot.period === period);
  }

  function substitutionFor(classId: string, period: number) {
    return substitutions.find((slot) => slot.classId === classId && slot.period === period);
  }

  function eventForCell(classId: string, period: number) {
    return dailyEvents.find(
      (event) => (!event.classId || event.classId === classId) && period >= event.fromPeriod && period <= event.toPeriod
    );
  }

  function freeTeachersForPeriod(period: number) {
    const unavailable = new Set(
      statuses
        .filter((status) => period >= status.fromPeriod && period <= status.toPeriod)
        .map((status) => status.teacherId)
    );
    const scheduleSlots = dayBaseSlots.length ? dayBaseSlots : baseSlots;
    const busy = new Set(
      scheduleSlots
        .filter((slot) => {
          const coveredByEvent = dailyEvents.some(
            (event) =>
              (!event.classId || event.classId === slot.classId) &&
              period >= event.fromPeriod &&
              period <= event.toPeriod
          );
          return slot.period === period && !coveredByEvent;
        })
        .map((slot) => slot.teacherId)
    );
    dailyEvents.forEach((event) => {
      if (period >= event.fromPeriod && period <= event.toPeriod && event.substituteTeacherId) {
        busy.add(event.substituteTeacherId);
      }
    });
    return teachers.filter((teacher) => teacher.id && !busy.has(teacher.id) && !unavailable.has(teacher.id));
  }

  function openSubstitutionCell(substitution: DailySubstitution) {
    setSubModal(substitution);
  }

  function availableTeachersFor(substitution: DailySubstitution | null) {
    if (!substitution) return [];
    const period = substitution.period;
    const unavailable = new Set(
      statuses.filter((s) => period >= s.fromPeriod && period <= s.toPeriod).map((s) => s.teacherId)
    );
    const busy = new Set(baseSlots.filter((slot) => slot.period === period).map((slot) => slot.teacherId));
    const used = new Set(
      substitutions
        .filter((s) => s.period === period && s.id !== substitution.id && s.substituteTeacherId)
        .map((s) => s.substituteTeacherId)
    );
    return teachers.filter(
      (teacher) =>
        teacher.id !== substitution.absentTeacherId &&
        !unavailable.has(teacher.id || "") &&
        !busy.has(teacher.id || "") &&
        !used.has(teacher.id || "")
    );
  }

  async function applyManualSubstitute(substituteTeacherId: string | null) {
    if (!subModal?.id) return;
    try {
      const res = await somApi.daily.updateSubstitution(subModal.id, substituteTeacherId);
      const updated = res.data;
      setResult((prev) =>
        prev
          ? {
              ...prev,
              substitutions: (prev.substitutions || []).map((substitution) =>
                substitution.id === updated.id ? updated : substitution
              )
            }
          : prev
      );
      setSubModal(null);
      setTeacherPrograms([]);
    } catch (error) {
      alert(dailyErrorMessage(error, "فشل تحديث البديل"));
    }
  }

  const visibleTeacherPrograms = teacherPrograms.filter((program) => {
    const matchesSearch = !teacherSearch.trim() || program.teacherName.includes(teacherSearch.trim());
    const matchesBusy = !showOnlyBusyTeachers || program.lessons.length > 0 || !!program.status;
    return matchesSearch && matchesBusy;
  });

  return {
    date,
    setDate,
    workingDays,
    periodsPerDay,
    periodDefinitions,
    day,
    teachers,
    teacherId,
    type,
    fromPeriod,
    toPeriod,
    reason,
    statuses,
    result,
    teacherPrograms,
    teacherSearch,
    showOnlyBusyTeachers,
    loadingTeacherPrograms,
    subModal,
    allClasses,
    dayBaseSlots,
    events,
    eventForm,
    periods,
    baseSlots,
    substitutions,
    dailyEvents,
    dailyDuties,
    classes,
    periodDisplay,
    setDay,
    setTeacherId,
    setType,
    setFromPeriod,
    setToPeriod,
    setReason,
    setTeacherPrograms,
    setTeacherSearch,
    setShowOnlyBusyTeachers,
    setEventForm,
    setEvents,
    setResult,
    setStatuses,
    setSubModal,
    setWorkingDays,
    setPeriodsPerDay,
    setPeriodDefinitions,
    addStatus,
    removeStatus,
    generate,
    archiveDay,
    generateTeacherPrograms,
    toggleEventClass,
    saveEvent,
    removeEvent,
    teacherName,
    slotFor,
    substitutionFor,
    eventForCell,
    freeTeachersForPeriod,
    openSubstitutionCell,
    availableTeachersFor,
    applyManualSubstitute,
    visibleTeacherPrograms
  };
}
