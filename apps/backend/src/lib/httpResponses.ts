import type { Response } from "express";

type ApiErrorDetails = Record<string, unknown>;

export function sendErrorResponse(
  res: Response,
  status: number,
  error: string,
  message: string,
  details: ApiErrorDetails = {}
) {
  return res.status(status).json({
    error,
    message,
    data: null,
    ...details
  });
}
