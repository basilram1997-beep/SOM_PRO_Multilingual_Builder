import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import { localizeClassName, localizeDay, localizeSubjectName, localizeTeacherName } from "../../i18n/displayNames";
import { exportSectionPdf } from "../../features/schedules/schedulesExport";
import { useSchedules } from "../../features/schedules/useSchedules";
import { teacherColorStyle } from "../../utils/teacherColors";
import type { AuthUser } from "../auth/LoginPage";

type RoomEditorState = {
  day: string;
  period: number;
  classId: string;
  className: string;
  subjectId: string;
  teacherId: string;
  room: string;
  updatedAt?: string;
};

type SwapPreviewState = {
  ok: boolean;
  canSwap: boolean;
  conflicts: string[];
  affectedPeriods: number[];
};

type CopyPreviewState = {
  ok: boolean;
  canCopy: boolean;
  conflicts: string[];
  copiedCount: number;
};

export function SchedulesPage({ currentUser }: { currentUser: AuthUser }) {
  const { t, language } = useI18n();
  const schedules = useSchedules(language);
  const isTeacher = currentUser.role === "TEACHER";
  const [copyFromDay, setCopyFromDay] = useState("");
  const [copyToDay, setCopyToDay] = useState("");
  const [copyOverwrite, setCopyOverwrite] = useState(false);
  const [copyPreviewRequested, setCopyPreviewRequested] = useState(false);
  const [copyPreview, setCopyPreview] = useState<CopyPreviewState | null>(null);
  const [copyPreviewBusy, setCopyPreviewBusy] = useState(false);
  const [copyPreviewError, setCopyPreviewError] = useState("");
  const [swapDay, setSwapDay] = useState("");
  const [swapClassId, setSwapClassId] = useState("");
  const [swapFirstPeriod, setSwapFirstPeriod] = useState(1);
  const [swapSecondPeriod, setSwapSecondPeriod] = useState(2);
  const [swapPreview, setSwapPreview] = useState<SwapPreviewState | null>(null);
  const [swapPreviewBusy, setSwapPreviewBusy] = useState(false);
  const [swapPreviewError, setSwapPreviewError] = useState("");
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationMessage, setOperationMessage] = useState("");
  const [operationError, setOperationError] = useState("");
  const [roomEditor, setRoomEditor] = useState<RoomEditorState | null>(null);
  const [roomDraft, setRoomDraft] = useState("");

  const ui = useMemo(() => {
    if (language === "ar") {
      return {
        copyTitle: "نسخ يوم من البرنامج الثابت",
        copyFromDay: "اليوم المصدر",
        copyToDay: "اليوم الهدف",
        copyOverwrite: "استبدال حصص اليوم الهدف",
        copyButton: "نسخ اليوم",
        copyPreviewTitle: "معاينة النسخ",
        copyPreviewBusy: "جاري فحص النسخ...",
        copyPreviewOk: "النسخ مسموح",
        copyPreviewBlocked: "لا يمكن تنفيذ النسخ الآن بسبب تعارضات في الجدول",
        copyPreviewHint: "فعّل الاستبدال أو اختر يومًا هدفًا فارغًا حتى يكتمل النسخ بلا تعارض.",
        copyPreviewReadyHint: "اختر اليوم المصدر والهدف، ثم اضغط نسخ اليوم لعرض النتيجة قبل التنفيذ.",
        swapTitle: "تبديل حصص صف",
        swapDay: "اليوم",
        swapClass: "الصف",
        swapFirstPeriod: "الحصة الأولى",
        swapSecondPeriod: "الحصة الثانية",
        swapButton: "تبديل الحصص",
        swapPreviewTitle: "معاينة التبديل",
        swapPreviewBusy: "جاري فحص التبديل...",
        swapPreviewOk: "التبديل مسموح",
        swapPreviewBlocked: "التبديل محجوب بسبب التعارضات التالية",
        swapPreviewHint:
          "اختر حصة لا يكون فيها المعلم أو الصف مشغولًا، أو بدّل إلى فترة أخرى لا تتعارض مع الدروس الأخرى.",
        swapPreviewReadyHint: "اختر اليوم والصف والحصتين، وسيظهر هنا إن كان التبديل ممكنًا قبل التنفيذ.",
        roomLabel: "الغرفة",
        roomHint: "تظهر الغرفة داخل الخلية إذا كانت محددة.",
        editRoom: "تعديل الغرفة",
        roomEditorTitle: "تعديل غرفة الحصة",
        roomEditorLabel: "اسم الغرفة",
        roomEditorSave: "حفظ الغرفة",
        roomEditorClose: "إلغاء",
        roomEditorCurrent: "الغرفة الحالية",
        roomEditorEmpty: "لا توجد غرفة محددة",
        roomEditorHelp: "يمكن حفظ اسم غرفة جديد مباشرة على نفس الحصة."
      };
    }

    if (language === "he") {
      return {
        copyTitle: "העתקת יום מלוח הזמנים הבסיסי",
        copyFromDay: "יום מקור",
        copyToDay: "יום יעד",
        copyOverwrite: "החלפת שיעורי יום היעד",
        copyButton: "העתק יום",
        copyPreviewTitle: "תצוגה מקדימה של ההעתקה",
        copyPreviewBusy: "בודק העתקה...",
        copyPreviewOk: "ההעתקה מותרת",
        copyPreviewBlocked: "לא ניתן לבצע את ההעתקה כעת בגלל התנגשויות בלוח הזמנים",
        copyPreviewHint: "הפעל החלפה או בחר יום יעד ריק כדי להשלים את ההעתקה ללא התנגשות.",
        copyPreviewReadyHint: "בחר את יום המקור והיעד, ואז לחץ על העתק יום כדי לראות את התוצאה לפני הביצוע.",
        swapTitle: "החלפת שעות כיתה",
        swapDay: "יום",
        swapClass: "כיתה",
        swapFirstPeriod: "שעה ראשונה",
        swapSecondPeriod: "שעה שנייה",
        swapButton: "החלף שעות",
        swapPreviewTitle: "תצוגה מקדימה של ההחלפה",
        swapPreviewBusy: "בודק החלפה...",
        swapPreviewOk: "ההחלפה מותרת",
        swapPreviewBlocked: "ההחלפה חסומה בגלל ההתנגשויות הבאות",
        swapPreviewHint: "בחר שעה שבה המורה או הכיתה אינם תפוסים, או עבור לשעה אחרת שאינה מתנגשת עם השיעורים האחרים.",
        swapPreviewReadyHint: "בחר יום, כיתה ושתי שעות, וכאן יופיע אם ההחלפה אפשרית לפני הביצוע.",
        roomLabel: "חדר",
        roomHint: "החדר מופיע בתוך התא אם הוגדר.",
        editRoom: "עריכת חדר",
        roomEditorTitle: "עריכת חדר השיעור",
        roomEditorLabel: "שם החדר",
        roomEditorSave: "שמירת חדר",
        roomEditorClose: "ביטול",
        roomEditorCurrent: "החדר הנוכחי",
        roomEditorEmpty: "לא הוגדר חדר",
        roomEditorHelp: "אפשר לשמור שם חדר חדש ישירות על אותה שעה."
      };
    }

    return {
      copyTitle: "Copy a day of the base schedule",
      copyFromDay: "Copy from day",
      copyToDay: "Copy to day",
      copyOverwrite: "Replace target day lessons",
      copyButton: "Copy day",
      copyPreviewTitle: "Copy preview",
      copyPreviewBusy: "Checking copy...",
      copyPreviewOk: "Copy allowed",
      copyPreviewBlocked: "Cannot copy now because of timetable conflicts",
      copyPreviewHint: "Enable replacement or choose an empty target day to complete the copy without conflicts.",
      copyPreviewReadyHint:
        "Choose the source and target day, then click Copy day to preview the result before applying it.",
      swapTitle: "Swap class periods",
      swapDay: "Day",
      swapClass: "Class",
      swapFirstPeriod: "First period",
      swapSecondPeriod: "Second period",
      swapButton: "Swap periods",
      swapPreviewTitle: "Swap preview",
      swapPreviewBusy: "Checking swap...",
      swapPreviewOk: "Swap allowed",
      swapPreviewBlocked: "Swap blocked because of the following conflicts",
      swapPreviewHint:
        "Choose a period where the teacher or class is free, or switch to another period that does not conflict with other lessons.",
      swapPreviewReadyHint:
        "Choose the day, class, and two periods, and the preview will show whether the swap is possible before applying it.",
      roomLabel: "Room",
      roomHint: "Room appears inside each slot if it is set.",
      editRoom: "Edit room",
      roomEditorTitle: "Edit lesson room",
      roomEditorLabel: "Room name",
      roomEditorSave: "Save room",
      roomEditorClose: "Cancel",
      roomEditorCurrent: "Current room",
      roomEditorEmpty: "No room set",
      roomEditorHelp: "You can save a new room directly on the same slot."
    };
  }, [language]);

  useEffect(() => {
    let active = true;

    if (isTeacher) {
      setCopyPreview(null);
      setCopyPreviewRequested(false);
      setCopyPreviewBusy(false);
      setCopyPreviewError("");
      setSwapPreview(null);
      setSwapPreviewBusy(false);
      setSwapPreviewError("");
      return () => {
        active = false;
      };
    }

    if (!swapDay || !swapClassId || !swapFirstPeriod || !swapSecondPeriod || swapFirstPeriod === swapSecondPeriod) {
      setSwapPreview(null);
      setSwapPreviewBusy(false);
      setSwapPreviewError("");
      return () => {
        active = false;
      };
    }

    setSwapPreviewBusy(true);
    setSwapPreviewError("");

    void somApi.schedules
      .previewSwapPeriods({
        day: swapDay,
        classId: swapClassId,
        firstPeriod: swapFirstPeriod,
        secondPeriod: swapSecondPeriod
      })
      .then((response) => {
        if (!active) return;
        setSwapPreview(response.data);
      })
      .catch((error) => {
        if (!active) return;
        setSwapPreview({
          ok: false,
          canSwap: false,
          conflicts: [],
          affectedPeriods: [swapFirstPeriod, swapSecondPeriod]
        });
        setSwapPreviewError(
          error instanceof Error
            ? error.message
            : language === "ar"
              ? "تعذر فحص التبديل الآن"
              : language === "he"
                ? "לא ניתן לבדוק את ההחלפה כעת"
                : "Could not preview the swap right now"
        );
      })
      .finally(() => {
        if (active) setSwapPreviewBusy(false);
      });

    return () => {
      active = false;
    };
  }, [isTeacher, language, swapClassId, swapDay, swapFirstPeriod, swapSecondPeriod]);

  useEffect(() => {
    if (isTeacher) return;
    if (!copyFromDay && schedules.day) setCopyFromDay(schedules.day);
    if (!copyToDay && schedules.workingDays.length > 0) {
      setCopyToDay(
        schedules.workingDays.find((day) => day !== schedules.day) || schedules.workingDays[0] || schedules.day
      );
    }
    if (!swapDay && schedules.day) setSwapDay(schedules.day);
    if (!swapClassId && schedules.classes[0]?.id) setSwapClassId(schedules.classes[0].id);
    if (swapFirstPeriod < 1 && schedules.periods[0]) setSwapFirstPeriod(schedules.periods[0]);
    if (swapSecondPeriod < 1 && schedules.periods[1]) setSwapSecondPeriod(schedules.periods[1]);
  }, [
    isTeacher,
    copyFromDay,
    copyToDay,
    schedules.classes,
    schedules.day,
    schedules.periods,
    schedules.workingDays,
    swapClassId,
    swapDay,
    swapFirstPeriod,
    swapSecondPeriod
  ]);

  async function refreshBase() {
    await schedules.loadBase(schedules.day);
  }

  async function handleCopyDay() {
    if (!copyFromDay || !copyToDay) return;
    setCopyPreviewRequested(true);
    setCopyPreviewBusy(true);
    setCopyPreviewError("");

    try {
      const response = await somApi.schedules.previewCopyWeek({
        fromDay: copyFromDay,
        toDay: copyToDay,
        overwriteConflicts: copyOverwrite
      });
      if (response.data) {
        setCopyPreview(response.data);
        if (!response.data.canCopy) {
          setOperationError(
            language === "ar"
              ? "لا يمكن تنفيذ النسخ الآن بسبب تعارضات في الجدول"
              : language === "he"
                ? "לא ניתן לבצע את ההעתקה כעת בגלל התנגשויות בלוח הזמנים"
                : "The copy cannot run because of schedule conflicts"
          );
          return;
        }
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "";
      const looksTechnical = /Cannot\s+POST|<!DOCTYPE|<html|<body|<pre>|ERR_|ECONN|EADDR|\/api\//i.test(rawMessage);
      setCopyPreview({
        ok: false,
        canCopy: false,
        conflicts: [],
        copiedCount: 0
      });
      setCopyPreviewError(
        looksTechnical
          ? language === "ar"
            ? "تعذر فحص النسخ الآن"
            : language === "he"
              ? "לא ניתן לבדוק את ההעתקה כעת"
              : "Could not preview the copy right now"
          : rawMessage ||
              (language === "ar"
                ? "تعذر فحص النسخ الآن"
                : language === "he"
                  ? "לא ניתן לבדוק את ההעתקה כעת"
                  : "Could not preview the copy right now")
      );
      return;
    } finally {
      setCopyPreviewBusy(false);
    }

    if (copyPreview && !copyPreview.canCopy) {
      setOperationError(
        language === "ar"
          ? "النسخ غير مسموح بسبب التعارضات الظاهرة أدناه"
          : language === "he"
            ? "ההעתקה אינה מותרת בגלל ההתנגשויות שמופיעות למטה"
            : "The copy is blocked by the conflicts shown below"
      );
      return;
    }
    setOperationBusy(true);
    setOperationMessage("");
    setOperationError("");
    try {
      await somApi.schedules.copyWeek({ fromDay: copyFromDay, toDay: copyToDay, overwriteConflicts: copyOverwrite });
      await refreshBase();
      await schedules.validate();
      setOperationMessage(
        language === "ar"
          ? "تم نسخ اليوم بنجاح"
          : language === "he"
            ? "היום הועתק בהצלחה"
            : "The day was copied successfully"
      );
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : language === "ar"
            ? "تعذر نسخ اليوم"
            : language === "he"
              ? "לא ניתן היה להעתיק את היום"
              : "Could not copy the day"
      );
    } finally {
      setOperationBusy(false);
    }
  }

  async function handleSwapPeriods() {
    if (!swapDay || !swapClassId || !swapFirstPeriod || !swapSecondPeriod || swapFirstPeriod === swapSecondPeriod)
      return;
    if (swapPreview && !swapPreview.canSwap) {
      setOperationError(
        language === "ar"
          ? "التبديل غير مسموح بسبب التعارضات الظاهرة أدناه"
          : language === "he"
            ? "ההחלפה אינה מותרת בגלל ההתנגשויות שמופיעות למטה"
            : "The swap is blocked by the conflicts shown below"
      );
      return;
    }
    setOperationBusy(true);
    setOperationMessage("");
    setOperationError("");
    try {
      await somApi.schedules.swapPeriods({
        day: swapDay,
        classId: swapClassId,
        firstPeriod: swapFirstPeriod,
        secondPeriod: swapSecondPeriod
      });
      await refreshBase();
      await schedules.validate();
      setOperationMessage(
        language === "ar"
          ? "تم تبديل الحصص بنجاح"
          : language === "he"
            ? "השעות הוחלפו בהצלחה"
            : "The periods were swapped successfully"
      );
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : language === "ar"
            ? "تعذر تبديل الحصص"
            : language === "he"
              ? "לא ניתן היה להחליף את השעות"
              : "Could not swap periods"
      );
    } finally {
      setOperationBusy(false);
    }
  }

  function openRoomEditor(slot: {
    day?: string;
    period: number;
    classId: string;
    class?: { name?: string };
    subject?: { id?: string | null } | null;
    subjectId?: string;
    teacher?: { id?: string | null } | null;
    teacherId?: string;
    room?: string | null;
    updatedAt?: string;
  }) {
    setRoomEditor({
      day: slot.day || schedules.day,
      period: slot.period,
      classId: slot.classId,
      className: slot.class?.name || "",
      subjectId: slot.subjectId || slot.subject?.id || "",
      teacherId: slot.teacherId || slot.teacher?.id || "",
      room: typeof slot.room === "string" ? slot.room : "",
      updatedAt: slot.updatedAt
    });
    setRoomDraft(typeof slot.room === "string" ? slot.room : "");
  }

  async function handleSaveRoom() {
    if (!roomEditor || !roomEditor.subjectId || !roomEditor.teacherId) {
      setOperationError(
        language === "ar"
          ? "لا يمكن حفظ الغرفة لأن بيانات الحصة غير مكتملة"
          : language === "he"
            ? "לא ניתן לשמור את החדר כי נתוני השיעור חסרים"
            : "Cannot save room because the lesson data is incomplete"
      );
      return;
    }

    setOperationBusy(true);
    setOperationMessage("");
    setOperationError("");
    try {
      await somApi.schedules.saveBase({
        day: roomEditor.day,
        period: roomEditor.period,
        classId: roomEditor.classId,
        subjectId: roomEditor.subjectId,
        teacherId: roomEditor.teacherId,
        room: roomDraft.trim() || null,
        expectedUpdatedAt: roomEditor.updatedAt
      });
      setRoomEditor(null);
      setRoomDraft("");
      await refreshBase();
      await schedules.validate();
      setOperationMessage(
        language === "ar" ? "تم حفظ الغرفة بنجاح" : language === "he" ? "החדר נשמר בהצלחה" : "Room saved successfully"
      );
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : language === "ar"
            ? "تعذر حفظ الغرفة"
            : language === "he"
              ? "לא ניתן היה לשמור את החדר"
              : "Could not save room"
      );
    } finally {
      setOperationBusy(false);
    }
  }

  return (
    <div className="page schedules-page">
      <h2>{t("schedules.title")}</h2>

      <Card title={t("common.day")}>
        <div className="schedule-day-strip">
          <label>
            <span>{t("common.day")}</span>
            <select value={schedules.day} onChange={(event) => schedules.setDay(event.target.value)}>
              {schedules.workingDays.map((day) => (
                <option key={day} value={day}>
                  {localizeDay(day, language)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        <div className="table-wrap daily-schedule-wrap" id="base-schedule-grid">
          <table className="daily-grid-table flipped-daily-grid">
            <thead>
              <tr>
                <th>{language === "ar" ? "الحصة / الصف" : `${t("timetable.period")} / ${t("timetable.class")}`}</th>
                {schedules.classes.map((cls) => (
                  <th key={cls.id || cls.name}>{localizeClassName(cls.name, language)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.classes.length === 0 && (
                <tr>
                  <td colSpan={2}>{t("common.empty")}</td>
                </tr>
              )}

              {schedules.classes.length > 0 &&
                schedules.periods.map((period) => {
                  const display = schedules.periodDisplay(period);
                  return (
                    <tr key={period}>
                      <th className="period-time-header">
                        <strong>{display.name}</strong>
                        {display.time && <span>{display.time}</span>}
                      </th>
                      {schedules.classes.map((cls) => {
                        const classKey = cls.id || cls.name;
                        const slot = schedules.slotFor(classKey, period);

                        return (
                          <td
                            key={`${classKey}-${period}`}
                            className={slot ? "daily-cell teacher-color-cell" : "free-period"}
                            style={slot ? teacherColorStyle(slot.teacher) : undefined}
                          >
                            {slot ? (
                              <>
                                <strong>{localizeSubjectName(slot.subject?.name || "", language)}</strong>
                                <span>{localizeTeacherName(slot.teacher?.name || "", language)}</span>
                              </>
                            ) : (
                              t("daily.free")
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <p className="schedule-room-hint">{ui.roomHint}</p>
        {operationMessage && (
          <div className="form-message" role="status">
            {operationMessage}
          </div>
        )}
        {!isTeacher && operationError && (
          <div className="alert" role="alert">
            {operationError}
          </div>
        )}
      </Card>

      {!isTeacher && (
        <>
          <Card>
            <div className="schedule-actions-card">
              {schedules.conflicts.length > 0 && (
                <div className="alert">
                  {schedules.conflicts.map((conflict) => (
                    <p key={conflict}>{conflict}</p>
                  ))}
                </div>
              )}
              <div className="actions schedule-actions-row">
                <button onClick={schedules.validate}>{t("schedules.validate")}</button>
                <button
                  className="secondary export-button"
                  onClick={() => void exportSectionPdf("base-schedule-grid", t("schedules.title"))}
                >
                  {t("schedules.exportBase")}
                </button>
              </div>
            </div>
          </Card>

          <div className="schedule-tools">
            <div className="schedule-tool">
              <h3>{ui.swapTitle}</h3>
              <div className="schedule-tool-grid">
                <label>
                  {ui.swapDay}
                  <select value={swapDay} onChange={(event) => setSwapDay(event.target.value)}>
                    {schedules.workingDays.map((day) => (
                      <option key={day} value={day}>
                        {localizeDay(day, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {ui.swapClass}
                  <select value={swapClassId} onChange={(event) => setSwapClassId(event.target.value)}>
                    {schedules.classes.map((cls) => (
                      <option key={cls.id || cls.name} value={cls.id || cls.name}>
                        {localizeClassName(cls.name, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {ui.swapFirstPeriod}
                  <select value={swapFirstPeriod} onChange={(event) => setSwapFirstPeriod(Number(event.target.value))}>
                    {schedules.periods.map((period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {ui.swapSecondPeriod}
                  <select
                    value={swapSecondPeriod}
                    onChange={(event) => setSwapSecondPeriod(Number(event.target.value))}
                  >
                    {schedules.periods.map((period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={operationBusy || swapPreviewBusy || Boolean(swapPreview && !swapPreview.canSwap)}
                  onClick={() => void handleSwapPeriods()}
                >
                  {ui.swapButton}
                </button>
              </div>

              <div className={`schedule-swap-preview ${swapPreview?.canSwap ? "is-ok" : "is-blocked"}`}>
                <div className="schedule-swap-preview-head">
                  <strong>{ui.swapPreviewTitle}</strong>
                  <span>
                    {localizeDay(swapDay, language)} ·{" "}
                    {localizeClassName(
                      schedules.classes.find((cls) => (cls.id || cls.name) === swapClassId)?.name || "",
                      language
                    )}{" "}
                    · {swapFirstPeriod} ↔ {swapSecondPeriod}
                  </span>
                </div>

                {swapPreviewBusy && <p className="muted">{ui.swapPreviewBusy}</p>}
                {!swapPreviewBusy && swapPreviewError && (
                  <p className="schedule-swap-preview-error">{swapPreviewError}</p>
                )}
                {!swapPreviewBusy && swapPreview && swapPreview.canSwap && (
                  <p className="schedule-swap-preview-ok">{ui.swapPreviewOk}</p>
                )}
                {!swapPreviewBusy && swapPreview && !swapPreview.canSwap && (
                  <>
                    <p className="schedule-swap-preview-blocked">{ui.swapPreviewBlocked}</p>
                    <p className="schedule-swap-preview-hint">{ui.swapPreviewHint}</p>
                    <ul className="schedule-swap-conflicts">
                      {swapPreview.conflicts.map((conflict) => (
                        <li key={conflict}>{conflict}</li>
                      ))}
                    </ul>
                  </>
                )}
                {!swapPreviewBusy && !swapPreview && !swapPreviewError && (
                  <p className="schedule-swap-preview-hint">{ui.swapPreviewReadyHint}</p>
                )}
              </div>
            </div>

            <div className="schedule-tool">
              <h3>{ui.copyTitle}</h3>
              <div className="schedule-tool-grid">
                <label>
                  {ui.copyFromDay}
                  <select value={copyFromDay} onChange={(event) => setCopyFromDay(event.target.value)}>
                    {schedules.workingDays.map((day) => (
                      <option key={day} value={day}>
                        {localizeDay(day, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {ui.copyToDay}
                  <select value={copyToDay} onChange={(event) => setCopyToDay(event.target.value)}>
                    {schedules.workingDays.map((day) => (
                      <option key={day} value={day}>
                        {localizeDay(day, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="schedule-tool-check">
                  <input
                    type="checkbox"
                    checked={copyOverwrite}
                    onChange={(event) => setCopyOverwrite(event.target.checked)}
                  />
                  <span>{ui.copyOverwrite}</span>
                </label>
                <button
                  disabled={operationBusy || copyPreviewBusy || Boolean(copyPreview && !copyPreview.canCopy)}
                  onClick={() => void handleCopyDay()}
                >
                  {ui.copyButton}
                </button>
              </div>

              {copyPreviewRequested && (
                <div className={`schedule-copy-preview ${copyPreview?.canCopy ? "is-ok" : "is-blocked"}`}>
                  <div className="schedule-swap-preview-head">
                    <strong>{ui.copyPreviewTitle}</strong>
                    <span>
                      {localizeDay(copyFromDay, language)} → {localizeDay(copyToDay, language)}
                    </span>
                  </div>
                  {copyPreviewBusy && <p className="muted">{ui.copyPreviewBusy}</p>}
                  {!copyPreviewBusy && copyPreviewError && (
                    <p className="schedule-swap-preview-error">{copyPreviewError}</p>
                  )}
                  {!copyPreviewBusy && copyPreview && copyPreview.canCopy && (
                    <p className="schedule-swap-preview-ok">{ui.copyPreviewOk}</p>
                  )}
                  {!copyPreviewBusy && copyPreview && !copyPreview.canCopy && (
                    <>
                      <p className="schedule-swap-preview-blocked">{ui.copyPreviewBlocked}</p>
                      <p className="schedule-swap-preview-hint">{ui.copyPreviewHint}</p>
                      <ul className="schedule-swap-conflicts">
                        {copyPreview.conflicts.map((conflict) => (
                          <li key={conflict}>{conflict}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {!copyPreviewBusy && !copyPreview && !copyPreviewError && (
                    <p className="schedule-swap-preview-hint">{ui.copyPreviewReadyHint}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!isTeacher && roomEditor && (
        <div className="modal-backdrop" onClick={() => setRoomEditor(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{ui.roomEditorTitle}</h3>
            <p className="lesson-info">{ui.roomEditorHelp}</p>
            <div className="schedule-tool-grid">
              <label>
                <span>{ui.swapClass}</span>
                <input value={roomEditor.className} readOnly />
              </label>
              <label>
                <span>{ui.swapDay}</span>
                <input value={localizeDay(roomEditor.day, language)} readOnly />
              </label>
              <label>
                <span>{ui.swapFirstPeriod}</span>
                <input value={roomEditor.period} readOnly />
              </label>
              <label>
                <span>{ui.roomEditorLabel}</span>
                <input
                  value={roomDraft}
                  onChange={(event) => setRoomDraft(event.target.value)}
                  placeholder={ui.roomEditorEmpty}
                />
              </label>
              <label>
                <span>{ui.roomEditorCurrent}</span>
                <input value={roomEditor.room || ui.roomEditorEmpty} readOnly />
              </label>
            </div>
            <div className="actions top-space">
              <button disabled={operationBusy} onClick={() => void handleSaveRoom()}>
                {ui.roomEditorSave}
              </button>
              <button className="secondary" onClick={() => setRoomEditor(null)}>
                {ui.roomEditorClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
