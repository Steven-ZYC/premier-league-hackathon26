import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error("PORT must be a valid TCP port.");
  process.exit(1);
}
if (!existsSync(resolve("dist/index.html"))) {
  console.error(
    "Missing dist/index.html. Build the production package before starting.",
  );
  process.exit(1);
}
// One process, no dev server, compiler, Functions host or background worker.
const server = createApp().listen(port, "0.0.0.0", () => {
  const address = server.address();
  console.log(
    `PitchPulse listening on 0.0.0.0:${typeof address === "object" ? address?.port : port}`,
  );
});
server.requestTimeout = 45_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxConnections = 64;
server.on("error", () => {
  console.error("Unable to start HTTP server.");
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 40_000).unref();
  });
}
