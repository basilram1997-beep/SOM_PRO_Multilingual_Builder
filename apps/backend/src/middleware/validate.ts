import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { sendErrorResponse } from "../lib/httpResponses";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return sendErrorResponse(res, 400, "VALIDATION_ERROR", "بيانات الطلب غير صالحة", {
        details: result.error.flatten()
      });
    }
    req.body = result.data;
    next();
  };
}
