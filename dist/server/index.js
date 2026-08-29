export default {
  async fetch(request, env) {
    if (env?.ASSETS?.fetch) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;

      const url = new URL(request.url);
      if ((request.headers.get("accept") || "").includes("text/html")) {
        return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
      }

      return response;
    }

    return new Response("SOM PRO", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
