import { Printer, Send, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { localizeClassName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import { useStudentPledges } from "../../features/students/useStudentPledges";

export function StudentPledgePage() {
  const { t, language } = useI18n();
  const pledge = useStudentPledges();
  const chooseClassFirstLabel = t("pledges.chooseClassFirst");
  const fatherNameLabel = t("students.fatherName");
  const motherNameLabel = t("students.motherName");
  const guardianPhoneLabel = t("students.guardianPhone");
  const homeroomTeacherLabel = t("pledges.homeroomTeacher");
  const principalNameLabel = t("pledges.principalName");
  const teacherSignatureLabel = t("pledges.teacherSignature");
  const principalSignatureLabel = t("pledges.principalSignature");
  const noneLabel = t("common.notSet");

  const classLabel = pledge.selectedClass ? localizeClassName(pledge.selectedClass.name, language) : noneLabel;
  const studentLabel = pledge.selectedStudent?.name || noneLabel;
  const nationalIdLabel = pledge.selectedStudent?.nationalId || noneLabel;
  const fatherNameValue = pledge.selectedStudent?.fatherName || noneLabel;
  const motherNameValue = pledge.selectedStudent?.motherName || noneLabel;
  const guardianPhoneValue = pledge.selectedStudent?.guardianPhone?.trim() || "";
  const hasGuardianContact = Boolean(guardianPhoneValue);
  const pledgeTextValue = pledge.form.pledgeText.trim();
  const pledgeNoteValue = pledge.form.note.trim();
  const homeroomTeacherNameValue = pledge.form.homeroomTeacherName.trim();
  const principalNameValue = pledge.form.principalName.trim();
  const familyInfoLabel = t("pledges.familyDetails");
  const pledgeInfoLabel = t("pledges.pledgeDetails");

  return (
    <div className="page student-invitations-page student-pledges-page">
      <div className="page-title-row">
        <h2>{t("pledges.title")}</h2>
        <div className="button-group">
          <button type="button" className="secondary" onClick={pledge.exportPledge} disabled={pledge.exporting}>
            <Printer size={16} />
            <span>{pledge.exporting ? t("common.loading") : t("pledges.export")}</span>
          </button>
          <button type="button" className="primary" onClick={pledge.save} disabled={pledge.saving}>
            <Send size={16} />
            <span>{pledge.saving ? t("pledges.saving") : t("pledges.save")}</span>
          </button>
        </div>
      </div>

      <Card title={t("pledges.formTitle")}>
        <div className="student-invitation-form">
          <label>
            {t("pledges.class")}
            <select
              value={pledge.form.classId}
              onChange={(event) => {
                pledge.setSelectedClassId(event.target.value);
                pledge.setForm((previous) => ({ ...previous, classId: event.target.value, studentId: "" }));
              }}
            >
              <option value="">{t("students.selectClass")}</option>
              {pledge.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("pledges.student")}
            <select
              value={pledge.form.studentId}
              onChange={(event) => pledge.setForm((previous) => ({ ...previous, studentId: event.target.value }))}
              disabled={!pledge.form.classId || pledge.students.length === 0}
            >
              <option value="">{pledge.loading ? t("common.loading") : t("pledges.chooseStudent")}</option>
              {pledge.students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("pledges.date")}
            <input
              type="date"
              value={pledge.form.date}
              onChange={(event) => pledge.setForm((previous) => ({ ...previous, date: event.target.value }))}
            />
          </label>
          <label className="student-invitation-full">
            {t("pledges.titleField")}
            <input
              value={pledge.form.title}
              onChange={(event) => pledge.setForm((previous) => ({ ...previous, title: event.target.value }))}
            />
          </label>
          <label className="student-invitation-full">
            {t("pledges.text")}
            <textarea
              rows={6}
              value={pledge.form.pledgeText}
              onChange={(event) => pledge.setForm((previous) => ({ ...previous, pledgeText: event.target.value }))}
            />
          </label>
          <label className="student-invitation-full">
            {t("pledges.note")}
            <textarea
              rows={3}
              value={pledge.form.note}
              onChange={(event) => pledge.setForm((previous) => ({ ...previous, note: event.target.value }))}
            />
          </label>
          <label>
            {homeroomTeacherLabel}
            <input
              value={pledge.form.homeroomTeacherName}
              onChange={(event) =>
                pledge.setForm((previous) => ({ ...previous, homeroomTeacherName: event.target.value }))
              }
            />
          </label>
          <label>
            {principalNameLabel}
            <input
              value={pledge.form.principalName}
              onChange={(event) => pledge.setForm((previous) => ({ ...previous, principalName: event.target.value }))}
            />
          </label>
        </div>
        {pledge.message && (
          <div className="form-message" role="status" aria-live="polite">
            {pledge.message}
          </div>
        )}
      </Card>

      <Card title={t("pledges.previewTitle")}>
        <div id="invitation-print" className="invitation-preview pledge-preview">
          <div className="pledge-preview-header">
            <div className="pledge-preview-topline">
              <div className="pledge-preview-school">
                <span className="pledge-preview-admin">{t("app.name")}</span>
                <strong>{pledge.schoolName || t("app.name")}</strong>
                <span>{pledge.schoolAddress || t("school.address")}</span>
              </div>
              <div className="pledge-badge" aria-hidden="true">
                <ShieldCheck size={24} strokeWidth={2.3} />
              </div>
            </div>
            <div className="pledge-preview-title">{t("pledges.title")}</div>
            <div className="pledge-preview-subtitle">{t("pledges.letterhead")}</div>
          </div>

          <div className="pledge-preview-meta-grid">
            <div className="pledge-preview-panel">
              <strong>{t("pledges.student")}</strong>
              <div>
                <span>{t("pledges.studentName")}</span>
                <b>{studentLabel}</b>
              </div>
              <div>
                <span>{t("pledges.class")}</span>
                <b>{classLabel}</b>
              </div>
              <div>
                <span>{t("students.nationalId")}</span>
                <b>{nationalIdLabel}</b>
              </div>
            </div>
            <div className="pledge-preview-panel">
              <strong>{familyInfoLabel}</strong>
              <div>
                <span>{fatherNameLabel}</span>
                <b>{fatherNameValue}</b>
              </div>
              <div>
                <span>{motherNameLabel}</span>
                <b>{motherNameValue}</b>
              </div>
              {hasGuardianContact ? (
                <div>
                  <span>{guardianPhoneLabel}</span>
                  <b>{guardianPhoneValue}</b>
                </div>
              ) : null}
            </div>
            <div className="pledge-preview-panel">
              <strong>{pledgeInfoLabel}</strong>
              <div>
                <span>{homeroomTeacherLabel}</span>
                <b>{homeroomTeacherNameValue || noneLabel}</b>
              </div>
              <div>
                <span>{principalNameLabel}</span>
                <b>{principalNameValue || noneLabel}</b>
              </div>
            </div>
          </div>

          <div className="pledge-preview-body">
            {pledgeTextValue && (
              <div className="pledge-preview-section">
                <strong>{t("pledges.text")}</strong>
                <p>{pledgeTextValue}</p>
              </div>
            )}
            {pledgeNoteValue && (
              <div className="pledge-preview-section pledge-preview-section--soft">
                <strong>{t("pledges.note")}</strong>
                <p>{pledgeNoteValue}</p>
              </div>
            )}
          </div>

          <div className="invitation-signatures pledge-signatures">
            <div>
              <span>{teacherSignatureLabel}</span>
              <strong>{homeroomTeacherNameValue || noneLabel}</strong>
            </div>
            <div>
              <span>{principalSignatureLabel}</span>
              <strong>{principalNameValue || noneLabel}</strong>
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("pledges.savedTitle")}>
        {pledge.selectedClassId ? (
          <div className="pledge-saved-panel">
            <div className="invitation-list">
              {pledge.pledges.length === 0 ? (
                <div className="empty-state">{t("pledges.empty")}</div>
              ) : (
                pledge.pledges.map((row) => {
                  const payload = row.payload || {};
                  return (
                    <article key={row.id} className="invitation-item">
                      <header>
                        <strong>{row.studentName || payload.studentName || noneLabel}</strong>
                        <span>{payload.title || t("pledges.title")}</span>
                      </header>
                      <div className="invitation-item-grid">
                        <div>
                          <span>{t("pledges.date")}</span>
                          <strong>{payload.date || row.createdAt.slice(0, 10)}</strong>
                        </div>
                        <div>
                          <span>{t("pledges.titleField")}</span>
                          <strong>{payload.title || row.title}</strong>
                        </div>
                        <div>
                          <span>{t("pledges.text")}</span>
                          <strong>{payload.pledgeText || row.message}</strong>
                        </div>
                        <div>
                          <span>{t("pledges.status")}</span>
                          <strong>{row.status}</strong>
                        </div>
                      </div>
                      <div className="invitation-notification-body">
                        <strong>{t("pledges.notificationTitle")}</strong>
                        <p>{row.message}</p>
                        <div className="invitation-recipient-list">
                          <span>{t("pledges.notificationRecipients")}</span>
                          <strong>
                            {(row.recipientNames || row.recipientPhones || [])
                              .map((item) =>
                                "name" in item
                                  ? `${item.label}${item.name ? `: ${item.name}` : ""}`
                                  : `${item.label}${item.phone ? `: ${item.phone}` : ""}`
                              )
                              .join(" • ") || noneLabel}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">{chooseClassFirstLabel}</div>
        )}
      </Card>
    </div>
  );
}
