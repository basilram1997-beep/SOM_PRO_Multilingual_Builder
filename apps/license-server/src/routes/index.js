const { isRateLimited, checkRequestNonce, json, serveStatic } = require("../runtime");
const { handleAdminRoutes } = require("./admin");
const { handleClientRoutes } = require("./client");

async function handleLicenseRequest(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const rateLimitDecision = await isRateLimited(req, url);
  if (!rateLimitDecision.ok) {
    if (rateLimitDecision.retryAfterSeconds) {
      res.setHeader("Retry-After", String(rateLimitDecision.retryAfterSeconds));
    }
    return json(res, rateLimitDecision.status || 429, { error: rateLimitDecision.error || "RATE_LIMITED" });
  }
  const nonceCheck = await checkRequestNonce(req, url);
  if (!nonceCheck.ok) {
    return json(res, nonceCheck.status || 409, { error: nonceCheck.error });
  }

  if (url.pathname === "/health") return json(res, 200, { ok: true, service: "som-license-server" });

  const admin = await handleAdminRoutes(req, res, url);
  if (admin) return admin;

  const client = await handleClientRoutes(req, res, url);
  if (client) return client;

  return serveStatic(req, res);
}

module.exports = {
  handleLicenseRequest
};
