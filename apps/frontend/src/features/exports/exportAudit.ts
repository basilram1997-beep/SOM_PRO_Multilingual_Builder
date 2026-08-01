import { somApi } from "../../api/somApi";

export type ExportPermission =
  "read" | "manageTeachers" | "manageSchedules" | "manageSettings" | "manageLicense" | "manageLessons";
export type ExportKind = "PDF" | "HTML" | "XLSX";

export type ExportNotice = {
  generatedAt: string;
  expiresAt: string;
  privacyWarning: string;
};

export type ExportAuditRequest = {
  page: string;
  title: string;
  fileName: string;
  kind: ExportKind;
  permission: ExportPermission;
  expiresInMinutes?: number;
};

export type ExportAuditResponse = {
  ok: boolean;
  expiresAt: string;
};

export async function recordExportAction(request: ExportAuditRequest) {
  const response = await somApi.reports.recordExport({
    ...request,
    expiresInMinutes: request.expiresInMinutes || 15,
    privacyWarningAccepted: true
  });

  return response.data as ExportAuditResponse;
}

export function buildExportNotice(privacyWarning: string, expiresAt: string): ExportNotice {
  return {
    generatedAt: new Date().toISOString(),
    expiresAt,
    privacyWarning
  };
}

export async function confirmAndRecordExport(request: ExportAuditRequest, privacyWarning: string) {
  if (!window.confirm(privacyWarning)) return null;
  try {
    const result = await recordExportAction(request);
    return buildExportNotice(privacyWarning, result.expiresAt);
  } catch {
    const expiresAt = new Date(Date.now() + (request.expiresInMinutes || 15) * 60_000).toISOString();
    return buildExportNotice(privacyWarning, expiresAt);
  }
}
