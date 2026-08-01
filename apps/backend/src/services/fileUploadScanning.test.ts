import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { scanUploadedFile } from "./fileUploadScanning";

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function withMockClamAv(responseForPayload: (payload: Buffer) => string, fn: (url: string) => Promise<void>) {
  const server = net.createServer((socket) => {
    const chunks: Buffer[] = [];
    let timer: NodeJS.Timeout | null = null;

    const respond = () => {
      if (socket.destroyed) {
        return;
      }

      const payload = Buffer.concat(chunks);
      socket.write(responseForPayload(payload));
      socket.end();
    };

    const scheduleResponse = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(respond, 25);
      timer.unref?.();
    };

    socket.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
      scheduleResponse();
    });

    socket.on("end", () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      respond();
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start mock clamav server");
  }

  try {
    await fn(`clamav://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

test("scanUploadedFile fails closed when scanning is disabled", async () => {
  await withEnv(
    {
      SOM_FILE_UPLOAD_SCANNING_ENABLED: "false",
      SOM_FILE_UPLOAD_SCANNER_URL: undefined
    },
    async () => {
      const result = await scanUploadedFile({
        fileName: "report.xlsx",
        content: Buffer.from("clean")
      });

      assert.equal(result.ok, false);
      assert.equal(result.reason, "FILE_UPLOAD_SCANNING_NOT_ENABLED");
      assert.equal(result.scanner, "disabled");
    }
  );
});

test("scanUploadedFile accepts a clean file through a ClamAV-compatible scanner", async () => {
  await withMockClamAv(
    (payload) => (payload.includes(Buffer.from("EICAR")) ? "stream: Eicar-Test-Signature FOUND\n" : "stream: OK\n"),
    async (url) => {
      await withEnv(
        {
          SOM_FILE_UPLOAD_SCANNING_ENABLED: "true",
          SOM_FILE_UPLOAD_SCANNER_URL: url,
          SOM_FILE_UPLOAD_SCANNER_TIMEOUT_MS: "2000"
        },
        async () => {
          const result = await scanUploadedFile({
            fileName: "report.xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sizeBytes: 4,
            content: Buffer.from("clean")
          });

          assert.equal(result.ok, true);
          assert.equal(result.reason, null);
          assert.equal(result.scanner, "clamav-tcp");
        }
      );
    }
  );
});

test("scanUploadedFile rejects infected content through a ClamAV-compatible scanner", async () => {
  await withMockClamAv(
    (payload) => (payload.includes(Buffer.from("EICAR")) ? "stream: Eicar-Test-Signature FOUND\n" : "stream: OK\n"),
    async (url) => {
      await withEnv(
        {
          SOM_FILE_UPLOAD_SCANNING_ENABLED: "true",
          SOM_FILE_UPLOAD_SCANNER_URL: url,
          SOM_FILE_UPLOAD_SCANNER_TIMEOUT_MS: "2000"
        },
        async () => {
          const result = await scanUploadedFile({
            fileName: "report.xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sizeBytes: 68,
            content: Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
          });

          assert.equal(result.ok, false);
          assert.equal(result.reason, "MALWARE_DETECTED");
          assert.equal(result.scanner, "clamav-tcp");
        }
      );
    }
  );
});
