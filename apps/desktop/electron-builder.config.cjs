const path = require("path");
const codesignEnabled = String(process.env.SOM_ENABLE_CODESIGN || "").toLowerCase() === "true";

module.exports = {
  appId: "com.sompro.desktop",
  productName: "SOM PRO",
  artifactName: "SOM-PRO-Setup-${version}.${ext}",
  directories: {
    output: "release"
  },
  electronDist: path.join(__dirname, "..", "..", "node_modules", "electron", "dist"),
  files: ["preload.js", "offline.html", "loading.html", "package.json", "icon.ico", "src/**/*", "som-pro-runtime.env"],
  win: {
    target: ["nsis"],
    icon: "icon.ico",
    signExecutable: codesignEnabled
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "SOM PRO",
    installerIcon: "icon.ico",
    uninstallerIcon: "icon.ico",
    include: "installer.nsh",
    warningsAsErrors: true,
    installerSidebar: "build/sompro-sidebar.bmp",
    uninstallerSidebar: "build/sompro-sidebar.bmp"
  },
  extraResources: [
    {
      from: "../frontend/dist",
      to: "web"
    }
  ],
  compression: "store"
};
