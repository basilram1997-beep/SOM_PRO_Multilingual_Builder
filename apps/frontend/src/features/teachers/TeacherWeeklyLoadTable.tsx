import { useEffect, useMemo, useState } from "react";
import { localizeClassName, localizeSubjectName } from "../../i18n/displayNames";
import type { AppLanguage, BaseScheduleSlotWithDetails, TeacherWithAssignments } from "./teacherTypes";

type Row = {
  key: string;
  assignmentId?: string;
  classId?: string | null;
  subjectId?: string | null;
  className: string;
  subjectName: string;
  requiredWeekly: number;
  isPlaceholder?: boolean;
};

type Props = {
  selected: TeacherWithAssignments | null;
  teacherId?: string;
  weeklySlots: BaseScheduleSlotWithDetails[];
  schoolClasses?: { id: string; name: string }[];
  schoolSubjects?: { id: string; name: string }[];
  language: AppLanguage;
  onRemoveAssignment?: (assignmentId: string) => void;
  onWeeklyPeriodsChange?: (assignmentId: string, weeklyPeriods: number) => void;
  onAddAssignment?: (classId: string, subjectId: string, weeklyPeriods: number) => void;
};

const periodMultipliers = {
  month: 4,
  term: 16,
  year: 32
};

function labels(language: AppLanguage) {
  if (language === "en") {
    return {
      title: "Weekly lessons by class and subject",
      hint: "Required lessons come from teacher files. Actual lessons are counted from the base schedule.",
      className: "Class",
      subjectName: "Subject",
      requiredWeek: "Required / week",
      selectedClass: "Selected class",
      month: "Month",
      term: "Term",
      year: "Year",
      total: "Total",
      empty: "No assignments were found for this teacher.",
      saveHint: "Edit the required weekly lessons and the change will be saved immediately.",
      addTitle: "Add class, subject, and weekly lessons",
      addClass: "Class",
      addSubject: "Subject",
      addWeekly: "Weekly lessons",
      addButton: "Add assignment",
      remove: "Delete",
      removeConfirm: "Delete this class and subject assignment?"
    };
  }
  if (language === "he") {
    return {
      title: "שיעורים שבועיים לפי כיתה ומקצוע",
      hint: "השיעורים הנדרשים נשמרים במבנה המורה. השיעורים בפועל נספרים מהמערכת הקבועה.",
      className: "כיתה",
      subjectName: "מקצוע",
      requiredWeek: "נדרש בשבוע",
      selectedClass: "כיתה נבחרת",
      month: "חודש",
      term: "סמסטר",
      year: "שנה",
      total: "סך הכול",
      empty: "לא נמצאו שיוכים למורה זה.",
      saveHint: "ערוך את מספר השיעורים השבועיים והשינוי יישמר מיד.",
      addTitle: "הוספת כיתה, מקצוע ושיעורים שבועיים",
      addClass: "כיתה",
      addSubject: "מקצוע",
      addWeekly: "שיעורים שבועיים",
      addButton: "הוסף שיוך",
      remove: "מחיקה",
      removeConfirm: "למחוק את השיוך הזה?"
    };
  }
  return {
    title: "حصص المعلم حسب الصف والمادة",
    hint: "المطلوب يُحفظ في ملف المعلم، والموجود يُحسب من البرنامج الثابت.",
    className: "الصف",
    subjectName: "المادة",
    requiredWeek: "المطلوب أسبوعيًا",
    selectedClass: "الصف المختار",
    month: "الشهر",
    term: "الفصل",
    year: "السنة",
    total: "المجموع",
    empty: "لا توجد تكليفات لهذا المعلم.",
    saveHint: "عدّل عدد الحصص الأسبوعية وسيُحفظ التغيير مباشرة.",
    addTitle: "إضافة صف ومادة وحصص أسبوعية",
    addClass: "الصف",
    addSubject: "المادة",
    addWeekly: "الحصص الأسبوعية",
    addButton: "إضافة تكليف",
    remove: "حذف",
    removeConfirm: "حذف هذا التكليف الخاص بالصف والمادة؟"
  };
}

function rowKey(
  classId: string | null | undefined,
  subjectId: string | null | undefined,
  className: string,
  subjectName: string
) {
  return `${classId || className}::${subjectId || subjectName}`;
}

