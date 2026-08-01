import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { somApi } from "../../api/somApi";
import type { AppLanguage } from "../daily/dailyTypes";
import type {
  SecurityIncidentCreateRequest,
  SecurityIncidentListResponse,
  SecurityIncidentRow,
  SecurityIncidentSeverity,
  SecurityIncidentStatus,
  SecurityReport
} from "./reportTypes";

const emptySecurity: SecurityReport = {
  days: 7,
  total: 0,
  blockedMultipart: 0,
  rateLimited: 0,
  text: "",
  events: [],
  chart: [],
  byPath: []
};

const emptyIncidentForm = {
  title: "",
  summary: "",
  severity: "MEDIUM" as SecurityIncidentSeverity,
  detectedAt: new Date().toISOString(),
  systemsAffected: "",
  dataAffected: "",
  attackVector: "",
  vulnerabilities: "",
  evidenceNotes: ""
};

function buildSecurityText(
  language: AppLanguage,
  days: number,
  total: number,
  blockedMultipart: number,
  rateLimited: number
) {
  if (language === "en") {
    return `Security report for the last ${days} days. Total events: ${total}. Multipart blocks: ${blockedMultipart}. Rate-limited attempts: ${rateLimited}.`;
  }
  if (language === "he") {
    return `דוח אבטחה ל-${days} הימים האחרונים. סך האירועים ${total}. חסימות multipart: ${blockedMultipart}. ניסיונות חריגה ממגבלה: ${rateLimited}.`;
  }
  return `تقرير أمني لآخر ${days} يومًا. عدد الأحداث ${total}. محاولات الحظر الصريحة ${blockedMultipart}. محاولات التجاوز المحدودة ${rateLimited}.`;
}

function splitList(value: string) {
  return value
    .split(/[\n,،؛]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIncidentRequest(form: typeof emptyIncidentForm): SecurityIncidentCreateRequest {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    severity: form.severity,
    detectedAt: form.detectedAt,
    systemsAffected: splitList(form.systemsAffected),
    dataAffected: splitList(form.dataAffected),
    attackVector: form.attackVector.trim() || null,
    vulnerabilities: splitList(form.vulnerabilities),
    evidenceNotes: form.evidenceNotes.trim() || null
  };
}

function incidentStatusLabel(language: AppLanguage, status: SecurityIncidentStatus) {
  const labels: Record<AppLanguage, Record<SecurityIncidentStatus, string>> = {
    ar: {
      SUSPECTED: "مشتبه به",
      UNDER_REVIEW: "قيد المراجعة",
      CONTAINED: "تم الاحتواء",
      RESOLVED: "تم الحل",
      CLOSED: "مغلق"
    },
    en: {
      SUSPECTED: "Suspected",
      UNDER_REVIEW: "Under review",
      CONTAINED: "Contained",
      RESOLVED: "Resolved",
      CLOSED: "Closed"
    },
    he: {
      SUSPECTED: "חשד",
      UNDER_REVIEW: "בבדיקה",
      CONTAINED: "נבלם",
      RESOLVED: "נפתר",
      CLOSED: "סגור"
    }
  };
  return labels[language][status] || status;
}

export type SecurityMonitoringState = {
  days: number;
  setDays: Dispatch<SetStateAction<number>>;
  security: SecurityReport;
  error: string;
  load: () => Promise<void>;
  incidents: SecurityIncidentRow[];
  incidentsTotal: number;
  incidentCounts: Record<string, number>;
  incidentError: string;
  incidentSubmitting: boolean;
  incidentForm: typeof emptyIncidentForm;
  setIncidentField: <K extends keyof typeof emptyIncidentForm>(key: K, value: (typeof emptyIncidentForm)[K]) => void;
  submitIncident: () => Promise<void>;
  resetIncidentForm: () => void;
  incidentStatusLabel: (status: SecurityIncidentStatus) => string;
};

export function useSecurityMonitoring(language: AppLanguage): SecurityMonitoringState {
  const [days, setDays] = useState(7);
  const [security, setSecurity] = useState<SecurityReport>(emptySecurity);
  const [error, setError] = useState("");
  const [incidents, setIncidents] = useState<SecurityIncidentRow[]>([]);
  const [incidentsTotal, setIncidentsTotal] = useState(0);
  const [incidentCounts, setIncidentCounts] = useState<Record<string, number>>({});
  const [incidentError, setIncidentError] = useState("");
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentForm, setIncidentForm] = useState(emptyIncidentForm);

  const loadSecurity = useCallback(async () => {
    const securityRes = await somApi.reports.security(days, language);
    const securityData = securityRes.data || emptySecurity;
    setSecurity({
      ...securityData,
      text: buildSecurityText(
        language,
        securityData.days,
        securityData.total,
        securityData.blockedMultipart,
        securityData.rateLimited
      )
    });
  }, [days, language]);

  const loadIncidents = useCallback(async () => {
    const incidentRes = await somApi.reports.securityIncidents({ limit: 20 });
    const incidentData = incidentRes.data || ({} as SecurityIncidentListResponse);
    setIncidents(incidentData.items || []);
    setIncidentsTotal(incidentData.total || 0);
    setIncidentCounts(incidentData.counts || {});
  }, []);

  const load = useCallback(async () => {
    setError("");
    setIncidentError("");

    try {
      await loadSecurity();
    } catch {
      setSecurity(emptySecurity);
      setError(
        language === "en"
          ? "Security monitoring is restricted to administrators."
          : language === "he"
            ? "מעקב האבטחה שמור למנהלים בלבד."
            : "المراقبة الأمنية مخصصة للإدارة فقط."
      );
    }

    try {
      await loadIncidents();
    } catch {
      setIncidents([]);
      setIncidentsTotal(0);
      setIncidentCounts({});
      setIncidentError(
        language === "en"
          ? "Security incident list could not be loaded."
          : language === "he"
            ? "לא ניתן לטעון את רשימת אירועי האבטחה."
            : "تعذر تحميل قائمة الحوادث الأمنية."
      );
    }
  }, [language, loadIncidents, loadSecurity]);

  const setIncidentField = useCallback(
    <K extends keyof typeof emptyIncidentForm>(key: K, value: (typeof emptyIncidentForm)[K]) => {
      setIncidentForm((previous) => ({ ...previous, [key]: value }));
    },
    []
  );

  const resetIncidentForm = useCallback(() => setIncidentForm(emptyIncidentForm), []);

  const submitIncident = useCallback(async () => {
    setIncidentSubmitting(true);
    setIncidentError("");
    try {
      await somApi.reports.createSecurityIncident(toIncidentRequest(incidentForm));
      resetIncidentForm();
      await load();
    } catch {
      setIncidentError(
        language === "en"
          ? "Unable to record the incident right now."
          : language === "he"
            ? "לא ניתן לשמור את האירוע כעת."
            : "تعذر تسجيل الحادث الآن."
      );
    } finally {
      setIncidentSubmitting(false);
    }
  }, [incidentForm, language, load, resetIncidentForm]);

  const incidentLabel = useMemo(
    () => (status: SecurityIncidentStatus) => incidentStatusLabel(language, status),
    [language]
  );

  return {
    days,
    setDays,
    security,
    error,
    load,
    incidents,
    incidentsTotal,
    incidentCounts,
    incidentError,
    incidentSubmitting,
    incidentForm,
    setIncidentField,
    submitIncident,
    resetIncidentForm,
    incidentStatusLabel: incidentLabel
  };
}
