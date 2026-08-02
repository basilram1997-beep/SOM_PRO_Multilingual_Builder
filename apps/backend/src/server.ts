import { createApp } from "./app";
import { env } from "./config/env";
import { logSafeError } from "./lib/safeLog";
import { startProductBackupScheduler } from "./services/productBackupScheduler";
import { repairLocalSchoolColumns } from "./services/schemaRepair";

async function bootstrap() {
  await repairLocalSchoolColumns();
  const app = createApp();
  app.listen(env.port);
  startProductBackupScheduler();
}

bootstrap().catch((error) => {
  logSafeError("server.bootstrap", error);
  process.exitCode = 1;
});
