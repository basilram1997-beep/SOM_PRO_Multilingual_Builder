import { useEffect, useMemo, useState } from "react";
import type { SchoolClass, Student } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import { confirmAndRecordExport } from "../exports/exportAudit";
import { emptyPledgeForm, type StudentPledgeForm, type StudentPledgeRow } from "./studentTypes";

export function useStudentPledges() {
  const { t, language } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [form, setForm] = useState<StudentPledgeForm>(emptyPledgeForm);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pledges, setPledges] = useState<StudentPledgeRow[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === form.studentId) || null,
    [students, form.studentId]
  );

  async function loadClasses() {
    try {
      const [classesResponse, settingsResponse] = await Promise.all([somApi.classes.list(), somApi.settings.get()]);
      const nextClasses = sortSchoolClasses((classesResponse.data || []) as SchoolClass[]);
      setClasses(nextClasses);
      setSelectedClassId((previous) => previous || nextClasses[0]?.id || "");
      setSchoolName(settingsResponse.data.school?.name || "");
      setSchoolAddress(settingsResponse.data.school?.address || "");
      setForm((previous) => ({
        ...previous,
        principalName: previous.principalName || settingsResponse.data.school?.managerName || ""
      }));
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("pledges.loadFailed")));
    }
  }

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setPledges([]);
      return;
    }

    let active = true;
    setLoading(true);
    Promise.all([somApi.students.list(selectedClassId), somApi.students.pledges.list(selectedClassId, 40)])
      .then(([studentsResponse, pledgesResponse]) => {
        if (!active) return;
        setStudents(studentsResponse.data || []);
        setPledges(pledgesResponse.data || []);
        setForm((previous) => ({
          ...previous,
          classId: selectedClassId,
          studentId:
            previous.studentId && (studentsResponse.data || []).some((item) => item.id === previous.studentId)
              ? previous.studentId
              : (studentsResponse.data || [])[0]?.id || ""
        }));
      })
      .catch((error) => {
        if (active) setMessage(userFacingErrorMessage(error, t("pledges.loadFailed")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClassId, t]);

  function reset() {
    setForm((previous) => ({
      ...emptyPledgeForm,
      classId: previous.classId || selectedClassId || "",
      studentId: previous.studentId || students[0]?.id || ""
    }));
    setMessage("");
  }

  async function save() {
    if (!form.classId || !form.studentId || !form.title.trim() || !form.pledgeText.trim() || !form.date) {
      setMessage(t("pledges.required"));
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await somApi.students.pledges.save({
        classId: form.classId,
        studentId: form.studentId,
        date: form.date,
        title: form.title.trim(),
        pledgeText: form.pledgeText.trim(),
        note: form.note.trim(),
        homeroomTeacherName: form.homeroomTeacherName.trim(),
        principalName: form.principalName.trim()
      });
      const refreshed = await somApi.students.pledges.list(form.classId, 40);
      setPledges(refreshed.data || []);
      setMessage(t("pledges.saved"));
      reset();
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("pledges.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function exportPledge() {
    setExporting(true);
    setMessage("");
    try {
      const exportNotice = await confirmAndRecordExport(
        {
          page: "studentPledge",
          title: "Pledge",
          fileName: `pledge-${form.date || new Date().toISOString().slice(0, 10)}-${(selectedStudent?.name || "student").replace(/[\\/:*?"<>|]+/g, "-")}.pdf`,
          kind: "PDF",
          permission: "manageLessons",
          expiresInMinutes: 15
        },
        language === "he"
          ? "הייצוא הזה פרטי ומוגבל בזמן."
          : language === "en"
            ? "This export is private and expires automatically."
            : "هذا التصدير خاص ومؤقت وينتهي تلقائيًا بعد فترة قصيرة."
      );
      if (!exportNotice) return;

      const fileName = `pledge-${form.date || new Date().toISOString().slice(0, 10)}-${(selectedStudent?.name || "student").replace(/[\\/:*?"<>|]+/g, "-")}.pdf`;
      if (!window.somDesktop?.exportPdf) {
        setMessage(
          language === "he"
            ? "ייצוא PDF זמין בגרסת שולחן העבודה בלבד"
            : language === "en"
              ? "PDF export is available in the desktop app only"
              : "تصدير PDF متاح في نسخة سطح المكتب فقط"
        );
        return;
      }
      const result = await window.somDesktop.exportPdf(fileName);
      if (result?.ok) {
        setMessage(
          language === "he"
            ? "קובץ ה-PDF נשמר בהצלחה"
            : language === "en"
              ? "PDF exported successfully"
              : "تم تصدير ملف PDF بنجاح"
        );
        return;
      }
      if (result?.canceled) return;
      setMessage(
        language === "he"
          ? "לא ניתן היה לשמור את קובץ ה-PDF"
          : language === "en"
            ? "The PDF file could not be saved"
            : "تعذر حفظ ملف PDF"
      );
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("common.error")));
    } finally {
      setExporting(false);
    }
  }

  return {
    classes,
    students,
    selectedClassId,
    setSelectedClassId,
    form,
    setForm,
    saving,
    exporting,
    loading,
    message,
    pledges,
    selectedClass,
    selectedStudent,
    schoolName,
    schoolAddress,
    setStudents,
    setMessage,
    save,
    reset,
    exportPledge
  };
}
