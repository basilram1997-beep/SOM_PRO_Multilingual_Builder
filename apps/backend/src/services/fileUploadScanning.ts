import { promises as fs } from "node:fs";
import net from "node:net";

export type FileUploadScanInput = {
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  filePath?: string | null;
  content?: Buffer | null;
};

export type FileUploadScanResult = {
  ok: boolean;
  reason: string | null;
  scanner: "disabled" | "clamav-tcp" | "placeholder";
};

type ScannerConfig = {
  enabled: boolean;
  url: string | null;
  timeoutMs: number;
};

type ParsedScannerUrl = {
  host: string;
  port: number;
};

const DEFAULT_SCAN_TIMEOUT_MS = 5_000;
const CLAMAV_RESPONSE_OK = /\bOK\b/i;
const CLAMAV_RESPONSE_FOUND = /\bFOUND\b/i;

function getScannerConfig(): ScannerConfig {
  return {
    enabled:
      String(process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED || "")
        .trim()
        .toLowerCase() === "true",
    url: String(process.env.SOM_FILE_UPLOAD_SCANNER_URL || "").trim() || null,
    timeoutMs: Math.max(
      500,
      Number(process.env.SOM_FILE_UPLOAD_SCANNER_TIMEOUT_MS || DEFAULT_SCAN_TIMEOUT_MS) || DEFAULT_SCAN_TIMEOUT_MS
    )
  };
}

function normalizeFileName(fileName: string) {
  return String(fileName || "").trim();
}

function getFileContent(input: FileUploadScanInput) {
  if (input.content && input.content.length > 0) {
    return Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content);
  }

  if (input.filePath) {
    return fs.readFile(input.filePath);
  }

  return null;
}

function parseScannerUrl(scannerUrl: string): ParsedScannerUrl | null {
  const trimmed = scannerUrl.trim();
  if (!trimmed) return null;

  try {
    const normalized = /^(https?|tcp|clamav):\/\//i.test(trimmed) ? trimmed : `tcp://${trimmed}`;
    const parsed = new URL(normalized);
    const port = Number(parsed.port || "3310");
    if (!parsed.hostname || !Number.isInteger(port) || port <= 0 || port > 65535) {
      return null;
    }
    return {
      host: parsed.hostname,
      port
    };
  } catch {
    return null;
  }
}

function scanWithClamAv(buffer: Buffer, scannerUrl: string, timeoutMs: number): Promise<FileUploadScanResult> {
  const parsed = parseScannerUrl(scannerUrl);
  if (!parsed) {
    return Promise.resolve({
      ok: false,
      reason: "INVALID_SCANNER_URL",
      scanner: "placeholder"
    });
  }

  return new Promise<FileUploadScanResult>((resolve) => {
    const socket = net.createConnection({ host: parsed.host, port: parsed.port });
    let settled = false;
    let response = "";
    let responseSeen = false;
    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const finish = (result: FileUploadScanResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        reason: "SCAN_TIMEOUT",
        scanner: "clamav-tcp"
      });
    }, timeoutMs);
    timer.unref?.();

    socket.on("error", (error) => {
      finish({
        ok: false,
        reason: `SCAN_SOCKET_ERROR:${error instanceof Error ? error.message : String(error)}`,
        scanner: "clamav-tcp"
      });
    });

    const evaluateResponse = () => {
      if (CLAMAV_RESPONSE_FOUND.test(response)) {
        finish({
          ok: false,
          reason: "MALWARE_DETECTED",
          scanner: "clamav-tcp"
        });
        return true;
      }

      if (CLAMAV_RESPONSE_OK.test(response)) {
        finish({
          ok: true,
          reason: null,
          scanner: "clamav-tcp"
        });
        return true;
      }

      return false;
    };

    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      responseSeen = true;
      evaluateResponse();
    });

    socket.on("end", () => {
      if (settled) {
        return;
      }

      if (CLAMAV_RESPONSE_FOUND.test(response)) {
        finish({
          ok: false,
          reason: "MALWARE_DETECTED",
          scanner: "clamav-tcp"
        });
        return;
      }

      if (CLAMAV_RESPONSE_OK.test(response)) {
        finish({
          ok: true,
          reason: null,
          scanner: "clamav-tcp"
        });
        return;
      }

      finish({
        ok: false,
        reason: response.trim()
          ? `SCANNER_REJECTED:${response.trim().slice(0, 120)}`
          : responseSeen
            ? "SCANNER_REJECTED"
            : "SCAN_TIMEOUT",
        scanner: "clamav-tcp"
      });
    });

    socket.on("close", () => {
      if (settled) {
        return;
      }

      if (evaluateResponse()) {
        return;
      }

      if (responseSeen) {
        finish({
          ok: false,
          reason: response.trim() ? `SCANNER_REJECTED:${response.trim().slice(0, 120)}` : "SCANNER_REJECTED",
          scanner: "clamav-tcp"
        });
      }
    });

    socket.on("connect", () => {
      const header = Buffer.from("zINSTREAM\0");
      socket.write(header);

      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }

      const zero = Buffer.allocUnsafe(4);
      zero.writeUInt32BE(0, 0);
      socket.end(zero);
    });
  });
}

export async function scanUploadedFile(input: FileUploadScanInput): Promise<FileUploadScanResult> {
  const fileName = normalizeFileName(input.fileName);
  if (!fileName) {
    return { ok: false, reason: "INVALID_FILE_NAME", scanner: "placeholder" };
  }

  const config = getScannerConfig();
  if (!config.enabled) {
    return {
      ok: false,
      reason: "FILE_UPLOAD_SCANNING_NOT_ENABLED",
      scanner: "disabled"
    };
  }

  const content = await getFileContent(input);
  if (!content || content.length === 0) {
    return {
      ok: false,
      reason: "MISSING_FILE_CONTENT",
      scanner: "placeholder"
    };
  }

  if (!config.url) {
    return {
      ok: false,
      reason: "FILE_UPLOAD_SCANNER_URL_MISSING",
      scanner: "placeholder"
    };
  }

  return scanWithClamAv(content, config.url, config.timeoutMs);
}
