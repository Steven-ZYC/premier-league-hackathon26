import type {
  EventType,
  Match,
  MatchEvent,
  Stats,
  StatsPair,
  Team,
} from "./types";
import {
  eventLabels,
  normalizeEvents,
  parseDisplayTime,
  scoreAt,
} from "./engine";

export function versionMatch(match: Match): string {
  const text = JSON.stringify({ ...match, version: "" });
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `v1-${(hash >>> 0).toString(16)}`;
}
export function detectType(text: string): EventType {
  if (
    /VAR.*(取消|无效|cancel|disallow)|(?:进球|goal).*(?:取消|无效|disallowed)/i.test(
      text,
    )
  )
    return "var_cancel_goal";
  if (/乌龙|own goal/i.test(text)) return "own_goal";
  if (/红牌|red card|sent off/i.test(text)) return "red_card";
  if (/黄牌|yellow card|booked/i.test(text)) return "yellow_card";
  if (/点球.*(?:未进|罚失|扑出)|penalty.*(?:miss|saved)/i.test(text))
    return "penalty_missed";
  if (/点球.*(?:判|获得)|判.*点球|penalty awarded/i.test(text))
    return "penalty_awarded";
  if (
    /进球|破门|得分|goal\b|scores?\b/i.test(text) &&
    !/未进球|没有进球|没有得分|未得分|no goal|goal kick|goal.?keeper|goal.?kick/i.test(
      text,
    )
  )
    return "goal";
  if (
    /射门.*(?:扑出|挡出)|射正|shot.*(?:saved|on target)|on.target/i.test(text)
  )
    return "shot_on_target";
  if (/射偏|偏出|高出|shot.*(?:wide|over)|off.target/i.test(text))
    return "shot_off_target";
  if (/封堵|blocked/i.test(text)) return "shot_blocked";
  if (/扑救|扑出|save\b/i.test(text)) return "save";
  if (/角球|corner/i.test(text)) return "corner";
  if (/换人|替换|substitution/i.test(text)) return "substitution";
  if (/犯规|foul/i.test(text)) return "foul";
  if (/半场结束|中场休息|half.?time/i.test(text)) return "halftime";
  if (/全场结束|终场|full.?time/i.test(text)) return "fulltime";
  if (/开球|开场|kick.?off/i.test(text)) return "kickoff";
  return "unknown";
}
export function parseText(
  raw: string,
  homeName: string,
  awayName: string,
): MatchEvent[] {
  if (raw.length > 200_000)
    throw new Error("赛况文本过长，请限制在 200,000 字符以内。");
  const events: MatchEvent[] = [];
  let period: 1 | 2 = 1;
  for (const line of raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (/^(?:下半场|second half|2nd half)\s*[:：]?$/i.test(line)) {
      period = 2;
      continue;
    }
    if (/^(?:上半场|first half|1st half)\s*[:：]?$/i.test(line)) {
      period = 1;
      continue;
    }
    const found = line.match(
      /^(\d{1,3}(?:\s*\+\s*\d{1,2})?)\s*[′'’分.:：]?\s*(.*)$/,
    );
    const displayTime =
      found?.[1].replace(/\s/g, "") ?? (events.at(-1)?.displayTime || "0");
    const base = parseDisplayTime(displayTime).base;
    // A normal minute identifies its half even when an imported file is unsorted.
    // Added first-half time must not inherit period 2 from an earlier input line.
    period = base <= 45 ? 1 : 2;
    const home =
      /主队|主隊|\bhome\b/i.test(line) ||
      (!!homeName.trim() &&
        line.toLowerCase().includes(homeName.trim().toLowerCase()));
    const away =
      /客队|客隊|\baway\b/i.test(line) ||
      (!!awayName.trim() &&
        line.toLowerCase().includes(awayName.trim().toLowerCase()));
    const type = detectType(line);
    const warnings: string[] = [];
    if (!found) warnings.push("未识别时间，沿用上一时间，请核对");
    if (
      home === away &&
      !["kickoff", "halftime", "fulltime", "var_cancel_goal"].includes(type)
    )
      warnings.push("球队无法确定，请选择球队");
    if (type === "unknown") warnings.push("无法识别动作，原文已保留");
    const team = home !== away ? (home ? "home" : "away") : "unknown";
    const event: MatchEvent = {
      id: `import-${events.length + 1}`,
      period,
      displayTime,
      order: events.length,
      activeMinute: 0,
      team,
      type,
      rawText: line,
      confirmed:
        !!found &&
        type !== "unknown" &&
        (team !== "unknown" ||
          ["kickoff", "halftime", "fulltime", "var_cancel_goal"].includes(
            type,
          )),
      warnings,
    };
    if (type === "var_cancel_goal") {
      const goal = [...events]
        .reverse()
        .find((e) => ["goal", "own_goal"].includes(e.type));
      if (goal) event.relatedEventId = goal.id;
      else {
        event.confirmed = false;
        warnings.push("请关联被取消的进球");
      }
    }
    const identical = events.find((e) => e.rawText === line);
    if (identical) {
      if (type !== "var_cancel_goal") event.relatedEventId = identical.id;
      warnings.push("重复原文，关联后不重复计数");
    }
    const possible = events.at(-1);
    if (
      possible &&
      possible.displayTime === displayTime &&
      possible.team === team &&
      [
        "goal",
        "shot_on_target",
        "shot_off_target",
        "save",
        "shot_blocked",
      ].includes(type) &&
      [
        "goal",
        "shot_on_target",
        "shot_off_target",
        "save",
        "shot_blocked",
      ].includes(possible.type) &&
      !event.relatedEventId
    )
      warnings.push("同分钟射门/扑救可能重复；请核对并关联同次动作");
    events.push(event);
  }
  if (!events.length)
    throw new Error("没有找到赛况。请每行输入一条带分钟的事件。");
  if (events.length > 2000) throw new Error("最多支持 2,000 条事件。");
  return normalizeEvents(events);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error(`${label} 必须为不超过 ${max} 字符的文本。`);
  return value;
}
function team(value: unknown, label: string): Team {
  if (!record(value)) throw new Error(`${label}格式错误。`);
  const name = text(value.name, `${label}名称`, 80);
  if (!name.trim()) throw new Error(`${label}名称不能为空。`);
  const badge =
    typeof value.badge === "string" && /^https:\/\//.test(value.badge)
      ? value.badge
      : undefined;
  return {
    name,
    short:
      typeof value.short === "string"
        ? value.short.slice(0, 8)
        : name.slice(0, 3),
    englishName:
      typeof value.englishName === "string"
        ? value.englishName.slice(0, 80)
        : undefined,
    color:
      typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color)
        ? value.color
        : "#8b5cf6",
    badge,
  };
}
const statKeys: (keyof Stats)[] = [
  "goals",
  "shots",
  "shotsOnTarget",
  "corners",
  "fouls",
  "yellowCards",
  "redCards",
  "passes",
  "successfulPasses",
  "passAccuracy",
  "possession",
  "xg",
];
function stats(value: unknown): Stats {
  if (!record(value)) throw new Error("统计必须为对象。");
  const out: Stats = {};
  for (const key of statKeys) {
    const item = value[key];
    if (item === undefined || item === null) continue;
    if (
      typeof item !== "number" ||
      !Number.isFinite(item) ||
      item < 0 ||
      item > 100000
    )
      throw new Error(`统计 ${key} 必须是非负数字。`);
    if (
      !["possession", "passAccuracy", "xg"].includes(key) &&
      !Number.isInteger(item)
    )
      throw new Error(`统计 ${key} 必须是整数。`);
    if (["possession", "passAccuracy"].includes(key) && item > 100)
      throw new Error(`${key} 必须在 0–100 之间。`);
    out[key] = item;
  }
  if (
    out.successfulPasses !== undefined &&
    out.passes !== undefined &&
    out.successfulPasses > out.passes
  )
    throw new Error("成功传球数不能超过总传球数。");
  if (
    out.shotsOnTarget !== undefined &&
    out.shots !== undefined &&
    out.shotsOnTarget > out.shots
  )
    throw new Error("射正数不能超过射门数。");
  if (
    out.passes !== undefined &&
    out.passes > 0 &&
    out.successfulPasses !== undefined &&
    out.passAccuracy !== undefined &&
    Math.abs((out.successfulPasses / out.passes) * 100 - out.passAccuracy) > 1
  )
    throw new Error("传球成功率与成功/总传球数冲突，请核对统计口径。");
  return out;
}
function pair(value: unknown): StatsPair {
  if (!record(value)) throw new Error("统计需要 home 和 away 对象。");
  return { home: stats(value.home), away: stats(value.away) };
}
export function validateMatch(value: unknown): Match {
  if (!record(value)) throw new Error("比赛 JSON 必须为对象。");
  if (
    !Array.isArray(value.events) ||
    !value.events.length ||
    value.events.length > 2000
  )
    throw new Error("比赛需要 1–2,000 条事件。");
  const ids = new Set<string>();
  const events = value.events.map((item, index): MatchEvent => {
    if (!record(item)) throw new Error(`事件 ${index + 1} 格式错误。`);
    const id =
      typeof item.id === "string"
        ? text(item.id, "事件 ID", 100)
        : `import-${index + 1}`;
    if (ids.has(id)) throw new Error("事件 ID 不能重复。");
    ids.add(id);
    const displayTime =
      typeof item.displayTime === "string"
        ? item.displayTime
        : String(item.minute ?? "");
    const parsed = parseDisplayTime(displayTime);
    const type =
      typeof item.type === "string" && Object.hasOwn(eventLabels, item.type)
        ? (item.type as EventType)
        : "unknown";
    const side =
      item.team === "home" || item.team === "away" ? item.team : "unknown";
    return {
      id,
      period:
        item.period === 1 || item.period === 2
          ? item.period
          : parsed.base <= 45
            ? 1
            : 2,
      displayTime,
      activeMinute: 0,
      order:
        typeof item.order === "number" && Number.isInteger(item.order)
          ? item.order
          : index,
      team: side,
      player:
        typeof item.player === "string" ? item.player.slice(0, 100) : undefined,
      type,
      rawText: text(item.rawText, "事件原文", 3000),
      relatedEventId:
        typeof item.relatedEventId === "string"
          ? item.relatedEventId
          : undefined,
      confirmed:
        typeof item.confirmed === "boolean"
          ? item.confirmed
          : type !== "unknown" &&
            (side !== "unknown" ||
              ["kickoff", "halftime", "fulltime", "var_cancel_goal"].includes(
                type,
              )),
      warnings: Array.isArray(item.warnings)
        ? item.warnings
            .filter((x): x is string => typeof x === "string")
            .slice(0, 10)
        : [],
    };
  });
  const normalized = normalizeEvents(events);
  const positions = new Map(normalized.map((e, i) => [e.id, i]));
  for (let i = 0; i < normalized.length; i++) {
    const e = normalized[i];
    if (
      e.relatedEventId &&
      (!positions.has(e.relatedEventId) ||
        positions.get(e.relatedEventId)! >= i)
    )
      throw new Error("关联事件必须存在并发生在当前事件之前。");
    if (
      e.type === "var_cancel_goal" &&
      (!e.relatedEventId ||
        !["goal", "own_goal"].includes(
          normalized[positions.get(e.relatedEventId)!]?.type,
        ))
    )
      throw new Error("VAR 取消进球必须关联先前的进球。");
  }
  const date =
    typeof value.date === "string"
      ? value.date
      : new Date().toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("日期请使用有效的 YYYY-MM-DD 日期。");
  const match: Match = {
    id:
      typeof value.id === "string"
        ? text(value.id, "比赛 ID", 100)
        : `import-${Date.now()}`,
    version: "",
    title:
      typeof value.title === "string"
        ? text(value.title, "比赛名称", 100)
        : "导入比赛",
    competition:
      typeof value.competition === "string"
        ? text(value.competition, "赛事", 100)
        : "自定义赛事",
    date,
    home: team(value.home, "主队"),
    away: team(value.away, "客队"),
    events: normalized,
    coverage:
      value.coverage === "complete" || value.coverage === "excerpt"
        ? value.coverage
        : "unknown",
    source:
      typeof value.source === "string"
        ? text(value.source, "来源", 500)
        : "个人导入",
    rawInput:
      typeof value.rawInput === "string"
        ? text(value.rawInput, "原始输入", 200000)
        : normalized.map((e) => e.rawText).join("\n"),
    demo: false,
    duration: Math.max(90, normalized.at(-1)!.activeMinute),
  };
  if (value.finalStats !== undefined) match.finalStats = pair(value.finalStats);
  if (value.snapshots !== undefined) {
    if (!Array.isArray(value.snapshots) || value.snapshots.length > 2000)
      throw new Error("统计快照格式错误。");
    match.snapshots = value.snapshots.map((s) => {
      if (
        !record(s) ||
        typeof s.cursor !== "number" ||
        !Number.isInteger(s.cursor) ||
        s.cursor < 0 ||
        s.cursor >= normalized.length
      )
        throw new Error("快照 cursor 必须指向有效事件。");
      return { ...pair(s), cursor: positions.get(events[s.cursor].id)! };
    });
  }
  if (value.missingRanges !== undefined) {
    if (!Array.isArray(value.missingRanges))
      throw new Error("缺失区间格式错误。");
    match.missingRanges = value.missingRanges.map((r) => {
      if (
        !record(r) ||
        typeof r.from !== "number" ||
        typeof r.to !== "number" ||
        r.from < 0 ||
        r.to <= r.from ||
        r.to > match.duration
      )
        throw new Error("缺失区间应包含有效 from、to 分钟。");
      return { from: r.from, to: r.to };
    });
  }
  if (
    match.finalStats &&
    (match.coverage === "complete" ||
      [...normalized].reverse().find((event) => event.confirmed)?.type ===
        "fulltime")
  ) {
    const score = scoreAt(match, normalized.length - 1);
    if (
      (match.finalStats.home.goals !== undefined &&
        match.finalStats.home.goals !== score[0]) ||
      (match.finalStats.away.goals !== undefined &&
        match.finalStats.away.goals !== score[1])
    )
      throw new Error("终场进球统计与事件比分冲突，请核对。");
  }
  match.version = versionMatch(match);
  return match;
}
