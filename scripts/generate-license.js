const crypto = require("crypto");

const secret = process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling";
const days = Number(process.argv[2] || 30);
const _schoolName = process.argv[3] || "مدرسة جديدة";
const institutionCode = process.argv[4] || "000000";
const cleanInstitutionCode = String(institutionCode || "")
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9-]/g, "") || "000000";
const payloadPart = cleanInstitutionCode;
const signature = crypto.createHmac("sha256", secret).update(payloadPart).digest("hex").slice(0, 4).toUpperCase();
process.stdout.write(`[SOM PRO] License: SOM2-${payloadPart}-${signature}\n`);
process.stdout.write(`[SOM PRO] Expires: ${new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()}\n`);
