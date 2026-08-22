#!/usr/bin/env node

const { spawnSync } = require("child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("fs");
const { dirname, resolve } = require("path");

const repoRoot = resolve(__dirname, "..", "..");
const exampleConfigPath = resolve(repoRoot, "deploy", "cloudflare", "sompro-staging.tunnel.example.yml");
const localConfigPath = resolve(repoRoot, "deploy", "cloudflare", "sompro-staging.tunnel.yml");

const args = new Set(process.argv.slice(2));

function print(line = "") {
  process.stdout.write(`${line}\n`);
}

function fail(message) {
  process.stderr.write(`[SOM PRO] ${message}\n`);
  process.exitCode = 1;
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
}

function assertRealHostname(hostname) {
  if (!hostname) {
    throw new Error("SOM_CLOUDFLARE_TUNNEL_HOSTNAME is required, for example staging.example.com");
  }
  if (
    /^(localhost|127\.0\.0\.1)$/i.test(hostname) ||
    /(^|\.)example\.(com|invalid)$/i.test(hostname) ||
    /trycloudflare\.com$/i.test(hostname) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    throw new Error(
      "SOM_CLOUDFLARE_TUNNEL_HOSTNAME must be a stable owned hostname, not localhost, IP, placeholder, or trycloudflare.com"
    );
  }
}

function renderConfig() {
  const hostname = normalizeHostname(process.env.SOM_CLOUDFLARE_TUNNEL_HOSTNAME);
  assertRealHostname(hostname);

  const tunnelName = process.env.SOM_CLOUDFLARE_TUNNEL_NAME || "sompro-staging";
  const credentialsFile = process.env.SOM_CLOUDFLARE_CREDENTIALS_FILE || "C:\\secure\\cloudflared\\sompro-staging.json";
  const service = process.env.SOM_CLOUDFLARE_TUNNEL_SERVICE || "http://127.0.0.1:8080";

  return [
    "# Generated local Cloudflare Tunnel config. Do not commit this file.",
    `tunnel: ${tunnelName}`,
    `credentials-file: ${credentialsFile}`,
    "",
    "ingress:",
    `  - hostname: ${hostname}`,
    `    service: ${service}`,
    "  - service: http_status:404",
    ""
  ].join("\n");
}

function runCheck() {
  const cloudflared = commandExists("cloudflared");
  const docker = commandExists("docker");
  const example = readFileSync(exampleConfigPath, "utf8");

  print("[SOM PRO] Cloudflare Tunnel operator check");
  print(`cloudflared: ${cloudflared.ok ? "FOUND" : "MISSING"}`);
  if (cloudflared.output) print(`cloudflared version: ${cloudflared.output.split(/\r?\n/)[0]}`);
  print(`docker: ${docker.ok ? "FOUND" : "MISSING"}`);
  if (docker.output) print(`docker version: ${docker.output.split(/\r?\n/)[0]}`);
  print(`example config: ${exampleConfigPath}`);
  print(`local config target: ${localConfigPath}`);

  if (!example.includes("staging.example.com") || !example.includes("http://127.0.0.1:8080")) {
    fail("Example Cloudflare tunnel config lost its safe placeholder or local proxy service");
    return;
  }

  if (!cloudflared.ok && !docker.ok) {
    fail("Install cloudflared or Docker before running a tunnel");
  }
}

function writeConfig() {
  let config;
  try {
    config = renderConfig();
  } catch (error) {
    fail(error.message);
    return;
  }

  mkdirSync(dirname(localConfigPath), { recursive: true });
  writeFileSync(localConfigPath, config, { encoding: "utf8", flag: "wx" });
  print(`[SOM PRO] Wrote local untracked config: ${localConfigPath}`);
}

if (args.has("--write-config")) {
  writeConfig();
} else {
  runCheck();
}
