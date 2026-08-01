import { useEffect, useMemo, useState } from "react";
import { sortSchoolClasses, type Subject } from "@som/shared";
import { somApi } from "../../api/somApi";
import { uniqueVisibleNameOptions, useI18n } from "../../i18n/i18n";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { AuthUser } from "../../pages/auth/LoginPage";
import {
  emptyLessonTodayForm,
  type LessonTodayAssignment,
  type LessonTodayForm,
  type LessonTodayRow,
  type LessonTodayTeacher
} from "./lessonTodayTypes";

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : dayNames[value.getDay()];
}

function uniqueAssignments(assignments: LessonTodayAssignment[]) {
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

export function useLessonToday(currentUser: AuthUser) {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<LessonTodayTeacher[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<LessonTodayRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, notStarted: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(false);
  const [savingLessonId, setSavingLessonId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingLesson, setEditingLesson] = useState<LessonTodayRow | null>(null);
  const [form, setForm] = useState<LessonTodayForm>(emptyLessonTodayForm);

  const day = useMemo(() => dayForDate(date), [date]);
  const selectedTeacher = useMemo(
    () => teachers.find((item) => item.id === selectedTeacherId) || null,
    [teachers, selectedTeacherId]
  );
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
    if (!selectedSubjectId) return;
    const allowed = subjectOptions.some((item) => item.id === selectedSubjectId);
    if (!allowed) {
      setSelectedSubjectId("");
    }
  }, [selectedSubjectId, subjectOptions]);

  const visibleRows = useMemo(() => {
    if (!selectedSubjectId) {
      return rows;
    }
    return rows.filter((row) => row.subjectId === selectedSubjectId);
  }, [rows, selectedSubjectId]);

  useEffect(() => {
    let active = true;
    if (isTeacher) {
      somApi.lessons.today
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
          const nextTeachers: LessonTodayTeacher[] = nextTeacher ? [nextTeacher] : [];
          setTeachers(nextTeachers);
          setSelectedTeacherId(nextTeacher?.id || "");
        })
        .catch((error) => {
          if (!active) return;
          if (!isTeacher && isForbiddenError(error)) return;
          setMessage(userFacingErrorMessage(error, t("lessonToday.loadFailed")));
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
        setSelectedSubjectId((previous) =>
          previous && subjects.some((item) => item.id === previous) ? previous : subjects[0]?.id || ""
        );
      })
      .catch((error) => {
        if (!active) return;
        if (!isTeacher && isForbiddenError(error)) return;
        setMessage(userFacingErrorMessage(error, t("lessonToday.loadFailed")));
      });
    return () => {
      active = false;
    };
  }, [currentUser.studentId, isTeacher, t]);

  useEffect(() => {
    if (!date || (isTeacher && !selectedTeacherId)) {
      setRows([]);
      setSummary({ total: 0, notStarted: 0, inProgress: 0, completed: 0 });
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    (isTeacher ? somApi.lessons.today.list(date, selectedTeacherId) : somApi.lessons.today.list(date))
      .then((response) => {
        if (!active) return;
        setRows(response.data?.lessons || []);
        setSummary(response.data?.summary || { total: 0, notStarted: 0, inProgress: 0, completed: 0 });
        if (isTeacher && response.data?.teacher && response.data.teacher.id !== selectedTeacherId) {
          setSelectedTeacherId(response.data.teacher.id);
        }
      })
      .catch((error) => {
        if (!active) return;
        setMessage(userFacingErrorMessage(error, t("lessonToday.loadFailed")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, isTeacher, selectedTeacherId, t]);

  function openEditor(lesson?: LessonTodayRow) {
    const existing = lesson || null;
    setEditingLesson(lesson || ({ id: "new" } as LessonTodayRow));
    setForm({
      ...emptyLessonTodayForm,
      id: existing?.id,
      teacherId: existing?.teacherId || selectedTeacherId,
      classId: existing?.classId || teacherAssignments[0]?.classId || "",
      subjectId: existing?.subjectId || teacherAssignments[0]?.subjectId || "",
      date,
      day,
      period: existing?.period || 1,
      title: existing?.title || "",
      summary: existing?.summary || "",
      status: existing?.status || "NOT_STARTED",
      note: existing?.note || "",
      attachments: existing?.attachments || ""
    });
    setMessage("");
  }

  function closeEditor() {
    setEditingLesson(null);
    setForm(emptyLessonTodayForm);
  }

  async function saveLesson() {
    if (!selectedTeacherId || !form.classId || !form.subjectId || !form.title.trim() || !date || !day) {
      setMessage(t("lessonToday.required"));
      return;
    }
    const allowed = teacherAssignments.some(
      (item) => item.classId === form.classId && item.subjectId === form.subjectId
    );
    if (!allowed) {
      setMessage(t("lessonToday.assignmentRequired"));
      return;
    }

    setSavingLessonId(form.id || `${form.classId}-${form.subjectId}-${form.period}`);
    setMessage("");
    try {
      const response = await somApi.lessons.today.save({
        ...form,
        teacherId: isTeacher ? undefined : selectedTeacherId,
        date,
        day
      });
      const saved = response.data;
      setRows((previous) => {
        const without = previous.filter((row) => row.id !== saved.id);
        return [...without, saved].sort((left, right) => left.period - right.period);
      });
      const refreshed = await somApi.lessons.today.list(date, isTeacher ? undefined : selectedTeacherId);
      setRows(refreshed.data?.lessons || []);
      setSummary(refreshed.data?.summary || { total: 0, notStarted: 0, inProgress: 0, completed: 0 });
      setMessage(t("lessonToday.saved"));
      closeEditor();
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("lessonToday.saveFailed")));
    } finally {
      setSavingLessonId(null);
    }
  }

  async function removeLesson(id: string) {
    if (!confirm(t("lessonToday.confirmDelete"))) return;
    setSavingLessonId(id);
    setMessage("");
    try {
      await somApi.lessons.today.remove(id);
      setRows((previous) => previous.filter((row) => row.id !== id));
      setMessage(t("lessonToday.deleted"));
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("lessonToday.deleteFailed")));
    } finally {
      setSavingLessonId(null);
    }
  }

  return {
    teachers,
    selectedTeacherId,
    setSelectedTeacherId,
    date,
    day,
    rows,
    visibleRows,
    summary,
    loading,
    savingLessonId,
    message,
    editingLesson,
    form,
    isTeacher,
    classOptions,
    subjectOptions,
    selectedSubjectId,
    setSelectedSubjectId,
    teacherAssignments,
    selectedTeacher,
    setDate,
    setForm,
    openEditor,
    closeEditor,
    saveLesson,
    removeLesson
  };
}
