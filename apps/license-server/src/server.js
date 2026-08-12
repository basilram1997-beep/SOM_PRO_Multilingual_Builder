// Phase 4 note: license-server still keeps its endpoints in one file to avoid changing licensing behavior.
// A deeper route/service split is documented for the next commercial hardening phase.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
loadEnvFile(path.join(ROOT_DIR, ".env"));
loadEnvFile(path.join(__dirname, "..", ".env"));

const PORT = Number(process.env.LICENSE_PORT || 4100);
const DEFAULT_LICENSE_SECRET = "change-this-secret-before-selling";
const LICENSE_SECRET = process.env.SOM_PRO_LICENSE_SECRET || DEFAULT_LICENSE_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
const CORS_ORIGIN = process.env.LICENSE_CORS_ORIGIN || process.env.PUBLIC_BASE_URL || (IS_PRODUCTION ? "" : "*");
const DATA_FILE = process.env.LICENSE_DATA_FILE || path.join(__dirname, "..", "data", "licenses.json");
const ACCOUNTS_FILE =
  process.env.LICENSE_ACCOUNTS_FILE || path.join(__dirname, "..", "data", "license-admin-accounts.json");
const SECURITY_EVENTS_FILE =
  process.env.LICENSE_SECURITY_EVENTS_FILE || path.join(__dirname, "..", "data", "license-security-events.jsonl");
