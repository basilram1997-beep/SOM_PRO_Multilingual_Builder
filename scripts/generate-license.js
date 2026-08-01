const crypto = require("crypto");

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const secret = process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling";
const days = Number(process.argv[2] || 30);
const schoolName = process.argv[3] || "مدرسة جديدة";
const institutionCode = process.argv[4] || "000000";
const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const payload = { schoolName, institutionCode, plan: days <= 45 ? "TRIAL" : "PAID", expiresAt, maxDevices: 1 };
const payloadPart = base64Url(JSON.stringify(payload));
const signature = crypto.createHmac("sha256", secret).update(payloadPart).digest("hex");
process.stdout.write(`[SOM PRO] License: SOM-${payloadPart}.${signature}\n`);
process.stdout.write(`[SOM PRO] Expires: ${expiresAt}\n`);
