import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { createServer as createViteServer } from "vite";
import { handleApi } from "../api/src/handler";

if (existsSync(".env")) process.loadEnvFile(".env");
const api = createServer(async (req, res) => {
  // Bind to loopback and reject cross-origin browser requests. Local development
  // uses a synthetic user; caller-supplied identity headers are ignored.
  const origin = req.headers.origin;
  if (
    origin &&
    !/^http:\/\/(localhost|127\.0\.0\.1):(5173|7071)$/.test(origin)
  ) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  let raw = "";
  try {
    for await (const chunk of req) {
      raw += String(chunk);
      if (Buffer.byteLength(raw) > 250_000) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "INPUT_TOO_LARGE", message: "请求过大。" }),
        );
        return;
      }
    }
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "INVALID_JSON", message: "无效 JSON。" }),
      );
      return;
    }
    const result = await handleApi({
      path: new URL(req.url ?? "/", "http://127.0.0.1:7071").pathname,
      method: req.method ?? "GET",
      body,
      local: true,
    });
    res.writeHead(result.status, result.headers);
    res.end(JSON.stringify(result.body));
  } catch {
    res.writeHead(500);
    res.end("Internal server error");
  }
});
await new Promise<void>((resolve, reject) => {
  api.once("error", reject);
  api.listen(7071, "127.0.0.1", resolve);
});
const vite = await createViteServer({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
await vite.listen();
console.log("PitchPulse API: http://127.0.0.1:7071/api/health");
vite.printUrls();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await vite.close();
    api.close();
    process.exit(0);
  });
