import { useEffect, useState } from "react";
import type { SchoolClass, Student } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import { parseStudentImportFile } from "./studentImport";
import { emptyStudentForm, type StudentImportRow, type StudentRow } from "./studentTypes";
import { studentText } from "./studentText";

export function useStudents() {
  const { t, language } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [form, setForm] = useState<Student>(emptyStudentForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingStudent, setMovingStudent] = useState<StudentRow | null>(null);
  const [moveClassId, setMoveClassId] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const importChooseClassFirstLabel = studentText(
    t,
    language,
    "students.importChooseClassFirst",
    "اختر صفًا أولًا قبل استيراد ملف إكسل.",
    "בחר כיתה קודם לפני ייבוא קובץ אקסל."
  );
  const importEmptyLabel = studentText(
    t,
    language,
    "students.importEmpty",
    "ملف إكسل فارغ أو لا يحتوي على صفوف صالحة.",
    "קובץ האקסל ריק או שאינו מכיל שורות תקינות."
  );
  const importedLabel = studentText(t, language, "students.imported", "تم استيراد الطلاب", "התלמידים יובאו");
  const importFailedLabel = studentText(
    t,
    language,
    "students.importFailed",
    "تعذر استيراد الطلاب",
    "לא ניתן לייבא תלמידים"
  );

  async function load() {
    try {
      const [classesResponse, studentsResponse] = await Promise.all([somApi.classes.list(), somApi.students.list()]);
      const nextClasses = sortSchoolClasses((classesResponse.data || []) as SchoolClass[]);
      setClasses(nextClasses);
      setStudents(studentsResponse.data || []);
      setSelectedClassId((previous) => (previous && nextClasses.some((item) => item.id === previous) ? previous : ""));
      setForm((previous) => ({ ...previous, classId: previous.classId || nextClasses[0]?.id || "" }));
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("students.loadFailed")));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setForm({ ...emptyStudentForm, classId: classes[0]?.id || "" });
    setMessage("");
  }

  function buildStudentPayload(row: StudentImportRow, classId: string): Student {
    return {
      name: row.name,
      nationalId: row.nationalId || "",
      classId,
      fatherName: row.fatherName || "",
      motherName: row.motherName || "",
      residence: row.residence || "",
      fatherPhone: row.fatherPhone || "",
      motherPhone: row.motherPhone || "",
      guardianPhone: row.guardianPhone || "",
      healthFund: row.healthFund || "",
      studentPhone: row.studentPhone || ""
    };
  }

  function buildStudentSavePayload(student: Student): Student {
    return {
      name: student.name,
      nationalId: student.nationalId || "",
      classId: student.classId,
      fatherName: student.fatherName || "",
      motherName: student.motherName || "",
      residence: student.residence || "",
      fatherPhone: student.fatherPhone || "",
      motherPhone: student.motherPhone || "",
      guardianPhone: student.guardianPhone || "",
      healthFund: student.healthFund || "",
      studentPhone: student.studentPhone || ""
    };
  }

  async function importStudentsFallback(classId: string, rows: StudentImportRow[]) {
    const currentStudents = students.filter((student) => student.classId === classId);
    for (const row of rows) {
      const payload = buildStudentPayload(row, classId);
      const existing = payload.nationalId
        ? currentStudents.find((student) => (student.nationalId || "") === payload.nationalId)
        : undefined;
      if (existing) {
        await somApi.students.update(existing.id, payload);
      } else {
        await somApi.students.create(payload);
      }
    }
  }

  function openMove(student: StudentRow) {
    setMovingStudent(student);
    setMoveClassId(student.classId || "");
    setMessage("");
  }

  function closeMove() {
    setMovingStudent(null);
    setMoveClassId("");
  }

  async function confirmMove() {
    if (!movingStudent || !moveClassId || movingStudent.classId === moveClassId) {
      closeMove();
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await somApi.students.move(movingStudent.id, moveClassId);
      await load();
      closeMove();
      setMessage(t("students.moved"));
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("students.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form.name.trim() || !form.classId) {
      setMessage(t("students.required"));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const payload = buildStudentSavePayload(form);
      if (form.id) await somApi.students.update(form.id, payload);
      else await somApi.students.create(payload);
      await load();
      reset();
      setMessage(t("students.saved"));
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("students.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function importFromFile(file: File) {
    const classId = selectedClassId;
    if (!classId) {
      setMessage(importChooseClassFirstLabel);
      return;
    }

    setImporting(true);
    setMessage("");
    try {
      const rows = await parseStudentImportFile(file);
      if (rows.length === 0) {
        setMessage(importEmptyLabel);
        return;
      }

      let total = rows.length;
      try {
        const response = await somApi.students.import(classId, rows);
        const data = response.data || { created: 0, updated: 0, total: rows.length, students: [] };
        total = data.total || rows.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");
        if (!message.includes("Cannot POST /api/students/import")) throw error;
        await importStudentsFallback(classId, rows);
      }

      void load();
      setMessage(`${importedLabel} (${total})`);
    } catch (error) {
      setMessage(userFacingErrorMessage(error, importFailedLabel));
    } finally {
      setImporting(false);
    }
  }

  async function remove(id: string) {
    if (deletingId || !confirm(t("students.confirmDelete"))) return;
    setDeletingId(id);
    setMessage("");
    try {
      await somApi.students.remove(id);
      if (form.id === id) reset();
      await load();
      setMessage(t("students.deleted"));
    } catch {
      setMessage(t("students.saveFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const filteredStudents = selectedClassId
    ? students.filter((student) => student.classId === selectedClassId)
    : students;

  return {
    classes,
    students: filteredStudents,
    allStudents: students,
    selectedClassId,
    setSelectedClassId,
    form,
    saving,
    importing,
    deletingId,
    movingStudent,
    moveClassId,
    message,
    setMoveClassId,
    setForm,
    save,
    importFromFile,
    remove,
    reset,
    openMove,
    closeMove,
    confirmMove
  };
}
