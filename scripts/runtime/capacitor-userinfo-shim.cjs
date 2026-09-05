const os = require("node:os");

const fallbackShell = process.platform === "win32" ? process.env.COMSPEC || "cmd.exe" : process.env.SHELL || "/bin/sh";
const fallbackHome = process.env.HOME || process.env.USERPROFILE || process.cwd();

if (typeof os.userInfo === "function") {
  const originalUserInfo = os.userInfo.bind(os);
  os.userInfo = function userInfoPatched(options) {
    try {
      return originalUserInfo(options);
    } catch {
      return {
        uid: 0,
        gid: 0,
        username: process.env.USERNAME || process.env.USER || "codex",
        homedir: fallbackHome,
        shell: fallbackShell
      };
    }
  };
}
