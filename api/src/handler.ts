import { predict } from "./predict";
import { commentary } from "./commentary";
import { parse } from "./parse";
import {
  ApiError,
  modelName,
  requireRecord,
  type Environment,
  type Fetcher,
} from "./service";

export interface ApiRequest {
  path: string;
  method: string;
  body?: unknown;
  // Internal identity selected by the hosting adapter, never from request JSON.
  userId?: string;
  local?: boolean;
}
export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export async function handleApi(
  request: ApiRequest,
  env: Environment = process.env,
  fetcher?: Fetcher,
): Promise<ApiResponse> {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const route = request.path.replace(/^\/api\//, "").replace(/\/$/, "");
    if (route === "health" && request.method === "GET")
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          aiConfigured: !!env.DEEPSEEK_API_KEY?.trim(),
          model: modelName(env),
          authRequired: !request.local,
        },
      };
    if (!["predict", "commentary", "parse"].includes(route))
      throw new ApiError(404, "NOT_FOUND", "接口不存在。");
    if (request.method !== "POST")
      return {
        status: 405,
        headers: { ...headers, Allow: "POST" },
        body: { error: "METHOD_NOT_ALLOWED", message: "请使用 POST 请求。" },
      };
    // Only the server adapter may provide userId. Local bypass is exclusively
    // used by the loopback-only development server, never the production server.
    const userId = request.local
      ? "local-development"
      : request.userId;
    if (!userId)
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "请先通过 GitHub 登录，再使用 AI 功能。",
      );
    if (JSON.stringify(request.body)?.length > 250_000)
      throw new ApiError(413, "INPUT_TOO_LARGE", "请求过大，请减少导入内容。");
    const body = requireRecord(request.body);
    const runtime = { env, userId, fetcher };
    const result =
      route === "predict"
        ? await predict(body, runtime)
        : route === "commentary"
          ? await commentary(body, runtime)
          : await parse(body, runtime);
    return { status: 200, headers, body: result };
  } catch (error) {
    const known = error instanceof ApiError;
    return {
      status: known ? error.status : 500,
      headers,
      body: {
        error: known ? error.code : "INTERNAL_ERROR",
        message: known ? error.message : "处理失败，请稍后重试。",
      },
    };
  }
}