const RESET_TOKENS_FILE =
  process.env.LICENSE_RESET_TOKENS_FILE || path.join(__dirname, "..", "data", "license-reset-tokens.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const TOKEN_FILE = path.join(__dirname, "..", "data", "owner-token.txt");
const ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || (IS_PRODUCTION ? "" : readLocalAdminToken());
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";

if (IS_PRODUCTION && LICENSE_SECRET === DEFAULT_LICENSE_SECRET) {
  console.error("SOM_PRO_LICENSE_SECRET must be changed before selling or production use.");
  process.exit(1);
}

if (IS_PRODUCTION && !process.env.LICENSE_ADMIN_TOKEN) {
  console.error("LICENSE_ADMIN_TOKEN is required in production. Do not use a generated local owner token.");
  process.exit(1);
}

if (IS_PRODUCTION && String(ADMIN_TOKEN || "").length < 32) {
  console.error("LICENSE_ADMIN_TOKEN must be at least 32 characters in production.");
  process.exit(1);
}

const requestBuckets = new Map();
const RATE_LIMITS = {
  admin: { limit: Number(process.env.LICENSE_ADMIN_RATE_LIMIT || 120), windowMs: 60_000 },
  client: { limit: Number(process.env.LICENSE_CLIENT_RATE_LIMIT || 180), windowMs: 60_000 },
  general: { limit: Number(process.env.LICENSE_GENERAL_RATE_LIMIT || 300), windowMs: 60_000 }
};
const MAX_BODY_BYTES = Number(process.env.LICENSE_MAX_BODY_BYTES || 32_768);
const RESET_TOKEN_TTL_MS = Number(process.env.LICENSE_RESET_TOKEN_TTL_MS || 15 * 60_000);
const REQUEST_NONCE_TTL_MS = Number(process.env.LICENSE_REQUEST_NONCE_TTL_MS || 5 * 60_000);
const requestNonces = new Map();

function readLocalAdminToken() {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  if (!fs.existsSync(TOKEN_FILE)) {
    const token = "SOM-OWNER-" + crypto.randomBytes(18).toString("hex").toUpperCase();
    fs.writeFileSync(TOKEN_FILE, token, "utf8");
    return token;
  }
  return fs.readFileSync(TOKEN_FILE, "utf8").trim();
}

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function hmac(value) {
  return crypto.createHmac("sha256", LICENSE_SECRET).update(value).digest("hex");
}

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function makeLicenseKey(payload) {
  const payloadPart = base64Url(JSON.stringify(payload));
  return "SOM-" + payloadPart + "." + hmac(payloadPart);
}

function parseLicenseKey(licenseKey) {
  const clean = String(licenseKey || "").trim();
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
  return hash(normalizeLicenseCode(code));
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

function readAccounts() {
  try {
    const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
  if (fs.existsSync(ACCOUNTS_FILE)) fs.copyFileSync(ACCOUNTS_FILE, ACCOUNTS_FILE + ".bak");
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2) + "\n", "utf8");
}

function recordSecurityEvent(event) {
  try {
    fs.mkdirSync(path.dirname(SECURITY_EVENTS_FILE), { recursive: true });
    const safeEvent = {
      at: new Date().toISOString(),
      type: event.type || "UNKNOWN",
      result: event.result || "UNKNOWN",
      actor: event.actor || null,
      licenseId: event.licenseId || null,
      ip: event.ip || null,
      details: event.details || {}
    };
    fs.appendFileSync(SECURITY_EVENTS_FILE, JSON.stringify(safeEvent) + "\n", "utf8");
  } catch {
    // Audit best effort must not expose secrets or break license checks.
  }
}

function readResetTokens() {
  try {
    const data = JSON.parse(fs.readFileSync(RESET_TOKENS_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeResetTokens(tokens) {
  fs.mkdirSync(path.dirname(RESET_TOKENS_FILE), { recursive: true });
  fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify(tokens, null, 2) + "\n", "utf8");
}

function createResetToken(license, account, ip) {
  const token = "SOM-RESET-" + crypto.randomBytes(24).toString("hex").toUpperCase();
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  const tokens = readResetTokens().filter((item) => new Date(item.expiresAt || 0).getTime() > Date.now() && !item.usedAt);
  tokens.push({
    tokenHash,
    licenseId: license.id,
    email: account.email,
    createdAt: new Date().toISOString(),
    expiresAt,
    usedAt: null
  });
  writeResetTokens(tokens);
  recordSecurityEvent({
    type: "ADMIN_RESET_TOKEN_ISSUED",
    result: "SUCCESS",
    actor: account.email,
    licenseId: license.id,
    ip
  });
  return { token, tokenHash, expiresAt };
}

function consumeResetToken(token, newPassword, ip) {
  const tokenHash = hash(token);
  const tokens = readResetTokens();
  const reset = tokens.find((item) => item.tokenHash === tokenHash);
  if (!reset || reset.usedAt || new Date(reset.expiresAt || 0).getTime() <= Date.now()) {
    recordSecurityEvent({ type: "ADMIN_RESET_TOKEN_CONSUME", result: "DENIED", ip });
    return null;
  }
  const accounts = readAccounts();
  const index = accounts.findIndex((item) => item.licenseId === reset.licenseId && item.email === reset.email);
  if (index === -1) return null;
  accounts[index] = { ...accounts[index], password: String(newPassword || "").trim(), updatedAt: new Date().toISOString() };
  reset.usedAt = new Date().toISOString();
  writeAccounts(accounts);
  writeResetTokens(tokens);
  recordSecurityEvent({
    type: "ADMIN_RESET_TOKEN_CONSUME",
    result: "SUCCESS",
    actor: reset.email,
    licenseId: reset.licenseId,
    ip
  });
  return { email: reset.email };
}

function upsertAdminAccount(license, accountPatch) {
  const accounts = readAccounts();
  const index = accounts.findIndex((item) => item.licenseId === license.id);
  const existing = index >= 0 ? accounts[index] : {};
  const password =
    String(accountPatch.password || existing.password || uniqueAdminPassword(accounts, license.id)).trim() ||
    uniqueAdminPassword(accounts, license.id);
  const defaultUsername = makeDefaultAdminEmail(license.institutionCode);
  const legacyUsername = makeLegacyAdminEmail(license.institutionCode);
  const existingUsername = String(existing.email || "")
    .trim()
    .toLowerCase();
  const email = String(
    accountPatch.email ||
      (!accountPatch.email && existingUsername === legacyUsername ? defaultUsername : existing.email) ||
      defaultUsername
  )
    .trim()
    .toLowerCase();
  const next = {
    licenseId: license.id,
    schoolName: repairMojibakeText(license.schoolName || ""),
    institutionCode: repairMojibakeText(license.institutionCode || ""),
    name: repairMojibakeText(
      accountPatch.name || existing.name || "\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u062f\u0631\u0633\u0629"
    ),
    email,
    password,
    role: accountPatch.role || existing.role || "ADMIN",
    updatedAt: new Date().toISOString()
  };
  if (index >= 0) accounts[index] = next;
  else accounts.push({ ...next, createdAt: new Date().toISOString() });
  writeAccounts(accounts);
  return next;
}

function getAdminAccount(license) {
  if (!license) return null;
  const account = readAccounts().find((item) => item.licenseId === license.id);
  if (account) {
    const legacyEmail = makeLegacyAdminEmail(license.institutionCode);
    if (
      legacyEmail &&
      String(account.email || "")
        .trim()
        .toLowerCase() === legacyEmail
    ) {
      return upsertAdminAccount(license, {});
    }
    return account;
  }
  return upsertAdminAccount(license, {});
}

function removeAdminAccount(licenseId) {
  writeAccounts(readAccounts().filter((item) => item.licenseId !== licenseId));
}

function publicAdminAccount(license) {
  const account = getAdminAccount(license);
  if (!account) return null;
  return { name: account.name, email: account.email, password: account.password, role: account.role };
}
function repairMojibakeText(value) {
  const text = String(value || "");
  if (!/[\u00c3\u00d8\u00d9]/.test(text)) return text;
  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
}

function normalizeLicenseText(value) {
  return repairMojibakeText(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function activeDevices(license) {
  return (Array.isArray(license.devices) ? license.devices : []).filter(
    (device) => !device.disabled && device.status !== "revoked"
  );
}

function payloadFromLicense(license) {
  return {
    licenseId: license.id,
    schoolId: license.schoolId || license.id,
    schoolName: repairMojibakeText(license.schoolName || ""),
    institutionCode: repairMojibakeText(license.institutionCode || ""),
    plan: license.plan || "PAID",
    status: effectiveStatus(license),
    expiresAt: license.expiresAt,
    maxDevices: Number(license.maxDevices || 1),
    activeDevicesCount: activeDevices(license).length,
    allowedFeatures: Array.isArray(license.allowedFeatures) ? license.allowedFeatures : ["core"]
  };
}
function licenseDetailsMatch(body, license, payload) {
  const schoolName = normalizeLicenseText(body.schoolName);
  const institutionCode = normalizeLicenseText(body.institutionCode);
  const storedSchoolName = normalizeLicenseText(license.schoolName);
  const storedInstitutionCode = normalizeLicenseText(license.institutionCode);
  const signedSchoolName = normalizeLicenseText(payload.schoolName);
  const signedInstitutionCode = normalizeLicenseText(payload.institutionCode);

  return (
    (schoolName === storedSchoolName || schoolName === signedSchoolName) &&
    (institutionCode === storedInstitutionCode || institutionCode === signedInstitutionCode)
  );
}

function repairStoredLicenseDetails(license, payload) {
  if (payload.schoolName && normalizeLicenseText(license.schoolName) === normalizeLicenseText(payload.schoolName)) {
    license.schoolName = String(payload.schoolName);
  } else {
    license.schoolName = repairMojibakeText(license.schoolName);
  }

  if (
    payload.institutionCode &&
    normalizeLicenseText(license.institutionCode) === normalizeLicenseText(payload.institutionCode)
  ) {
    license.institutionCode = String(payload.institutionCode);
  } else {
    license.institutionCode = repairMojibakeText(license.institutionCode);
  }
}

function ensureLicenseCodes(db) {
  let changed = false;
  for (const license of db) {
    if (license.licenseKey && !license.licenseKeyHash) {
      license.licenseKeyHash = hash(license.licenseKey);
      changed = true;
    }
    if (!license.licenseCode) {
      license.licenseCode = generateUniqueLicenseCode(db);
      changed = true;
    }
    const expectedCodeHash = licenseCodeHash(license.licenseCode);
    if (license.licenseCodeHash !== expectedCodeHash) {
      license.licenseCodeHash = expectedCodeHash;
      changed = true;
    }
    try {
      if (license.licenseKey) {
        const payload = parseLicenseKey(license.licenseKey);
        if (
          payload.schoolName &&
          normalizeLicenseText(license.schoolName) !== normalizeLicenseText(payload.schoolName)
        ) {
          license.schoolName = String(payload.schoolName);
          changed = true;
        }
        if (
          payload.institutionCode &&
          normalizeLicenseText(license.institutionCode) !== normalizeLicenseText(payload.institutionCode)
        ) {
          license.institutionCode = String(payload.institutionCode);
          changed = true;
        }
      }
    } catch {}
    license.devices = Array.isArray(license.devices) ? license.devices : [];
    license.installations = Array.isArray(license.installations) ? license.installations : [];
  }
  return changed;
}

function licenseIdentity(license) {
  return String(license?.licenseKeyHash || license?.licenseCodeHash || license?.id || license?.schoolId || "").trim();
}

function dedupeLicenses(db) {
  const seen = new Map();
  for (const license of db) {
    const key = licenseIdentity(license);
    if (!key) continue;
    const current = seen.get(key);
    if (!current) {
      seen.set(key, license);
      continue;
    }
    const currentTime = new Date(current.updatedAt || current.createdAt || 0).getTime();
    const nextTime = new Date(license.updatedAt || license.createdAt || 0).getTime();
    if (nextTime >= currentTime) {
      seen.set(key, {
        ...current,
        ...license,
        devices: Array.isArray(license.devices) ? license.devices : current.devices,
        installations: Array.isArray(license.installations) ? license.installations : current.installations
      });
    }
  }
  return Array.from(seen.values());
}

function readDb() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const normalized = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
    const db = dedupeLicenses(normalized);
    if (ensureLicenseCodes(db) || db.length !== normalized.length) writeDb(db);
    return db;
  } catch {
    return [];
  }
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const safeData = dedupeLicenses(Array.isArray(data) ? data : data ? [data] : []);
  if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + ".bak");
  fs.writeFileSync(DATA_FILE, JSON.stringify(safeData, null, 2) + "\n", "utf8");
}

function securityHeaders(contentType = "application/json; charset=utf-8") {
  const headers = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
  };
  if (CORS_ORIGIN) headers["Access-Control-Allow-Origin"] = CORS_ORIGIN;
  return headers;
}

function json(res, status, body) {
  res.writeHead(status, {
    ...securityHeaders()
  });
  res.end(JSON.stringify(body));
}

function timingSafeTextEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAdmin(req) {
  const header = req.headers.authorization || "";
  return timingSafeTextEquals(header, "Bearer " + ADMIN_TOKEN);
}

function clientAddress(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function routeBucketName(req, url) {
  if (url.pathname.startsWith("/api/admin/")) return "admin";
  if (url.pathname.startsWith("/api/client/") || url.pathname.startsWith("/api/license/")) return "client";
  return "general";
}

function isRateLimited(req, url) {
  const bucket = routeBucketName(req, url);
  const limit = RATE_LIMITS[bucket] || RATE_LIMITS.general;
  const key = `${bucket}:${clientAddress(req)}`;
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit.limit;
}

function checkRequestNonce(req, url) {
  if (!url.pathname.startsWith("/api/client/") && !url.pathname.startsWith("/api/license/")) return { ok: true };
  if (req.method !== "POST") return { ok: true };
  const nonce = String(req.headers["x-request-nonce"] || "").trim();
  const requireNonce = String(process.env.LICENSE_REQUIRE_CLIENT_NONCE || "").toLowerCase() === "true";
  if (!nonce) return requireNonce ? { ok: false, error: "MISSING_NONCE" } : { ok: true };
  if (nonce.length < 16 || nonce.length > 128) return { ok: false, error: "INVALID_NONCE" };

  const now = Date.now();
  for (const [key, item] of requestNonces.entries()) {
    if (item.expiresAt <= now) requestNonces.delete(key);
  }
  const key = `${routeBucketName(req, url)}:${clientAddress(req)}:${hash(nonce)}`;
  if (requestNonces.has(key)) return { ok: false, error: "REPLAYED_NONCE" };
  requestNonces.set(key, { expiresAt: now + REQUEST_NONCE_TTL_MS });
  return { ok: true };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
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

function effectiveStatus(license) {
  if (license.status === "REVOKED") return "CANCELLED";
  if (["SUSPENDED", "READ_ONLY", "CANCELLED"].includes(license.status)) return license.status;
  if (new Date(license.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return license.status || "ACTIVE";
}

function deviceFingerprintFromBody(body) {
  return String(body.deviceId || body.deviceFingerprint || "").trim() || "unknown-device";
}

function deviceNameFromBody(body) {
  return String(body.deviceName || body.computerName || "").trim() || "SOM PRO Desktop";
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
function machineFingerprintFromInstall(body) {
  const source =
    [body.machineGuid, body.computerName, body.userName, body.installFingerprint].filter(Boolean).join("|") ||
    "unknown-installer";
  return hash(source);
}

function resolveLicenseCredential(db, credential) {
  const raw = String(credential || "").trim();
  if (!raw) throw new Error("INVALID_LICENSE_FORMAT");

  if (raw.includes(".")) {
    const payload = parseLicenseKey(raw);
    const credentialHash = hash(raw);
    return { license: db.find((item) => item.licenseKeyHash === credentialHash), payload, credentialHash };
  }

  const normalizedCode = normalizeLicenseCode(raw);
  const credentialHash = licenseCodeHash(normalizedCode);
  const license = db.find(
    (item) => item.licenseCodeHash === credentialHash || normalizeLicenseCode(item.licenseCode) === normalizedCode
  );
  return { license, payload: license ? payloadFromLicense(license) : null, credentialHash };
}

function validateInstallBody(db, body) {
  const credential = body.licenseCode || body.licenseKey;
  const resolved = resolveLicenseCredential(db, credential);
  if (!resolved.license)
    return {
      errorStatus: 404,
      body: {
        error: "LICENSE_NOT_ISSUED",
        message:
          "\u0647\u0630\u0627 \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u063a\u064a\u0631 \u0635\u0627\u062f\u0631 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0627\u0644\u0643."
      }
    };

  repairStoredLicenseDetails(resolved.license, resolved.payload);
  if (!licenseDetailsMatch(body, resolved.license, resolved.payload)) {
    return {
      errorStatus: 403,
      body: {
        error: "LICENSE_DETAILS_MISMATCH",
        message:
          "\u0627\u0633\u0645 \u0627\u0644\u0645\u062f\u0631\u0633\u0629 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0645\u0624\u0633\u0633\u0629 \u0644\u0627 \u064a\u0637\u0627\u0628\u0642\u0627\u0646 \u0627\u0644\u062a\u0631\u062e\u064a\u0635."
      }
    };
  }

  const status = effectiveStatus(resolved.license);
  if (status !== "ACTIVE") {
    return {
      errorStatus: 403,
      body: {
        error: "LICENSE_NOT_ACTIVE",
        status,
        message: "\u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u063a\u064a\u0631 \u0645\u0641\u0639\u0644."
      }
    };
  }

  resolved.license.installations = Array.isArray(resolved.license.installations) ? resolved.license.installations : [];
  if (resolved.license.installations.length > 0) {
    return {
      errorStatus: 403,
      body: {
        error: "INSTALL_ALREADY_USED",
        message:
          "\u062a\u0645 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u0633\u0627\u0628\u0642\u0627 \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u062b\u0628\u064a\u062a\u0647 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649."
      }
    };
  }

  return resolved;
}

function serveStatic(req, res) {
  const file = req.url === "/" ? "index.html" : req.url.replace(/^\//, "");
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(full);
  const type = ext === ".html" ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
  res.writeHead(200, {
    ...securityHeaders(type),
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  });
  fs.createReadStream(full).pipe(res);
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  if (isRateLimited(req, url)) return json(res, 429, { error: "RATE_LIMITED" });
  const nonceCheck = checkRequestNonce(req, url);
  if (!nonceCheck.ok) return json(res, 409, { error: nonceCheck.error });

  if (url.pathname === "/health") return json(res, 200, { ok: true, service: "som-license-server" });

  if (url.pathname === "/api/admin/licenses" && req.method === "GET") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    return json(res, 200, { data: readDb().map(publicLicense) });
  }

  if (url.pathname === "/api/admin/licenses" && req.method === "POST") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const body = await readBody(req);
    const days = Number(body.days || 30);
    const db = readDb();
    const payload = {
      schoolName: repairMojibakeText(
        body.schoolName || "\u0645\u062f\u0631\u0633\u0629 \u062c\u062f\u064a\u062f\u0629"
      ),
      institutionCode: repairMojibakeText(body.institutionCode || ""),
      plan: String(body.plan || (days <= 45 ? "TRIAL" : "PAID")),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      maxDevices: Number(body.maxDevices || 1),
      allowedFeatures: Array.isArray(body.allowedFeatures) ? body.allowedFeatures : ["core"]
    };
    const licenseKey = makeLicenseKey(payload);
    const licenseCode = generateUniqueLicenseCode(db);
    const license = {
      id: crypto.randomUUID(),
      schoolId: body.schoolId || crypto.randomUUID(),
      licenseKey,
      licenseKeyHash: hash(licenseKey),
      licenseCode,
      licenseCodeHash: licenseCodeHash(licenseCode),
      status: "ACTIVE",
      devices: [],
      installations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload
    };
    upsertAdminAccount(license, {
      name: body.adminName || body.managerName || "\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u062f\u0631\u0633\u0629",
      email: body.adminEmail || makeDefaultAdminEmail(license.institutionCode),
      password: body.adminPassword || uniqueAdminPassword(readAccounts(), license.id),
      role: "ADMIN"
    });
    db.push(license);
    writeDb(db);
    return json(res, 201, { data: publicLicense(license) });
  }

  const deleteMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const db = readDb();
    const next = db.filter((item) => item.id !== deleteMatch[1]);
    if (next.length === db.length) return json(res, 404, { error: "NOT_FOUND" });
    removeAdminAccount(deleteMatch[1]);
    writeDb(next);
    return json(res, 200, { ok: true });
  }

  const patchMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)$/);
  if (patchMatch && req.method === "PATCH") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const body = await readBody(req);
    const db = readDb();
    const license = db.find((item) => item.id === patchMatch[1]);
    if (!license) return json(res, 404, { error: "NOT_FOUND" });
    for (const field of [
      "status",
      "expiresAt",
      "maxDevices",
      "schoolName",
      "institutionCode",
      "plan",
      "allowedFeatures"
    ]) {
      if (body[field] !== undefined) license[field] = body[field];
    }
    if (body.adminAccount) {
      upsertAdminAccount(license, body.adminAccount);
    }
    if (body.resetAdminPassword) {
      upsertAdminAccount(license, { password: uniqueAdminPassword(readAccounts(), license.id) });
    }
    if (body.extendDays) {
      const base = Math.max(Date.now(), new Date(license.expiresAt).getTime());
      license.expiresAt = new Date(base + Number(body.extendDays) * 24 * 60 * 60 * 1000).toISOString();
      if (license.status === "EXPIRED") license.status = "ACTIVE";
    }
    license.updatedAt = new Date().toISOString();
    writeDb(db);
    return json(res, 200, { data: publicLicense(license) });
  }

  const deviceMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/devices\/([^/]+)\/disable$/);
  if (deviceMatch && req.method === "POST") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const db = readDb();
    const license = db.find((item) => item.id === deviceMatch[1]);
    if (!license) return json(res, 404, { error: "NOT_FOUND" });
    const fingerprint = decodeURIComponent(deviceMatch[2]);
    const device = license.devices.find((item) => item.fingerprint === fingerprint || item.deviceId === fingerprint);
    if (device) device.disabled = true;
    license.updatedAt = new Date().toISOString();
    writeDb(db);
    return json(res, 200, { data: publicLicense(license) });
  }

  const actionMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/(suspend|cancel|renew)$/);
  if (actionMatch && req.method === "POST") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const body = await readBody(req);
    const db = readDb();
    const license = db.find((item) => item.id === actionMatch[1]);
    if (!license) return json(res, 404, { error: "NOT_FOUND" });
    const action = actionMatch[2];
    if (action === "suspend") license.status = "SUSPENDED";
    if (action === "cancel") license.status = "CANCELLED";
    if (action === "renew") {
      const days = Number(body.days || body.extendDays || 30);
      const base = Math.max(Date.now(), new Date(license.expiresAt).getTime());
      license.expiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
      if (["EXPIRED", "SUSPENDED", "READ_ONLY"].includes(license.status)) license.status = "ACTIVE";
    }
    license.updatedAt = new Date().toISOString();
    writeDb(db);
    return json(res, 200, { data: publicLicense(license) });
  }
  if (url.pathname === "/api/client/preinstall" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const db = readDb();
      const result = validateInstallBody(db, body);
      if (result.errorStatus) return json(res, result.errorStatus, result.body);
      return json(res, 200, { data: publicLicense(result.license), ok: true });
    } catch {
      return json(res, 400, {
        error: "INVALID_LICENSE",
        message:
          "\u0643\u0648\u062f \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d \u0623\u0648 \u0642\u062f\u064a\u0645. \u0623\u0635\u062f\u0631 \u062a\u0631\u062e\u064a\u0635\u0627 \u062c\u062f\u064a\u062f\u0627 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0627\u0644\u0643."
      });
    }
  }

  if (url.pathname === "/api/client/register-install" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const db = readDb();
      const result = validateInstallBody(db, body);
      if (result.errorStatus) return json(res, result.errorStatus, result.body);
      const fingerprint = machineFingerprintFromInstall(body);
      result.license.installations.push({
        fingerprint,
        installedAt: new Date().toISOString(),
        computerName: String(body.computerName || ""),
        userName: String(body.userName || "")
      });
      result.license.updatedAt = new Date().toISOString();
      writeDb(db);
      return json(res, 200, { data: publicLicense(result.license), ok: true });
    } catch {
      return json(res, 400, {
        error: "INVALID_LICENSE",
        message:
          "\u0643\u0648\u062f \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d \u0623\u0648 \u0642\u062f\u064a\u0645."
      });
    }
  }

  if (url.pathname === "/api/client/recover-admin" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const db = readDb();
      const resolved = resolveLicenseCredential(db, body.licenseCode || body.licenseKey);
      const license = resolved.license;
      if (!license) return json(res, 404, { error: "LICENSE_NOT_ISSUED", status: "SUSPENDED" });
      const status = effectiveStatus(license);
      if (["SUSPENDED", "CANCELLED"].includes(status)) return json(res, 403, { error: "LICENSE_SUSPENDED", status });
      const account = getAdminAccount(license);
      const requestedEmail = String(body.email || "")
        .trim()
        .toLowerCase();
      const accountEmail = String(account.email || "")
        .trim()
        .toLowerCase();
      if (requestedEmail && requestedEmail !== accountEmail) {
        recordSecurityEvent({
          type: "ADMIN_RESET_TOKEN_ISSUED",
          result: "DENIED",
          licenseId: license.id,
          email: requestedEmail,
          ip: clientAddress(req),
          reason: "EMAIL_MISMATCH"
        });
        return json(res, 403, { error: "RECOVERY_NOT_AVAILABLE" });
      }
      const reset = createResetToken(license, account, clientAddress(req));
      license.updatedAt = new Date().toISOString();
      writeDb(db);
      return json(res, 200, {
        data: {
          ...publicLicense(license),
          adminAccount: { name: account.name, email: account.email, role: account.role },
          resetToken: reset.token,
          resetTokenExpiresAt: reset.expiresAt
        },
        status,
        readOnly: false
      });
    } catch (error) {
      return json(res, 400, { error: "RECOVERY_FAILED", message: error.message });
    }
  }

  if (url.pathname === "/api/client/reset-admin-password" && req.method === "POST") {
    const body = await readBody(req);
    const token = String(body.resetToken || "").trim();
    const newPassword = String(body.newPassword || "").trim();
    if (!token || newPassword.length < 12) return json(res, 400, { error: "INVALID_RESET_REQUEST" });
    const result = consumeResetToken(token, newPassword, clientAddress(req));
    if (!result) return json(res, 400, { error: "INVALID_OR_EXPIRED_RESET_TOKEN" });
    return json(res, 200, { data: { ok: true, email: result.email } });
  }

  if (url.pathname === "/api/client/activate" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const db = readDb();
      const resolved = resolveLicenseCredential(db, body.licenseCode || body.licenseKey);
      const license = resolved.license;
      if (!license)
        return json(res, 404, {
          error: "LICENSE_NOT_ISSUED",
          status: "SUSPENDED",
          message:
            "\u0647\u0630\u0627 \u0627\u0644\u062a\u0631\u062e\u064a\u0635 \u063a\u064a\u0631 \u0635\u0627\u062f\u0631 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0627\u0644\u0643"
        });
      const status = effectiveStatus(license);
      if (["SUSPENDED", "CANCELLED"].includes(status)) return json(res, 403, { error: "LICENSE_SUSPENDED", status });
      const fingerprint = deviceFingerprintFromBody(body);
      license.devices = Array.isArray(license.devices) ? license.devices : [];
      let device = license.devices.find((item) => item.fingerprint === fingerprint || item.deviceId === fingerprint);
      if (!device) {
        if (license.devices.filter((item) => !item.disabled).length >= Number(license.maxDevices || 1)) {
          return json(res, 403, { error: "MAX_DEVICES_REACHED", status: "SUSPENDED" });
        }
        device = {
          fingerprint,
          deviceId: fingerprint,
          deviceName: deviceNameFromBody(body),
          appVersion: String(body.appVersion || ""),
          platform: String(body.platform || ""),
          activatedAt: new Date().toISOString(),
          lastCheckAt: new Date().toISOString(),
          status: "active",
          disabled: false
        };
        license.devices.push(device);
      }
      if (device.disabled || device.status === "revoked")
        return json(res, 403, {
          error: "DEVICE_DISABLED",
          status: "SUSPENDED",
          message: "هذا الجهاز غير مفعل أو تم تعطيله"
        });
      device.lastCheckAt = new Date().toISOString();
      device.deviceName = deviceNameFromBody(body);
      device.appVersion = String(body.appVersion || device.appVersion || "");
      device.platform = String(body.platform || device.platform || "");
      license.updatedAt = new Date().toISOString();
      writeDb(db);
      return json(res, 200, licenseStatusPayload(license, "تم تفعيل هذا الجهاز بنجاح"));
    } catch (error) {
      return json(res, 400, { error: "INVALID_LICENSE", message: error.message });
    }
  }

  if (
    (url.pathname === "/api/client/check" ||
      url.pathname === "/api/client/status" ||
      url.pathname === "/api/license/status") &&
    req.method === "POST"
  ) {
    const body = await readBody(req);
    const db = readDb();
    const license = db.find(
      (item) => item.licenseKeyHash === body.licenseKeyHash || item.licenseCodeHash === body.licenseKeyHash
    );
    if (!license) return json(res, 404, { error: "LICENSE_NOT_FOUND", status: "SUSPENDED" });
    const fingerprint = deviceFingerprintFromBody(body);
    license.devices = Array.isArray(license.devices) ? license.devices : [];
    const device = license.devices.find((item) => item.fingerprint === fingerprint || item.deviceId === fingerprint);
    if (!device || device.disabled || device.status === "revoked")
      return json(res, 403, {
        error: "DEVICE_DISABLED",
        status: "SUSPENDED",
        message: "هذا الجهاز غير مفعل أو تم تعطيله"
      });
    device.lastCheckAt = new Date().toISOString();
    writeDb(db);
    return json(res, 200, licenseStatusPayload(license));
  }

  return serveStatic(req, res);
}

function createLicenseServer() {
  return http.createServer((req, res) =>
    handle(req, res).catch((error) => {
      if (error?.message === "BODY_TOO_LARGE") return json(res, 413, { error: "BODY_TOO_LARGE" });
      return json(res, 500, { error: "INTERNAL_ERROR" });
    })
  );
}

const server = createLicenseServer();

if (require.main === module) {
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log("License server is already running on http://localhost:" + PORT);
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log("SOM License Server running on http://localhost:" + PORT);
    console.log("Owner login: http://localhost:" + PORT);
    if (!process.env.LICENSE_ADMIN_TOKEN) {
      console.log("Owner token saved in: " + TOKEN_FILE);
    }
  });
}

module.exports = {
  createLicenseServer,
  handle,
  hash,
  licenseCodeHash,
  makeLicenseKey,
  normalizeLicenseCode
};
