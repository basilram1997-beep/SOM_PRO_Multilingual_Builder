const { Prisma } = require("@prisma/client");
const { ADMIN_TOKEN, clientAddress, timingSafeTextEquals } = require("./runtime");

const sensitiveKeys = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "oldpassword",
  "confirmpassword",
  "passwordconfirmation",
  "passwordconfirm",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "licensekey",
  "licensecode",
  "ownertoken",
  "secret",
  "mfasecret",
  "mfa_secret",
  "session",
  "sessionid",
  "jwt"
]);

function redactSensitive(value) {
  if (Buffer.isBuffer(value)) {
    return `[BUFFER ${value.length} BYTES]`;
  }
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitive(item)])
  );
}

function isAdmin(req) {
  const header = req.headers.authorization || "";
  return timingSafeTextEquals(header, "Bearer " + ADMIN_TOKEN);
}

function appendAuditLog(prisma, req, action, details) {
  const schoolId = req.user?.schoolId || null;
  const userId = req.user?.id || req.user?.userId || null;
  void prisma.auditLog
    .create({
      data: {
        schoolId,
        userId,
        action,
        entity: "HTTP_SECURITY",
        after: details
      }
    })
    .catch(() => null);
}

function auditRequest(prisma, req, action, details) {
  appendAuditLog(prisma, req, action, details);
}

module.exports = {
  appendAuditLog,
  auditRequest,
  isAdmin,
  redactSensitive
};
