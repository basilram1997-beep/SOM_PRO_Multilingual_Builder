const fs = require("fs");
const path = require("path");
const electron = require("electron");

const VALID_RUNTIME_MODES = new Set(["development", "local-trial", "saas"]);
const DEFAULT_LOCAL_API_URL = "http://localhost:4000";
const DEFAULT_LOCAL_APP_URL = "http://localhost:5173";
const DEFAULT_LOCAL_LICENSE_SERVER_URL = "http://localhost:4100";

function parseEnvFile(file) {
  const values = {};
  try {
    if (!file || !fs.existsSync(file)) return values;
    for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  } catch {
    return values;
  }
  return values;
}

function configFileCandidates() {
  const app = electron.app || { isPackaged: false };
  const exeDir = process.execPath ? path.dirname(process.execPath) : "";
  return [
    process.env.SOM_RUNTIME_CONFIG,
    path.join(exeDir, "som-pro-runtime.env"),
    path.join(process.resourcesPath || "", "som-pro-runtime.env"),
    path.resolve(__dirname, "..", "som-pro-runtime.env"),
    app.isPackaged ? "" : path.resolve(__dirname, "..", "..", "..", ".env")
  ].filter(Boolean);
}

function readRuntimeFileConfig() {
  return configFileCandidates().reduce((merged, file) => ({ ...merged, ...parseEnvFile(file) }), {});
}

function normalizeRuntimeMode(mode, packaged = false) {
  const candidate = String(mode || "")
    .trim()
    .toLowerCase();
  if (VALID_RUNTIME_MODES.has(candidate)) return candidate;
  return packaged ? "local-trial" : "development";
}

function getDesktopRuntimeConfig() {
  const app = electron.app || { isPackaged: false };
  const fileConfig = readRuntimeFileConfig();
  const requestedMode = process.env.SOM_RUNTIME_MODE || fileConfig.SOM_RUNTIME_MODE;
  const mode = app.isPackaged ? normalizeRuntimeMode(requestedMode, true) : "local-trial";
  const isSaas = mode === "saas";
  const candidateApiUrl =
    process.env.SOM_API_URL ||
    process.env.VITE_API_URL ||
    fileConfig.SOM_API_URL ||
    fileConfig.VITE_API_URL ||
    DEFAULT_LOCAL_API_URL;
  const candidateAppUrl = process.env.SOM_PRO_APP_URL || fileConfig.SOM_PRO_APP_URL || DEFAULT_LOCAL_APP_URL;
  const candidateLicenseServerUrl =
    process.env.SOM_LICENSE_SERVER_URL ||
    process.env.SOM_PRO_LICENSE_SERVER_URL ||
    fileConfig.SOM_LICENSE_SERVER_URL ||
    fileConfig.SOM_PRO_LICENSE_SERVER_URL ||
    DEFAULT_LOCAL_LICENSE_SERVER_URL;
  const localApiUrl = DEFAULT_LOCAL_API_URL;
  const localAppUrl = DEFAULT_LOCAL_APP_URL;
  const localLicenseServerUrl = DEFAULT_LOCAL_LICENSE_SERVER_URL;
  const apiUrl = isSaas ? candidateApiUrl : localApiUrl;
  const appUrl = isSaas ? candidateAppUrl : localAppUrl;
  const licenseServerUrl = isSaas ? candidateLicenseServerUrl : localLicenseServerUrl;

  return {
    mode,
    isSaas,
    apiUrl,
    appUrl,
    licenseServerUrl
  };
}

module.exports = {
  DEFAULT_LOCAL_API_URL,
  DEFAULT_LOCAL_APP_URL,
  DEFAULT_LOCAL_LICENSE_SERVER_URL,
  VALID_RUNTIME_MODES,
  getDesktopRuntimeConfig,
  normalizeRuntimeMode
};
