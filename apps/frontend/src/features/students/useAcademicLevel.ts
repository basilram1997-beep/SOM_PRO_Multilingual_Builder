import { useEffect, useMemo, useState } from "react";
import type { SchoolClass, Subject } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { uniqueVisibleNameOptions, useI18n } from "../../i18n/i18n";
import {
  emptyAcademicForm,
  type AcademicRow,
  type AcademicSubjectSummary,
  type StudentAcademicForm
} from "./studentTypes";

const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : dayNames[value.getDay()];
}

export function useAcademicLevel() {
  const { t } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AcademicRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, positive: 0, negative: 0 });
  const [subjectSummary, setSubjectSummary] = useState<AcademicSubjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingStudent, setEditingStudent] = useState<AcademicRow | null>(null);
  const [form, setForm] = useState<StudentAcademicForm>(emptyAcademicForm);

  const day = useMemo(() => dayForDate(date), [date]);
  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) || null, [classes, classId]);
  const selectedSubject = useMemo(() => subjects.find((item) => item.id === subjectId) || null, [subjects, subjectId]);

  useEffect(() => {
    let active = true;
    Promise.all([somApi.classes.list(), somApi.subjects.list()])
      .then(([classesResponse, subjectsResponse]) => {
        if (!active) return;
        const nextClasses = sortSchoolClasses((classesResponse.data || []) as SchoolClass[]);
        const nextSubjects = uniqueVisibleNameOptions((subjectsResponse.data || []) as Subject[]);
        setClasses(nextClasses);
        setSubjects(nextSubjects);
        setClassId((previous) => previous || nextClasses[0]?.id || "");
        setSubjectId((previous) => previous || nextSubjects[0]?.id || "");
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("academic.loadFailed"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!classId || !subjectId || !date) {
      setRows([]);
      setSummary({ total: 0, positive: 0, negative: 0 });
      setSubjectSummary([]);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    somApi.students.academic
      .list(classId, subjectId, date)
      .then((response) => {
        if (!active) return;
        setRows(response.data?.rows || []);
        setSummary(response.data?.summary || { total: 0, positive: 0, negative: 0 });
        setSubjectSummary(response.data?.subjectSummary || []);
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("academic.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, subjectId, date, t]);

  function openEditor(student: AcademicRow) {
    const existing = student.academic;
    setEditingStudent(student);
    setForm({
      ...emptyAcademicForm,
      id: existing?.id,
      studentId: student.id,
      subjectId,
      date,
      day,
      tone: existing?.tone || "POSITIVE",
      strengths: existing?.strengths || "",
      weaknesses: existing?.weaknesses || "",
      assignments: existing?.assignments || "",
      lessonProgress: existing?.lessonProgress || "",
      certificate: existing?.certificate || "",
      note: existing?.note || ""
    });
    setMessage("");
  }

  function closeEditor() {
    setEditingStudent(null);
    setForm(emptyAcademicForm);
  }

  async function saveRecord() {
    if (!form.studentId || !form.subjectId || !classId || !date || !day) {
      setMessage(t("academic.required"));
      return;
    }
    setSavingStudentId(form.studentId);
    setMessage("");
    try {
      const response = await somApi.students.academic.save({
        ...form,
        date,
        day,
        studentId: form.studentId,
        subjectId: form.subjectId
      });
      setRows((previous) =>
        previous.map((row) => (row.id === form.studentId ? { ...row, academic: response.data } : row))
      );
      const refreshed = await somApi.students.academic.list(classId, subjectId, date);
      setRows(refreshed.data?.rows || []);
      setSummary(refreshed.data?.summary || { total: 0, positive: 0, negative: 0 });
      setSubjectSummary(refreshed.data?.subjectSummary || []);
      setMessage(t("academic.saved"));
      closeEditor();
    } catch {
      setMessage(t("academic.saveFailed"));
    } finally {
      setSavingStudentId(null);
    }
  }

  const subjectRows = subjectSummary;

  return {
    classes,
    subjects,
    classId,
    subjectId,
    date,
    day,
    rows,
    summary,
    subjectRows,
    loading,
    savingStudentId,
    message,
    editingStudent,
    form,
    selectedClass,
    selectedSubject,
    setClassId,
    setSubjectId,
    setDate,
    setForm,
    openEditor,
    closeEditor,
    saveRecord
  };
}
