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
  principal?: string;
  local?: boolean;
}
export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function principalUser(encoded: string | undefined): string | undefined {
  if (!encoded || encoded.length > 12_000) return;
  try {
    const principal = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      typeof principal.userId !== "string" ||
      !principal.userId ||
      principal.userId.length > 200 ||
      !["github", "aad"].includes(String(principal.identityProvider)) ||
      !Array.isArray(principal.userRoles) ||
      !principal.userRoles.includes("authenticated")
    )
      return;
    return `${principal.identityProvider}:${principal.userId}`;
  } catch {
    return;
  }
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
    // Production values are supplied only by Azure Static Web Apps edge. The
    // accompanying route configuration requires authenticated for these routes.
    const userId = request.local
      ? "local-development"
      : principalUser(request.principal);
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
