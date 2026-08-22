const http = require("http");
const crypto = require("node:crypto");

const port = Number(process.env.SOM_TUNNEL_PROXY_PORT || 8080);
const host = process.env.SOM_TUNNEL_PROXY_HOST || "127.0.0.1";
const frontendOrigin = process.env.SOM_TUNNEL_FRONTEND_ORIGIN || "http://127.0.0.1:4188";
const backendOrigin = process.env.SOM_TUNNEL_BACKEND_ORIGIN || "http://127.0.0.1:4000";
const proxyUser = String(process.env.SOM_TUNNEL_PROXY_USER || "").trim();
const proxyPassword = String(process.env.SOM_TUNNEL_PROXY_PASSWORD || "").trim();
const proxyAuthEnabled = Boolean(proxyUser && proxyPassword);
const proxySessionCookieName = "som_demo_proxy_auth";
const proxySessionTtlSeconds = Number(process.env.SOM_TUNNEL_PROXY_SESSION_TTL_SECONDS || 60 * 60 * 12);
const proxySessionSecret = crypto
  .createHash("sha256")
  .update([proxyUser, proxyPassword, host, port].join("|"))
  .digest("hex");

function timingSafeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || "").split(/;\s*/u)) {
    if (!part) continue;
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function encodeSessionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", proxySessionSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function decodeSessionToken(value) {
  const [body, signature] = String(value || "").split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", proxySessionSecret).update(body).digest("base64url");
  if (!timingSafeEquals(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.user !== proxyUser || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function buildAuthCookie() {
  const value = encodeSessionToken({
    user: proxyUser,
    exp: Date.now() + proxySessionTtlSeconds * 1000
  });
  return `${proxySessionCookieName}=${value}; Path=/; Max-Age=${proxySessionTtlSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function requireProxyAuth(req, res) {
  if (!proxyAuthEnabled) return true;
  const cookies = parseCookies(req.headers.cookie);
  if (decodeSessionToken(cookies[proxySessionCookieName])) return true;
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Basic ")) {
    res.writeHead(401, {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="SOM PRO Demo", charset="UTF-8"'
    });
    res.end("Authentication required");
    return false;
  }

  try {
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const givenUser = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
    const givenPassword = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";
    if (!timingSafeEquals(givenUser, proxyUser) || !timingSafeEquals(givenPassword, proxyPassword)) {
      res.writeHead(401, {
        "content-type": "text/plain; charset=utf-8",
        "www-authenticate": 'Basic realm="SOM PRO Demo", charset="UTF-8"'
      });
      res.end("Authentication required");
      return false;
    }
    return true;
  } catch {
    res.writeHead(401, {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="SOM PRO Demo", charset="UTF-8"'
    });
    res.end("Authentication required");
    return false;
  }
}

function proxyRequest(req, res, origin) {
  const target = new URL(req.url || "/", origin);
  const proxyReq = http.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host
      }
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers };
      if (proxyAuthEnabled && String(req.headers.authorization || "").startsWith("Basic ")) {
        headers["set-cookie"] = buildAuthCookie();
      }
      res.writeHead(proxyRes.statusCode || 502, headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`SOM tunnel proxy error: ${error.message}`);
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (!requireProxyAuth(req, res)) return;
  const url = req.url || "/";
  const isApi = url === "/api" || url.startsWith("/api/");
  proxyRequest(req, res, isApi ? backendOrigin : frontendOrigin);
});

server.listen(port, host, () => {
  console.log(`[SOM PRO] local Cloudflare proxy listening on http://${host}:${port}`);
  console.log(`[SOM PRO] frontend -> ${frontendOrigin}`);
  console.log(`[SOM PRO] /api -> ${backendOrigin}`);
  if (proxyAuthEnabled) {
    console.log(`[SOM PRO] proxy basic auth enabled for user "${proxyUser}"`);
  }
});
