export function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ar", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function parseLicensePayload(licenseCode?: string) {
  try {
    const clean = String(licenseCode || "").trim();
    if (clean.startsWith("SOM2-")) {
      const parts = clean.split("-");
      if (parts.length !== 3) return null;
      const [, institutionCode, signature] = parts;
      if (!/^[A-Z0-9-]+$/i.test(institutionCode) || !/^[A-Z0-9]{4}$/i.test(signature)) {
        return null;
      }
      return {
        plan: "TRIAL",
        institutionCode: institutionCode.toUpperCase(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        maxDevices: 1,
        allowedFeatures: ["browser-e2e"]
      };
    }
    if (!clean.startsWith("SOM-") || !clean.includes(".")) return null;
    const payloadPart = clean.slice(4).split(".")[0];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
