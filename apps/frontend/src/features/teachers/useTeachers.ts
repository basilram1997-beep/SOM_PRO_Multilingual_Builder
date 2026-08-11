import { useEffect, useMemo, useState } from "react";
import type { Teacher } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { localizeTeacherName } from "../../i18n/displayNames";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import {
  arabicDays,
  assignmentText,
  blankTeacher,
  normalizeTeacherForm,
  normalizeTeacherRecord
} from "./teacherHelpers";
import type {
  AppLanguage,
  BaseScheduleSlotWithDetails,
  DailyScheduleSummary,
  TeacherWithAssignments
} from "./teacherTypes";

type UseTeachersOptions = {
  language: AppLanguage;
};

function countTeacherMatches(slots: BaseScheduleSlotWithDetails[], teacherId?: string) {
  if (!teacherId) return 0;
  return slots.filter((slot) => slot.teacherId === teacherId).length;
}

function countSubstitutions(
  substitutions: NonNullable<DailyScheduleSummary>["substitutions"] | undefined,
  teacherId?: string,
  role: "absent" | "substitute" = "substitute"
) {
  if (!teacherId) return 0;
  const list = substitutions || [];
  if (role === "absent") return list.filter((entry) => entry.absentTeacherId === teacherId).length;
  return list.filter((entry) => entry.substituteTeacherId === teacherId).length;
}

