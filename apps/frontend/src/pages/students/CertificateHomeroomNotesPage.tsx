import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import type { HomeroomAssignment, SchoolClass } from "@som/shared";
import { somApi, type CertificateHomeroomNoteRow } from "../../api/somApi";
import { Card } from "../../components/ui/Card";
import { localizeClassName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import { certificateTypeOptions, type CertificateType } from "../../features/students/studentCertificateTypes";

type Props = {
  currentUser: AuthUser;
};

type EditableNoteRow = CertificateHomeroomNoteRow & {
  showBehaviorOnCertificate: boolean;
};

type HomeroomAssignmentWithTeacher = HomeroomAssignment & {
  teacher?: { name?: string | null } | null;
};

function currentAcademicYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

export function CertificateHomeroomNotesPage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [homerooms, setHomerooms] = useState<HomeroomAssignmentWithTeacher[]>([]);
  const [classId, setClassId] = useState("");
  const [certificateType, setCertificateType] = useState<CertificateType>("TERM1_BIMONTHLY");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [rows, setRows] = useState<EditableNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const visibleClasses = useMemo(() => {
    if (currentUser.role !== "TEACHER") return classes;
    const homeroomClassIds = new Set(
      homerooms
        .filter((assignment) => assignment.isActive !== false && assignment.teacher?.name === currentUser.name)
        .map((assignment) => assignment.classId)
    );
    return classes.filter((item) => item.id && homeroomClassIds.has(item.id));
  }, [classes, currentUser.name, currentUser.role, homerooms]);

  useEffect(() => {
    let active = true;
    Promise.all([somApi.classes.list(), somApi.homeroom.list()])
      .then(([classesResponse, homeroomResponse]) => {
        if (!active) return;
        setClasses(classesResponse.data || []);
        setHomerooms((homeroomResponse.data || []) as HomeroomAssignmentWithTeacher[]);
      })
      .catch(() => {
        if (active) setMessage(t("certificates.loadFailed"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!classId && visibleClasses[0]?.id) {
      setClassId(visibleClasses[0].id);
    }
  }, [classId, visibleClasses]);

  useEffect(() => {
    if (!classId) {
      setRows([]);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    somApi.students.certificate.homeroomNotes
      .list(classId, certificateType, academicYear)
      .then((response) => {
        if (!active) return;
        setRows(
          (response.data.rows || []).map((row) => ({
            ...row,
            showBehaviorOnCertificate: Boolean(row.behaviorNote)
          }))
        );
      })
      .catch(() => {
        if (active) setMessage(t("certificates.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [academicYear, certificateType, classId, t]);

  function updateRow(studentId: string, updates: Partial<EditableNoteRow>) {
    setRows((previous) => previous.map((row) => (row.studentId === studentId ? { ...row, ...updates } : row)));
  }

  async function saveNotes() {
    if (!classId || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await somApi.students.certificate.homeroomNotes.save({
        classId,
        certificateType,
        academicYear,
        notes: rows.map((row) => ({
          studentId: row.studentId,
          teacherNotes: row.teacherNotes,
          showBehaviorOnCertificate: row.showBehaviorOnCertificate,
          behaviorNote: row.showBehaviorOnCertificate ? row.behaviorSummary || row.behaviorNote : null
        }))
      });
      setMessage(t("certificates.saved"));
    } catch {
      setMessage(t("certificates.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page certificate-notes-page" data-e2e="certificate-homeroom-notes-page">
      <h2>{t("certificates.homeroomNotesPageTitle")}</h2>

      <Card title={t("certificates.classDetailsTitle")}>
        <div className="certificate-notes-toolbar">
          <label>
            <span>{t("common.class")}</span>
            <select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">{t("students.selectClass")}</option>
              {visibleClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("certificates.type")}</span>
            <select
              value={certificateType}
              onChange={(event) => setCertificateType(event.target.value as CertificateType)}
            >
              {certificateTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("certificates.academicYear")}</span>
            <input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => void saveNotes()}
            disabled={!classId || saving || loading}
          >
            <Save size={18} />
            <span>{saving ? t("certificates.saving") : t("certificates.save")}</span>
          </button>
        </div>
        <p className="certificate-notes-hint">{t("certificates.homeroomNotesPageHint")}</p>
        {message ? <div className="form-message">{message}</div> : null}
      </Card>

      <Card title={t("certificates.homeroomNotes")}>
        <div className="table-wrap certificate-notes-table-wrap">
          <table className="compact-table certificate-notes-table">
            <thead>
              <tr>
                <th>{t("certificates.studentName")}</th>
                <th>{t("certificates.homeroomNotes")}</th>
                <th>{t("certificates.showBehaviorOnCertificate")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3}>{t("common.loading")}</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={3}>{classId ? t("homework.noStudents") : t("certificates.selectClassFirst")}</td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.studentId}>
                    <td>
                      <strong>{row.studentName}</strong>
                      <span className="certificate-notes-student-id">{row.nationalId || "-"}</span>
                    </td>
                    <td>
                      <textarea
                        value={row.teacherNotes}
                        onChange={(event) => updateRow(row.studentId, { teacherNotes: event.target.value })}
                        placeholder={t("certificates.teacherNotesPlaceholder")}
                      />
                    </td>
                    <td>
                      <label className="certificate-notes-behavior-toggle">
                        <input
                          type="checkbox"
                          checked={row.showBehaviorOnCertificate}
                          disabled={!row.behaviorSummary && !row.behaviorNote}
                          onChange={(event) =>
                            updateRow(row.studentId, {
                              showBehaviorOnCertificate: event.target.checked
                            })
                          }
                        />
                        <span>{row.behaviorSummary || row.behaviorNote || t("certificates.noTeacherNotes")}</span>
                      </label>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
