// Minimal Supabase-style gateway: /auth/v1 → GoTrue, /rest/v1 → PostgREST.
import http from "node:http";
const routes = [
  ["/auth/v1", Number(process.env.AUTH_PORT ?? 9999)],
  ["/rest/v1", Number(process.env.REST_PORT ?? 3001)],
];
http
  .createServer((req, res) => {
    const route = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!route) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "not available in local stack" }));
    }
    const [prefix, port] = route;
    const upstream = http.request(
      { host: "127.0.0.1", port, path: req.url.slice(prefix.length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  })
  .listen(Number(process.env.GATEWAY_PORT ?? 54321), () => console.log("gateway ready"));
