import { localizeSubjectName } from "../../i18n/displayNames";
import type { AppLanguage } from "../teachers/teacherTypes";
import type { GradeEntryState } from "./useGradeEntry";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  gradeEntry: GradeEntryState;
  studentMode?: boolean;
  readOnly?: boolean;
  showSubjectSelector?: boolean;
};

const termCards: Array<{
  key: "TERM1" | "TERM2";
  title: { ar: string; en: string; he: string };
  options: Array<{
    type: "TERM1_BIMONTHLY" | "TERM1_FINAL" | "TERM2_BIMONTHLY" | "TERM2_FINAL";
    label: { ar: string; en: string; he: string };
  }>;
}> = [
  {
    key: "TERM1",
    title: { ar: "فصل أول", en: "First term", he: "מחצית א'" },
    options: [
      { type: "TERM1_BIMONTHLY", label: { ar: "تقييم الشهرين", en: "Bi-monthly evaluation", he: "הערכת חודשיים" } },
      { type: "TERM1_FINAL", label: { ar: "تقييم النهائي", en: "Final evaluation", he: "הערכה סופית" } }
    ]
  },
  {
    key: "TERM2",
    title: { ar: "فصل ثاني", en: "Second term", he: "מחצית ב'" },
    options: [
      { type: "TERM2_BIMONTHLY", label: { ar: "تقييم الشهرين", en: "Bi-monthly evaluation", he: "הערכת חודשיים" } },
      { type: "TERM2_FINAL", label: { ar: "تقييم النهائي", en: "Final evaluation", he: "הערכה סופית" } }
    ]
  }
];

function textFor(language: AppLanguage, text: { ar: string; en: string; he: string }) {
  if (language === "en") return text.en;
  if (language === "he") return text.he;
  return text.ar;
}

function optionLabel(
  language: AppLanguage,
  studentMode: boolean,
  type: "TERM1_BIMONTHLY" | "TERM1_FINAL" | "TERM2_BIMONTHLY" | "TERM2_FINAL"
) {
  if (studentMode) {
    if (type === "TERM1_BIMONTHLY" || type === "TERM2_BIMONTHLY") {
      return textFor(language, { ar: "علامات الشهرين", en: "Bimonthly marks", he: "ציוני דו-חודשי" });
    }
    return textFor(language, { ar: "علامات النهائي", en: "Final marks", he: "ציוני סופי" });
  }

  if (type === "TERM1_BIMONTHLY" || type === "TERM2_BIMONTHLY") {
    return textFor(language, { ar: "تقييم الشهرين", en: "Bi-monthly evaluation", he: "הערכת חודשיים" });
  }

  return textFor(language, { ar: "تقييم النهائي", en: "Final evaluation", he: "הערכה סופית" });
}

export function GradeEntrySelectionPanel({
  t,
  language,
  gradeEntry,
  studentMode = false,
  readOnly = false,
  showSubjectSelector = true
}: Props) {
  const selectedSubject = gradeEntry.selectedSubject
    ? localizeSubjectName(gradeEntry.selectedSubject.name, language)
    : t("common.none");
  const chooseSubjectLabel = t("gradeEntry.selectSubject");
  const selectedSubjectLabel = gradeEntry.selectedSubject ? selectedSubject : chooseSubjectLabel;

  function chooseType(type: "TERM1_BIMONTHLY" | "TERM1_FINAL" | "TERM2_BIMONTHLY" | "TERM2_FINAL") {
    if (readOnly) return;
    gradeEntry.setCertificateType(type);
  }

  return (
    <div className="grade-entry-selection-stack">
      {showSubjectSelector && (
        <div className="grade-entry-scope-grid">
          <section className="grade-entry-scope-card">
            <div className="grade-entry-scope-card__title">
              <strong>{t("common.subject")}</strong>
            </div>
            {!studentMode ? (
              <label className="grade-entry-scope-field">
                <span>{t("common.subject")}</span>
                <select
                  value={gradeEntry.subjectId}
                  onChange={(event) => gradeEntry.setSubjectId(event.target.value)}
                  disabled={
                    gradeEntry.loading ||
                    readOnly ||
                    !gradeEntry.selectedClassAccessible ||
                    gradeEntry.subjects.length === 0
                  }
                >
                  <option value="" />
                  {gradeEntry.subjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {localizeSubjectName(item.name, language)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grade-entry-subject-grid">
                {gradeEntry.subjects.length > 0 ? (
                  gradeEntry.subjects.map((item) => {
                    const active = gradeEntry.subjectId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={active ? "active" : ""}
                        aria-pressed={active}
                        onClick={() => gradeEntry.setSubjectId(item.id || "")}
                      >
                        {localizeSubjectName(item.name, language)}
                      </button>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    className="grade-entry-scope-empty-button"
                    onClick={() => gradeEntry.setSubjectId(gradeEntry.subjects[0]?.id || "")}
                    disabled={gradeEntry.loading || readOnly || gradeEntry.subjects.length === 0}
                    aria-label={chooseSubjectLabel}
                  >
                    <span className="grade-entry-scope-empty-button__label">{chooseSubjectLabel}</span>
                    <strong className="grade-entry-scope-card__value">{selectedSubjectLabel}</strong>
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="grade-entry-term-grid">
        {termCards.map((card) => (
          <section key={card.key} className="grade-entry-term-card">
            <div className="grade-entry-term-card__title">{textFor(language, card.title)}</div>
            <div className="grade-entry-term-buttons">
              {card.options.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  data-e2e={`grade-entry-type-${option.type}`}
                  className={gradeEntry.certificateType === option.type ? "active" : ""}
                  aria-pressed={gradeEntry.certificateType === option.type}
                  onClick={() => chooseType(option.type)}
                >
                  {optionLabel(language, studentMode, option.type)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
