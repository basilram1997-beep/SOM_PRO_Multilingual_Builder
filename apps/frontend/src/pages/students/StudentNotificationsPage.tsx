import { BellRing, ChevronDown, ChevronUp, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { useStudentNotifications } from "../../features/students/useStudentNotifications";
import { useI18n } from "../../i18n/i18n";

type RecipientName = { label: string; name: string | null };
type RecipientPhone = { label: string; phone: string };

const EVENT_TYPE_KEYS: Record<string, string> = {
  ATTENDANCE: "notifications.type.attendance",
  INVITATION: "notifications.type.invitation",
  PLEDGE: "notifications.type.pledge",
  SCHOOL_MESSAGE: "notifications.type.schoolMessage"
};

function formatNotificationRecipients(
  t: (key: string) => string,
  recipientNames?: RecipientName[] | null,
  recipientPhones?: RecipientPhone[] | null
) {
  const names = (recipientNames || [])
    .map((recipient) => `${recipient.label}${recipient.name ? `: ${recipient.name}` : ""}`)
    .filter(Boolean);
  if (names.length > 0) return names.join(" • ");

  const phones = (recipientPhones || [])
    .map((recipient) => `${recipient.label}${recipient.phone ? `: ${recipient.phone}` : ""}`)
    .filter(Boolean);
  if (phones.length > 0) return phones.join(" • ");

  return t("common.none");
}

function formatPayloadValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value))
    return value
      .map((item) => String(item))
      .filter(Boolean)
      .join(" • ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SchoolNotificationsPage() {
  const { t } = useI18n();
  const notifications = useStudentNotifications();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [printNotificationId, setPrintNotificationId] = useState<string | null>(null);

  const selectedPrintNotification = useMemo(
    () => notifications.notifications.find((item) => item.id === printNotificationId) || null,
    [notifications.notifications, printNotificationId]
  );

  useEffect(() => {
    if (!printNotificationId) return;
    const timer = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(timer);
  }, [printNotificationId]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintNotificationId(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  function toggleNotification(id: string) {
    setExpandedIds((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="page school-notifications-page">
      <div className="page-title-row">
        <div>
          <h2>{t("notifications.title")}</h2>
          <p className="page-subtitle">{t("notifications.subtitle")}</p>
        </div>
        <div className="button-group">
          <button type="button" className="secondary" onClick={notifications.refresh} disabled={notifications.loading}>
            <RefreshCw size={16} />
            <span>{notifications.loading ? t("common.loading") : t("common.refresh")}</span>
          </button>
        </div>
      </div>

      <Card title={t("notifications.summaryTitle")}>
        <div className="school-notifications-summary">
          <div>
            <span>{t("notifications.total")}</span>
            <strong>{notifications.counts.total}</strong>
          </div>
          <div>
            <span>{t("notifications.sent")}</span>
            <strong>{notifications.counts.sent}</strong>
          </div>
          <div>
            <span>{t("notifications.failed")}</span>
            <strong>{notifications.counts.failed}</strong>
          </div>
          <div>
            <span>{t("notifications.queued")}</span>
            <strong>{notifications.counts.queued}</strong>
          </div>
        </div>
      </Card>

      <Card title={t("notifications.filtersTitle")}>
        <div className="school-notifications-toolbar">
          <label>
            <span>{t("notifications.filterClass")}</span>
            <select
              value={notifications.selectedClassId}
              onChange={(event) => notifications.setSelectedClassId(event.target.value)}
            >
              <option value="">{t("notifications.allClasses")}</option>
              {notifications.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {notifications.localizeClassName(item.name, notifications.language)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t("notifications.filterType")}</span>
            <select
              value={notifications.selectedType}
              onChange={(event) =>
                notifications.setSelectedType(
                  event.target.value as "" | "ATTENDANCE" | "INVITATION" | "PLEDGE" | "SCHOOL_MESSAGE"
                )
              }
            >
              <option value="">{t("common.all")}</option>
              <option value="ATTENDANCE">{t("notifications.type.attendance")}</option>
              <option value="INVITATION">{t("notifications.type.invitation")}</option>
              <option value="PLEDGE">{t("notifications.type.pledge")}</option>
              <option value="SCHOOL_MESSAGE">{t("notifications.type.schoolMessage")}</option>
            </select>
          </label>
        </div>

        {notifications.message && (
          <div className="form-message" role="status" aria-live="polite">
            {notifications.message}
          </div>
        )}
      </Card>

      <Card title={t("notifications.listTitle")}>
        {notifications.loading ? (
          <div className="empty-state">{t("common.loading")}</div>
        ) : notifications.notifications.length === 0 ? (
          <div className="empty-state">
            <BellRing size={18} />
            <span>{t("notifications.empty")}</span>
          </div>
        ) : (
          <div className="school-notifications-list">
            {notifications.notifications.map((item) => {
              const payload = item.payload || {};
              const eventKey = EVENT_TYPE_KEYS[item.eventType] || "notifications.type.other";
              const expanded = Boolean(expandedIds[item.id]);
              const payloadEntries = Object.entries(payload)
                .map(([key, value]) => ({ key, value: formatPayloadValue(value) }))
                .filter((entry) => entry.value && !["className", "studentName"].includes(entry.key));

              return (
                <article
                  key={item.id}
                  className={`school-notification-item type-${item.eventType.toLowerCase().replace(/_/g, "-")} status-${item.status.toLowerCase()}`}
                >
                  <header className="school-notification-header">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{t(eventKey)}</span>
                    </div>
                    <div className="school-notification-actions">
                      <small>{item.createdAt.slice(0, 10)}</small>
                      <button
                        type="button"
                        className="secondary school-notification-toggle"
                        onClick={() => toggleNotification(item.id)}
                      >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span>{expanded ? t("common.hide") : t("common.details")}</span>
                      </button>
                    </div>
                  </header>

                  <div className="school-notification-meta">
                    <div>
                      <span>{t("notifications.student")}</span>
                      <strong>{item.studentName || (payload.studentName as string) || t("common.none")}</strong>
                    </div>
                    <div>
                      <span>{t("notifications.class")}</span>
                      <strong>{(payload.className as string) || t("common.none")}</strong>
                    </div>
                    <div>
                      <span>{t("notifications.status")}</span>
                      <strong>{item.status}</strong>
                    </div>
                  </div>

                  <p className="school-notification-message">{item.message}</p>

                  {expanded && (
                    <div className="school-notification-details">
                      <div>
                        <span>{t("notifications.recipients")}</span>
                        <strong>{formatNotificationRecipients(t, item.recipientNames, item.recipientPhones)}</strong>
                      </div>
                      <div>
                        <span>{t("notifications.type.other")}</span>
                        <strong>{item.eventType}</strong>
                      </div>
                      <div>
                        <span>{t("notifications.date")}</span>
                        <strong>{item.createdAt}</strong>
                      </div>
                      {payloadEntries.length > 0 && (
                        <div className="school-notification-payload">
                          <span>{t("notifications.payload")}</span>
                          <div>
                            {payloadEntries.map((entry) => (
                              <div key={entry.key}>
                                <strong>{entry.key}</strong>
                                <span>{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.errorMessage && (
                        <div>
                          <span>{t("common.error")}</span>
                          <strong>{item.errorMessage}</strong>
                        </div>
                      )}
                      <div className="school-notification-footer">
                        <button type="button" className="secondary" onClick={() => setPrintNotificationId(item.id)}>
                          <Printer size={16} />
                          <span>{t("notifications.print")}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {selectedPrintNotification && (
        <div className="school-notification-print" aria-hidden="true">
          <article>
            <header>
              <div>
                <h1>{t("notifications.title")}</h1>
                <span>{selectedPrintNotification.title}</span>
              </div>
              <small>{selectedPrintNotification.createdAt.slice(0, 10)}</small>
            </header>
            <section>
              <div>
                <span>{t("notifications.student")}</span>
                <strong>{selectedPrintNotification.studentName || t("common.none")}</strong>
              </div>
              <div>
                <span>{t("notifications.class")}</span>
                <strong>
                  {(selectedPrintNotification.payload?.className as string | undefined) || t("common.none")}
                </strong>
              </div>
              <div>
                <span>{t("notifications.status")}</span>
                <strong>{selectedPrintNotification.status}</strong>
              </div>
            </section>
            <p>{selectedPrintNotification.message}</p>
            <footer>
              <span>{t("notifications.recipients")}</span>
              <strong>
                {formatNotificationRecipients(
                  t,
                  selectedPrintNotification.recipientNames,
                  selectedPrintNotification.recipientPhones
                )}
              </strong>
            </footer>
          </article>
        </div>
      )}
    </div>
  );
}
