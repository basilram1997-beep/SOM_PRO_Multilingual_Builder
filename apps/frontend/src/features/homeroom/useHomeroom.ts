import { useCallback, useEffect, useMemo, useState } from "react";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { HomeroomAssignment, HomeroomClass, HomeroomTeacher } from "./homeroomTypes";

const defaultWorkingDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

type HomeroomForm = {
  teacherId: string;
  classId: string;
  weeklyDay: string;
  weeklyPeriod: number;
};

export function useHomeroom() {
  const [teachers, setTeachers] = useState<HomeroomTeacher[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [homerooms, setHomerooms] = useState<HomeroomAssignment[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>(defaultWorkingDays);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [form, setForm] = useState<HomeroomForm>({
    teacherId: "",
    classId: "",
    weeklyDay: defaultWorkingDays[0],
    weeklyPeriod: 1
  });
  const [bulkDay, setBulkDay] = useState(defaultWorkingDays[0]);
  const [bulkPeriod, setBulkPeriod] = useState(2);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const periods = useMemo(() => Array.from({ length: periodsPerDay }, (_, i) => i + 1), [periodsPerDay]);

  const load = useCallback(async () => {
    try {
      const [teachersRes, classesRes, homeroomsRes, settingsRes] = await Promise.all([
        somApi.teachers.list(),
        somApi.classes.list(),
        somApi.homeroom.list(),
        somApi.settings.get()
      ]);
      const days = settingsRes.data.settings.workingDays || [];
      const firstDay = days[0] || defaultWorkingDays[0];
      const nextTeachers = (teachersRes.data || [])
        .map((teacher: { id?: string; name?: string }) => ({ id: teacher.id || "", name: teacher.name || "" }))
        .filter((teacher): teacher is HomeroomTeacher => Boolean(teacher.id && teacher.name));
      const nextClasses = sortSchoolClasses(
        (classesRes.data || [])
          .map((cls: { id?: string; name?: string }) => ({ id: cls.id || "", name: cls.name || "" }))
          .filter((cls): cls is HomeroomClass => Boolean(cls.id && cls.name))
      );
      const nextHomerooms = homeroomsRes.data || [];
      setTeachers(nextTeachers);
      setClasses(nextClasses);
      setHomerooms(nextHomerooms);
      setWorkingDays(days.length ? days : defaultWorkingDays);
      setPeriodsPerDay(settingsRes.data.settings.periodsPerDay || 7);
      setBulkDay((previous) => previous || firstDay);
      setForm((previous) => ({ ...previous, weeklyDay: previous.weeklyDay || firstDay }));
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل تحميل بيانات المربين"));
    }
  }, []);

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, [load]);

  function homeroomFor(classId: string) {
    return homerooms.find((h) => h.classId === classId);
  }

  function teacherIdFromClassName(className: string) {
    const afterSlash = className.split("/").pop()?.trim();
    const found = teachers.find((teacher) => teacher.name === afterSlash || afterSlash?.includes(teacher.name));
    return found?.id || "";
  }

  function toggleClass(classId: string) {
    setSelectedClassIds((previous) =>
      previous.includes(classId) ? previous.filter((id) => id !== classId) : [...previous, classId]
    );
  }

  function selectAllClasses() {
    setSelectedClassIds(classes.map((cls) => cls.id));
  }

  async function saveHomeroom() {
    if (!form.teacherId || !form.classId) return alert("اختر المربي والصف");
    try {
      await somApi.homeroom.save({ ...form, isActive: true });
      setConflicts([]);
      await load();
      alert("تم حفظ حصة التربية");
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حفظ حصة التربية"));
    }
  }

  async function applyBulkTime() {
    const targetClasses = selectedClassIds.length
      ? classes.filter((cls) => selectedClassIds.includes(cls.id))
      : classes;
    try {
      for (const cls of targetClasses) {
        const existing = homeroomFor(cls.id);
        const teacherId = existing?.teacherId || teacherIdFromClassName(cls.name);
        if (!teacherId) continue;
        await somApi.homeroom.save({
          teacherId,
          classId: cls.id,
          weeklyDay: bulkDay,
          weeklyPeriod: bulkPeriod,
          isActive: true
        });
      }
      const classIds = targetClasses.map((cls) => cls.id);
      const res = await somApi.homeroom.applyToBaseSchedule(true, classIds);
      setConflicts(res.data.conflicts || []);
      await load();
      alert("تم تحديد يوم وحصة التربية للصفوف المختارة ومنحها أولوية في البرنامج الثابت");
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل تطبيق حصص التربية على الصفوف المختارة"));
    }
  }

  async function applyHomerooms(overwriteConflicts = false) {
    try {
      const res = await somApi.homeroom.applyToBaseSchedule(overwriteConflicts, selectedClassIds);
      setConflicts(res.data.conflicts || []);
      if (res.data.conflicts.length) {
        alert("تم التطبيق مع استبدال الحصة الموجودة");
      } else {
        alert(`تم تطبيق عدد حصص التربية على البرنامج الثابت: ${res.data.applied}`);
      }
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل تطبيق حصص التربية"));
    }
  }

  async function removeHomeroom(id?: string) {
    if (!id) return;
    try {
      await somApi.homeroom.remove(id);
      setConflicts([]);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حذف حصة التربية"));
    }
  }

  return {
    teachers,
    classes,
    homerooms,
    workingDays,
    periodsPerDay,
    periods,
    form,
    bulkDay,
    bulkPeriod,
    selectedClassIds,
    conflicts,
    setForm,
    setBulkDay,
    setBulkPeriod,
    toggleClass,
    selectAllClasses,
    saveHomeroom,
    applyBulkTime,
    applyHomerooms,
    removeHomeroom,
    homeroomFor,
    teacherIdFromClassName
  };
}
