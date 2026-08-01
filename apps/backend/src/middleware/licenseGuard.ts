import type { Request, Response, NextFunction } from "express";
import { getLicenseState } from "../services/licenseService";
import { getRequestDeviceInfo } from "../services/deviceContext";

const publicPaths = ["/health", "/api/license/status", "/api/license/activate"];
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LICENSE_STATUS_HEADER = "X-SOM-License-Status";
const LICENSE_READ_ONLY_HEADER = "X-SOM-License-Read-Only";
const LICENSE_READ_ONLY_MESSAGE = "الترخيص لا يسمح بالتعديل الآن";

export async function licenseGuard(req: Request, res: Response, next: NextFunction) {
  if (publicPaths.includes(req.path)) return next();
  const state = await getLicenseState(req.user?.schoolId, getRequestDeviceInfo(req));
  res.setHeader(LICENSE_STATUS_HEADER, state.status);
  res.setHeader(LICENSE_READ_ONLY_HEADER, String(state.readOnly));

  if (state.readOnly && writeMethods.has(req.method)) {
    return res.status(402).json({
      error: "LICENSE_READ_ONLY",
      message: state.readOnlyReason || LICENSE_READ_ONLY_MESSAGE,
      license: state
    });
  }

  return next();
}
