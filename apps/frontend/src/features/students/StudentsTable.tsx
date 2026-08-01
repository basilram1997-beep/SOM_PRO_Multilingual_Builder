import { Card } from "../../components/ui/Card";
import { localizeClassName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type { StudentRow } from "./studentTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  students: StudentRow[];
  deletingId: string | null;
  onEdit: (student: StudentRow) => void;
  onDelete: (id: string) => void;
  onMove: (student: StudentRow) => void;
};

export function StudentsTable({ t, language, students, deletingId, onEdit, onDelete, onMove }: Props) {
  const fatherNameLabel = language === "ar" ? "اسم الأب" : language === "he" ? "שם האב" : t("students.fatherName");
  const motherNameLabel = language === "ar" ? "اسم الأم" : language === "he" ? "שם האם" : t("students.motherName");
  const fatherPhoneLabel =
    language === "ar" ? "هاتف الأب" : language === "he" ? "טלפון האב" : t("students.fatherPhone");
  const motherPhoneLabel =
    language === "ar" ? "هاتف الأم" : language === "he" ? "טלפון האם" : t("students.motherPhone");
  const guardianPhoneLabel =
    language === "ar"
      ? "هاتف الوصي إن وجد"
      : language === "he"
        ? "טלפון האפוטרופוס אם קיים"
        : t("students.guardianPhone");
  const studentPhoneLabel =
    language === "ar" ? "هاتف الطالب" : language === "he" ? "טלפון התלמיד" : t("students.studentPhone");

  return (
    <Card title={t("students.listTitle")}>
      <div className="table-wrap students-table-wrap">
        <table className="students-table" data-e2e="students-table">
          <thead>
            <tr>
              <th>{t("students.name")}</th>
              <th>{t("students.nationalId")}</th>
              <th>{t("common.class")}</th>
              <th>{fatherNameLabel}</th>
              <th>{motherNameLabel}</th>
              <th>{t("students.residence")}</th>
              <th>{t("students.contactPhones")}</th>
              <th>{t("students.healthFund")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={9}>{t("students.empty")}</td>
              </tr>
            )}
            {students.map((student) => (
              <tr key={student.id} data-e2e={`student-row-${student.id}`}>
                <td>{student.name}</td>
                <td>{student.nationalId || "-"}</td>
                <td>{student.class?.name ? localizeClassName(student.class.name, language) : "-"}</td>
                <td>{student.fatherName || "-"}</td>
                <td>{student.motherName || "-"}</td>
                <td>{student.residence || "-"}</td>
                <td className="student-phone-cell">
                  <span>
                    <strong>{fatherPhoneLabel}:</strong> {student.fatherPhone || "-"}
                  </span>
                  <span>
                    <strong>{motherPhoneLabel}:</strong> {student.motherPhone || "-"}
                  </span>
                  <span>
                    <strong>{guardianPhoneLabel}:</strong> {student.guardianPhone || "-"}
                  </span>
                  <span>
                    <strong>{studentPhoneLabel}:</strong> {student.studentPhone || "-"}
                  </span>
                </td>
                <td>{student.healthFund || "-"}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    data-e2e={`student-edit-${student.id}`}
                    className="light"
                    onClick={() => onEdit(student)}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    data-e2e={`student-move-${student.id}`}
                    className="light"
                    onClick={() => onMove(student)}
                  >
                    {t("students.move")}
                  </button>
                  <button
                    type="button"
                    data-e2e={`student-delete-${student.id}`}
                    className="danger light"
                    disabled={deletingId === student.id}
                    onClick={() => onDelete(student.id)}
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
