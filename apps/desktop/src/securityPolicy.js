function parseUrl(value) {
  try {
    return new URL(String(value || ""));
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname || "").toLowerCase());
}

function originOf(value) {
  const parsed = parseUrl(value);
  return parsed ? parsed.origin : null;
}

function configuredOrigins(runtimeConfig, extraOrigins = []) {
  return [
    runtimeConfig?.appUrl,
    runtimeConfig?.apiUrl,
    runtimeConfig?.licenseServerUrl,
    ...extraOrigins
  ]
    .map(originOf)
    .filter(Boolean);
}

function envExternalOrigins() {
  return String(process.env.SOM_DESKTOP_EXTERNAL_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isTrustedNavigationUrl(value, runtimeConfig) {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  if (parsed.protocol === "file:") return true;

  if (!runtimeConfig?.isSaas && ["http:", "https:"].includes(parsed.protocol) && isLoopbackHost(parsed.hostname)) {
    return true;
  }

  if (runtimeConfig?.isSaas) {
    return parsed.protocol === "https:" && parsed.origin === originOf(runtimeConfig.appUrl);
  }

  return configuredOrigins(runtimeConfig).includes(parsed.origin);
}

function isAllowedExternalUrl(value, runtimeConfig) {
  const parsed = parseUrl(value);
  if (!parsed || parsed.protocol !== "https:") return false;
  if (isLoopbackHost(parsed.hostname)) return false;
  return configuredOrigins(runtimeConfig, envExternalOrigins()).includes(parsed.origin);
}

module.exports = {
  configuredOrigins,
  isAllowedExternalUrl,
  isLoopbackHost,
  isTrustedNavigationUrl,
  originOf
};
