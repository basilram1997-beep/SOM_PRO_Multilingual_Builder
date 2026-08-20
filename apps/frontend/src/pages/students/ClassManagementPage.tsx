import { Card } from "../../components/ui/Card";
import { localizeTeacherName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import { teacherColorStyle } from "../../utils/teacherColors";
import { useClassManagement } from "../../features/classes/useClassManagement";

export function ClassManagementPage() {
  const { t, language } = useI18n();
  const classManagement = useClassManagement();

  const description =
    language === "ar"
      ? "إضافة صف وربطه بمربي الصف، أو حذف الصف مع تنظيف البيانات المرتبطة به."
      : language === "he"
        ? "הוספת כיתה וקישור מחנך, או מחיקת הכיתה תוך ניקוי הנתונים הקשורים."
        : t("classesManagement.description");

  const addTitle = t("classesManagement.addTitle");
  const tableTitle = t("classesManagement.tableTitle");
  const classNameLabel =
    language === "ar" ? "اسم الصف" : language === "he" ? "שם הכיתה" : t("classesManagement.className");
  const homeroomTeacherLabel =
    language === "ar" ? "مربي الصف" : language === "he" ? "מחנך הכיתה" : t("classesManagement.homeroomTeacher");
  const maxStudentsLabel =
    language === "ar"
      ? "الحد الأعلى للطلاب"
      : language === "he"
        ? "מקסימום תלמידים"
        : t("classesManagement.maxStudents");
  const noHomeroomLabel =
    language === "ar" ? "لم يتم اختيار بعد" : language === "he" ? "עדיין לא נבחר" : t("classesManagement.noHomeroom");
  const emptyClassesLabel =
    language === "ar" ? "لا توجد صفوف بعد." : language === "he" ? "עדיין אין כיתות." : t("classesManagement.empty");
  return (
    <div className="page classes-management-page" data-e2e="classes-management-page">
      <h2>{t("classesManagement.title")}</h2>
      <p className="muted">{description}</p>

      {classManagement.loadError && <div className="alert">{classManagement.loadError}</div>}
      {classManagement.message && (
        <div className="form-message" role="status">
          {classManagement.message}
        </div>
      )}

      <Card title={addTitle}>
        <div className="form classes-management-form">
          <label>
            <span>{classNameLabel}</span>
            <input
              value={classManagement.form.name}
              onChange={(event) => classManagement.setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder={classNameLabel}
            />
          </label>
          <label>
            <span>{homeroomTeacherLabel}</span>
            <select
              value={classManagement.form.teacherId}
              onChange={(event) =>
                classManagement.setForm((previous) => ({ ...previous, teacherId: event.target.value }))
              }
            >
              <option value="">{noHomeroomLabel}</option>
              {classManagement.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {localizeTeacherName(teacher.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{maxStudentsLabel}</span>
            <input
              type="number"
              min="1"
              max="500"
              value={classManagement.form.maxStudents}
              onChange={(event) =>
                classManagement.setForm((previous) => ({ ...previous, maxStudents: event.target.value }))
              }
            />
          </label>
          <div className="actions">
            <button
              type="button"
              onClick={classManagement.createClass}
              disabled={classManagement.savingClassId === "new"}
            >
              {t("classesManagement.addClass")}
            </button>
          </div>
        </div>
      </Card>

      <Card title={tableTitle}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.class")}</th>
                <th>{homeroomTeacherLabel}</th>
                <th>{maxStudentsLabel}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {classManagement.classes.length === 0 ? (
                <tr>
                  <td colSpan={4}>{emptyClassesLabel}</td>
                </tr>
              ) : (
                classManagement.classes.map((cls) => {
                  const classId = cls.id || "";
                  if (!classId) return null;
                  const homeroom = classManagement.homeroomByClass.get(classId);
                  const teacher = classManagement.teachers.find((item) => item.id === homeroom?.teacherId) || null;
                  const classNameValue = classManagement.classDrafts[classId] ?? cls.name ?? "";
                  const maxStudentsValue =
                    classManagement.classMaxDrafts[classId] ?? (cls.maxStudents == null ? "" : String(cls.maxStudents));
                  const teacherValue = homeroom?.teacherId || "";

                  return (
                    <tr key={classId}>
                      <td>
                        <input
                          value={classNameValue}
                          disabled={classManagement.savingClassId === classId}
                          onChange={(event) =>
                            classManagement.setClassDrafts((previous) => ({
                              ...previous,
                              [classId]: event.target.value
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={teacherValue}
                          disabled={classManagement.savingClassId === classId}
                          onChange={(event) => classManagement.saveHomeroom(classId, event.target.value)}
                        >
                          <option value="">{noHomeroomLabel}</option>
                          {classManagement.teachers.map((item) => (
                            <option key={item.id} value={item.id}>
                              {localizeTeacherName(item.name, language)}
                            </option>
                          ))}
                        </select>
                        {teacher && (
                          <div
                            className="teacher-color-cell class-management-teacher-chip"
                            style={teacherColorStyle(teacher)}
                          >
                            {localizeTeacherName(teacher.name, language)}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={maxStudentsValue}
                          disabled={classManagement.savingClassId === classId}
                          onChange={(event) =>
                            classManagement.setClassMaxDrafts((previous) => ({
                              ...previous,
                              [classId]: event.target.value
                            }))
                          }
                        />
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          disabled={
                            classManagement.savingClassId === classId ||
                            (classNameValue.trim() === (cls.name || "").trim() &&
                              maxStudentsValue.trim() === (cls.maxStudents == null ? "" : String(cls.maxStudents)))
                          }
                          onClick={() =>
                            classManagement.updateClass(classId, {
                              name: classNameValue.trim(),
                              maxStudents: maxStudentsValue.trim() ? Number(maxStudentsValue) : null
                            })
                          }
                        >
                          {t("common.save")}
                        </button>
                        <button
                          type="button"
                          className="danger light"
                          disabled={classManagement.savingClassId === classId}
                          onClick={() => classManagement.removeClass(classId, cls.name)}
                        >
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
