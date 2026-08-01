const fs = require("fs");
const path = require("path");
const { error, success } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const required = [
  ".env.production.example",
  "apps/backend/.env.production.example",
  "apps/license-server/.env.production.example",
  "apps/frontend/.env.production.example",
  "apps/desktop/.env.saas.production.example",
  "docker-compose.production.yml",
  "apps/backend/Dockerfile.production",
  "apps/license-server/Dockerfile.production",
  "apps/frontend/Dockerfile.production",
  "deploy/nginx/sompro.conf",
  "deploy/nginx/frontend.conf",
  "deploy/scripts/backup-postgres.sh",
  "deploy/scripts/restore-postgres.sh",
  "deploy/scripts/backup-license-data.sh",
  "deploy/scripts/rotate-backups.sh",
  "docs/PRODUCTION_DEPLOYMENT_GUIDE_AR.md",
  "docs/MONITORING_AND_HEALTHCHECKS_AR.md",
  "docs/PRODUCTION_SECURITY_CHECKLIST_AR.md",
  "docs/PHASE_7_PRODUCTION_READINESS_REPORT.md"
];
const forbidden = [
  /SOM-OWNER-[A-Z0-9]+/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /postgresql:\/\/[^\s:]+:[^\s@]*(?:password123|som_password)[^\s@]*@/i
];

let ok = true;
for (const file of required) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) success("موجود:", file);
  else {
    error("غير موجود:", file);
    ok = false;
  }
}

const scanFiles = required.filter((file) => fs.existsSync(path.join(root, file)));
for (const file of scanFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) {
      error("نمط حساس محتمل:", file, pattern.toString());
      ok = false;
    }
  }
}

process.exit(ok ? 0 : 1);
