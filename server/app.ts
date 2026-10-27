import { resolve, extname } from "node:path";
import express, { type ErrorRequestHandler, type Response } from "express";
import { handleApi, type ApiResponse } from "../api/src/handler";
import type { Environment, Fetcher } from "../api/src/service";
import { easyAuthUser } from "./auth";

function sendApi(res: Response, result: ApiResponse) {
  res
    .set(result.headers ?? {})
    .status(result.status)
    .json(result.body);
}

export function createApp({
  env = process.env,
  distDir = resolve("dist"),
  fetcher,
}: { env?: Environment; distDir?: string; fetcher?: Fetcher } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.enable("case sensitive routing");
  // Do not trust arbitrary forwarded headers or use client IPs as identity.
  app.set("trust proxy", false);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    });
    next();
  });

  app.use(
    "/api",
    async (req, res, next) => {
      res.set("Cache-Control", "no-store");
      res.locals.userId = easyAuthUser(req.headers, env);
      // Reject unauthenticated POSTs before allocating/parsing their body. The
      // shared handler owns the route/method/auth errors and never sees headers.
      if (req.method === "POST" && !res.locals.userId) {
        sendApi(
          res,
          await handleApi({ path: `/api${req.path}`, method: req.method }, env),
        );
        return;
      }
      next();
    },
    express.json({ limit: 250_000, strict: true, inflate: false }),
    async (req, res) => {
      // local/principal/userId in JSON, cookies or alternate headers cannot
      // override the identity selected by the trusted server adapter.
      const result = await handleApi(
        {
          path: `/api${req.path}`,
          method: req.method,
          body: req.body,
          userId: res.locals.userId,
        },
        env,
        fetcher,
      );
      sendApi(res, result);
    },
  );

  // Easy Auth normally intercepts these before Node. If it is disabled or this
  // package is running locally, do not serve the SPA as a fake auth response.
  app.use("/.auth", (_req, res) => {
    res.set("Cache-Control", "no-store").status(503).json({
      error: "AUTH_NOT_CONFIGURED",
      message: "请在 Azure App Service 中启用 GitHub 身份认证。",
    });
  });
  app.use(
    "/assets",
    express.static(resolve(distDir, "assets"), {
      immutable: true,
      maxAge: "1y",
      fallthrough: false,
      dotfiles: "deny",
    }),
  );
  app.use(
    express.static(distDir, { index: false, dotfiles: "deny", maxAge: 0 }),
  );
  app.use((req, res) => {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      !req.path.split("/").some((part) => part.startsWith(".")) &&
      !extname(req.path) &&
      req.accepts("html")
    ) {
      res
        .set("Cache-Control", "no-cache")
        .sendFile(resolve(distDir, "index.html"));
      return;
    }
    res.status(404).json({ error: "NOT_FOUND", message: "内容不存在。" });
  });
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status =
      error?.type === "entity.too.large"
        ? 413
        : error?.type === "entity.parse.failed"
          ? 400
          : error?.status === 415
            ? 415
            : error?.status === 404
              ? 404
              : 500;
    res
      .set("Cache-Control", "no-store")
      .status(status)
      .json({
        error:
          status === 413
            ? "INPUT_TOO_LARGE"
            : status === 400
              ? "INVALID_JSON"
              : status === 415
                ? "UNSUPPORTED_MEDIA_TYPE"
                : status === 404
                  ? "NOT_FOUND"
                  : "INTERNAL_ERROR",
        message:
          status === 413
            ? "请求过大，请减少导入内容。"
            : status === 400
              ? "请求不是有效的 JSON 对象。"
              : status === 415
                ? "请使用未压缩的 UTF-8 JSON。"
                : status === 404
                  ? "内容不存在。"
                  : "处理失败，请稍后重试。",
      });
  };
  app.use(onError);
  return app;
}
