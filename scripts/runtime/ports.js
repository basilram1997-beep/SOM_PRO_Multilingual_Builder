const net = require("node:net");

function waitForTcp(host, port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.once("connect", () => {
        cleanup();
        resolve();
      });

      const retry = () => {
        cleanup();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 1000);
      };

      socket.once("error", retry);
      socket.once("timeout", retry);
    };

    tryConnect();
  });
}

async function isTcpReachable(host, port, timeoutMs = 1000) {
  try {
    await waitForTcp(host, port, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

async function assertLocalService({ name, host, port, timeoutMs, hint }) {
  try {
    await waitForTcp(host, port, timeoutMs);
  } catch (failure) {
    const suffix = hint ? ` ${hint}` : "";
    throw new Error(`${name} is not reachable at ${host}:${port}.${suffix}`, { cause: failure });
  }
}

async function assertTcpPortFree({ name, host, port }) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();

    const cleanup = () => {
      server.removeAllListeners();
      server.close(() => null);
    };

    server.once("error", (failure) => {
      cleanup();
      if (failure?.code === "EADDRINUSE") {
        reject(new Error(`${name} port ${host}:${port} is already in use. Stop the old E2E service before retrying.`));
        return;
      }
      reject(failure);
    });

    server.once("listening", () => {
      cleanup();
      resolve();
    });

    server.listen(port, host);
  });
}

module.exports = {
  assertLocalService,
  assertTcpPortFree,
  isTcpReachable,
  waitForTcp
};
