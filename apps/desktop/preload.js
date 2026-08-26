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

function saveLicenseSetup(setup) {
  return ipcRenderer.invoke("som-save-license-setup", setup || {}).then((result) => {
    if (result?.ok) {
      desktopState.licenseSetup = {
        ...(desktopState.licenseSetup || {}),
        ...(setup || {})
      };
    }
    return result;
  });
}

const data = bridgeData();
const desktopState = {
  appName: "SOM PRO",
  mode: data.mode,
  apiUrl: data.apiUrl,
  licenseServerUrl: data.licenseServerUrl,
  device: data.device || null,
  licenseSetup: data.licenseSetup || null
};

contextBridge.exposeInMainWorld(
  "somDesktop",
  Object.freeze({
    appName: desktopState.appName,
    mode: desktopState.mode,
    apiUrl: desktopState.apiUrl,
    licenseServerUrl: desktopState.licenseServerUrl,
    device: desktopState.device,
    get licenseSetup() {
      return desktopState.licenseSetup;
    },
    saveLicenseSetup,
    repairConnection: () => ipcRenderer.invoke("som-repair-local-services"),
    exportPdf: (fileName) => ipcRenderer.invoke("som-export-pdf", { fileName: safeFileName(fileName) })
  })
);