function buildRows(
  selected: TeacherWithAssignments | null,
  teacherId: string | undefined,
  weeklySlots: BaseScheduleSlotWithDetails[],
  schoolClasses: { id: string; name: string }[] = []
) {
  if (!teacherId) return [];

  const rows = new Map<string, Row>();
  const classNameById = new Map(schoolClasses.map((cls) => [cls.id, cls.name]));

  for (const assignment of selected?.assignments || []) {
    const classId = assignment.classId || assignment.class?.id || null;
    const subjectId = assignment.subjectId || assignment.subject?.id || null;
    const className = assignment.class?.name || "-";
    const subjectName = assignment.subject?.name || "-";
    const key = rowKey(classId, subjectId, className, subjectName);
    rows.set(key, {
      key,
      assignmentId: assignment.id,
      classId,
      subjectId,
      className,
      subjectName,
      requiredWeekly: Number(assignment.weeklyPeriods || 0)
    });
  }

  for (const classId of selected?.preferredClasses || []) {
    const className = classNameById.get(classId) || classId || "-";
    const hasAssignmentForClass = Array.from(rows.values()).some((row) => row.classId === classId);
    if (hasAssignmentForClass) continue;
    const key = rowKey(classId, null, className, "-");
    rows.set(key, {
      key,
      classId,
      subjectId: null,
      className,
      subjectName: "-",
      requiredWeekly: 0,
      isPlaceholder: true
    });
  }

  for (const slot of weeklySlots.filter((slot) => slot.teacherId === teacherId)) {
    const className = slot.class?.name || "-";
    const subjectName = slot.subject?.name || "-";
    const key = rowKey(slot.classId, slot.subjectId, className, subjectName);
    const current = rows.get(key) || {
      key,
      classId: slot.classId,
      subjectId: slot.subjectId,
      className,
      subjectName,
      requiredWeekly: 0
    };
    rows.set(key, current);
  }

  return Array.from(rows.values()).sort(
    (a, b) => a.className.localeCompare(b.className, "ar") || a.subjectName.localeCompare(b.subjectName, "ar")
  );
}

