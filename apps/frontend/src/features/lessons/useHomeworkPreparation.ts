import { useEffect, useMemo, useState } from "react";
import { sortSchoolClasses, type Subject } from "@som/shared";
import { somApi } from "../../api/somApi";
import { uniqueVisibleNameOptions, useI18n } from "../../i18n/i18n";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { AuthUser } from "../../pages/auth/LoginPage";
import {
  emptyHomeworkPreparationForm,
  type HomeworkPreparationAssignment,
  type HomeworkPreparationDetailRow,
  type HomeworkPreparationForm,
  type HomeworkPreparationRow,
  type HomeworkPreparationStudent,
  type HomeworkPreparationTeacher,
  type HomeworkSubmissionForm
} from "./homeworkPreparationTypes";

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function dayForDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? "" : dayNames[value.getDay()];
}

function uniqueAssignments(assignments: HomeworkPreparationAssignment[]) {
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

export function useHomeworkPreparation(currentUser: AuthUser) {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<HomeworkPreparationTeacher[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<HomeworkPreparationRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, homework: 0, preparation: 0 });
  const [loading, setLoading] = useState(false);
  const [savingHomeworkId, setSavingHomeworkId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingHomework, setEditingHomework] = useState<HomeworkPreparationRow | null>(null);
  const [form, setForm] = useState<HomeworkPreparationForm>(emptyHomeworkPreparationForm);
  const [submissionsHomework, setSubmissionsHomework] = useState<HomeworkPreparationDetailRow | null>(null);
  const [submissionStudents, setSubmissionStudents] = useState<HomeworkPreparationStudent[]>([]);
  const [submissionForm, setSubmissionForm] = useState<HomeworkSubmissionForm[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsSaving, setSubmissionsSaving] = useState(false);

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
    let active = true;
    if (isTeacher) {
      somApi.homework
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
          const nextTeachers: HomeworkPreparationTeacher[] = nextTeacher ? [nextTeacher] : [];
          setTeachers(nextTeachers);
          setSelectedTeacherId(nextTeacher?.id || "");
        })
        .catch((error) => {
          if (!active) return;
          if (!isTeacher && isForbiddenError(error)) return;
          setMessage(userFacingErrorMessage(error, t("homework.loadFailed")));
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
        setMessage(userFacingErrorMessage(error, t("homework.loadFailed")));
      });
    return () => {
      active = false;
    };
  }, [currentUser.studentId, isTeacher, t]);

  useEffect(() => {
    if (!date || (isTeacher && !selectedTeacherId)) {
      setRows([]);
      setSummary({ total: 0, homework: 0, preparation: 0 });
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    (isTeacher ? somApi.homework.list(date, selectedTeacherId) : somApi.homework.list(date))
      .then((response) => {
        if (!active) return;
        setRows(response.data?.homeworks || []);
        setSummary(response.data?.summary || { total: 0, homework: 0, preparation: 0 });
        if (isTeacher && response.data?.teacher && response.data.teacher.id !== selectedTeacherId) {
          setSelectedTeacherId(response.data.teacher.id);
        }
      })
      .catch(() => {
        if (!active) return;
        setMessage(t("homework.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, isTeacher, selectedTeacherId, t]);

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

  function openEditor(homework?: HomeworkPreparationRow) {
    const existing = homework || null;
    setEditingHomework(homework || ({ id: "new" } as HomeworkPreparationRow));
    setForm({
      ...emptyHomeworkPreparationForm,
      id: existing?.id,
      teacherId: existing?.teacherId || selectedTeacherId,
      classId: existing?.classId || teacherAssignments[0]?.classId || "",
      subjectId: existing?.subjectId || teacherAssignments[0]?.subjectId || "",
      date,
      day,
      kind: existing?.kind || "HOMEWORK",
      title: existing?.title || "",
      description: existing?.description || "",
      dueDate: existing?.dueDate || "",
      attachment: existing?.attachment || "",
      notes: existing?.notes || ""
    });
    setMessage("");
  }

  function closeEditor() {
    setEditingHomework(null);
    setForm(emptyHomeworkPreparationForm);
  }

  async function saveHomework() {
    if (!selectedTeacherId || !form.classId || !form.subjectId || !form.title.trim() || !date || !day) {
      setMessage(t("homework.required"));
      return;
    }
    const allowed = teacherAssignments.some(
      (item) => item.classId === form.classId && item.subjectId === form.subjectId
    );
    if (!allowed) {
      setMessage(t("homework.assignmentRequired"));
      return;
    }

    setSavingHomeworkId(form.id || `${form.classId}-${form.subjectId}-${form.kind}`);
    setMessage("");
    try {
      const response = await somApi.homework.save({
        ...form,
        teacherId: isTeacher ? undefined : selectedTeacherId,
        date,
        day
      });
      const saved = response.data;
      setRows((previous) => {
        const without = previous.filter((row) => row.id !== saved.id);
        return [...without, saved].sort((left, right) => left.title.localeCompare(right.title));
      });
      const refreshed = await somApi.homework.list(date, isTeacher ? undefined : selectedTeacherId);
      setRows(refreshed.data?.homeworks || []);
      setSummary(refreshed.data?.summary || { total: 0, homework: 0, preparation: 0 });
      setMessage(t("homework.saved"));
      closeEditor();
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("homework.saveFailed")));
    } finally {
      setSavingHomeworkId(null);
    }
  }

  async function removeHomework(id: string) {
    if (!confirm(t("homework.confirmDelete"))) return;
    setSavingHomeworkId(id);
    setMessage("");
    try {
      await somApi.homework.remove(id);
      setRows((previous) => previous.filter((row) => row.id !== id));
      setMessage(t("homework.deleted"));
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(t("homework.deleteFailed"));
    } finally {
      setSavingHomeworkId(null);
    }
  }

  async function openSubmissions(homework: HomeworkPreparationRow) {
    setSubmissionsLoading(true);
    setMessage("");
    try {
      const response = await somApi.homework.submissions(homework.id);
      setSubmissionsHomework(response.data?.homework || homework);
      setSubmissionStudents(response.data?.students || []);
      setSubmissionForm(
        (response.data?.students || []).map((student) => {
          const submission = student.submission;
          return {
            homeworkId: homework.id,
            studentId: student.id,
            status: submission?.status || "UNSOLVED",
            note: submission?.note || "",
            grade: submission?.grade || ""
          };
        })
      );
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("homework.loadSubmissionsFailed")));
    } finally {
      setSubmissionsLoading(false);
    }
  }

  function closeSubmissions() {
    setSubmissionsHomework(null);
    setSubmissionStudents([]);
    setSubmissionForm([]);
  }

  function updateSubmission(studentId: string, patch: Partial<HomeworkSubmissionForm>) {
    setSubmissionForm((previous) =>
      previous.map((item) => (item.studentId === studentId ? { ...item, ...patch } : item))
    );
  }

  async function saveSubmissions() {
    if (!submissionsHomework) return;
    setSubmissionsSaving(true);
    setMessage("");
    try {
      const response = await somApi.homework.saveSubmissions(submissionsHomework.id, { submissions: submissionForm });
      const refreshed = response.data;
      if (refreshed) {
        setSubmissionsHomework(refreshed);
      }
      setMessage(t("homework.submissionsSaved"));
      closeSubmissions();
      const list = await somApi.homework.list(date, isTeacher ? undefined : selectedTeacherId);
      setRows(list.data?.homeworks || []);
      setSummary(list.data?.summary || { total: 0, homework: 0, preparation: 0 });
    } catch (error) {
      if (!isTeacher && isForbiddenError(error)) return;
      setMessage(userFacingErrorMessage(error, t("homework.saveFailed")));
    } finally {
      setSubmissionsSaving(false);
    }
  }

  const selectedHomeworkStudents = submissionStudents;

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
    savingHomeworkId,
    message,
    editingHomework,
    form,
    isTeacher,
    classOptions,
    subjectOptions,
    selectedSubjectId,
    setSelectedSubjectId,
    teacherAssignments,
    selectedTeacher,
    submissionsHomework,
    selectedHomeworkStudents,
    submissionForm,
    submissionsLoading,
    submissionsSaving,
    setDate,
    setForm,
    openEditor,
    closeEditor,
    saveHomework,
    removeHomework,
    openSubmissions,
    closeSubmissions,
    updateSubmission,
    saveSubmissions
  };
}
