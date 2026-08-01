import { Card } from "../../components/ui/Card";
import type { GradeEntryStudentMarks } from "./gradeEntryDraft";
import {
  calculateWeightedTotal,
  countCompletedMarks,
  isCompletionBadgeComplete,
  isCompletionBadgeEmpty
} from "./gradeEntryDraft";
import type { GradeEntryState } from "./useGradeEntry";

type Props = {
  t: (key: string) => string;
  gradeEntry: GradeEntryState;
  draftRows: Record<string, GradeEntryStudentMarks>;
  studentIds: string[];
  updateMark: (studentId: string, sectionId: string, value: string) => void;
  readOnly?: boolean;
  studentMode?: boolean;
  studentId?: string | null;
};

function completionTone(filled: number, total: number) {
  if (isCompletionBadgeComplete(filled, total)) return "complete";
  if (isCompletionBadgeEmpty(filled)) return "empty";
  return "partial";
}

function studentSectionLabel(certificateType: GradeEntryState["certificateType"], sectionId: string) {
  if (sectionId === "daily-exam") return "امتحان يومي";
  if (sectionId === "attendance-participation") return "حضور ومشاركة";
  if (sectionId === "bimonthly-exam") return "امتحان شهرين";
  if (sectionId === "final-exam") return "امتحان نهائي";
  if (sectionId === "marks") return "امتحان يومي";
  return certificateType === "TERM1_BIMONTHLY" || certificateType === "TERM2_BIMONTHLY"
    ? "امتحان شهرين"
    : "امتحان نهائي";
}

export function GradeEntryMarksGrid({
  t,
  gradeEntry,
  draftRows,
  studentIds,
  updateMark,
  readOnly = false,
  studentMode = false,
  studentId = ""
}: Props) {
  if (
    !studentMode &&
    (!gradeEntry.subjectId || !gradeEntry.selectedClassAccessible || !gradeEntry.selectedSubjectAccessible)
  ) {
    return null;
  }

  const title = studentMode ? "كشف العلامات" : t("gradeEntry.marksTitle");
  const currentStudentMarks = studentId ? draftRows[studentId] || {} : {};

  return (
    <Card title={title}>
      <div className="certificate-table-wrap grade-entry-matrix-wrap">
        <table className="certificate-table grade-entry-matrix-table" data-e2e="grade-entry-marks-table">
          <thead>
            <tr>
              {studentMode ? (
                <>
                  <th>الامتحان</th>
                  <th>الوزن</th>
                  <th>الدرجة من</th>
                  <th>علامتي</th>
                </>
              ) : (
                <>
                  <th>{t("students.name")}</th>
                  <th>{t("students.nationalId")}</th>
                  {gradeEntry.sections.map((section) => {
                    const filled = countCompletedMarks(draftRows, studentIds, section.id);
                    const tone = completionTone(filled, studentIds.length);
                    return (
                      <th key={section.id} className={`grade-entry-section-head ${tone}`}>
                        <span>{section.name}</span>
                        <small>
                          {section.percentage}% · {section.outOf}
                        </small>
                        <small>
                          {section.name
                            ? `${t("gradeEntry.sectionName")}: ${section.name}`
                            : t("gradeEntry.sectionName")}
                        </small>
                        <span className={`grade-entry-progress-badge small ${tone}`}>
                          {filled}/{studentIds.length}
                        </span>
                      </th>
                    );
                  })}
                  <th>{t("gradeEntry.rowTotal")}</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {studentMode ? (
              gradeEntry.sections.map((section) => (
                <tr key={section.id}>
                  <td>{studentSectionLabel(gradeEntry.certificateType, section.id)}</td>
                  <td>{section.percentage}</td>
                  <td>{section.outOf}</td>
                  <td>{currentStudentMarks[section.id]?.trim() || "-"}</td>
                </tr>
              ))
            ) : !gradeEntry.students.length ? (
              <tr>
                <td colSpan={gradeEntry.sections.length + 3}>
                  {gradeEntry.classId ? t("students.empty") : t("students.chooseClassFirst")}
                </td>
              </tr>
            ) : (
              gradeEntry.students.map((student) => {
                const marks = draftRows[student.id || ""] || {};
                const total = calculateWeightedTotal(marks, gradeEntry.sections, gradeEntry.maxScore);
                return (
                  <tr key={student.id} data-e2e={`grade-entry-student-row-${student.id}`}>
                    <td className="grade-entry-student-name">{student.name}</td>
                    <td>{student.nationalId || "-"}</td>
                    {gradeEntry.sections.map((section) => (
                      <td key={`${student.id}-${section.id}`}>
                        <input
                          data-e2e={`grade-entry-mark-${student.id}-${section.id}`}
                          className="grade-entry-mark-input"
                          type="number"
                          min="0"
                          max={section.outOf}
                          step="0.1"
                          inputMode="decimal"
                          value={marks[section.id] || ""}
                          onChange={
                            readOnly
                              ? undefined
                              : (event) => updateMark(student.id || "", section.id, event.target.value)
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                          placeholder={`/ ${section.outOf}`}
                          aria-label={`${student.name} - ${section.name}`}
                        />
                      </td>
                    ))}
                    <td>
                      <span className={`grade-entry-row-total ${total === null ? "empty" : ""}`}>
                        {total === null ? "-" : `${total} / ${gradeEntry.maxScore}`}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