export function useTeachers({ language }: UseTeachersOptions) {
  const [teachers, setTeachers] = useState<TeacherWithAssignments[]>([]);
  const [selected, setSelected] = useState<TeacherWithAssignments | null>(null);
  const [form, setForm] = useState<Teacher>(blankTeacher);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(arabicDays[new Date().getDay()]);
  const [schoolClasses, setSchoolClasses] = useState<{ id: string; name: string }[]>([]);
  const [schoolSubjects, setSchoolSubjects] = useState<{ id: string; name: string }[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [todaySlots, setTodaySlots] = useState<BaseScheduleSlotWithDetails[]>([]);
  const [weeklySlots, setWeeklySlots] = useState<BaseScheduleSlotWithDetails[]>([]);
  const [daily, setDaily] = useState<DailyScheduleSummary>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  async function load() {
    try {
      const [teachersRes, settingsRes, classesRes, subjectsRes] = await Promise.all([
        somApi.teachers.list(),
        somApi.settings.get(),
        somApi.classes.list(),
        somApi.subjects.list()
      ]);

      const availableTeachers = (teachersRes.data as TeacherWithAssignments[]).map((teacher) =>
        normalizeTeacherRecord(teacher)
      );
      setTeachers(availableTeachers);
      setSchoolClasses(sortSchoolClasses((classesRes.data || []) as { id: string; name: string }[]));
      setSchoolSubjects((subjectsRes.data || []) as { id: string; name: string }[]);

      const days = settingsRes.data.settings.workingDays || [];
      setWorkingDays(days);
      setPeriodsPerDay(settingsRes.data.settings.periodsPerDay || 7);
      const selectedDay = days.includes(day) ? day : days[0] || day;
      setDay(selectedDay);

      const [slotsRes, weeklySlotsRes, dailyRes] = await Promise.all([
        somApi.schedules.base(selectedDay),
        somApi.schedules.base(),
        somApi.daily.get(todayIso)
      ]);
      setTodaySlots(slotsRes.data as BaseScheduleSlotWithDetails[]);
      setWeeklySlots(weeklySlotsRes.data as BaseScheduleSlotWithDetails[]);
      setDaily(dailyRes.data as DailyScheduleSummary);
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل تحميل بيانات المعلمين"));
    }
  }

  async function loadSlots(selectedDay: string) {
    setDay(selectedDay);
    try {
      const slotsRes = await somApi.schedules.base(selectedDay);
      setTodaySlots(slotsRes.data as BaseScheduleSlotWithDetails[]);
    } catch (error) {
      console.error(error);
      setTodaySlots([]);
    }
  }

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    const classNames = (teacher: TeacherWithAssignments) =>
      (teacher.preferredClasses || [])
        .map((classId) => schoolClasses.find((item) => item.id === classId)?.name || classId)
        .join(" ");
    return teachers.filter((t) =>
      `${t.name} ${localizeTeacherName(t.name, language)} ${t.specialty || ""} ${t.adminRole || ""} ${assignmentText(t, "classes", language, schoolClasses, schoolSubjects)} ${classNames(t)}`.includes(
        q
      )
    );
  }, [teachers, query, language, schoolClasses, schoolSubjects]);

  function openTeacher(t: TeacherWithAssignments) {
    setSelected(t);
    setForm(normalizeTeacherForm(t));
  }

  function newTeacher() {
    setSelected(null);
    setForm({ ...blankTeacher, workDays: workingDays.length ? [...workingDays] : [] });
  }

  async function save() {
    if (!form.name.trim()) return alert("اسم المعلم مطلوب");
    try {
      const payload = normalizeTeacherForm(form);
      if (form.id) await somApi.teachers.update(form.id, payload);
      else await somApi.teachers.create(payload);
      await load();
      setSelected(null);
      setForm(blankTeacher);
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حفظ المعلم"));
    }
  }

  async function remove(id?: string, name?: string) {
    const targetId = id || selected?.id;
    const targetName = name || selected?.name;
    if (!targetId) return alert("اختر معلماً أولاً");
    if (!confirm(`حذف المعلم ${targetName || ""}؟`)) return;
    try {
      await somApi.teachers.remove(targetId);
      setSelected(null);
      setForm(blankTeacher);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حذف المعلم"));
    }
  }

  function lessonsToday(teacherId?: string) {
    return countTeacherMatches(todaySlots, teacherId);
  }

  function weeklyLessons(teacherId?: string) {
    return countTeacherMatches(weeklySlots, teacherId);
  }

  function substitutionsToday(teacherId?: string) {
    return countSubstitutions(daily?.substitutions || [], teacherId, "substitute");
  }

  function affectedToday(teacherId?: string) {
    return countSubstitutions(daily?.substitutions || [], teacherId, "absent");
  }

  async function updateAssignmentWeeklyPeriods(assignmentId: string, weeklyPeriods: number) {
    const teacherId = form.id || selected?.id;
    if (!teacherId) return;
    try {
      await somApi.teachers.updateAssignmentWeeklyPeriods(teacherId, assignmentId, weeklyPeriods);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل تحديث عدد الحصص الأسبوعية"));
    }
  }

  async function addAssignment(classId: string, subjectId: string, weeklyPeriods: number) {
    const teacherId = form.id || selected?.id;
    if (!teacherId) return alert("اختر معلماً أولاً");
    try {
      await somApi.teachers.assignSubject(teacherId, { classId, subjectId, weeklyPeriods });
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "تعذر إضافة الصف والمادة"));
    }
  }

  async function removeAssignment(assignmentId: string) {
    const teacherId = form.id || selected?.id;
    if (!teacherId) return alert("اختر معلماً أولاً");
    try {
      await somApi.teachers.removeAssignment(teacherId, assignmentId);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "تعذر حذف تكليف الصف والمادة"));
    }
  }

  return {
    teachers,
    selected,
    form,
    query,
    day,
    schoolClasses,
    schoolSubjects,
    workingDays,
    periodsPerDay,
    todaySlots,
    weeklySlots,
    daily,
    filtered,
    setQuery,
    setForm,
    setDay,
    loadSlots,
    openTeacher,
    newTeacher,
    save,
    remove,
    lessonsToday,
    weeklyLessons,
    substitutionsToday,
    affectedToday,
    removeAssignment,
    updateAssignmentWeeklyPeriods,
    addAssignment
  };
}
