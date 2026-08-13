import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listSourceFiles(fullPath);
    if (!/\.(ts|tsx|js|cjs|mjs)$/.test(entry)) return [];
    if (/\.test\./.test(entry)) return [];
    return [fullPath];
  });
}

test("multi-environment architecture documents one source tree and same-origin routing", () => {
  const doc = read("../../docs/ENVIRONMENT_ARCHITECTURE.md");

  assert.match(doc, /one repository, one source tree, and one build architecture/i);
  assert.match(doc, /https:\/\/sompro\.duckdns\.org/);
  assert.match(doc, /https:\/\/app\.example\.com/);
  assert.match(doc, /\| `VITE_API_URL` \| `http:\/\/localhost:4000` for direct dev, or `\/api` with a local proxy \| `\/api` \| `\/api` \|/);
  assert.match(doc, /https:\/\/DOMAIN\/api\/\*/);
  assert.match(doc, /https:\/\/DOMAIN\/license\/\*/);
  assert.match(doc, /Do not change application source code/);
});

test("staging and production examples use same-origin web API config", () => {
  const staging = parseEnv(read("../../.env.staging.example"));
  const production = parseEnv(read("../../.env.production.example"));
  const frontendStaging = parseEnv(read("../../apps/frontend/.env.staging.example"));
  const frontendProduction = parseEnv(read("../../apps/frontend/.env.production.example"));

  assert.equal(staging.APP_URL, "https://sompro.duckdns.org");
  assert.equal(staging.PUBLIC_APP_URL, "https://sompro.duckdns.org");
  assert.equal(staging.VITE_API_URL, "/api");
  assert.equal(staging.CORS_ORIGIN, "https://sompro.duckdns.org");
  assert.equal(staging.SOM_API_URL, "https://sompro.duckdns.org/api");
  assert.equal(staging.SOM_LICENSE_SERVER_URL, "https://sompro.duckdns.org/license");

  assert.equal(production.APP_URL, "https://app.example.com");
  assert.equal(production.PUBLIC_APP_URL, "https://app.example.com");
  assert.equal(production.VITE_API_URL, "/api");
  assert.equal(production.CORS_ORIGIN, "https://app.example.com");
  assert.equal(production.SOM_API_URL, "https://app.example.com/api");
  assert.equal(production.SOM_LICENSE_SERVER_URL, "https://app.example.com/license");

  assert.equal(frontendStaging.VITE_API_URL, "/api");
  assert.equal(frontendProduction.VITE_API_URL, "/api");
});

test("frontend and reverse proxy default web deployments to /api without hard-coded deployment domains", () => {
  const frontend = read("../../apps/frontend/src/api/http.ts");
  const dockerfile = read("../../apps/frontend/Dockerfile.production");
  const compose = read("../../docker-compose.production.yml");
  const nginx = read("../../deploy/nginx/sompro.conf");

  assert.match(frontend, /const SAME_ORIGIN_API_URL = "\/api"/);
  assert.match(frontend, /return ENV_API_URL \|\| SAME_ORIGIN_API_URL/);
  assert.match(dockerfile, /ARG VITE_API_URL=\/api/);
  assert.match(compose, /VITE_API_URL:\s+\$\{VITE_API_URL:-\/api\}/);
  assert.match(nginx, /location\s+\/api\//);
  assert.match(nginx, /proxy_pass\s+http:\/\/backend:4000;/);
  assert.match(nginx, /location\s+\/license\//);
  assert.match(nginx, /proxy_pass\s+http:\/\/license-server:4100;/);

  assert.doesNotMatch(frontend, /sompro\.duckdns\.org|app\.sompro\.co\.il|app\.example\.com/);
  assert.doesNotMatch(dockerfile, /api\.your-domain\.com|sompro\.duckdns\.org|app\.sompro\.co\.il/);
});

test("application source logic does not hard-code staging or future production domains", () => {
  const sourceRoots = [
    "../../apps/frontend/src",
    "../../apps/backend/src",
    "../../apps/desktop/src",
    "../../apps/license-server/src"
  ];

  for (const root of sourceRoots) {
    for (const file of listSourceFiles(root)) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /sompro\.duckdns\.org|app\.sompro\.co\.il/i, `${file} must not hard-code deployment domains`);
    }
  }
});
