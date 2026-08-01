import { useCallback, useState } from "react";
import { somApi } from "../../api/somApi";
import type { AppLanguage } from "../daily/dailyTypes";
import type { SchoolOperationsResponse } from "./reportTypes";

const emptyOperations: SchoolOperationsResponse = {
  schoolId: "",
  generatedAt: "",
  school: { id: "", name: null, institutionCode: null },
  auditLogExport: {
    path: "/api/audit-logs/export",
    format: "jsonl",
    privacyWarning: true,
    expiresImmediately: false
  },
  reportExports: [],
  backupJobs: []
};

function exportFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || "audit-log.jsonl";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type SchoolOperationsState = {
  operations: SchoolOperationsResponse;
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  exporting: boolean;
  exportAuditLog: () => Promise<void>;
};

export function useSchoolOperations(language: AppLanguage): SchoolOperationsState {
  const [operations, setOperations] = useState<SchoolOperationsResponse>(emptyOperations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await somApi.schools.operations();
      setOperations(response.data || emptyOperations);
    } catch {
      setOperations(emptyOperations);
      setError(
        language === "en"
          ? "Operations dashboard could not be loaded."
          : language === "he"
            ? "לא ניתן לטעון את לוח הפעולות."
            : "تعذر تحميل لوحة العمليات."
      );
    } finally {
      setLoading(false);
    }
  }, [language]);

  const exportAuditLog = useCallback(async () => {
    setExporting(true);
    setError("");
    try {
      const result = await somApi.auditLogs.export();
      exportFile(result.blob, result.fileName || "audit-log.jsonl");
    } catch {
      setError(
        language === "en"
          ? "Could not export the audit log."
          : language === "he"
            ? "לא ניתן לייצא את יומן הבקרה."
            : "تعذر تصدير سجل التدقيق."
      );
    } finally {
      setExporting(false);
    }
  }, [language]);

  return {
    operations,
    loading,
    error,
    load,
    exporting,
    exportAuditLog
  };
}
