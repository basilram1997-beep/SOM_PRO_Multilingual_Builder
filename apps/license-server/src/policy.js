const crypto = require("crypto");
const { hash, hmac, base64Url, base64UrlDecode, CODE_ALPHABET, PASSWORD_ALPHABET } = require("./runtime");

function repairMojibakeText(value) {
  if (typeof value !== "string") return String(value || "");
  if (!/[ÃÂ][\x80-\xBF]/.test(value)) return value;
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function normalizeLicenseText(value) {
  return repairMojibakeText(String(value || ""))
    .trim()
    .replace(/\s+/g, " ");
}

function makeLicenseKey(payload) {
  const institutionCode =
    repairMojibakeText(payload.institutionCode || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "") || "000000";
  const payloadPart = institutionCode;
  return "SOM2-" + payloadPart + "-" + hmac(payloadPart).slice(0, 4).toUpperCase();
}

function parseLicenseKey(licenseKey) {
  const clean = String(licenseKey || "").trim();
  if (clean.startsWith("SOM2-")) {
    const parts = clean.split("-");
    if (parts.length !== 3) throw new Error("INVALID_LICENSE_FORMAT");
    const [, institutionCode, signature] = parts;
    if (!/^[A-Z0-9-]+$/i.test(institutionCode) || !/^[A-Z0-9]{4}$/i.test(signature)) {
      throw new Error("INVALID_LICENSE_FORMAT");
    }
    const payloadPart = institutionCode.toUpperCase();
    if (hmac(payloadPart).slice(0, 4).toUpperCase() !== String(signature || "").trim().toUpperCase()) {
      throw new Error("INVALID_LICENSE_SIGNATURE");
    }
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    return {
      plan: "TRIAL",
      institutionCode: institutionCode.toUpperCase(),
      expiresAt: expiresAt.toISOString(),
      maxDevices: 1,
      allowedFeatures: ["core"]
    };
  }
  if (!clean.startsWith("SOM-")) throw new Error("INVALID_LICENSE_FORMAT");
  const [payloadPart, signature] = clean.slice(4).split(".");
  if (!payloadPart || !signature) throw new Error("INVALID_LICENSE_FORMAT");
  if (hmac(payloadPart) !== signature) throw new Error("INVALID_LICENSE_SIGNATURE");
  return JSON.parse(base64UrlDecode(payloadPart));
}

function randomCodeGroup() {
  let value = "";
  for (let i = 0; i < 4; i += 1) {
    value += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return value;
}

function normalizeLicenseCode(value) {
  const compact = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  if (compact.startsWith("SOM") && compact.length > 3) {
    const rest = compact.slice(3);
    const groups = [];
    for (let i = 0; i < rest.length; i += 4) groups.push(rest.slice(i, i + 4));
    return ["SOM", ...groups].join("-");
  }
  return compact;
}

function generateLicenseCode() {
  return ["SOM", randomCodeGroup(), randomCodeGroup(), randomCodeGroup()].join("-");
}

function licenseCodeHash(code) {
  const clean = String(code || "").trim();
  return clean.includes(".") ? hash(clean) : hash(normalizeLicenseCode(clean));
}

function generateUniqueLicenseCode(db) {
  let code = generateLicenseCode();
  while (
    db.some(
      (item) =>
        item.licenseCodeHash === licenseCodeHash(code) ||
        normalizeLicenseCode(item.licenseCode) === normalizeLicenseCode(code)
    )
  ) {
    code = generateLicenseCode();
  }
  return code;
}

function randomAdminPassword() {
  let value = "";
  for (let i = 0; i < 12; i += 1) value += PASSWORD_ALPHABET[crypto.randomInt(0, PASSWORD_ALPHABET.length)];
  return value;
}

function uniqueAdminPassword(accounts, currentLicenseId) {
  let password = randomAdminPassword();
  while (accounts.some((item) => item.licenseId !== currentLicenseId && item.password === password)) {
    password = randomAdminPassword();
  }
  return password;
}

function makeDefaultAdminEmail(institutionCode) {
  const clean = String(institutionCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return clean ? "admin" + clean : "admin" + crypto.randomBytes(3).toString("hex");
}

function makeLegacyAdminEmail(institutionCode) {
  const clean = String(institutionCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return clean ? "admin-" + clean + "@sompro.local" : "";
}

function activeDevices(license) {
  const devices = Array.isArray(license?.devices) ? license.devices : [];
  return devices.filter((device) => !device.disabled && device.status !== "revoked");
}

function payloadFromLicense(license) {
  return {
    schoolName: normalizeLicenseText(license.schoolName || ""),
    institutionCode: normalizeLicenseText(license.institutionCode || ""),
    plan: String(license.plan || "PAID"),
    expiresAt: String(license.expiresAt || ""),
    maxDevices: Number(license.maxDevices || 1),
    allowedFeatures: Array.isArray(license.allowedFeatures) ? license.allowedFeatures : ["core"],
    adminAccount: license.adminAccount || null
  };
}

function licenseDetailsMatch(body, license, payload) {
  const schoolName = normalizeLicenseText(body.schoolName || body.name || "");
  const institutionCode = normalizeLicenseText(body.institutionCode || body.schoolCode || "");
  return (
    !schoolName ||
    normalizeLicenseText(payload.schoolName || license.schoolName || "") === schoolName ||
    normalizeLicenseText(license.schoolName || "") === schoolName ||
    normalizeLicenseText(payload.institutionCode || license.institutionCode || "") === institutionCode
  );
}

function deviceFingerprintFromBody(body) {
  return String(body.deviceId || body.deviceFingerprint || "").trim() || "unknown-device";
}

function deviceNameFromBody(body) {
  return String(body.deviceName || body.computerName || "").trim() || "SOM PRO Desktop";
}

function machineFingerprintFromInstall(body) {
  const source =
    [body.machineGuid, body.computerName, body.userName, body.installFingerprint].filter(Boolean).join("|") ||
    "unknown-installer";
  return hash(source);
}

function effectiveStatus(license) {
  if (license.status === "REVOKED") return "CANCELLED";
  if (["SUSPENDED", "READ_ONLY", "CANCELLED"].includes(license.status)) return license.status;
  if (new Date(license.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return license.status || "ACTIVE";
}

function licenseStatusPayload(license, message) {
  const status = effectiveStatus(license);
  return {
    data: publicLicense(license),
    status,
    expiresAt: license.expiresAt,
    schoolName: repairMojibakeText(license.schoolName || ""),
    plan: license.plan || "PAID",
    maxDevices: Number(license.maxDevices || 1),
    activeDevicesCount: activeDevices(license).length,
    readOnly: ["READ_ONLY", "SUSPENDED", "EXPIRED", "CANCELLED"].includes(status),
    message: message || license.readOnlyReason || null,
    serverTime: new Date().toISOString()
  };
}

function publicAdminAccount(license) {
  if (!license?.adminAccount) return null;
  const admin = license.adminAccount;
  return {
    name: admin.name || "مدير المدرسة",
    email: admin.email,
    role: admin.role || "ADMIN"
  };
}

function publicLicense(license) {
  const safe = { ...license };
  delete safe.licenseKey;
  delete safe.licenseKeyHash;
  delete safe.licenseCodeHash;
  delete safe.adminPasswordHash;
  safe.schoolId = safe.schoolId || safe.id;
  safe.allowedFeatures = Array.isArray(safe.allowedFeatures) ? safe.allowedFeatures : ["core"];
  safe.activeDevicesCount = activeDevices(safe).length;
  safe.serverTime = new Date().toISOString();
  return { ...safe, adminAccount: publicAdminAccount(license) };
}

module.exports = {
  activeDevices,
  base64Url,
  base64UrlDecode,
  deviceFingerprintFromBody,
  deviceNameFromBody,
  effectiveStatus,
  generateLicenseCode,
  generateUniqueLicenseCode,
  licenseCodeHash,
  licenseDetailsMatch,
  licenseStatusPayload,
  makeDefaultAdminEmail,
  makeLegacyAdminEmail,
  makeLicenseKey,
  machineFingerprintFromInstall,
  normalizeLicenseCode,
  normalizeLicenseText,
  parseLicenseKey,
  payloadFromLicense,
  publicAdminAccount,
  publicLicense,
  randomAdminPassword,
  repairMojibakeText,
  uniqueAdminPassword
};
