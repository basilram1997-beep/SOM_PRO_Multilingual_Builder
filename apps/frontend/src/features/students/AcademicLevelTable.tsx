import { Card } from "../../components/ui/Card";
import { localizeClassName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type { AcademicRow } from "./studentTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  rows: AcademicRow[];
  loading: boolean;
  savingStudentId: string | null;
  onEdit: (student: AcademicRow) => void;
};

export function AcademicLevelTable({ t, language, rows, loading, savingStudentId, onEdit }: Props) {
  return (
    <Card title={t("academic.studentsTitle")}>
      <div className="table-wrap academic-table-wrap">
        <table className="academic-table">
          <thead>
            <tr>
              <th>{t("students.name")}</th>
              <th>{t("common.class")}</th>
              <th>{t("academic.tone")}</th>
              <th>{t("academic.strengths")}</th>
              <th>{t("academic.weaknesses")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>{t("common.loading")}</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>{t("academic.emptyClass")}</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const record = row.academic;
                const disabled = savingStudentId === row.id;
                const toneKey = record?.tone === "NEGATIVE" ? "negative" : record ? "positive" : "neutral";
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.class?.name ? localizeClassName(row.class.name, language) : "-"}</td>
                    <td>
                      <span className={`academic-tone ${toneKey !== "neutral" ? `academic-tone-${toneKey}` : ""}`}>
                        {record
                          ? record.tone === "NEGATIVE"
                            ? t("academic.negative")
                            : t("academic.positive")
                          : t("common.none")}
                      </span>
                    </td>
                    <td>{record?.strengths || "-"}</td>
                    <td>{record?.weaknesses || "-"}</td>
                    <td>
                      <button type="button" className="light" disabled={disabled} onClick={() => onEdit(row)}>
                        {record ? t("academic.edit") : t("academic.add")}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
