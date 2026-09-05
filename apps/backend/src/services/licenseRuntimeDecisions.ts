import { LicenseStatus } from "@prisma/client";
import { REQUIRE_CENTRAL_LICENSE, RUNTIME_MODE } from "./licenseRuntimeConfig";

export function shouldUseCentralLicenseServer(runtimeMode = RUNTIME_MODE, requireCentral = REQUIRE_CENTRAL_LICENSE) {
  return (
    requireCentral ||
    String(runtimeMode || "")
      .trim()
      .toLowerCase() === "saas"
  );
}

export function shouldFallbackToLocalLicense(
  central: { error?: string } | null | undefined,
  runtimeMode = RUNTIME_MODE
) {
  if (!central?.error) return false;
  if (central.error !== "LICENSE_NOT_FOUND") return false;
  if (REQUIRE_CENTRAL_LICENSE) return false;
  return (
    String(runtimeMode || "")
      .trim()
      .toLowerCase() !== "saas"
  );
}

export function getLocalFallbackLicenseStatus(status: LicenseStatus) {
  return status === "EXPIRED" || status === "CANCELLED" ? status : "ACTIVE";
}
