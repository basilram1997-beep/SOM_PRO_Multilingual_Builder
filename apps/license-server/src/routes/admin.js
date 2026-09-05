const crypto = require("crypto");
const { json, readBody } = require("../runtime");
const { isAdmin } = require("../security");
const { repairMojibakeText } = require("../policy");
const {
  createLicenseRecord,
  deleteLicenseById,
  listLicenses,
  mutateLicenseById,
  publicLicenseFromRecord
} = require("../store");

async function handleAdminRoutes(req, res, url) {
  if (url.pathname === "/api/admin/licenses" && req.method === "GET") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const licenses = await listLicenses();
    return json(res, 200, { data: licenses.map(publicLicenseFromRecord) });
  }

  if (url.pathname === "/api/admin/licenses" && req.method === "POST") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const body = await readBody(req);
    const license = await createLicenseRecord({
      ...body,
      schoolName: repairMojibakeText(body.schoolName || "مدرسة جديدة"),
      institutionCode: repairMojibakeText(body.institutionCode || "")
    });
    return json(res, 201, { data: publicLicenseFromRecord(license) });
  }

  const deleteMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const removed = await deleteLicenseById(deleteMatch[1]);
    if (!removed) return json(res, 404, { error: "NOT_FOUND" });
    return json(res, 200, { ok: true });
  }

  const patchMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)$/);
  if (patchMatch && req.method === "PATCH") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const body = await readBody(req);
    const updated = await mutateLicenseById(patchMatch[1], (license) => {
      const next = { ...license };
      for (const field of ["status", "expiresAt", "maxDevices", "schoolName", "institutionCode", "plan", "allowedFeatures"]) {
        if (body[field] !== undefined) next[field] = body[field];
      }
      if (body.adminAccount) {
        next.adminAccount = {
          name: body.adminAccount.name || license.adminAccount?.name || "مدير المدرسة",
          email: body.adminAccount.email || license.adminAccount?.email || "",
          password: body.adminAccount.password || license.adminAccount?.password || "",
          role: body.adminAccount.role || license.adminAccount?.role || "ADMIN"
        };
      }
      if (body.resetAdminPassword) {
        next.adminAccount = {
          name: license.adminAccount?.name || "مدير المدرسة",
          email: license.adminAccount?.email || "",
          password: crypto.randomBytes(16).toString("hex"),
          role: license.adminAccount?.role || "ADMIN"
        };
      }
      if (body.extendDays) {
        const base = Math.max(Date.now(), new Date(license.expiresAt).getTime());
        next.expiresAt = new Date(base + Number(body.extendDays) * 24 * 60 * 60 * 1000).toISOString();
        if (license.status === "EXPIRED") next.status = "ACTIVE";
      }
      next.updatedAt = new Date().toISOString();
      return next;
    });
    if (!updated) return json(res, 404, { error: "NOT_FOUND" });
    return json(res, 200, { data: publicLicenseFromRecord(updated) });
  }

  const deviceMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/devices\/([^/]+)\/disable$/);
  if (deviceMatch && req.method === "POST") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const updated = await mutateLicenseById(deviceMatch[1], (license) => {
      const fingerprint = decodeURIComponent(deviceMatch[2]);
      const devices = Array.isArray(license.devices) ? [...license.devices] : [];
      const device = devices.find((item) => item.fingerprint === fingerprint || item.deviceId === fingerprint);
      if (device) device.disabled = true;
      return { ...license, devices, updatedAt: new Date().toISOString() };
    });
    if (!updated) return json(res, 404, { error: "NOT_FOUND" });
    return json(res, 200, { data: publicLicenseFromRecord(updated) });
  }

  const actionMatch = url.pathname.match(/^\/api\/admin\/licenses\/([^/]+)\/(suspend|cancel|renew)$/);
  if (actionMatch && req.method === "POST") {
    if (!isAdmin(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const body = await readBody(req);
    const updated = await mutateLicenseById(actionMatch[1], (license) => {
      const next = { ...license };
      const action = actionMatch[2];
      if (action === "suspend") next.status = "SUSPENDED";
      if (action === "cancel") next.status = "CANCELLED";
      if (action === "renew") {
        const days = Number(body.days || body.extendDays || 30);
        const base = Math.max(Date.now(), new Date(license.expiresAt).getTime());
        next.expiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
        if (["EXPIRED", "SUSPENDED", "READ_ONLY"].includes(license.status)) next.status = "ACTIVE";
      }
      next.updatedAt = new Date().toISOString();
      return next;
    });
    if (!updated) return json(res, 404, { error: "NOT_FOUND" });
    return json(res, 200, { data: publicLicenseFromRecord(updated) });
  }

  return null;
}

module.exports = {
  handleAdminRoutes
};
