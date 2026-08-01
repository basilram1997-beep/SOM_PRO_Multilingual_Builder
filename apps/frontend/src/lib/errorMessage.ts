export function userFacingErrorMessage(error: unknown, fallback: string) {
  const hasBrokenEncoding = (value: string) => /[ï¿½Ã˜Ã™ÃƒÃ¢]/.test(value);
  const looksForbidden = (value: string) =>
    /(FORBIDDEN|forbidden|not authorized|unauthorized|permission denied|لا تملك صلاحية|غير مصرح|ممنوع)/i.test(
      value.trim()
    );

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && !hasBrokenEncoding(message) && !looksForbidden(message)) return message;
  }
  if (typeof error === "string") {
    const message = error.trim();
    if (message && !hasBrokenEncoding(message) && !looksForbidden(message)) return message;
  }
  return fallback;
}
