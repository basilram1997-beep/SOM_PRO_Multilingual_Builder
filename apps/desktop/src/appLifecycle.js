const { app, BrowserWindow } = require("electron");
const { createWindow } = require("./window");
const { stopManagedProcesses } = require("./backendProcess");

function registerAppLifecycle() {
  app.whenReady().then(createWindow);
  app.on("before-quit", stopManagedProcesses);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

module.exports = { registerAppLifecycle };
