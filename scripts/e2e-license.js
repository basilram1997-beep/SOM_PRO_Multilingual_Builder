const crypto = require("node:crypto");

function generateE2ELicenseCode({
  days = 365,
  institutionCode = "E2E-4100",
  secret = process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
} = {}) {
  const cleanInstitutionCode = String(institutionCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "") || "E2E-4100";
  const payloadPart = cleanInstitutionCode;
  const signature = crypto.createHmac("sha256", secret).update(payloadPart).digest("hex").slice(0, 4).toUpperCase();
  return `SOM2-${payloadPart}-${signature}`;
}

module.exports = {
  generateE2ELicenseCode
};
