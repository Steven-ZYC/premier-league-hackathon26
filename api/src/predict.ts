import type { Direction, Side } from "../../shared/types";
import { nextEffectiveIndex } from "../../shared/engine";
import { buildPrefixContext, requestMatch } from "./context";
import {
  ApiError,
  askJSON,
  cached,
  hash,
  modelName,
  outputText,
  requireRecord,
  type Runtime,
} from "./service";

export async function predict(body: Record<string, unknown>, runtime: Runtime) {
  const { match, cursor } = requestMatch(body);
  if (body.team !== "home" && body.team !== "away")
    throw new ApiError(400, "INVALID_TEAM", "请选择主队或客队。");
  const team: Side = body.team;
  if (nextEffectiveIndex(match, cursor) < 0)
    throw new ApiError(
      400,
      "NO_NEXT_EVENT",
      "请回到比赛过程中的位置，再预测下一有效事件。",
    );
  const model = modelName(runtime.env);
  const clientVersion = requireRecord(body.match).version;
  const version =
    typeof clientVersion === "string" && clientVersion.length <= 100
      ? clientVersion
      : match.version;
  // Never trust a caller-supplied version as the cache identity. Hash the entire
  // validated input so changing future data also invalidates the cache.
  const key = hash([
    runtime.userId,
    "predict",
    hash(match),
    team,
    cursor,
    model,
    "prompt-v1",
  ]);
  return cached(key, async () => {
    const context = buildPrefixContext(match, cursor);
    const output = await askJSON(
      runtime,
      '你是足球复盘分析助手，只能使用所给前缀事实；不知道未来结果。预测指定球队在下一有效事件后势头相对当前的方向，不预测比分或胜率；证据不足使用 insufficient。返回 JSON {"direction":"up|down|flat|insufficient","explanation":"一至两句中文，陈述依据与不确定性"}。禁止百分比、宣称准确率、虚构事件。',
      { ...context, selectedTeam: team },
    );
    if (
      !["up", "down", "flat", "insufficient"].includes(String(output.direction))
    )
      throw new ApiError(
        502,
        "AI_INVALID_OUTPUT",
        "AI 返回预测方向无效，请重试。",
      );
    return {
      direction: output.direction as Direction,
      explanation: outputText(output.explanation, 600),
      team,
      cursor,
      version,
      model,
    };
  });
}
