import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { localizeClassName, localizeList, localizeSchoolText, localizeSubjectName } from "../../i18n/displayNames";
import { useDashboard } from "../../features/dashboard/useDashboard";
import { sortSchoolClasses } from "@som/shared";

function statusLabel(type: string, t: (key: string) => string) {
  if (type === "ABSENT") return t("daily.absent");
  if (type === "LATE") return t("daily.late");
  if (type === "LEFT") return t("daily.left");
  return t("daily.mission");
}

function Metric({
  label,
  value,
  danger,
  warning,
  onClick
}: {
  label: string;
  value: number | string;
  danger?: boolean;
  warning?: boolean;
  onClick?: () => void;
}) {
  const className = `metric-card ${danger ? "danger-metric" : warning ? "warning-metric" : ""} ${onClick ? "clickable-metric metric-card-button" : ""}`;

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={`${label}: ${value}`}>
        <span>{label}</span>
        <strong>{value}</strong>
      </button>
    );
  }

  return (
    <div className={className}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function localizeDashboardDay(day: string, language: string) {
  if (language !== "ar") {
    return day;
  }

  const normalized = day.trim().toLowerCase();
  const dayNames: Record<string, string> = {
    saturday: "السبت",
    sunday: "الأحد",
    monday: "الاثنين",
    tuesday: "الثلاثاء",
    wednesday: "الأربعاء",
    thursday: "الخميس",
    friday: "الجمعة",
    السبت: "السبت",
    الأحد: "الأحد",
    الاثنين: "الاثنين",
    الثلاثاء: "الثلاثاء",
    الأربعاء: "الأربعاء",
    الخميس: "الخميس",
    الجمعة: "الجمعة"
  };

  return dayNames[normalized] || day;
}

export function DashboardPage() {
  const { t, language } = useI18n();
  const dashboard = useDashboard(language);
  const sortedClasses = sortSchoolClasses(dashboard.classes);
  const specificCount = dashboard.specificCount();
  const specificCounts = {
    week: specificCount,
    month: specificCount * 4,
    term: specificCount * 16,
    year: specificCount * 32
  };
  const school = dashboard.stats?.school || {};
  const details = dashboard.stats?.schoolDetails || {};
  const statusDetails = (dashboard.daily?.statuses || []).filter((status) => status.type === dashboard.detailType);

  return (
    <div className="page dashboard-page">
      <h2>{t("dashboard.title")}</h2>

      <div className="hero-panel">
        <div>
          <span className="eyebrow">SOM PRO</span>
          <h1>{school.name ? localizeSchoolText(school.name, language) : t("settings.schoolName")}</h1>
          <p>
            {t("school.principal")}:{" "}
            <strong>
              {school.managerName ? localizeSchoolText(school.managerName, language) : t("common.notSet")}
            </strong>{" "}
            · {t("school.code")}: <strong>{school.institutionCode || t("common.notSet")}</strong>
          </p>
          <p>
            {t("school.address")}:{" "}
            <strong>{school.address ? localizeSchoolText(school.address, language) : t("common.notSet")}</strong>
          </p>
          <p>
            {t("school.days")}:{" "}
            <strong>
              {localizeList(dashboard.stats?.workingDays || [], language, (value) =>
                localizeDashboardDay(value, language)
              ).join(language === "en" ? ", " : "، ")}
            </strong>{" "}
            · {t("school.periodsPerDay")}: <strong>{dashboard.stats?.periodsPerDay || 0}</strong>
          </p>
        </div>
        <div className="date-box">
          <strong>{localizeDashboardDay(dashboard.today.day, language)}</strong>
          <span>{dashboard.today.iso}</span>
        </div>
      </div>

      <Card title={t("dashboard.teacherDetails")}>
        <div className="stats-grid">
          <Metric label={t("dashboard.teachersCount")} value={dashboard.stats?.teachers ?? 0} />
          <Metric
            label={t("dashboard.absentCount")}
            value={dashboard.stats?.today?.absent ?? 0}
            danger
            onClick={() => dashboard.setDetailType("ABSENT")}
          />
          <Metric
            label={t("dashboard.lateCount")}
            value={dashboard.stats?.today?.late ?? 0}
            warning
            onClick={() => dashboard.setDetailType("LATE")}
          />
          <Metric
            label={t("dashboard.leftCount")}
            value={dashboard.stats?.today?.left ?? 0}
            warning
            onClick={() => dashboard.setDetailType("LEFT")}
          />
          <Metric label={t("dashboard.substitutionsCount")} value={dashboard.stats?.today?.substitutions ?? 0} />
          <Metric label={t("dashboard.affectedClasses")} value={dashboard.stats?.today?.affectedClasses ?? 0} />
        </div>
      </Card>

      <Card title={t("dashboard.teacherPermissionRequests")}>
        {dashboard.teacherRequests.length === 0 ? (
          <div className="empty-state">{t("dashboard.teacherPermissionRequestsEmpty")}</div>
        ) : (
          <div className="table-wrap dashboard-request-table">
            <table>
              <thead>
                <tr>
                  <th>{t("common.teacher")}</th>
                  <th>{t("dashboard.requestStatus")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.day")}</th>
                  <th>{t("common.from")}</th>
                  <th>{t("common.to")}</th>
                  <th>{t("dashboard.requestedBy")}</th>
                  <th>{t("common.details")}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.teacherRequests.map((request) => {
                  const payload = request.payload || {};
                  return (
                    <tr key={request.id}>
                      <td>{payload.teacherName || t("common.notSet")}</td>
                      <td>{payload.status ? statusLabel(payload.status, t) : t("dashboard.requestStatus")}</td>
                      <td>{payload.date || request.createdAt.slice(0, 10)}</td>
                      <td>{payload.day ? localizeDashboardDay(payload.day, language) : t("common.notSet")}</td>
                      <td>{String(payload.fromPeriod || 0)}</td>
                      <td>{String(payload.toPeriod || payload.fromPeriod || 0)}</td>
                      <td>{request.title || request.message}</td>
                      <td>
                        <div className="request-note-cell">
                          <p>{payload.reason || request.message}</p>
                          {payload.note ? <p className="muted">{payload.note}</p> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t("dashboard.schoolDetails")}>
        <div className="details-grid">
          <Metric label={t("dashboard.classesCount")} value={details.classes ?? 0} />
          <Metric label={t("dashboard.subjectsCount")} value={details.subjects ?? 0} />
          <Metric label={t("dashboard.weekLessons")} value={details.weeklyLessons ?? 0} />
          <Metric label={t("dashboard.monthLessons")} value={details.monthlyLessons ?? 0} />
          <Metric label={t("dashboard.termLessons")} value={details.termLessons ?? 0} />
          <Metric label={t("dashboard.yearLessons")} value={details.yearlyLessons ?? 0} />
          <Metric label={t("dashboard.homeroomCount")} value={details.homeroomTeachers ?? 0} />
        </div>
      </Card>

      <Card title={t("dashboard.specificSubject")}>
        <div className="form-row">
          <div className="subject-filter-field">
            <span>{t("common.class")}:</span>
            <select value={dashboard.selectedClassId} onChange={(e) => dashboard.setSelectedClassId(e.target.value)}>
              {sortedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {localizeClassName(cls.name, language)}
                </option>
              ))}
            </select>
          </div>
          <div className="subject-filter-field">
            <span>{t("common.subject")}:</span>
            <select
              value={dashboard.selectedSubjectId}
              onChange={(e) => dashboard.setSelectedSubjectId(e.target.value)}
            >
              {dashboard.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {localizeSubjectName(subject.name, language)}
                </option>
              ))}
            </select>
          </div>
          <div className="mini-period-counts">
            <Metric label={t("dashboard.week")} value={specificCounts.week} />
            <Metric label={t("dashboard.month")} value={specificCounts.month} />
            <Metric label={t("dashboard.term")} value={specificCounts.term} />
            <Metric label={t("dashboard.year")} value={specificCounts.year} />
          </div>
        </div>
      </Card>

      <div className="dashboard-footer-contact">
        <strong>{t("dashboard.phone")}</strong>
        <span>{t("dashboard.contactName")}</span>
      </div>

      {dashboard.detailType && (
        <div className="modal-backdrop" onClick={() => dashboard.setDetailType(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t("dashboard.statusDetails")}</h3>
            {statusDetails.length === 0 && <p className="muted">{t("dashboard.noDetails")}</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("common.teacher")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("common.from")}</th>
                    <th>{t("common.to")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDetails.map((status) => (
                    <tr key={status.id}>
                      <td>{status.teacher?.name}</td>
                      <td>{statusLabel(status.type, t)}</td>
                      <td>{status.fromPeriod}</td>
                      <td>{status.toPeriod || status.fromPeriod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions">
              <button className="danger" onClick={() => dashboard.setDetailType(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
