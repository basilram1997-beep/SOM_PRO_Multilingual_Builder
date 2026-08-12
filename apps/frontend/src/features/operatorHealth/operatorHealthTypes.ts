export type OperatorHealthResponse = {
  generatedAt: string;
  database: {
    ok: boolean;
    latencyMs: number;
    message: string;
  };
  license: {
    status?: string;
    plan?: string;
    expiresAt?: string | null;
    readOnly?: boolean;
    readOnlyReason?: string | null;
    activeDevicesCount?: number | null;
    maxDevices?: number;
  };
  backup: {
    id: string;
    backupType: string;
    status: string;
    encrypted: boolean;
    filePath: string;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  alerting: {
    configured: boolean;
    channels: {
      name: string;
      configured: boolean;
      target: string | null;
      message: string;
    }[];
  };
  backupPolicy: {
    automatic: boolean;
    intervalHours: number | null;
    runOnStart: boolean;
    lastSuccessfulBackupAt: string | null;
    message: string;
  };
  redundancy: {
    mode: string;
    configured: boolean;
    ready: boolean;
    message: string;
    database: {
      configured: boolean;
      target: string | null;
      ok: boolean;
      latencyMs: number | null;
      statusCode: number | null;
      message: string;
    };
    backend: {
      configured: boolean;
      target: string | null;
      ok: boolean;
      latencyMs: number | null;
      statusCode: number | null;
      message: string;
    };
    license: {
      configured: boolean;
      target: string | null;
      ok: boolean;
      latencyMs: number | null;
      statusCode: number | null;
      message: string;
    };
  };
  version: {
    product: string;
    version: string;
    releaseChannel: string;
    runtimeMode: string;
    apiEnvironment: string;
    nodeVersion: string;
  };
  storage: {
    ok: boolean;
    path: string;
    totalBytes: number | null;
    availableBytes: number | null;
    usedPercent: number | null;
    message: string;
  };
  lastCheck: {
    at: string;
    source: string;
  };
};
