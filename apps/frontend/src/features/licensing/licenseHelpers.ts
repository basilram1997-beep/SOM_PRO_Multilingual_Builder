export function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ar", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function parseLicensePayload(licenseCode?: string) {
  try {
    const clean = String(licenseCode || "").trim();
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
