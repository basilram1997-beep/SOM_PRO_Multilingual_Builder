import { useEffect, type ReactNode } from "react";
import { Activity, Archive, BadgeCheck, Database, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { useOperatorHealth } from "../../features/operatorHealth/useOperatorHealth";

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`operator-health-badge ${ok ? "ok" : "fail"}`}>{label}</span>;
}

function HealthTile({
  icon,
  title,
  value,
  detail,
  ok
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <section className="operator-health-tile">
      <div className="operator-health-tile-icon">{icon}</div>
      <div>
        <div className="operator-health-tile-head">
          <h3>{title}</h3>
          <StatusBadge ok={ok} label={ok ? "OK" : "FAIL"} />
        </div>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </section>
  );
}

export function OperatorHealthPage() {
  const { language } = useI18n();
  const health = useOperatorHealth();
  const data = health.data;
  const isArabic = language === "ar";

  useEffect(() => {
    void health.load();
  }, [health.load]);

  return (
    <div className="page operator-health-page">
      <div className="page-header">
        <div>
          <h2>{isArabic ? "صحة التشغيل" : "Operator Health"}</h2>
          <p className="muted">
            {isArabic
              ? "تقرير تشخيصي مخصص للدعم الفني والمطور، وليس جزءاً من استخدام المدرسة اليومي."
              : "A diagnostic report for support and development, not normal school daily use."}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void health.load()} disabled={health.loading}>
          <RefreshCw size={16} />
          <span>
            {health.loading ? (isArabic ? "جارٍ الفحص..." : "Checking...") : isArabic ? "إعادة الفحص" : "Refresh"}
          </span>
        </button>
      </div>

      {health.error ? <p className="login-error">{health.error}</p> : null}
      {!data && !health.error ? (
        <p className="muted">{isArabic ? "جارٍ تحميل التقرير..." : "Loading report..."}</p>
      ) : null}

      {data ? (
        <>
          <div className="operator-health-grid">
            <HealthTile
              icon={<Database size={22} />}
              title={isArabic ? "قاعدة البيانات" : "Database"}
              value={data.database.ok ? (isArabic ? "متصلة" : "Reachable") : isArabic ? "غير متصلة" : "Unreachable"}
              detail={`${data.database.latencyMs} ms`}
              ok={data.database.ok}
            />
            <HealthTile
              icon={<ShieldCheck size={22} />}
              title={isArabic ? "الترخيص" : "License"}
              value={data.license.status || "-"}
              detail={data.license.expiresAt ? formatDate(data.license.expiresAt) : data.license.plan || "-"}
              ok={!data.license.readOnly}
            />
            <HealthTile
              icon={<Archive size={22} />}
              title={isArabic ? "آخر backup" : "Last backup"}
              value={data.backup?.status || (isArabic ? "لا يوجد" : "None")}
              detail={data.backup ? formatDate(data.backup.finishedAt || data.backup.startedAt) : "-"}
              ok={Boolean(data.backup && data.backup.status !== "FAILED")}
            />
            <HealthTile
              icon={<BadgeCheck size={22} />}
              title={isArabic ? "إصدار البرنامج" : "Version"}
              value={data.version.version}
              detail={`${data.version.releaseChannel} / ${data.version.runtimeMode}`}
              ok
            />
            <HealthTile
              icon={<HardDrive size={22} />}
              title={isArabic ? "مساحة التخزين" : "Storage"}
              value={
                data.storage.usedPercent === null
                  ? "-"
                  : isArabic
                    ? `مستخدم ${data.storage.usedPercent}%`
                    : `${data.storage.usedPercent}% used`
              }
              detail={`${formatBytes(data.storage.availableBytes)} ${isArabic ? "متاح" : "available"}`}
              ok={data.storage.ok}
            />
            <HealthTile
              icon={<Activity size={22} />}
              title={isArabic ? "آخر فحص" : "Last check"}
              value={formatDate(data.lastCheck.at)}
              detail={data.lastCheck.source}
              ok
            />
          </div>

          <Card title={isArabic ? "تفاصيل تقنية" : "Technical Details"}>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th>{isArabic ? "مسار التخزين" : "Storage path"}</th>
                    <td>{data.storage.path}</td>
                  </tr>
                  <tr>
                    <th>{isArabic ? "المساحة الكلية" : "Total storage"}</th>
                    <td>{formatBytes(data.storage.totalBytes)}</td>
                  </tr>
                  <tr>
                    <th>Node.js</th>
                    <td>{data.version.nodeVersion}</td>
                  </tr>
                  <tr>
                    <th>{isArabic ? "بيئة API" : "API environment"}</th>
                    <td>{data.version.apiEnvironment}</td>
                  </tr>
                  <tr>
                    <th>{isArabic ? "وضع القراءة فقط" : "Read-only mode"}</th>
                    <td>{data.license.readOnly ? data.license.readOnlyReason || "true" : "false"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
