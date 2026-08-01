import { useEffect, useMemo, useState } from "react";
import type { DutyAssignment, Teacher } from "@som/shared";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import type { DutyRow } from "./dutiesTypes";

const emptyForm: DutyAssignment = {
  teacherId: "",
  day: "",
  startTime: "07:30",
  endTime: "08:00",
  place: "",
  notes: "",
  isActive: true
};

export function useDuties() {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [rows, setRows] = useState<DutyRow[]>([]);
  const [form, setForm] = useState<DutyAssignment>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        `${a.day}${a.startTime}${a.place}`.localeCompare(`${b.day}${b.startTime}${b.place}`, "ar")
      ),
    [rows]
  );

  async function load() {
    const [teachersRes, settingsRes, dutiesRes] = await Promise.all([
      somApi.teachers.list(),
      somApi.settings.get(),
      somApi.duties.list()
    ]);
    const days = settingsRes.data.settings.workingDays || [];
    setTeachers(teachersRes.data);
    setWorkingDays(days);
    setRows(dutiesRes.data || []);
    setForm((prev) => ({ ...prev, day: prev.day || days[0] || "" }));
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ ...emptyForm, day: workingDays[0] || "" });
  }

  async function save() {
    if (!form.teacherId || !form.day || !form.startTime || !form.endTime || !form.place.trim()) {
      alert(t("duties.required"));
      return;
    }
    try {
      setSaving(true);
      await somApi.duties.save(form);
      setMessage(t("duties.saved"));
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    if (!confirm(t("duties.confirmDelete"))) return;
    await somApi.duties.remove(id);
    setMessage(t("duties.deleted"));
    await load();
  }

  return {
    teachers,
    workingDays,
    rows,
    form,
    saving,
    message,
    sortedRows,
    setForm,
    save,
    remove,
    resetForm
  };
}
