import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

function isSecureRequest(req: Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return req.secure || forwardedProto === "https";
}

export function enforceHttpsInProduction(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production" || !env.enforceHttpsInProduction) {
    return next();
  }

  if (isSecureRequest(req)) {
    return next();
  }

  return res.status(400).json({
    error: "HTTPS_REQUIRED",
    message: "يجب الوصول إلى SOM PRO عبر HTTPS في بيئة الإنتاج."
  });
}
