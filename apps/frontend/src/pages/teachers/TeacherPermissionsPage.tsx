import { Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { somApi } from "../../api/somApi";
import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { AuthUser } from "../auth/LoginPage";
import type { TeacherPermissionForm, TeacherPermissionRow } from "../../features/students/studentTypes";
import { emptyTeacherPermissionForm } from "../../features/students/studentTypes";

function toDayName(date: string, language: string) {
  if (!date) return "";
  const locale = language === "he" ? "he-IL" : language === "en" ? "en-US" : "ar";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(locale, { weekday: "long" });
}

function statusLabel(status: TeacherPermissionForm["status"], t: (key: string) => string) {
  if (status === "LATE") return t("daily.late");
  if (status === "LEFT") return t("daily.left");
  if (status === "UNAVAILABLE") return t("daily.mission");
  return t("daily.absent");
}

export function TeacherPermissionsPage({ currentUser }: { currentUser: AuthUser }) {
  const { t, language } = useI18n();
  const [form, setForm] = useState<TeacherPermissionForm>(emptyTeacherPermissionForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<TeacherPermissionRow[]>([]);

  const teacherName =
    currentUser.name || (language === "ar" ? "غير محدد" : language === "he" ? "לא מוגדר" : t("common.notSet"));

  const teacherDay = useMemo(() => toDayName(form.date, language), [form.date, language]);

  async function loadRequests() {
    setLoading(true);
    try {
      const response = await somApi.teachers.permissions.list(20);
      setRequests(response.data || []);
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("teacherPermissions.loadFailed")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    setForm((previous) => ({
      ...previous,
      day: toDayName(previous.date, language)
    }));
  }, [form.date, language]);

  async function savePermission() {
    if (!form.date || !form.day || !form.reason.trim()) {
      setMessage(t("teacherPermissions.required"));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await somApi.teachers.permissions.save({
        ...form,
        day: form.day || teacherDay,
        reason: form.reason.trim(),
        note: form.note.trim()
      });
      if (response.data) {
        await loadRequests();
      }
      setMessage(t("teacherPermissions.saved"));
      setForm({
        ...emptyTeacherPermissionForm,
        date: form.date,
        day: teacherDay || form.day
      });
    } catch (error) {
      setMessage(userFacingErrorMessage(error, t("teacherPermissions.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page teacher-permissions-page">
      <div className="page-title-row">
        <h2>{t("teacherPermissions.title")}</h2>
        <div className="button-group">
          <button type="button" className="primary" onClick={savePermission} disabled={saving}>
            <Send size={16} />
            <span>{saving ? t("teacherPermissions.saving") : t("teacherPermissions.save")}</span>
          </button>
        </div>
      </div>

      <Card title={t("teacherPermissions.formTitle")}>
        <div className="teacher-permission-meta">
          <div>
            <span>{t("teacherPermissions.teacherName")}:</span>
            <strong>{teacherName}</strong>
          </div>
          <div>
            <span>{t("teacherPermissions.currentRole")}:</span>
            <strong>{currentUser.role}</strong>
          </div>
        </div>
        <div className="student-invitation-form">
          <label>
            {t("common.date")}
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  date: event.target.value,
                  day: toDayName(event.target.value, language)
                }))
              }
            />
          </label>
          <label>
            {t("common.day")}
            <input
              value={form.day || teacherDay}
              onChange={(event) => setForm((previous) => ({ ...previous, day: event.target.value }))}
            />
          </label>
          <label>
            {t("teacherPermissions.status")}
            <select
              value={form.status}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, status: event.target.value as TeacherPermissionForm["status"] }))
              }
            >
              <option value="ABSENT">{t("daily.absent")}</option>
              <option value="LATE">{t("daily.late")}</option>
              <option value="LEFT">{t("daily.left")}</option>
              <option value="UNAVAILABLE">{t("daily.mission")}</option>
            </select>
          </label>
          <label>
            {t("teacherPermissions.fromPeriod")}
            <input
              type="number"
              min={1}
              max={12}
              value={form.fromPeriod}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, fromPeriod: Number(event.target.value) || 1 }))
              }
            />
          </label>
          <label>
            {t("teacherPermissions.toPeriod")}
            <input
              type="number"
              min={1}
              max={12}
              value={form.toPeriod}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, toPeriod: Number(event.target.value) || previous.fromPeriod }))
              }
            />
          </label>
          <label className="student-invitation-full">
            {t("teacherPermissions.reason")}
            <input
              value={form.reason}
              onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
            />
          </label>
          <label className="student-invitation-full">
            {t("teacherPermissions.note")}
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
            />
          </label>
        </div>
        {message ? (
          <div className="form-message" role="status" aria-live="polite">
            {message}
          </div>
        ) : null}
      </Card>

      <Card title={t("teacherPermissions.listTitle")}>
        {loading ? (
          <div className="empty-state">{t("common.loading")}</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">{t("teacherPermissions.empty")}</div>
        ) : (
          <div className="invitation-letter-list">
            {requests.map((row) => {
              const payload = row.payload || {};
              return (
                <article key={row.id} className="invitation-letter-item">
                  <header>
                    <strong>{payload.teacherName || teacherName}</strong>
                    <span>{statusLabel((payload.status || "ABSENT") as TeacherPermissionForm["status"], t)}</span>
                  </header>
                  <div className="invitation-letter-item-grid">
                    <div>
                      <span>{t("common.date")}</span>
                      <strong>{payload.date || row.createdAt.slice(0, 10)}</strong>
                    </div>
                    <div>
                      <span>{t("common.day")}</span>
                      <strong>{payload.day || t("common.none")}</strong>
                    </div>
                    <div>
                      <span>{t("teacherPermissions.fromPeriod")}</span>
                      <strong>{String(payload.fromPeriod || 0)}</strong>
                    </div>
                    <div>
                      <span>{t("teacherPermissions.toPeriod")}</span>
                      <strong>{String(payload.toPeriod || payload.fromPeriod || 0)}</strong>
                    </div>
                  </div>
                  <p className="muted">{payload.reason || row.message}</p>
                  {payload.note ? <p className="muted">{payload.note}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
