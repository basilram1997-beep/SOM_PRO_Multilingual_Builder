import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

test("DuckDNS staging deployment docs preserve router, env, and evidence steps", () => {
  const doc = read("../../docs/DUCKDNS_STAGING_DEPLOYMENT.md");

  assert.match(doc, /sompro\.duckdns\.org/);
  assert.match(doc, /10\.0\.0\.5:80/);
  assert.match(doc, /10\.0\.0\.5:443/);
  assert.match(doc, /npm run staging:prepare-duckdns/);
  assert.match(doc, /npm run staging:diagnose-duckdns/);
  assert.match(doc, /VITE_API_URL`\s+\|\s+`\/api`/);
  assert.match(doc, /--profile certbot run --rm --service-ports certbot/);
  assert.match(doc, /--cert-name sompro/);
  assert.match(doc, /docker compose --env-file \.env\.production -f docker-compose\.production\.yml up -d --build/);
  assert.match(doc, /STAGING_URL=https:\/\/sompro\.duckdns\.org npm run security:staging-evidence/);
  assert.match(doc, /ZAP_USE_DOCKER=true npm run security:dast/);
});

test("DuckDNS staging preparation script writes ignored env files without fixed secrets", () => {
  const script = read("../../scripts/runtime/prepare-duckdns-staging-env.js");
  const gitignore = read("../../.gitignore");
  const packageJson = read("../../package.json");

  assert.match(script, /SOM_STAGING_DOMAIN \|\| "sompro\.duckdns\.org"/);
  assert.match(script, /crypto\.randomBytes/);
  assert.match(script, /--env-file \.env\.production/);
  assert.match(script, /VITE_API_URL", "\/api"/);
  assert.match(script, /SOM_API_URL", apiUrl/);
  assert.match(script, /SOM_LICENSE_SERVER_URL", licenseUrl/);
  assert.doesNotMatch(script, /change-me-long-random|CHANGE_ME|password123/i);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^apps\/\*\/\.env\.\*$/m);
  assert.match(packageJson, /"staging:prepare-duckdns": "node scripts\/runtime\/prepare-duckdns-staging-env\.js"/);
  assert.match(packageJson, /"staging:diagnose-duckdns": "node scripts\/runtime\/duckdns-staging-diagnose\.js"/);
});