export function TeacherWeeklyLoadTable({
  selected,
  teacherId,
  weeklySlots,
  schoolClasses = [],
  schoolSubjects = [],
  language,
  onRemoveAssignment,
  onWeeklyPeriodsChange,
  onAddAssignment
}: Props) {
  const text = labels(language);
  const rows = buildRows(selected, teacherId, weeklySlots, schoolClasses);
  const requiredTotal = rows.reduce((sum, row) => sum + row.requiredWeekly, 0);
  const rowsSignature = useMemo(
    () => rows.map((row) => `${row.assignmentId || row.key}:${row.requiredWeekly}`).join("|"),
    [rows]
  );
  const initialDrafts = useMemo(
    () =>
      Object.fromEntries(
        rows.filter((row) => row.assignmentId).map((row) => [row.assignmentId as string, row.requiredWeekly])
      ),
    [rowsSignature]
  );
  const [draftPeriods, setDraftPeriods] = useState<Record<string, number>>({});
  const [newClassId, setNewClassId] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newWeeklyPeriods, setNewWeeklyPeriods] = useState(0);

  useEffect(() => {
    setDraftPeriods(initialDrafts);
  }, [initialDrafts, rowsSignature]);

  useEffect(() => {
    if (!newClassId && schoolClasses.length > 0) {
      setNewClassId(schoolClasses[0].id);
    }
  }, [newClassId, schoolClasses]);

  useEffect(() => {
    if (!newSubjectId && schoolSubjects.length > 0) {
      setNewSubjectId(schoolSubjects[0].id);
    }
  }, [newSubjectId, schoolSubjects]);

  function saveRequiredWeekly(assignmentId: string, nextValue: number, currentValue: number) {
    if (!onWeeklyPeriodsChange) return;
    const normalized = Math.max(0, Math.min(40, Number.isFinite(nextValue) ? Math.trunc(nextValue) : 0));
    setDraftPeriods((previous) => ({ ...previous, [assignmentId]: normalized }));
    if (normalized !== currentValue) onWeeklyPeriodsChange(assignmentId, normalized);
  }

  function addAssignment() {
    if (!onAddAssignment || !selected?.id) return;
    if (!newClassId || !newSubjectId) return;
    onAddAssignment(newClassId, newSubjectId, Math.max(0, Math.min(40, Math.trunc(Number(newWeeklyPeriods) || 0))));
    setNewWeeklyPeriods(0);
  }

  return (
    <section className="teacher-weekly-load">
      <h3>{text.title}</h3>
      <p className="muted">{text.hint}</p>
      <p className="muted">{text.saveHint}</p>

      <div className="form-row teacher-assignment-add-row">
        <label>
          {text.addClass}
          <select
            value={newClassId}
            onChange={(event) => setNewClassId(event.target.value)}
            disabled={schoolClasses.length === 0 || !selected?.id}
          >
            {schoolClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {localizeClassName(cls.name, language)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text.addSubject}
          <select
            value={newSubjectId}
            onChange={(event) => setNewSubjectId(event.target.value)}
            disabled={schoolSubjects.length === 0 || !selected?.id}
          >
            {schoolSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {localizeSubjectName(subject.name, language)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text.addWeekly}
          <input
            type="number"
            min={0}
            max={40}
            value={newWeeklyPeriods}
            onChange={(event) => setNewWeeklyPeriods(Number(event.currentTarget.value || 0))}
            disabled={!selected?.id}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={addAssignment}
          disabled={!selected?.id || !newClassId || !newSubjectId}
        >
          {text.addButton}
        </button>
      </div>

      <div className="table-wrap small-table teacher-weekly-load-table">
        <table>
          <thead>
            <tr>
              <th>{text.className}</th>
              <th>{text.subjectName}</th>
              <th>{text.requiredWeek}</th>
              <th>{text.month}</th>
              <th>{text.term}</th>
              <th>{text.year}</th>
              <th>{text.remove}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>{text.empty}</td>
              </tr>
            ) : (
              rows.map((row) => {
                const draftValue = row.assignmentId
                  ? (draftPeriods[row.assignmentId] ?? row.requiredWeekly)
                  : row.requiredWeekly;
                const subjectText = row.isPlaceholder
                  ? text.selectedClass
                  : localizeSubjectName(row.subjectName, language);

                return (
                  <tr key={row.key}>
                    <td>{localizeClassName(row.className, language)}</td>
                    <td>{subjectText}</td>
                    <td>
                      <input
                        className="weekly-periods-input"
                        type="number"
                        min={0}
                        max={40}
                        value={draftValue}
                        disabled={!row.assignmentId || !onWeeklyPeriodsChange || row.isPlaceholder}
                        onChange={(event) => {
                          if (!row.assignmentId || row.isPlaceholder) return;
                          const next = Number(event.currentTarget.value || 0);
                          const normalized = Math.max(0, Math.min(40, Number.isFinite(next) ? Math.trunc(next) : 0));
                          setDraftPeriods((previous) => ({ ...previous, [row.assignmentId as string]: normalized }));
                        }}
                        onBlur={(event) => {
                          if (!row.assignmentId || row.isPlaceholder) return;
                          const next = Number(event.currentTarget.value || 0);
                          saveRequiredWeekly(row.assignmentId, next, row.requiredWeekly);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" || !row.assignmentId || row.isPlaceholder) return;
                          const next = Number((event.currentTarget as HTMLInputElement).value || 0);
                          saveRequiredWeekly(row.assignmentId, next, row.requiredWeekly);
                        }}
                      />
                      {row.assignmentId && onWeeklyPeriodsChange && !row.isPlaceholder && (
                        <button
                          type="button"
                          className="secondary save-inline-button"
                          onClick={() => saveRequiredWeekly(row.assignmentId!, draftValue, row.requiredWeekly)}
                        >
                          حفظ
                        </button>
                      )}
                    </td>
                    <td>{row.requiredWeekly * periodMultipliers.month}</td>
                    <td>{row.requiredWeekly * periodMultipliers.term}</td>
                    <td>{row.requiredWeekly * periodMultipliers.year}</td>
                    <td>
                      {row.assignmentId && onRemoveAssignment && !row.isPlaceholder ? (
                        <button
                          type="button"
                          className="danger light"
                          onClick={() => {
                            if (confirm(text.removeConfirm)) onRemoveAssignment(row.assignmentId!);
                          }}
                        >
                          {text.remove}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            {rows.length > 0 && (
              <tr className="teacher-weekly-total-row">
                <td colSpan={2}>{text.total}</td>
                <td>{requiredTotal}</td>
                <td>{requiredTotal * periodMultipliers.month}</td>
                <td>{requiredTotal * periodMultipliers.term}</td>
                <td>{requiredTotal * periodMultipliers.year}</td>
                <td>-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
