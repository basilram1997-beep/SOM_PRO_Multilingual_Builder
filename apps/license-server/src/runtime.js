const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  clientAddress,
  createRequestProtectionStore,
  routeBucketName
} = require("./requestProtectionStore");

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
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const LOCAL_ADMIN_TOKEN = IS_PRODUCTION ? "" : createLocalAdminToken();
const ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || LOCAL_ADMIN_TOKEN;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";

const RATE_LIMITS = {
  admin: { limit: Number(process.env.LICENSE_ADMIN_RATE_LIMIT || 120), windowMs: 60_000 },
  client: { limit: Number(process.env.LICENSE_CLIENT_RATE_LIMIT || 180), windowMs: 60_000 },
  general: { limit: Number(process.env.LICENSE_GENERAL_RATE_LIMIT || 300), windowMs: 60_000 }
};
const MAX_BODY_BYTES = Number(process.env.LICENSE_MAX_BODY_BYTES || 32_768);
const RESET_TOKEN_TTL_MS = Number(process.env.LICENSE_RESET_TOKEN_TTL_MS || 15 * 60_000);
const REQUEST_NONCE_TTL_MS = Number(process.env.LICENSE_REQUEST_NONCE_TTL_MS || 5 * 60_000);
const requestProtectionStore = createRequestProtectionStore({
  rateLimits: RATE_LIMITS,
  requestNonceTtlMs: REQUEST_NONCE_TTL_MS
});

function createLocalAdminToken() {
  return "SOM-OWNER-" + crypto.randomBytes(18).toString("hex").toUpperCase();
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
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

function timingSafeTextEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
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
  return true;
}

async function isRateLimited(req, url) {
  return requestProtectionStore.isRateLimited(req, url);
}

async function checkRequestNonce(req, url) {
  return requestProtectionStore.checkRequestNonce(req, url);
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

function serveStatic(req, res) {
  const file = req.url === "/" ? "index.html" : req.url.replace(/^\//, "");
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full)) {
    res.writeHead(404);
    res.end("Not found");
    return true;
  }
  const ext = path.extname(full);
  const type = ext === ".html" ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
  res.writeHead(200, {
    ...securityHeaders(type),
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  });
  fs.createReadStream(full).pipe(res);
  return true;
}

function clearRequestProtectionState() {
  requestProtectionStore.clearRequestProtectionState();
}

module.exports = {
  ADMIN_TOKEN,
  CORS_ORIGIN,
  CODE_ALPHABET,
  DEFAULT_LICENSE_SECRET,
  IS_PRODUCTION,
  LICENSE_SECRET,
  MAX_BODY_BYTES,
  PASSWORD_ALPHABET,
  PORT,
  PUBLIC_DIR,
  RATE_LIMITS,
  RESET_TOKEN_TTL_MS,
  REQUEST_NONCE_TTL_MS,
  ROOT_DIR,
  base64Url,
  base64UrlDecode,
  checkRequestNonce,
  clearRequestProtectionState,
  clientAddress,
  hash,
  hmac,
  isRateLimited,
  json,
  loadEnvFile,
  readBody,
  routeBucketName,
  securityHeaders,
  serveStatic,
  timingSafeTextEquals,
  createLocalAdminToken
};
