import { useEffect, useMemo, useState } from "react";
import type { SchoolClass } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import { behaviorCategories, getBehaviorTemplates } from "./behaviorTemplates";
import {
  emptyBehaviorForm,
  type BehaviorListResponse,
  type BehaviorRow,
  type StudentBehaviorForm
} from "./studentTypes";

const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : dayNames[value.getDay()];
}

function buildForm(studentId: string, date: string, day: string, row?: BehaviorRow | null): StudentBehaviorForm {
  const existing = row?.behaviorRecords?.[0];
  const category = existing?.category || behaviorCategories[0].key;
  const tone = existing?.tone || "POSITIVE";
  const templates = getBehaviorTemplates(category, tone);
  return {
    ...emptyBehaviorForm,
    id: existing?.id,
    studentId,
    date,
    day,
    category,
    tone,
    template: existing?.template || templates[0] || "",
    note: existing?.note || ""
  };
}

function sortCategorySummary(items: BehaviorListResponse["categorySummary"]) {
  const order = new Map<string, number>(behaviorCategories.map((item, index) => [item.key, index]));
  return [...items].sort((left, right) => (order.get(left.category) ?? 999) - (order.get(right.category) ?? 999));
}

function resolveBehaviorTemplate(form: StudentBehaviorForm) {
  const category = form.category || behaviorCategories[0].key;
  const templates = getBehaviorTemplates(category, form.tone);
  const template = String(form.template || "").trim();
  if (template) return template;
  const note = String(form.note || "").trim();
  if (note) return note;
  return templates[0] || category;
}

export function useBehaviorPerformance(currentUser?: {
  role?: string;
  studentId?: string | null;
  studentIds?: string[];
}) {
  const { t } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<BehaviorRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, positive: 0, negative: 0 });
  const [categorySummary, setCategorySummary] = useState<BehaviorListResponse["categorySummary"]>([]);
  const [loading, setLoading] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingStudent, setEditingStudent] = useState<BehaviorRow | null>(null);
  const [form, setForm] = useState<StudentBehaviorForm>(emptyBehaviorForm);

  const day = useMemo(() => dayForDate(date), [date]);
  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) || null, [classes, classId]);

  useEffect(() => {
    let active = true;
    const linkedStudentId = currentUser?.studentId || currentUser?.studentIds?.[0] || "";
    const classesRequest =
      (currentUser?.role === "STUDENT" || currentUser?.role === "PARENT") && linkedStudentId
        ? somApi.students.context(linkedStudentId).then((response) => ({
            data: response.data?.class ? [response.data.class] : []
          }))
        : somApi.classes.list();
    classesRequest
      .then((response) => {
        if (!active) return;
        const nextClasses = sortSchoolClasses((response.data || []) as SchoolClass[]);
        setClasses(nextClasses);
        setClassId((previous) => previous || nextClasses[0]?.id || "");
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("behavior.loadFailed"));
      });
    return () => {
      active = false;
    };
  }, [currentUser?.role, currentUser?.studentId, currentUser?.studentIds, t]);

  useEffect(() => {
    if (!classId || !date) {
      setRows([]);
      setSummary({ total: 0, positive: 0, negative: 0 });
      setCategorySummary([]);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    somApi.students.behavior
      .list(classId, date)
      .then((response) => {
        if (!active) return;
        setRows(response.data?.rows || []);
        setSummary(response.data?.summary || { total: 0, positive: 0, negative: 0 });
        setCategorySummary(sortCategorySummary(response.data?.categorySummary || []));
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("behavior.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, date, t]);

  function openEditor(student: BehaviorRow) {
    setEditingStudent(student);
    setForm(buildForm(student.id, date, day, student));
    setMessage("");
  }

  function closeEditor() {
    setEditingStudent(null);
    setForm(emptyBehaviorForm);
  }

  function updateForm(next: StudentBehaviorForm | ((current: StudentBehaviorForm) => StudentBehaviorForm)) {
    setForm((previous) => (typeof next === "function" ? next(previous) : next));
  }

  function updateCategory(category: string) {
    const templates = getBehaviorTemplates(category, form.tone);
    updateForm((previous) => ({
      ...previous,
      category,
      template: templates[0] || previous.template || ""
    }));
  }

  function updateTone(tone: "POSITIVE" | "NEGATIVE") {
    const templates = getBehaviorTemplates(form.category || behaviorCategories[0].key, tone);
    updateForm((previous) => ({
      ...previous,
      tone,
      template: templates[0] || previous.template || ""
    }));
  }

  async function clearStudentRecords() {
    if (!editingStudent) return;
    try {
      setMessage("");
      setSavingStudentId(editingStudent.id);
      await somApi.students.behavior.clear(editingStudent.id, classId, date);
      setMessage(t("behavior.cleared"));
      closeEditor();
      try {
        const refreshed = await somApi.students.behavior.list(classId, date);
        setRows(refreshed.data?.rows || []);
        setSummary(refreshed.data?.summary || { total: 0, positive: 0, negative: 0 });
        setCategorySummary(sortCategorySummary(refreshed.data?.categorySummary || []));
      } catch {
        // Keep the successful clear visible even if the refresh fails.
      }
    } catch {
      setMessage(t("behavior.clearFailed"));
    } finally {
      setSavingStudentId(null);
    }
  }

  async function saveRecord() {
    const category = form.category || behaviorCategories[0].key;
    const template = resolveBehaviorTemplate(form);

    if (!form.studentId || !category || !template || !classId || !date || !day) {
      setMessage(t("behavior.required"));
      return;
    }

    setSavingStudentId(form.studentId);
    setMessage("");
    try {
      const response = await somApi.students.behavior.save({
        ...form,
        category,
        template,
        studentId: form.studentId,
        date,
        day
      });
      setRows((previous) =>
        previous.map((row) =>
          row.id === form.studentId
            ? {
                ...row,
                behaviorRecords: row.behaviorRecords.some((record) => record.id === response.data?.id)
                  ? row.behaviorRecords.map((record) => (record.id === response.data?.id ? response.data : record))
                  : [...row.behaviorRecords, response.data]
              }
              : row
        )
      );
      setMessage(t("behavior.saved"));
      closeEditor();
      try {
        const refreshed = await somApi.students.behavior.list(classId, date);
        setRows(refreshed.data?.rows || []);
        setSummary(refreshed.data?.summary || { total: 0, positive: 0, negative: 0 });
        setCategorySummary(sortCategorySummary(refreshed.data?.categorySummary || []));
      } catch {
        // Preserve the saved record locally even if the refresh fails.
      }
    } catch {
      setMessage(t("behavior.saveFailed"));
    } finally {
      setSavingStudentId(null);
    }
  }

  return {
    classes,
    classId,
    date,
    day,
    rows,
    summary,
    categorySummary,
    loading,
    savingStudentId,
    message,
    editingStudent,
    form,
    canUndo: Boolean(editingStudent?.behaviorRecords.length),
    selectedClass,
    setClassId,
    setDate,
    setForm: updateForm,
    openEditor,
    closeEditor,
    saveRecord,
    updateCategory,
    updateTone,
    undoLastChange: clearStudentRecords
  };
}
