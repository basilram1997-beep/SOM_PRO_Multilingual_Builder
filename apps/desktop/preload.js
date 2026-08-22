const { contextBridge, ipcRenderer } = require("electron");

function bridgeData() {
  try {
    return ipcRenderer.sendSync("som-desktop-bridge-data") || {};
  } catch {
    return {};
  }
}

function safeFileName(value) {
  return String(value || "SOM-PRO-export.pdf")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .slice(0, 160);
}

const data = bridgeData();

contextBridge.exposeInMainWorld(
  "somDesktop",
  Object.freeze({
    appName: "SOM PRO",
    mode: data.mode,
    apiUrl: data.apiUrl,
    licenseServerUrl: data.licenseServerUrl,
    device: data.device || null,
    licenseSetup: data.licenseSetup || null,
    repairConnection: () => ipcRenderer.invoke("som-repair-local-services"),
    exportPdf: (fileName) => ipcRenderer.invoke("som-export-pdf", { fileName: safeFileName(fileName) })
  })
);
