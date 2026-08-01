import { useEffect, useMemo, useState } from "react";
import { sortSchoolClasses, type Subject } from "@som/shared";
import { somApi } from "../../api/somApi";
import { uniqueVisibleNameOptions, useI18n } from "../../i18n/i18n";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { AuthUser } from "../../pages/auth/LoginPage";
import {
  emptyExamScheduleForm,
  type ExamScheduleAssignment,
  type ExamScheduleForm,
  type ExamScheduleRow,
  type ExamScheduleTeacher
} from "./examScheduleTypes";

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : dayNames[value.getDay()];
}

function uniqueAssignments(assignments: ExamScheduleAssignment[]) {
  const seen = new Set<string>();
  return assignments.filter((item) => {
    const key = `${item.classId}:${item.subjectId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isForbiddenError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /FORBIDDEN|forbidden|لا تملك صلاحية|غير مصرح|ممنوع/i.test(message);
}

function sortExams(rows: ExamScheduleRow[]) {
  return [...rows].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.startTime.localeCompare(right.startTime) ||
      left.title.localeCompare(right.title)
  );
}

export function useExamSchedule(currentUser: AuthUser) {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<ExamScheduleTeacher[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<ExamScheduleRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, conflicts: 0 });
  const [loading, setLoading] = useState(false);
  const [savingExamId, setSavingExamId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [editingExam, setEditingExam] = useState<ExamScheduleRow | null>(null);
  const [form, setForm] = useState<ExamScheduleForm>(emptyExamScheduleForm);
  const [selectedTeacher, setSelectedTeacher] = useState<ExamScheduleTeacher | null>(null);

  const day = useMemo(() => dayForDate(date), [date]);
  const teacherAssignments = useMemo(() => uniqueAssignments(selectedTeacher?.assignments || []), [selectedTeacher]);
  const isTeacher = currentUser.role === "TEACHER";
  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const assignment of teacherAssignments) seen.set(assignment.classId, assignment.className);
    return sortSchoolClasses(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
  }, [teacherAssignments]);
  const subjectOptions = useMemo(() => {
    return isTeacher
      ? uniqueVisibleNameOptions(
          teacherAssignments.map((item) => ({ id: item.subjectId || "", name: item.subjectName || "" }))
        )
      : uniqueVisibleNameOptions(
          studentSubjects.map((subject) => ({ id: subject.id || "", name: subject.name || "" }))
        );
  }, [isTeacher, studentSubjects, teacherAssignments]);

  useEffect(() => {
    let active = true;
    if (isTeacher) {
      somApi.exams
        .list(date)
        .then((response) => {
          if (!active) return;
          const nextTeacher = response.data?.teacher
            ? {
                id: response.data.teacher.id || "",
                name: response.data.teacher.name || "",
                assignments: (response.data.assignments || []).map((assignment) => ({
                  id: assignment.id || "",
                  classId: assignment.classId || "",
                  className: assignment.className || "",
                  subjectId: assignment.subjectId || "",
                  subjectName: assignment.subjectName || "",
                  weeklyPeriods: Number(assignment.weeklyPeriods || 0)
                }))
              }
            : null;
          const nextTeachers: ExamScheduleTeacher[] = nextTeacher ? [nextTeacher] : [];
          setTeachers(nextTeachers);
          setSelectedTeacherId(nextTeacher?.id || "");
        })
        .catch((error) => {
          if (!active) return;
          if (!isTeacher && isForbiddenError(error)) return;
          setMessage(userFacingErrorMessage(error, t("exams.loadFailed")));
        });
      return () => {
        active = false;
      };
    }

    if (!currentUser.studentId) {
      setTeachers([]);
      setStudentSubjects([]);
      setSelectedTeacherId("");
      return () => {
        active = false;
      };
    }

    somApi.students
      .context(currentUser.studentId)
      .then((response) => {
        if (!active) return;
        const subjects = response.data?.subjects || [];
        setTeachers([]);
        setStudentSubjects(subjects);
        setSelectedTeacherId("");
      })
      .catch((error) => {
        if (!active) return;
        if (!isTeacher && isForbiddenError(error)) return;
        setMessage(userFacingErrorMessage(error, t("exams.loadFailed")));
      });
    return () => {
      active = false;
    };
  }, [currentUser.studentId, isTeacher, t]);

  useEffect(() => {
    setSelectedTeacher(teachers.find((item) => item.id === selectedTeacherId) || null);
  }, [teachers, selectedTeacherId]);

  useEffect(() => {
    if (!date || (isTeacher && !selectedTeacherId)) {
      setRows([]);
      setSummary({ total: 0, conflicts: 0 });
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    setWarning("");
    (isTeacher ? somApi.exams.list(date, selectedTeacherId) : somApi.exams.list(date))
      .then((response) => {
        if (!active) return;
        setRows(sortExams(response.data?.exams || []));
        setSummary(response.data?.summary || { total: 0, conflicts: 0 });
        if (isTeacher && response.data?.teacher && response.data.teacher.id !== selectedTeacherId) {
          setSelectedTeacherId(response.data.teacher.id);
        }
      })
      .catch((error) => {
        if (!active) return;
        setMessage(userFacingErrorMessage(error, t("exams.loadFailed")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, isTeacher, selectedTeacherId, t]);

  function openEditor(exam?: ExamScheduleRow) {
    const existing = exam || null;
    setEditingExam(exam || ({ id: "new" } as ExamScheduleRow));
    setForm({
      ...emptyExamScheduleForm,
      id: existing?.id,
      teacherId: existing?.teacherId || selectedTeacherId,
      classId: existing?.classId || teacherAssignments[0]?.classId || "",
      subjectId: existing?.subjectId || teacherAssignments[0]?.subjectId || "",
      date,
      day,
      title: existing?.title || "",
      startTime: existing?.startTime || "",
      endTime: existing?.endTime || "",
      room: existing?.room || "",
      notes: existing?.notes || "",
      instructions: existing?.instructions || ""
    });
    setMessage("");
    setWarning("");
  }

  function closeEditor() {
    setEditingExam(null);
    setForm(emptyExamScheduleForm);
  }

  async function saveExam() {
    if (
      !selectedTeacherId ||
      !form.classId ||
      !form.subjectId ||
      !form.title.trim() ||
      !date ||
      !day ||
      !form.startTime ||
      !form.endTime
    ) {
      setMessage(t("exams.required"));
      return;
    }
    if (form.startTime >= form.endTime) {
      setMessage(t("exams.timeOrder"));
      return;
    }
    const allowed = teacherAssignments.some(
      (item) => item.classId === form.classId && item.subjectId === form.subjectId
    );
    if (!allowed) {
      setMessage(t("exams.assignmentRequired"));
      return;
    }

    setSavingExamId(form.id || `${form.classId}-${form.subjectId}-${form.startTime}-${form.endTime}`);
    setMessage("");
    setWarning("");
    try {
      const response = await somApi.exams.save({
        ...form,
        teacherId: isTeacher ? undefined : selectedTeacherId,
        date,
        day
      });
      const saved = response.data?.exam;
      if (saved) {
        setRows((previous) => sortExams([...previous.filter((row) => row.id !== saved.id), saved]));
      }
      const refreshed = await somApi.exams.list(date, isTeacher ? selectedTeacherId : undefined);
      setRows(sortExams(refreshed.data?.exams || []));
      setSummary(refreshed.data?.summary || { total: 0, conflicts: 0 });
      setWarning(response.data?.warning || "");
      setMessage(response.data?.warning ? t("exams.savedWithWarning") : t("exams.saved"));
      closeEditor();
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("exams.saveFailed")));
    } finally {
      setSavingExamId(null);
    }
  }

  async function removeExam(id: string) {
    if (!confirm(t("exams.confirmDelete"))) return;
    setSavingExamId(id);
    setMessage("");
    try {
      await somApi.exams.remove(id);
      setRows((previous) => previous.filter((row) => row.id !== id));
      setMessage(t("exams.deleted"));
      setWarning("");
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("exams.deleteFailed")));
    } finally {
      setSavingExamId(null);
    }
  }

  const conflictRows = rows.filter((row) => row.hasConflict);

  return {
    teachers,
    selectedTeacherId,
    setSelectedTeacherId,
    date,
    day,
    rows,
    summary,
    loading,
    savingExamId,
    message,
    warning,
    editingExam,
    form,
    isTeacher,
    classOptions,
    subjectOptions,
    teacherAssignments,
    selectedTeacher,
    conflictRows,
    setDate,
    setForm,
    openEditor,
    closeEditor,
    saveExam,
    removeExam
  };
}
