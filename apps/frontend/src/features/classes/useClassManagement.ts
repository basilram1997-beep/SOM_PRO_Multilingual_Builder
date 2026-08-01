import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_WEEK_DAYS,
  sortSchoolClasses,
  type HomeroomAssignment,
  type SchoolClass,
  type SchoolSettings,
  type Teacher
} from "@som/shared";
import { somApi } from "../../api/somApi";
import { userFacingErrorMessage } from "../../lib/errorMessage";

type ClassDraft = {
  name: string;
  teacherId: string;
  weeklyDay: string;
  weeklyPeriod: number;
  maxStudents: string;
};

function defaultDraft(workingDays: string[], periodsPerDay: number): ClassDraft {
  return {
    name: "",
    teacherId: "",
    weeklyDay: workingDays[0] ?? ALL_WEEK_DAYS[0] ?? "",
    weeklyPeriod: periodsPerDay > 0 ? 1 : 1,
    maxStudents: ""
  };
}

function toHomeroomMap(rows: HomeroomAssignment[]) {
  return new Map(rows.map((row) => [row.classId, row]));
}

export function useClassManagement() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classDrafts, setClassDrafts] = useState<Record<string, string>>({});
  const [classMaxDrafts, setClassMaxDrafts] = useState<Record<string, string>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [homerooms, setHomerooms] = useState<HomeroomAssignment[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>(Array.from(ALL_WEEK_DAYS));
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [form, setForm] = useState<ClassDraft>(defaultDraft(Array.from(ALL_WEEK_DAYS), 7));
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const homeroomByClass = useMemo(() => toHomeroomMap(homerooms), [homerooms]);
  const periods = useMemo(() => Array.from({ length: periodsPerDay }, (_, index) => index + 1), [periodsPerDay]);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const [classesRes, teachersRes, homeroomsRes, settingsRes] = await Promise.all([
        somApi.classes.list(),
        somApi.teachers.list(),
        somApi.homeroom.list(),
        somApi.settings.get()
      ]);

      const settings: SchoolSettings = settingsRes.data.settings;
      const nextWorkingDays = settings.workingDays?.length ? settings.workingDays : Array.from(ALL_WEEK_DAYS);
      const firstWorkingDay: string = nextWorkingDays[0] ?? ALL_WEEK_DAYS[0] ?? "";

      const nextClasses = sortSchoolClasses((classesRes.data || []) as SchoolClass[]);
      setClasses(nextClasses);
      setClassDrafts((previous) => {
        const nextDrafts: Record<string, string> = {};
        const nextMaxDrafts: Record<string, string> = {};
        for (const item of nextClasses) {
          if (item.id) {
            nextDrafts[item.id] = previous[item.id] ?? item.name ?? "";
            nextMaxDrafts[item.id] = item.maxStudents == null ? "" : String(item.maxStudents);
          }
        }
        setClassMaxDrafts(nextMaxDrafts);
        return nextDrafts;
      });
      setTeachers((teachersRes.data || []) as Teacher[]);
      setHomerooms((homeroomsRes.data || []) as HomeroomAssignment[]);
      setWorkingDays(nextWorkingDays);
      setPeriodsPerDay(settings.periodsPerDay || 7);
      setForm((previous) => ({
        ...previous,
        weeklyDay:
          previous.weeklyDay && nextWorkingDays.includes(previous.weeklyDay) ? previous.weeklyDay : firstWorkingDay,
        weeklyPeriod: Math.min(previous.weeklyPeriod || 1, settings.periodsPerDay || 7)
      }));
    } catch (error) {
      console.error(error);
      setLoadError(userFacingErrorMessage(error, "تعذر تحميل إدارة الصفوف"));
    }
  }, []);

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, [load]);

  function resetForm() {
    setForm(defaultDraft(workingDays, periodsPerDay));
  }

  async function createClass() {
    const name = form.name.trim();
    if (!name) {
      alert("اسم الصف مطلوب");
      return;
    }

    try {
      setMessage("");
      setSavingClassId("new");
      const created = await somApi.classes.create({
        name,
        grade: null,
        section: null,
        maxStudents: form.maxStudents.trim() ? Number(form.maxStudents) : null
      });
      const createdClassId = created.data.id;
      if (!createdClassId) {
        throw new Error("CLASS_ID_MISSING");
      }
      if (form.teacherId) {
        await somApi.homeroom.save({
          teacherId: form.teacherId,
          classId: createdClassId,
          weeklyDay: form.weeklyDay || null,
          weeklyPeriod: form.weeklyPeriod || null,
          isActive: true
        });
      }
      await load();
      resetForm();
      setMessage("تم حفظ الصف وربط المربي بنجاح");
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "تعذر حفظ الصف"));
    } finally {
      setSavingClassId(null);
    }
  }

  async function updateClass(classId: string, data: Partial<SchoolClass>) {
    try {
      setSavingClassId(classId);
      await somApi.classes.update(classId, data);
      await load();
      setMessage("تم حفظ تعديل الصف بنجاح");
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "تعذر حفظ تعديل الصف"));
    } finally {
      setSavingClassId(null);
    }
  }

  async function saveHomeroom(classId: string, teacherId: string, weeklyDay?: string, weeklyPeriod?: number) {
    try {
      setSavingClassId(classId);
      const current = homeroomByClass.get(classId);
      if (!teacherId) {
        if (current?.id) {
          await somApi.homeroom.remove(current.id);
          setMessage("تمت إزالة المربي من الصف");
        }
      } else {
        await somApi.homeroom.save({
          teacherId,
          classId,
          weeklyDay: weeklyDay || current?.weeklyDay || workingDays[0] || ALL_WEEK_DAYS[0] || "",
          weeklyPeriod: weeklyPeriod || current?.weeklyPeriod || 1,
          isActive: true
        });
        setMessage("تم حفظ المربي وتحديث الصف");
      }
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "تعذر حفظ المربي للصف"));
    } finally {
      setSavingClassId(null);
    }
  }

  async function removeClass(classId: string, className?: string) {
    if (!confirm(`حذف الصف ${className || ""}؟`)) return;
    try {
      setSavingClassId(classId);
      await somApi.classes.remove(classId);
      await load();
      setMessage("تم حذف الصف وكل ارتباطاته");
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "تعذر حذف الصف"));
    } finally {
      setSavingClassId(null);
    }
  }

  return {
    classes,
    classDrafts,
    classMaxDrafts,
    teachers,
    homeroomByClass,
    workingDays,
    periodsPerDay,
    periods,
    form,
    savingClassId,
    message,
    loadError,
    setForm,
    setClassDrafts,
    setClassMaxDrafts,
    createClass,
    updateClass,
    saveHomeroom,
    removeClass
  };
}
