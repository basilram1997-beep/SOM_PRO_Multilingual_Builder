import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { logSafeError } from "./lib/safeLog";
import { startProductBackupScheduler } from "./services/productBackupScheduler";
import { repairLocalSchoolColumns } from "./services/schemaRepair";
import type { Server } from "node:http";

let shutdownRegistered = false;

function registerShutdown(server: Server) {
  if (shutdownRegistered) {
    return;
  }

  shutdownRegistered = true;

  let shuttingDown = false;
  const closeServer = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await prisma.$disconnect();
  };

  const terminate = (signal: NodeJS.Signals) => {
    void closeServer()
      .catch((error) => {
        logSafeError(`server.shutdown.${signal}`, error);
      })
      .finally(() => {
        process.exit(0);
      });
  };

  process.once("SIGINT", () => terminate("SIGINT"));
  process.once("SIGTERM", () => terminate("SIGTERM"));
}

async function bootstrap() {
  await repairLocalSchoolColumns();
  await prisma.$connect();
  const app = createApp();
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.port, () => {
      resolve();
    });

    server.once("error", (error) => {
      reject(error);
    });

    registerShutdown(server);
  });
  startProductBackupScheduler();
}

bootstrap().catch((error) => {
  logSafeError("server.bootstrap", error);
  process.exitCode = 1;
});
