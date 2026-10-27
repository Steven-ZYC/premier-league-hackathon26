import { buildPrefixContext, requestMatch } from "./context";
import {
  ApiError,
  askJSON,
  cached,
  hash,
  modelName,
  outputText,
  text,
  type Runtime,
} from "./service";

export async function commentary(
  body: Record<string, unknown>,
  runtime: Runtime,
) {
  const { match, cursor } = requestMatch(body);
  const eventId = text(body.eventId, "eventId", 200);
  const eventIndex = match.events.findIndex((event) => event.id === eventId);
  if (eventIndex < 0 || eventIndex > cursor)
    throw new ApiError(400, "FUTURE_EVENT", "只能解说当前位置已经发生的事件。");
  const perspective = body.perspective;
  if (!["neutral", "home", "away"].includes(String(perspective)))
    throw new ApiError(400, "INVALID_PERSPECTIVE", "解说立场无效。");
  const model = modelName(runtime.env);
  const key = hash([
    runtime.userId,
    "commentary",
    hash(match),
    eventId,
    perspective,
    model,
    "prompt-v1",
  ]);
  return cached(key, async () => {
    const output = await askJSON(
      runtime,
      '你是足球文字解说。只改写指定事件的表达，用简体中文及少量emoji，按指定 neutral/home/away 立场增加适度情绪。所有事实必须能在原文核对。不可添加距离、角度、球员心理、观众反应或原文不存在的信息。只能使用给定事件及以前的事实，禁止后续剧透。返回 JSON {"title":"简短标题","text":"忠于原文的一至两句解说"}。',
      { ...buildPrefixContext(match, eventIndex), eventId, perspective },
    );
    return {
      title: outputText(output.title, 120),
      text: outputText(output.text, 900),
      model,
    };
  });
}
