import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { somApi } from "../../api/somApi";
import { localizeSubjectName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import {
  buildGradeEntryStorageKey,
  loadGradeEntryDraft,
  normalizeGradeEntryDraft,
  saveGradeEntryDraft,
  type GradeEntryStudentMarks
} from "../../features/students/gradeEntryDraft";
import { type GradeEntry, type GradeScheme } from "../../features/students/gradeEntryTypes";
import { GradeEntryMarksGrid } from "../../features/students/GradeEntryMarksGrid";
import { GradeEntrySelectionPanel } from "../../features/students/GradeEntrySelectionPanel";
import { buildGradeImportRows, parseGradeImportFile } from "../../features/students/gradeImport";
import { studentText } from "../../features/students/studentText";
import { useGradeEntry } from "../../features/students/useGradeEntry";

function typeLabelKey(type: GradeScheme["certificateType"]) {
  switch (type) {
    case "TERM1_BIMONTHLY":
      return "gradeEntry.marksTerm1Bimonthly";
    case "TERM1_FINAL":
      return "gradeEntry.marksTerm1Final";
    case "TERM2_BIMONTHLY":
      return "gradeEntry.marksTerm2Bimonthly";
    case "TERM2_FINAL":
      return "gradeEntry.marksTerm2Final";
    default:
      return "gradeEntry.marksTerm1Bimonthly";
  }
}

type Props = {
  currentUser: AuthUser;
};

export function StudentMarksPage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const gradeEntry = useGradeEntry(currentUser, language);
  const [draftRows, setDraftRows] = useState<Record<string, GradeEntryStudentMarks>>({});
  const [saveStatusMessage, setSaveStatusMessage] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [savingGradeEntries, setSavingGradeEntries] = useState(false);
  const loadedGradeEntryKeyRef = useRef("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = currentUser.role === "ADMIN";
  const canUseImport = isAdmin || import.meta.env.DEV;

  const selectedTypeLabel = t(typeLabelKey(gradeEntry.certificateType));
  const importGradeLabel = studentText(t, language, "students.import", "استيراد ملف إكسل", "ייבוא קובץ אקסל");
  const importingGradeLabel = studentText(t, language, "students.importing", "جارٍ الاستيراد...", "מייבא...");
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
  const showAccessMessage = Boolean(gradeEntry.classId && !gradeEntry.selectedClassAccessible);
  const isStudentViewer = currentUser.role === "STUDENT" || currentUser.role === "PARENT";

  const draftKey = useMemo(() => {
    if (
      !gradeEntry.classId ||
      !gradeEntry.subjectId ||
      !gradeEntry.certificateType ||
      !currentUser.schoolId ||
      !currentUser.id
    )
      return "";
    return buildGradeEntryStorageKey({
      schoolId: currentUser.schoolId,
      teacherId: currentUser.id,
      classId: gradeEntry.classId,
      subjectId: gradeEntry.subjectId,
      certificateType: gradeEntry.certificateType
    });
  }, [currentUser.id, currentUser.schoolId, gradeEntry.classId, gradeEntry.certificateType, gradeEntry.subjectId]);

  const studentIds = useMemo(
    () => gradeEntry.students.map((student) => student.id).filter((id): id is string => Boolean(id)),
    [gradeEntry.students]
  );

  async function saveGradeEntriesToServer(quiet = false, overrideRows?: Record<string, GradeEntryStudentMarks>) {
    if (isStudentViewer) {
      return false;
    }
    if (
      !gradeEntry.classId ||
      !gradeEntry.subjectId ||
      !gradeEntry.certificateType ||
      !gradeEntry.selectedClassAccessible ||
      !gradeEntry.selectedSubjectAccessible
    ) {
      return false;
    }

    setSavingGradeEntries(true);
    try {
      const gradeEntryPayload: GradeEntry = {
        classId: gradeEntry.classId,
        subjectId: gradeEntry.subjectId,
        certificateType: gradeEntry.certificateType,
        rows: overrideRows || draftRows
      };
      const response = await somApi.students.gradeEntries.save(gradeEntryPayload);
      const normalized = normalizeGradeEntryDraft(
        {
          rows: response.data?.rows || overrideRows || draftRows,
          updatedAt: String(response.data?.updatedAt || new Date().toISOString())
        },
        studentIds,
        gradeEntry.sections
      );
      setDraftRows(normalized.rows);
      if (draftKey) {
        saveGradeEntryDraft(draftKey, normalized);
      }
      setSaveStatusMessage(t("certificates.saved"));
      if (!quiet) {
        setPageMessage(t("certificates.saved"));
      }
      return true;
    } catch {
      const errorMessage = t("certificates.saveFailed");
      setSaveStatusMessage(errorMessage);
      if (!quiet) {
        setPageMessage(errorMessage);
      }
      return false;
    } finally {
      setSavingGradeEntries(false);
    }
  }

  async function handleImportGradeFile(file: File) {
    if (
      !gradeEntry.classId ||
      !gradeEntry.subjectId ||
      !gradeEntry.certificateType ||
      !gradeEntry.selectedClassAccessible ||
      !gradeEntry.selectedSubjectAccessible
    ) {
      setPageMessage(importChooseClassFirstLabel);
      return;
    }

    setSavingGradeEntries(true);
    setPageMessage(importingGradeLabel);
    try {
      const importedRows = await parseGradeImportFile(file, gradeEntry.sections);
      if (importedRows.length === 0) {
        setPageMessage(importEmptyLabel);
        return;
      }

      const importedDraftRows = buildGradeImportRows(gradeEntry.students, gradeEntry.sections, importedRows);
      if (Object.keys(importedDraftRows).length === 0) {
        setPageMessage(importEmptyLabel);
        return;
      }

      const mergedRows = {
        ...draftRows,
        ...importedDraftRows
      };
      setDraftRows(mergedRows);
      setPageMessage(`${importedLabel} (${Object.keys(importedDraftRows).length})`);
      await saveGradeEntriesToServer(true, mergedRows);
    } catch {
      setPageMessage(importFailedLabel);
    } finally {
      setSavingGradeEntries(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function handleImportSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImportGradeFile(file);
  }

  useEffect(() => {
    if (
      !draftKey ||
      !gradeEntry.selectedClassAccessible ||
      studentIds.length === 0 ||
      gradeEntry.sections.length === 0
    ) {
      setDraftRows({});
      loadedGradeEntryKeyRef.current = "";
      return;
    }

    let active = true;
    somApi.students.gradeEntries
      .get(gradeEntry.classId, gradeEntry.subjectId, gradeEntry.certificateType)
      .then((response) => {
        if (!active) return;
        const normalized = normalizeGradeEntryDraft(
          response.data
            ? { rows: response.data.rows || {}, updatedAt: String(response.data.updatedAt || new Date().toISOString()) }
            : loadGradeEntryDraft(draftKey),
          studentIds,
          gradeEntry.sections
        );
        setDraftRows(normalized.rows);
        loadedGradeEntryKeyRef.current = draftKey;
        saveGradeEntryDraft(draftKey, normalized);
      })
      .catch(() => {
        if (!active) return;
        const stored = loadGradeEntryDraft(draftKey);
        const normalized = normalizeGradeEntryDraft(stored, studentIds, gradeEntry.sections);
        setDraftRows(normalized.rows);
        loadedGradeEntryKeyRef.current = draftKey;
        setPageMessage(t("certificates.loadFailed"));
      });

    return () => {
      active = false;
    };
  }, [
    draftKey,
    gradeEntry.classId,
    gradeEntry.certificateType,
    gradeEntry.sections,
    gradeEntry.selectedClassAccessible,
    gradeEntry.subjectId,
    studentIds,
    t
  ]);

  useEffect(() => {
    if (isStudentViewer) return;
    if (!draftKey || !gradeEntry.selectedClassAccessible || studentIds.length === 0 || gradeEntry.sections.length === 0)
      return;
    saveGradeEntryDraft(draftKey, { rows: draftRows, updatedAt: new Date().toISOString() });
    if (loadedGradeEntryKeyRef.current !== draftKey) return;
    const timeout = window.setTimeout(() => {
      void saveGradeEntriesToServer(true);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [
    draftKey,
    draftRows,
    gradeEntry.selectedClassAccessible,
    gradeEntry.sections.length,
    studentIds.length,
    isStudentViewer
  ]);

  function updateMark(studentId: string, sectionId: string, value: string) {
    setDraftRows((previous) => ({
      ...previous,
      [studentId]: {
        ...(previous[studentId] || {}),
        [sectionId]: value
      }
    }));
  }

  return (
    <div className="page student-marks-page" data-e2e="student-marks-page">
      <div className="student-marks-page__header">
        <h2>
          {isStudentViewer
            ? "كشف العلامات"
            : currentUser.role === "TEACHER"
              ? t("nav.teacherMarks")
              : t("gradeEntry.title")}
        </h2>
        {!isStudentViewer && canUseImport && (
          <div className="student-marks-page__header-actions">
            <button
              type="button"
              className="secondary"
              data-e2e="grade-entry-import"
              onClick={() => importInputRef.current?.click()}
              disabled={
                savingGradeEntries ||
                gradeEntry.loading ||
                showAccessMessage ||
                !gradeEntry.classId ||
                !gradeEntry.subjectId ||
                !gradeEntry.selectedClassAccessible ||
                !gradeEntry.selectedSubjectAccessible
              }
            >
              <Upload size={18} />
              <span>{importGradeLabel}</span>
            </button>
            <button
              type="button"
              className="sticky-save-button"
              data-e2e="grade-entry-save"
              onClick={() => void saveGradeEntriesToServer(false)}
              disabled={
                savingGradeEntries ||
                gradeEntry.loading ||
                showAccessMessage ||
                !gradeEntry.classId ||
                !gradeEntry.subjectId ||
                !gradeEntry.selectedClassAccessible ||
                !gradeEntry.selectedSubjectAccessible
              }
            >
              <Save size={18} />
              <span>{t("common.save")}</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              hidden
              aria-hidden="true"
              onChange={(event) => {
                void handleImportSelection(event);
              }}
            />
          </div>
        )}
        {isStudentViewer && gradeEntry.subjectId && (
          <button type="button" className="secondary" onClick={() => gradeEntry.setSubjectId("")}>
            {t("common.back")}
          </button>
        )}
      </div>

      <Card>
        <div className="attendance-controls lesson-controls lesson-subject-filter">
          <label className="lesson-subject-filter-label">
            {t("common.subject")}
            <select value={gradeEntry.subjectId} onChange={(event) => gradeEntry.setSubjectId(event.target.value)}>
              <option value="">{t("gradeEntry.selectSubject")}</option>
              {gradeEntry.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <GradeEntrySelectionPanel
        t={t}
        language={language}
        gradeEntry={gradeEntry}
        studentMode={isStudentViewer}
        readOnly={false}
        showSubjectSelector={false}
      />

      {!isStudentViewer && gradeEntry.sections.length > 0 && (
        <Card title={`${t("gradeEntry.sectionsTitle")} — ${selectedTypeLabel}`}>
          <div className="certificate-table-wrap">
            <table
              className="certificate-table grade-entry-table grade-entry-sections-table"
              data-e2e="grade-entry-sections-table"
            >
              <thead>
                <tr>
                  <th>{t("gradeEntry.sectionName")}</th>
                  <th>{t("gradeEntry.sectionWeight")}</th>
                  <th>{t("gradeEntry.sectionOutOf")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {gradeEntry.sections.map((section) => (
                  <tr key={section.id}>
                    <td>{section.name || "-"}</td>
                    <td>{section.percentage}</td>
                    <td>{section.outOf}</td>
                    <td>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => gradeEntry.removeSection(section.id)}
                          disabled={gradeEntry.sections.length === 1 || gradeEntry.loading}
                        >
                          <Trash2 size={16} />
                          <span>{t("common.delete")}</span>
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(pageMessage || saveStatusMessage) && (
        <div className="form-message" role="status">
          {pageMessage || saveStatusMessage}
        </div>
      )}

      <GradeEntryMarksGrid
        t={t}
        gradeEntry={gradeEntry}
        draftRows={draftRows}
        studentIds={studentIds}
        updateMark={updateMark}
        readOnly={isStudentViewer}
        studentMode={isStudentViewer}
        studentId={currentUser.studentId || null}
      />

      {!isStudentViewer && isAdmin && (
        <Card
          title={t("gradeEntry.sectionsTitle")}
          actions={
            <div className="grade-entry-section-actions">
              <button type="button" onClick={() => void gradeEntry.save()} disabled={gradeEntry.loading}>
                <Save size={18} />
                <span>{t("common.save")}</span>
              </button>
              <button type="button" onClick={gradeEntry.addSection} disabled={gradeEntry.loading}>
                <Plus size={18} />
                <span>{t("gradeEntry.addSection")}</span>
              </button>
            </div>
          }
        >
          <div className="grade-entry-meta">
            <span>
              {t("gradeEntry.sectionsCount")}: {gradeEntry.sections.length}
            </span>
            <span>
              {t("gradeEntry.totalWeight")}: {gradeEntry.totalWeight} / {gradeEntry.maxScore}
            </span>
            <span>{selectedTypeLabel}</span>
          </div>
          {saveStatusMessage && (
            <div className="form-message" role="status">
              {saveStatusMessage}
            </div>
          )}
          <div className="certificate-table-wrap">
            <table className="certificate-table grade-entry-table">
              <thead>
                <tr>
                  <th>{t("gradeEntry.sectionName")}</th>
                  <th>{t("gradeEntry.sectionWeight")}</th>
                  <th>{t("gradeEntry.sectionOutOf")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {gradeEntry.sections.map((section) => (
                  <tr key={section.id}>
                    <td>
                      <input
                        value={section.name}
                        onChange={(event) => gradeEntry.updateSection(section.id, { name: event.target.value })}
                        placeholder={t("gradeEntry.sectionNamePlaceholder")}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={section.percentage}
                        onChange={(event) =>
                          gradeEntry.updateSection(section.id, { percentage: Number(event.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={section.outOf}
                        onChange={(event) =>
                          gradeEntry.updateSection(section.id, { outOf: Number(event.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => gradeEntry.removeSection(section.id)}
                        disabled={gradeEntry.sections.length === 1}
                      >
                        <Trash2 size={16} />
                        <span>{t("common.delete")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
