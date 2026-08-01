const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const files = [
  ["apps", "backend", ".env"],
  ["apps", "frontend", ".env"]
];

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function upsertEnvValue(file, key, value) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.trim().startsWith(key + "=")) {
      found = true;
      return key + "=" + value;
    }
    return line;
  });
  if (!found) next.push(key + "=" + value);
  fs.writeFileSync(file, next.filter((line, index) => line || index < next.length - 1).join("\n") + "\n", "utf8");
}

for (const parts of files) {
  const target = path.join(root, ...parts);
  const example = target + ".example";
  if (!fs.existsSync(target)) {
    if (!fs.existsSync(example)) {
      error("ملف المثال مفقود:", example);
      process.exit(1);
    }
    fs.copyFileSync(example, target);
    success("تم إنشاء:", path.relative(root, target));
  } else {
    success("موجود:", path.relative(root, target));
  }
}

const backendEnv = path.join(root, "apps", "backend", ".env");
const rootEnv = path.join(root, ".env");
if (!fs.existsSync(rootEnv) && fs.existsSync(backendEnv)) {
  fs.copyFileSync(backendEnv, rootEnv);
  success("تم إنشاء .env في جذر المشروع");
}

const current = { ...readEnv(rootEnv), ...readEnv(backendEnv) };
const defaultLicenseSecret = "change-this-secret-before-selling";
const defaultAuthSecret = "change-this-auth-secret-before-selling";
const licenseSecret =
  current.SOM_PRO_LICENSE_SECRET && current.SOM_PRO_LICENSE_SECRET !== defaultLicenseSecret
    ? current.SOM_PRO_LICENSE_SECRET
    : "SOM-SECRET-" + crypto.randomBytes(32).toString("hex");
const authSecret =
  current.SOM_PRO_AUTH_SECRET && current.SOM_PRO_AUTH_SECRET !== defaultAuthSecret
    ? current.SOM_PRO_AUTH_SECRET
    : "SOM-AUTH-" + crypto.randomBytes(32).toString("hex");
const adminPassword = current.SOM_PRO_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");

for (const file of [backendEnv, rootEnv]) {
  if (!fs.existsSync(file)) continue;
  const env = readEnv(file);
  if (!env.SOM_PRO_LICENSE_SECRET || env.SOM_PRO_LICENSE_SECRET === defaultLicenseSecret) {
    upsertEnvValue(file, "SOM_PRO_LICENSE_SECRET", licenseSecret);
    success("تم تحديث:", path.relative(root, file), "بسرّ ترخيص خاص");
  }
  if (!env.SOM_PRO_AUTH_SECRET || env.SOM_PRO_AUTH_SECRET === defaultAuthSecret) {
    upsertEnvValue(file, "SOM_PRO_AUTH_SECRET", authSecret);
    success("تم تحديث:", path.relative(root, file), "بسرّ مصادقة خاص");
  }
  if (!env.SOM_PRO_ADMIN_EMAIL) upsertEnvValue(file, "SOM_PRO_ADMIN_EMAIL", "admin@sompro.local");
  if (!env.SOM_PRO_ADMIN_PASSWORD) {
    upsertEnvValue(file, "SOM_PRO_ADMIN_PASSWORD", adminPassword);
    success("تم تحديث:", path.relative(root, file), "بكلمة مرور المدير الأولى");
  }
  if (!env.SOM_PRO_LICENSE_SERVER_URL && path.basename(path.dirname(file)) === "backend") {
    upsertEnvValue(file, "SOM_PRO_LICENSE_SERVER_URL", "http://localhost:4100");
    success("تم تحديث:", path.relative(root, file), "برابط خادم الترخيص المحلي");
  }
}
