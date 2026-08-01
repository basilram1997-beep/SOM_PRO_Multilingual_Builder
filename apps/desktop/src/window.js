const path = require("path");
const fs = require("fs/promises");
const { BrowserWindow, shell, ipcMain, dialog } = require("electron");
const { DEFAULT_WEB_URL, waitForUrl, bundledWebIndex, desktopRoot, runtimeConfig } = require("./paths");
const { ensureLocalBackend } = require("./backendProcess");

function isLocalOrLoopbackUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function loadBestAvailableApp(win) {
  const localIndex = bundledWebIndex();
  const { app } = require("electron");

  if (runtimeConfig.isSaas) {
    if (DEFAULT_WEB_URL && !isLocalOrLoopbackUrl(DEFAULT_WEB_URL)) {
      const webReady = await waitForUrl(DEFAULT_WEB_URL, app.isPackaged ? 6 : 10);
      if (webReady) {
        try {
          await win.loadURL(DEFAULT_WEB_URL + "?desktop=1&t=" + Date.now());
          return;
        } catch {
          // Fall through to the local failure page only.
        }
      }
    }

    await win.loadFile(path.join(desktopRoot(), "offline.html"));
    return;
  }

  if (app.isPackaged && localIndex && !process.env.SOM_PRO_APP_URL) {
    await win.loadFile(localIndex, { query: { desktop: "1" } });
    return;
  }

  const webReady = await waitForUrl(DEFAULT_WEB_URL, app.isPackaged ? 2 : 6);
  if (webReady) {
    try {
      await win.loadURL(DEFAULT_WEB_URL + "?desktop=1&t=" + Date.now());
      return;
    } catch {
      // Fall through to bundled web build.
    }
  }

  if (localIndex) {
    await win.loadFile(localIndex, { query: { desktop: "1" } });
    return;
  }

  await win.loadFile(path.join(desktopRoot(), "offline.html"));
}

async function waitForLocalBackend(retries = 1, pauseMs = 8000) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ready = await ensureLocalBackend().catch(() => false);
    if (ready) return true;
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
  return false;
}

async function createWindow() {
  const root = desktopRoot();
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    title: "SOM PRO",
    autoHideMenuBar: true,
    icon: path.join(root, "icon.ico"),
    show: false,
    backgroundColor: "#f6f7fb",
    webPreferences: {
      preload: path.join(root, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(root, "loading.html"));
  win.show();

  ipcMain.removeHandler("som-repair-local-services");
  ipcMain.handle("som-repair-local-services", async () => {
    const ready = runtimeConfig.isSaas ? true : await waitForLocalBackend(1, 8000);
    if (ready) await loadBestAvailableApp(win);
    return { ok: ready };
  });
  win.on("closed", () => ipcMain.removeHandler("som-repair-local-services"));

  ipcMain.removeHandler("som-export-pdf");
  ipcMain.handle("som-export-pdf", async (event, options = {}) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    if (!sourceWindow) {
      return { ok: false, error: "NO_ACTIVE_WINDOW" };
    }

    const defaultName = String(options.fileName || "SOM-PRO-export.pdf").replace(/[\\/:*?"<>|]+/g, "-");
    const { canceled, filePath } = await dialog.showSaveDialog(sourceWindow, {
      defaultPath: defaultName.toLowerCase().endsWith(".pdf") ? defaultName : `${defaultName}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    const pdfBuffer = await sourceWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      marginsType: 0
    });
    await fs.writeFile(filePath, pdfBuffer);
    return { ok: true, filePath };
  });
  win.on("closed", () => ipcMain.removeHandler("som-export-pdf"));

  const backendReady = runtimeConfig.isSaas ? true : await waitForLocalBackend(1, 8000);
  if (!backendReady) {
    await win.loadFile(path.join(root, "offline.html"));
    return;
  }

  await loadBestAvailableApp(win);

  if (!runtimeConfig.isSaas) {
    const localBackendMonitor = setInterval(() => {
      ensureLocalBackend().catch(() => null);
    }, 30000);
    win.on("closed", () => clearInterval(localBackendMonitor));
  }

  win.webContents.on("did-fail-load", async () => {
    if (runtimeConfig.isSaas) {
      await win.loadFile(path.join(root, "offline.html"));
      return;
    }

    const localIndex = bundledWebIndex();
    if (localIndex) await win.loadFile(localIndex, { query: { desktop: "1" } });
    else await win.loadFile(path.join(root, "offline.html"));
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

module.exports = { createWindow };
