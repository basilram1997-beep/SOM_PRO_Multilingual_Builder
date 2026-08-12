import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
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

function assertHttps(value: string, label: string) {
  assert.doesNotThrow(() => new URL(value), `${label} must be a valid URL`);
  assert.equal(new URL(value).protocol, "https:", `${label} must use HTTPS`);
}

test("production nginx enforces HTTPS, HSTS, and reverse proxy security headers", () => {
  const nginx = read("../../deploy/nginx/sompro.conf");

  assert.match(nginx, /listen\s+80\s+default_server;/, "nginx should keep an HTTP listener for redirects");
  assert.match(nginx, /return\s+301\s+https:\/\/\$host\$request_uri;/, "HTTP traffic should redirect to HTTPS");
  assert.match(nginx, /listen\s+443\s+ssl\s+http2\s+default_server;/, "nginx should expose a TLS server block");
  assert.match(nginx, /ssl_certificate\s+\/etc\/letsencrypt\/live\/sompro\/fullchain\.pem;/, "TLS certificate path should be mounted");
  assert.match(nginx, /ssl_certificate_key\s+\/etc\/letsencrypt\/live\/sompro\/privkey\.pem;/, "TLS key path should be mounted");
  assert.match(nginx, /Strict-Transport-Security\s+"max-age=31536000; includeSubDomains; preload"\s+always;/, "HSTS should be enabled for production");
  assert.match(nginx, /X-Content-Type-Options\s+"nosniff"\s+always;/, "nosniff should be sent at the edge");
  assert.match(nginx, /X-Frame-Options\s+"DENY"\s+always;/, "clickjacking protection should be sent at the edge");
  assert.match(nginx, /Referrer-Policy\s+"strict-origin-when-cross-origin"\s+always;/, "referrer policy should be sent at the edge");
  assert.match(nginx, /proxy_set_header\s+X-Forwarded-Proto\s+https;/, "backend should see the original HTTPS scheme");
  assert.match(nginx, /resolver\s+127\.0\.0\.11/, "Docker DNS should be configured for variable upstream proxying");

  assert.doesNotMatch(nginx, /HTTPS placeholder|TODO\s+HTTPS|your-domain\.com/i, "nginx must not ship placeholder HTTPS config");
});

test("production compose exposes HTTPS and fails closed on placeholder API origins", () => {
  const compose = read("../../docker-compose.production.yml");

  assert.match(compose, /-\s+"80:80"/, "compose should expose HTTP for redirect and ACME challenge");
  assert.match(compose, /-\s+"443:443"/, "compose should expose HTTPS");
  assert.match(compose, /https:\/\/127\.0\.0\.1\/healthz/, "nginx healthcheck should exercise the HTTPS endpoint");
  assert.match(compose, /VITE_API_URL:\s+\$\{VITE_API_URL:\?set VITE_API_URL to the public HTTPS API origin\}/, "frontend build should require explicit API URL");
  assert.doesNotMatch(compose, /https:\/\/api\.your-domain\.com/i, "compose must not fallback to a placeholder production API");
});

test("staging environment examples require HTTPS public URLs and avoid local placeholders", () => {
  const rootEnv = parseEnv(read("../../.env.staging.example"));
  const backendEnv = parseEnv(read(".env.staging.example"));
  const urlKeys = ["VITE_API_URL", "SOM_API_URL", "SOM_LICENSE_SERVER_URL", "CORS_ORIGIN"];

  for (const key of urlKeys) {
    assertHttps(rootEnv[key], `root ${key}`);
    assert.doesNotMatch(rootEnv[key], /localhost|127\.0\.0\.1|your-domain/i, `root ${key} should not be local or a legacy placeholder`);
  }

  for (const key of ["CORS_ORIGIN", "SOM_LICENSE_SERVER_URL"]) {
    assertHttps(backendEnv[key], `backend ${key}`);
    assert.doesNotMatch(backendEnv[key], /localhost|127\.0\.0\.1|your-domain/i, `backend ${key} should not be local or a legacy placeholder`);
  }

  assert.equal(rootEnv.NODE_ENV, "production");
  assert.equal(rootEnv.SOM_RUNTIME_MODE, "saas");
  assert.equal(backendEnv.NODE_ENV, "production");
  assert.equal(backendEnv.SOM_RUNTIME_MODE, "saas");
});

test("staging smoke script validates HTTPS, TLS config, and real env secret replacement", () => {
  const script = read("../../scripts/staging-check.js");

  assert.match(script, /actualEnvPath/, "script should inspect a real .env.staging when present");
  assert.match(script, /function isHttpsUrl/, "script should parse URLs instead of string-prefix guessing");
  assert.match(script, /function hasPlaceholder/, "script should centralize placeholder detection");
  assert.match(script, /listen\\s\+443\\s\+ssl\\s\+http2\\s\+default_server/, "script should verify nginx 443");
  assert.match(script, /nginx redirects HTTP to HTTPS/, "script should verify HTTP to HTTPS redirect");
  assert.match(script, /Strict-Transport-Security/, "script should verify HSTS");
  assert.match(script, /nginx healthcheck uses HTTPS health endpoint/, "script should verify HTTPS healthcheck");
  assert.match(script, /example\\\.invalid/, "script should fail real .env.staging when example placeholder domains remain");
  assert.match(script, /JWT_SECRET.*real staging secret/s, "script should reject placeholder staging secrets");
});
