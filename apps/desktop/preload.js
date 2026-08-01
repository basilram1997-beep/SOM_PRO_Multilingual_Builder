const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const { getDesktopRuntimeConfig } = require("./src/runtimeConfig");
const { getDesktopDeviceInfo } = require("./src/desktopDevice");

function parseIni(content) {
  const data = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("[") || line.startsWith(";")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    data[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return data;
}

function readLicenseSetup() {
  const exeDir = process.execPath ? path.dirname(process.execPath) : "";
  const candidates = [
    path.join(exeDir, "license-setup.ini"),
    path.join(process.resourcesPath || "", "license-setup.ini"),
    path.join(__dirname, "license-setup.ini")
  ];

  for (const file of candidates) {
    try {
      if (!file || !fs.existsSync(file)) continue;
      const data = parseIni(fs.readFileSync(file, "utf8"));
      if (data.licenseCode) return data;
    } catch {
      // Ignore unreadable local setup files and let the app show manual activation.
    }
  }
  return null;
}

const runtimeConfig = getDesktopRuntimeConfig();
const deviceInfo = getDesktopDeviceInfo();

contextBridge.exposeInMainWorld("somDesktop", {
  appName: "SOM PRO",
  mode: runtimeConfig.mode,
  apiUrl: runtimeConfig.apiUrl,
  licenseServerUrl: runtimeConfig.licenseServerUrl,
  device: deviceInfo,
  licenseSetup: readLicenseSetup(),
  repairConnection: () => ipcRenderer.invoke("som-repair-local-services"),
  exportPdf: (fileName) => ipcRenderer.invoke("som-export-pdf", { fileName })
});
