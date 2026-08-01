type SafeErrorLike = {
  name?: string;
  code?: string | number;
};

export function logSafeError(scope: string, error: unknown) {
  if (error && typeof error === "object") {
    const safeError = error as SafeErrorLike;
    const details: Record<string, unknown> = {};
    if (safeError.name) details.name = safeError.name;
    if (safeError.code !== undefined) details.code = safeError.code;
    console.error(scope, details);
    return;
  }

  console.error(scope);
}
