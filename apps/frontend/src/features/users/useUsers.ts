import { useEffect, useMemo, useState } from "react";
import { somApi } from "../../api/somApi";
import type { Translate } from "../teachers/teacherTypes";

type UserRole = "ADMIN" | "SCHEDULER" | "TEACHER" | "STUDENT" | "PARENT";
type UserRow = { id: string; name: string; email: string; role: UserRole | string; studentId?: string | null; studentIds?: string[] };
type StudentOption = { id: string; name: string };
type UserForm = { name: string; email: string; password: string; role: UserRole; studentId: string; studentIds: string[] };

const emptyForm: UserForm = { name: "", email: "", password: "", role: "TEACHER", studentId: "", studentIds: [] };

function needsStudentLink(role: UserRole) {
  return role === "STUDENT" || role === "PARENT";
}

function linkedStudentIdsForForm(form: UserForm) {
  if (form.role === "PARENT") return form.studentIds.length ? form.studentIds : form.studentId ? [form.studentId] : [];
  return form.studentId ? [form.studentId] : [];
}

function buildLabels(t: Translate) {
  return {
    title: t("users.title"),
    name: t("users.name"),
    username: t("users.username"),
    password: t("users.password"),
    role: t("users.role"),
    linkedStudent: t("users.linkedStudent"),
    selectStudent: t("users.selectStudent"),
    fullAdmin: t("users.fullAdmin"),
    scheduler: "SCHEDULER",
    teacher: t("users.teacher"),
    homeroomTeacher: t("users.homeroomTeacher"),
    student: t("users.student"),
    parent: t("users.parent"),
    add: t("users.add"),
    action: t("users.action"),
    delete: t("common.delete"),
    saving: t("users.saving"),
    saved: t("users.saved"),
    removed: t("users.removed"),
    required: t("users.required"),
    passwordShort: t("users.passwordShort"),
    confirmDelete: t("users.confirmDelete"),
    duplicate: t("users.duplicate"),
    saveFailed: t("users.saveFailed"),
    requiredStudent: t("users.requiredStudent"),
    none: t("common.none")
  };
}

function roleOptions(labels: ReturnType<typeof buildLabels>) {
  return [
    { value: "ADMIN" as const, label: labels.fullAdmin },
    { value: "TEACHER" as const, label: labels.teacher },
    { value: "STUDENT" as const, label: labels.student },
    { value: "PARENT" as const, label: labels.parent }
  ];
}

export function useUsers(t: Translate) {
  const labels = useMemo(() => buildLabels(t), [t]);
  const roleLabels = useMemo<Record<UserRole, string>>(
    () => ({
      ADMIN: labels.fullAdmin,
      SCHEDULER: labels.scheduler,
      TEACHER: labels.teacher,
      STUDENT: labels.student,
      PARENT: labels.parent
    }),
    [labels.fullAdmin, labels.scheduler, labels.teacher, labels.student, labels.parent]
  );
  const roles = useMemo(() => roleOptions(labels), [labels]);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    const [usersResponse, studentsResponse] = await Promise.all([somApi.settings.users(), somApi.students.list()]);
    setUsers(usersResponse.data || []);
    setStudents((studentsResponse.data || []).map((student) => ({ id: student.id, name: student.name })));
  };

  async function suggestUsername(role: UserRole = form.role) {
    setSuggesting(true);
    try {
      const res = await somApi.settings.suggestUsername(role);
      setForm((previous) => ({
        ...previous,
        role,
        studentId: needsStudentLink(role) ? previous.studentId : "",
        studentIds: role === "PARENT" ? previous.studentIds : [],
        email: res.data.username
      }));
    } catch {
      setMessage(labels.saveFailed);
    } finally {
      setSuggesting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        await load();
        if (!cancelled) {
          await suggestUsername("TEACHER");
        }
      } catch {
        if (!cancelled) setMessage(labels.saveFailed);
      }
    }

    initialize().catch(() => {
      if (!cancelled) setMessage(labels.saveFailed);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createUser() {
    if (!form.name.trim() || !form.password.trim()) {
      setMessage(labels.required);
      return;
    }
    if (needsStudentLink(form.role) && linkedStudentIdsForForm(form).length === 0) {
      setMessage(labels.requiredStudent);
      return;
    }
    if (form.password.length < 6) {
      setMessage(labels.passwordShort);
      return;
    }
    setSaving(true);
    try {
      const username = form.email.trim() || (await somApi.settings.suggestUsername(form.role)).data.username;
      await somApi.settings.createUser({
        ...form,
        email: username,
        studentId: needsStudentLink(form.role) ? linkedStudentIdsForForm(form)[0] || null : null,
        studentIds: form.role === "PARENT" ? linkedStudentIdsForForm(form) : undefined
      });
      setMessage(labels.saved);
      setForm({
        ...emptyForm,
        role: form.role,
        password: "",
        studentId: form.role === "STUDENT" ? form.studentId : "",
        studentIds: form.role === "PARENT" ? form.studentIds : []
      });
      await load();
      await suggestUsername(form.role);
    } catch {
      setMessage(labels.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(id: string) {
    if (deletingId) return;
    if (!confirm(labels.confirmDelete)) return;
    setDeletingId(id);
    try {
      await somApi.settings.removeUser(id);
      setMessage(labels.removed);
      await load();
      await suggestUsername(form.role);
    } catch {
      setMessage(labels.saveFailed);
    } finally {
      setDeletingId(null);
    }
  }

  return {
    labels,
    roleLabels,
    roles,
    users,
    students,
    form,
    message,
    suggesting,
    saving,
    deletingId,
    setForm,
    setMessage,
    suggestUsername,
    createUser,
    removeUser,
    load
  };
}
