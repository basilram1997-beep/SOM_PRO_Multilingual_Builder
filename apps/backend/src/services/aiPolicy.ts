export type AiContentFindingType =
  "prompt_injection" | "sensitive_data" | "unsafe_html" | "length_limit" | "outside_allowed_processing";

export type AiSafetyFinding = {
  type: AiContentFindingType;
  message: string;
};

export type AiPolicyConfig = {
  enabled: boolean;
  noTraining: boolean;
  contentFilters: boolean;
  storeHistory: boolean;
  historyEncrypted: boolean;
  outputMonitoring: boolean;
  allowExternalProcessing: boolean;
  restrictExternalStorageToIsrael: boolean;
  dataResidency: string;
  promptMaxChars: number;
  outputMaxChars: number;
  historyMaxChars: number;
};

const DEFAULT_CONFIG: AiPolicyConfig = {
  enabled: false,
  noTraining: true,
  contentFilters: true,
  storeHistory: false,
  historyEncrypted: true,
  outputMonitoring: true,
  allowExternalProcessing: false,
  restrictExternalStorageToIsrael: true,
  dataResidency: "IL",
  promptMaxChars: 4000,
  outputMaxChars: 2000,
  historyMaxChars: 25000
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|any|the) previous instructions/i,
  /reveal (the )?(system|developer|hidden) prompt/i,
  /jailbreak/i,
  /bypass safety/i,
  /do not follow/i,
  /act as if/i
];

const SENSITIVE_DATA_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[-_ ]?key/i,
  /credit card/i,
  /national id/i,
  /identity number/i,
  /medical record/i
];

const HTML_PATTERNS = [/<script[\s>]/i, /<\/?[a-z][\s\S]*>/i];

function readBoolean(envValue: string | undefined, defaultValue: boolean) {
  if (envValue === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(envValue.trim().toLowerCase());
}

function readPositiveInteger(envValue: string | undefined, defaultValue: number) {
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.floor(parsed);
}

export function loadAiPolicyConfig(env: NodeJS.ProcessEnv = process.env): AiPolicyConfig {
  return {
    enabled: readBoolean(env.SOM_AI_ENABLED, DEFAULT_CONFIG.enabled),
    noTraining: readBoolean(env.SOM_AI_NO_TRAINING, DEFAULT_CONFIG.noTraining),
    contentFilters: readBoolean(env.SOM_AI_CONTENT_FILTERS, DEFAULT_CONFIG.contentFilters),
    storeHistory: readBoolean(env.SOM_AI_STORE_HISTORY, DEFAULT_CONFIG.storeHistory),
    historyEncrypted: readBoolean(env.SOM_AI_HISTORY_ENCRYPTED, DEFAULT_CONFIG.historyEncrypted),
    outputMonitoring: readBoolean(env.SOM_AI_OUTPUT_MONITORING, DEFAULT_CONFIG.outputMonitoring),
    allowExternalProcessing: readBoolean(env.SOM_AI_ALLOW_EXTERNAL_PROCESSING, DEFAULT_CONFIG.allowExternalProcessing),
    restrictExternalStorageToIsrael: readBoolean(
      env.SOM_AI_RESTRICT_EXTERNAL_STORAGE_TO_ISRAEL,
      DEFAULT_CONFIG.restrictExternalStorageToIsrael
    ),
    dataResidency: (env.SOM_AI_DATA_RESIDENCY || DEFAULT_CONFIG.dataResidency).trim().toUpperCase(),
    promptMaxChars: readPositiveInteger(env.SOM_AI_PROMPT_MAX_CHARS, DEFAULT_CONFIG.promptMaxChars),
    outputMaxChars: readPositiveInteger(env.SOM_AI_OUTPUT_MAX_CHARS, DEFAULT_CONFIG.outputMaxChars),
    historyMaxChars: readPositiveInteger(env.SOM_AI_HISTORY_MAX_CHARS, DEFAULT_CONFIG.historyMaxChars)
  };
}

export function scanAiContent(
  input: string,
  config: AiPolicyConfig = loadAiPolicyConfig(),
  maxChars = config.promptMaxChars
) {
  const findings: AiSafetyFinding[] = [];
  const text = input.trim();

  if (text.length > maxChars) {
    findings.push({
      type: "length_limit",
      message: `النص يتجاوز الحد المسموح به (${maxChars} حرفًا)`
    });
  }

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text))) {
    findings.push({
      type: "prompt_injection",
      message: "يحتوي النص على مؤشرات توجيه أو تجاوز للقيود"
    });
  }

  if (SENSITIVE_DATA_PATTERNS.some((pattern) => pattern.test(text))) {
    findings.push({
      type: "sensitive_data",
      message: "يحتوي النص على مؤشرات لبيانات حساسة"
    });
  }

  if (HTML_PATTERNS.some((pattern) => pattern.test(text))) {
    findings.push({
      type: "unsafe_html",
      message: "يحتوي النص على محتوى HTML أو سكربت غير آمن"
    });
  }

  if (config.restrictExternalStorageToIsrael && config.dataResidency !== "IL" && config.dataResidency !== "ISRAEL") {
    findings.push({
      type: "outside_allowed_processing",
      message: "إعدادات تخزين البيانات لا تشير إلى إسرائيل كما هو مطلوب"
    });
  }

  return findings;
}

export function sanitizeAiText(input: string, maxChars: number) {
  const normalized = input.split("\u0000").join("").trim();
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
}

export function reviewAiOutput(output: string, config: AiPolicyConfig = loadAiPolicyConfig()) {
  const findings = scanAiContent(output, config, config.outputMaxChars);
  const sanitized = sanitizeAiText(output, config.outputMaxChars);

  return {
    sanitized,
    findings,
    requiresHumanReview: config.outputMonitoring || findings.length > 0
  };
}

export function buildAiPolicySummary(config: AiPolicyConfig = loadAiPolicyConfig()) {
  return {
    enabled: config.enabled,
    noTraining: config.noTraining,
    contentFilters: config.contentFilters,
    storeHistory: config.storeHistory,
    historyEncrypted: config.historyEncrypted,
    outputMonitoring: config.outputMonitoring,
    allowExternalProcessing: config.allowExternalProcessing,
    restrictExternalStorageToIsrael: config.restrictExternalStorageToIsrael,
    dataResidency: config.dataResidency,
    promptMaxChars: config.promptMaxChars,
    outputMaxChars: config.outputMaxChars,
    historyMaxChars: config.historyMaxChars
  };
}
