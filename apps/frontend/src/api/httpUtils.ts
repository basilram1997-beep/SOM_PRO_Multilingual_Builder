type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
};

function looksBrokenEncoding(value: string) {
  return /[�ØÙÃâ]/.test(value);
}

function looksTechnicalErrorMessage(message: string) {
  return /(stack trace|internal server error|prisma|sql|query failed|syntaxerror|referenceerror|typeerror|ecconn|eaddrinuse|enoent|eperm|exception|uncaught|at\s+\S+:\d+)/i.test(
    message
  );
}

function looksForbiddenMessage(message: string) {
  return /(FORBIDDEN|forbidden|not authorized|unauthorized|permission denied|لا تملك صلاحية|غير مصرح|ممنوع)/i.test(
    message.trim()
  );
}

export async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;

  const text = await response.text();
  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    const message = payload.trim();
    if (
      message &&
      !looksBrokenEncoding(message) &&
      !looksTechnicalErrorMessage(message) &&
      !looksForbiddenMessage(message)
    )
      return message;
  }
  if (!payload || typeof payload !== "object") return fallback;

  const body = payload as ApiErrorPayload;
  if (typeof body.message === "string" && body.message.trim()) {
    const message = body.message.trim();
    if (!looksTechnicalErrorMessage(message) && !looksBrokenEncoding(message) && !looksForbiddenMessage(message))
      return message;
  }
  if (typeof body.error === "string" && body.error.trim()) {
    const error = body.error.trim();
    if (!looksTechnicalErrorMessage(error) && !looksBrokenEncoding(error) && !looksForbiddenMessage(error))
      return error;
  }
  return fallback;
}

export function isLocalApiUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}
