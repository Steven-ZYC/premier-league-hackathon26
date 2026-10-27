import type { Match, MatchEvent } from "../../shared/types";
import { momentum, scoreAt, statsAt } from "../../shared/engine";
import { validateMatch } from "../../shared/parser";
import { ApiError, requireRecord } from "./service";

export function requestMatch(body: Record<string, unknown>): {
  match: Match;
  cursor: number;
} {
  let match: Match;
  try {
    match = validateMatch(body.match);
  } catch (error) {
    throw new ApiError(
      400,
      "INVALID_MATCH",
      error instanceof Error ? error.message : "比赛格式无效。",
    );
  }
  if (match.events.length > 2000)
    throw new ApiError(413, "INPUT_TOO_LARGE", "最多接收 2000 条事件。");
  const cursor = body.cursor;
  if (
    typeof cursor !== "number" ||
    !Number.isInteger(cursor) ||
    cursor < -1 ||
    cursor >= match.events.length
  )
    throw new ApiError(400, "INVALID_CURSOR", "回放位置无效。");
  return { match, cursor };
}

// Build a fresh allow-listed object. Never forward the caller's complete match or
// rawInput/title/source/finalStats/duration to the model, even in a nested field.
export function buildPrefixContext(match: Match, cursor: number) {
  if (!Number.isInteger(cursor) || cursor < -1 || cursor >= match.events.length)
    throw new ApiError(400, "INVALID_CURSOR", "回放位置无效。");
  const events: MatchEvent[] = match.events
    .slice(0, cursor + 1)
    .map((event) => ({
      id: event.id,
      period: event.period,
      displayTime: event.displayTime,
      activeMinute: event.activeMinute,
      order: event.order,
      team: event.team,
      type: event.type,
      player: event.player,
      rawText: event.rawText,
      relatedEventId: event.relatedEventId,
      confirmed: event.confirmed,
    }));
  const prefix: Match = {
    ...match,
    events,
    rawInput: "",
    finalStats: undefined,
    snapshots: match.snapshots?.filter((snapshot) => snapshot.cursor <= cursor),
  };
  const known = statsAt(prefix, cursor);
  return {
    teams: { home: match.home.name, away: match.away.name },
    currentTime: events.at(-1)?.displayTime ?? "0",
    score: scoreAt(prefix, cursor),
    momentum: {
      home: momentum(prefix, "home", cursor),
      away: momentum(prefix, "away", cursor),
    },
    knownStats: { home: known.home, away: known.away, label: known.label },
    events,
    rules: {
      neutral: 50,
      halfLifeMinutes: 3,
      windowMinutes: 8,
      weights: {
        goal: [12, -6],
        shot_on_target: [5, -2],
        shot_off_target: [2, 0],
        shot_blocked: [2, 0],
        corner: [1, 0],
        red_card: [-8, 3],
      },
      target:
        "下一条非零影响事件发生后，考虑信号衰减的指数相对当前值变化；绝对变化小于0.5为持平。指数不是胜率。",
    },
  };
}

export function readBody(value: unknown) {
  return requireRecord(value);
}
