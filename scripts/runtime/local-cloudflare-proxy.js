const http = require("http");

const port = Number(process.env.SOM_TUNNEL_PROXY_PORT || 8080);
const host = process.env.SOM_TUNNEL_PROXY_HOST || "127.0.0.1";
const frontendOrigin = process.env.SOM_TUNNEL_FRONTEND_ORIGIN || "http://127.0.0.1:4188";
const backendOrigin = process.env.SOM_TUNNEL_BACKEND_ORIGIN || "http://127.0.0.1:4000";

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
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
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
  const url = req.url || "/";
  const isApi = url === "/api" || url.startsWith("/api/");
  proxyRequest(req, res, isApi ? backendOrigin : frontendOrigin);
});

server.listen(port, host, () => {
  console.log(`[SOM PRO] local Cloudflare proxy listening on http://${host}:${port}`);
  console.log(`[SOM PRO] frontend -> ${frontendOrigin}`);
  console.log(`[SOM PRO] /api -> ${backendOrigin}`);
});
