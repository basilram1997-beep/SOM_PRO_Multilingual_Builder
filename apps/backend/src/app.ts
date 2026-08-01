import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { teachersRouter } from "./modules/teachers/teachers.routes";
import { classesRouter } from "./modules/classes/classes.routes";
import { subjectsRouter } from "./modules/subjects/subjects.routes";
import { schedulesRouter } from "./modules/schedules/schedules.routes";
import { dailyRouter } from "./modules/daily/daily.routes";
import { archiveRouter } from "./modules/archive/archive.routes";
import { auditLogsRouter } from "./modules/auditLogs/auditLogs.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { securityIncidentsRouter } from "./modules/securityIncidents/securityIncidents.routes";
import { statsRouter } from "./modules/stats.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { homeroomRouter } from "./modules/homeroom/homeroom.routes";
import { dutiesRouter } from "./modules/duties/duties.routes";
import { lessonTodayRouter } from "./modules/lessons/today.routes";
import { homeworkRouter } from "./modules/lessons/homework.routes";
import { examsRouter } from "./modules/lessons/exams.routes";
import { schoolsRouter } from "./modules/schools/schools.routes";
import { uploadsRouter } from "./modules/uploads/uploads.routes";
import { licenseRouter } from "./modules/license/license.routes";
import { studentsRouter } from "./modules/students/students.routes";
import { authenticateRequest, requirePermission, requirePermissionForWrite } from "./middleware/auth";
import { enforceHttpsInProduction } from "./middleware/https";
import { licenseGuard } from "./middleware/licenseGuard";
import { auditTrail } from "./middleware/auditTrail";
import {
  rejectSchoolContextOverride,
  rejectUserContextOverride,
  sensitiveWriteRateLimit
} from "./middleware/requestProtections";
import { logSafeError } from "./lib/safeLog";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      hsts: env.appEnv === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
    })
  );
  app.use(enforceHttpsInProduction);
  app.use(
    cors({
      credentials: false,
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      }
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "som-backend" }));
  app.get("/api/version", (_req, res) =>
    res.json({
      data: {
        product: "SOM PRO",
        version: process.env.SOM_VERSION || "0.9.0-rc.1",
        releaseChannel: process.env.SOM_RELEASE_CHANNEL || "release-candidate",
        runtimeMode: process.env.SOM_RUNTIME_MODE || env.appEnv,
        apiEnvironment: process.env.SOM_API_ENV || env.appEnv
      },
      error: null
    })
  );
  app.use("/api/auth", authRouter);
  app.use("/api/license", licenseRouter);

  app.use(authenticateRequest);
  app.use(licenseGuard);
  app.use(auditTrail);
  app.use(rejectSchoolContextOverride);
  app.use(rejectUserContextOverride);
  app.use(sensitiveWriteRateLimit);

  app.use("/api/stats", requirePermission("read"), statsRouter);
  app.use("/api/settings", requirePermissionForWrite("manageSettings"), settingsRouter);
  app.use("/api/homeroom", requirePermissionForWrite("manageSchedules"), homeroomRouter);
  app.use("/api/duties", requirePermissionForWrite("manageSchedules"), dutiesRouter);
  app.use("/api/lessons", lessonTodayRouter);
  app.use("/api/lessons/homework", homeworkRouter);
  app.use("/api/lessons/exams", examsRouter);
  app.use("/api/uploads", requirePermissionForWrite("manageSettings"), uploadsRouter);
  app.use("/api/teachers", requirePermissionForWrite("manageTeachers"), teachersRouter);
  app.use("/api/students", requirePermission("read"), studentsRouter);
  app.use("/api/classes", requirePermissionForWrite("manageSettings"), classesRouter);
  app.use("/api/subjects", requirePermission("read"), subjectsRouter);
  app.use("/api/schedules", requirePermissionForWrite("manageSchedules"), schedulesRouter);
  app.use("/api/daily", requirePermissionForWrite("manageSchedules"), dailyRouter);
  app.use("/api/archive", requirePermission("read"), archiveRouter);
  app.use("/api/audit-logs", requirePermission("manageSettings"), auditLogsRouter);
  app.use("/api/security-incidents", requirePermission("manageSettings"), securityIncidentsRouter);
  app.use("/api/reports", requirePermission("read"), reportsRouter);
  app.use("/api/schools", requirePermissionForWrite("manageSettings"), schoolsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const error = err instanceof Error ? err : new Error("UNKNOWN_SERVER_ERROR");
    logSafeError("app.unhandled", error);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "حدث خطأ داخلي في الخادم",
      data: null
    });
  });

  return app;
}
