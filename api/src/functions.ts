import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { handleApi } from "./handler";

app.http("pitchpulse", {
  route: "{action}",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    let body: unknown;
    if (request.method === "POST") {
      const size = Number(request.headers.get("content-length") ?? 0);
      if (size > 250_000)
        return {
          status: 413,
          jsonBody: { error: "INPUT_TOO_LARGE", message: "请求过大。" },
        };
      try {
        body = await request.json();
      } catch {
        return {
          status: 400,
          jsonBody: { error: "INVALID_JSON", message: "请求不是有效的 JSON。" },
        };
      }
    }
    const result = await handleApi({
      path: `/api/${request.params.action}`,
      method: request.method,
      body,
      principal: request.headers.get("x-ms-client-principal") ?? undefined,
    });
    return {
      status: result.status,
      headers: result.headers,
      jsonBody: result.body,
    };
  },
});
