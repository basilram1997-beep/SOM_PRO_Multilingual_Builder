const crypto = require("node:crypto");

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function generateE2ELicenseCode({
  days = 365,
  schoolName = "SOM E2E School",
  institutionCode = "E2E-4100",
  secret = process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
} = {}) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    schoolName,
    institutionCode,
    plan: days <= 45 ? "TRIAL" : "PAID",
    expiresAt,
    maxDevices: 1,
    allowedFeatures: ["browser-e2e"]
  };
  const payloadPart = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(payloadPart).digest("hex");
  return `SOM-${payloadPart}.${signature}`;
}

module.exports = {
  generateE2ELicenseCode
};
