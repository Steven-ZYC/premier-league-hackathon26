import type {
  EventType,
  Match,
  MatchEvent,
  Perspective,
  Side,
  Stats,
  StatsPair,
} from "./types";

export const MOMENTUM_RULES = {
  baseline: 50,
  halfLife: 3,
  window: 8,
  weights: {
    goal: [12, -6],
    own_goal: [12, -6],
    shot_on_target: [5, -2],
    shot_off_target: [2, 0],
    shot_blocked: [2, 0],
    corner: [1, 0],
    red_card: [-8, 3],
  } as Record<string, readonly [number, number]>,
};
export const eventLabels: Record<EventType, string> = {
  goal: "进球",
  own_goal: "乌龙球",
  shot_on_target: "射正",
  shot_off_target: "射偏",
  shot_blocked: "射门被封堵",
  save: "扑救",
  corner: "角球",
  yellow_card: "黄牌",
  red_card: "红牌",
  penalty_awarded: "点球判罚",
  penalty_missed: "点球未进",
  var_cancel_goal: "VAR 取消进球",
  substitution: "换人",
  foul: "犯规",
  unknown: "待核对",
  kickoff: "开场",
  halftime: "半场",
  fulltime: "终场",
};
export function parseDisplayTime(time: string): {
  base: number;
  added: number;
} {
  const found = time.trim().match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?[′'’分]?$/);
  if (!found) throw new Error(`无法识别时间「${time}」，请使用 12 或 45+2。`);
  const base = Number(found[1]);
  const added = Number(found[2] || 0);
  if (base > 130 || added > 30 || (added && base !== 45 && base !== 90))
    throw new Error(`时间「${time}」超出支持范围。补时请使用 45+N 或 90+N。`);
  return { base, added };
}
export function normalizeEvents(events: MatchEvent[]): MatchEvent[] {
  const parsed = events.map((e, index) => {
    const time = parseDisplayTime(e.displayTime);
    const period: 1 | 2 =
      e.period === 1 || e.period === 2 ? e.period : time.base <= 45 ? 1 : 2;
    if (
      (period === 1 && time.base > 45) ||
      (period === 2 && (time.base < 45 || (time.base === 45 && time.added > 0)))
    )
      throw new Error(`时间 ${e.displayTime} 与比赛阶段不一致。`);
    return {
      event: {
        ...e,
        period,
        order: Number.isInteger(e.order) ? e.order : index,
        displayTime: `${time.base}${time.added ? `+${time.added}` : ""}`,
      },
      clock: time.base + time.added,
      index,
    };
  });
  const firstEnd = Math.max(
    45,
    ...parsed.filter((x) => x.event.period === 1).map((x) => x.clock),
  );
  parsed.sort(
    (a, b) =>
      a.event.period - b.event.period ||
      a.clock - b.clock ||
      a.event.order - b.event.order ||
      a.index - b.index,
  );
  return parsed.map(({ event, clock }) => ({
    ...event,
    activeMinute: event.period === 1 ? clock : firstEnd + clock - 45,
  }));
}
export function currentMinute(match: Match, cursor: number): number {
  return cursor < 0
    ? 0
    : (match.events[Math.min(Math.floor(cursor), match.events.length - 1)]
        ?.activeMinute ?? 0);
}
function prefix(match: Match, cursor: number): MatchEvent[] {
  return match.events
    .slice(
      0,
      Math.max(0, Math.min(match.events.length, Math.floor(cursor) + 1)),
    )
    .filter((e) => e.confirmed);
}
export function beneficiary(event: MatchEvent): Side | "unknown" {
  return event.type === "own_goal"
    ? event.team === "home"
      ? "away"
      : event.team === "away"
        ? "home"
        : "unknown"
    : event.team;
}
export function eventWeights(event: MatchEvent, side: Side): number {
  const pair = Object.hasOwn(MOMENTUM_RULES.weights, event.type)
    ? MOMENTUM_RULES.weights[event.type]
    : undefined;
  const team = beneficiary(event);
  return event.confirmed && pair && team !== "unknown"
    ? pair[team === side ? 0 : 1]
    : 0;
}
export function isEffective(event: MatchEvent): boolean {
  return (
    (event.confirmed &&
      event.team !== "unknown" &&
      Object.hasOwn(MOMENTUM_RULES.weights, event.type)) ||
    (event.confirmed &&
      event.type === "var_cancel_goal" &&
      !!event.relatedEventId)
  );
}
// A relation can supersede an earlier shot only once that relation is visible.
// VAR cancellation removes the residual signal from that point onward, never retroactively.
function countedEvents(events: MatchEvent[]): MatchEvent[] {
  const ids = new Map(events.map((e) => [e.id, e]));
  const isGoal = (event: MatchEvent | undefined) =>
    !!event && ["goal", "own_goal"].includes(event.type);
  const shotTypes = ["shot_on_target", "shot_off_target", "shot_blocked"];
  const goalRoots = new Map<string, string>();
  const rootGoal = (event: MatchEvent): string => {
    let current = event;
    const seen = new Set<string>(),
      path: string[] = [];
    while (
      current.relatedEventId &&
      !seen.has(current.id) &&
      !goalRoots.has(current.id)
    ) {
      seen.add(current.id);
      path.push(current.id);
      const related = ids.get(current.relatedEventId);
      if (
        !related ||
        related.type !== current.type ||
        related.team !== current.team ||
        !isGoal(related)
      )
        break;
      current = related;
    }
    const root = goalRoots.get(current.id) ?? current.id;
    goalRoots.set(current.id, root);
    for (const id of path) goalRoots.set(id, root);
    return root;
  };
  const cancelled = new Set(
    events
      .filter((e) => e.type === "var_cancel_goal")
      .map((e) => {
        const goal = e.relatedEventId ? ids.get(e.relatedEventId) : undefined;
        return goal && isGoal(goal) ? rootGoal(goal) : undefined;
      }),
  );
  // A goal replaces its linked shot signal, but never erases an unrelated event
  // such as a red card or a penalty award. Duplicate goals retain the first time.
  const superseded = new Set(
    events
      .filter(
        (e) =>
          isGoal(e) &&
          e.relatedEventId &&
          shotTypes.includes(ids.get(e.relatedEventId)?.type ?? "") &&
          ids.get(e.relatedEventId)?.team === beneficiary(e),
      )
      .map((e) => e.relatedEventId),
  );
  return events.filter((e) => {
    if ((isGoal(e) && cancelled.has(rootGoal(e))) || superseded.has(e.id))
      return false;
    if (e.relatedEventId && e.type !== "var_cancel_goal") {
      const related = ids.get(e.relatedEventId);
      if (
        related &&
        ((related.type === e.type && related.team === e.team) ||
          (e.type === "shot_on_target" &&
            e.team === related.team &&
            ["shot_on_target", "goal"].includes(related.type)) ||
          (e.type === "save" &&
            ["shot_on_target", "goal"].includes(related.type)))
      )
        return false;
    }
    return true;
  });
}
export function momentum(
  match: Match,
  side: Side,
  cursor: number,
  time = currentMinute(match, cursor),
): number {
  // Filter time before resolving VAR/duplicate relations so a later decision
  // cannot rewrite an explicitly requested earlier sample.
  const visible = countedEvents(
    prefix(match, cursor).filter((event) => event.activeMinute <= time),
  );
  let signal = 0;
  for (const event of visible) {
    const age = time - event.activeMinute;
    if (age >= 0 && age <= MOMENTUM_RULES.window)
      signal +=
        eventWeights(event, side) * 2 ** (-age / MOMENTUM_RULES.halfLife);
  }
  return Math.max(0, Math.min(100, MOMENTUM_RULES.baseline + signal));
}
export function scoreAt(match: Match, cursor: number): [number, number] {
  const score: [number, number] = [0, 0];
  for (const event of countedEvents(prefix(match, cursor))) {
    if (event.type !== "goal" && event.type !== "own_goal") continue;
    const team = beneficiary(event);
    if (team !== "unknown") score[team === "home" ? 0 : 1]++;
  }
  return score;
}
export function playersAt(match: Match, cursor: number): [number, number] {
  const players: [number, number] = [11, 11];
  for (const e of countedEvents(prefix(match, cursor)))
    if (e.type === "red_card" && e.team !== "unknown")
      players[e.team === "home" ? 0 : 1]--;
  return players;
}
function withAccuracy(stats: Stats): Stats {
  return stats.passAccuracy === undefined &&
    stats.passes !== undefined &&
    stats.passes > 0 &&
    stats.successfulPasses !== undefined
    ? {
        ...stats,
        passAccuracy:
          Math.round((stats.successfulPasses / stats.passes) * 1000) / 10,
      }
    : { ...stats };
}
export function isFullTime(match: Match, cursor: number): boolean {
  return (
    cursor >= match.events.length - 1 &&
    [...match.events].reverse().find((event) => event.confirmed)?.type ===
      "fulltime"
  );
}
export function statsAt(
  match: Match,
  cursor: number,
): StatsPair & { label: string } {
  if (isFullTime(match, cursor) && match.finalStats)
    return {
      home: withAccuracy(match.finalStats.home),
      away: withAccuracy(match.finalStats.away),
      label: "终场 · 导入统计",
    };
  const snapshot = match.snapshots
    ?.filter((s) => s.cursor <= cursor)
    .sort((a, b) => b.cursor - a.cursor)[0];
  if (snapshot)
    return {
      home: withAccuracy(snapshot.home),
      away: withAccuracy(snapshot.away),
      label: `导入快照 · ${match.events[snapshot.cursor]?.displayTime ?? "0"}′`,
    };
  const visible = countedEvents(prefix(match, cursor));
  const [homeGoals, awayGoals] = scoreAt(match, cursor);
  const result: StatsPair = {
    home: { goals: homeGoals },
    away: { goals: awayGoals },
  };
  for (const side of ["home", "away"] as const) {
    const own = visible.filter((e) => e.team === side);
    const fields: [keyof Stats, EventType[]][] = [
      [
        "shots",
        [
          "goal",
          "shot_on_target",
          "shot_off_target",
          "shot_blocked",
          "penalty_missed",
        ],
      ],
      ["shotsOnTarget", ["goal", "shot_on_target"]],
      ["corners", ["corner"]],
      ["fouls", ["foul"]],
      ["yellowCards", ["yellow_card"]],
      ["redCards", ["red_card"]],
    ];
    for (const [field, types] of fields) {
      const count = own.filter((e) => types.includes(e.type)).length;
      if (count > 0 || match.coverage === "complete")
        result[side][field] = count;
    }
  }
  return {
    ...result,
    label:
      match.coverage === "complete"
        ? "截至当前 · 已记录事件计数"
        : "节选数据 · 至少已记录",
  };
}
export function nextEffectiveIndex(match: Match, cursor: number): number {
  return match.events.findIndex((event, index) => {
    if (index <= cursor || !isEffective(event)) return false;
    const before = countedEvents(prefix(match, index - 1)),
      after = countedEvents(prefix(match, index));
    if (event.type !== "var_cancel_goal")
      return after.some((e) => e.id === event.id);
    const afterIds = new Set(after.map((e) => e.id));
    return before.some(
      (e) =>
        !afterIds.has(e.id) &&
        event.activeMinute - e.activeMinute <= MOMENTUM_RULES.window &&
        (eventWeights(e, "home") !== 0 || eventWeights(e, "away") !== 0),
    );
  });
}
export function sampleSeries(
  match: Match,
  side: Side,
  cursor: number,
): { minute: number; value: number | null; eventIndex: number }[] {
  const end = currentMinute(match, cursor);
  const result: { minute: number; value: number | null; eventIndex: number }[] =
    [];
  const isMissing = (minute: number) =>
    match.missingRanges?.some((r) => minute > r.from && minute < r.to);
  let eventIndex = -1;
  for (let minute = 0; minute <= end; minute += 0.5) {
    while (
      eventIndex + 1 <= cursor &&
      match.events[eventIndex + 1]?.activeMinute < minute
    )
      eventIndex++;
    result.push({
      minute,
      value: isMissing(minute)
        ? null
        : momentum(match, side, eventIndex, minute),
      eventIndex,
    });
    while (
      eventIndex + 1 <= cursor &&
      match.events[eventIndex + 1]?.activeMinute === minute
    ) {
      eventIndex++;
      result.push({
        minute,
        value: isMissing(minute)
          ? null
          : momentum(match, side, eventIndex, minute),
        eventIndex,
      });
    }
  }
  if (!result.length || result[result.length - 1].minute !== end)
    result.push({
      minute: end,
      value: isMissing(end) ? null : momentum(match, side, cursor, end),
      eventIndex: cursor,
    });
  return result;
}
export function rulesCommentary(
  match: Match,
  event: MatchEvent,
  perspective: Perspective,
): { title: string; text: string } {
  const side = beneficiary(event);
  const aligned = perspective !== "neutral" && side === perspective;
  const titles: Partial<Record<EventType, [string, string, string]>> = {
    goal: [
      "球进了，比分改写！ ⚽",
      "进啦！把这一刻记住 ⚽",
      "被攻破了，继续加油 😮‍💨",
    ],
    own_goal: [
      "一次乌龙球，比分改变 ⚽",
      "乌龙球，我们获得进球 ⚽",
      "遗憾，乌龙球改变比分 😮‍💨",
    ],
    shot_on_target: [
      "射正，被门将挡下 🧤",
      "可惜啊，这次被扑出了 😫",
      "扑得漂亮，守住了！ 🧤",
    ],
    shot_off_target: [
      "射门偏出球门 👀",
      "再来一次，射偏了 😮‍💨",
      "这一球偏了，松口气 👀",
    ],
    shot_blocked: [
      "这次射门被封堵了 🛡️",
      "差一点，射门被挡住了 😣",
      "封堵到位！ 🛡️",
    ],
    corner: ["角球机会来了 🚩", "角球机会来了！ 🚩", "对手获得角球，稳住 🚩"],
    red_card: [
      "红牌，场上人数改变 🟥",
      "红牌！要稳住阵脚 🟥",
      "对手被罚下一人 🟥",
    ],
    var_cancel_goal: [
      "VAR 判定：进球取消 📺",
      "进球取消，遗憾啊 📺",
      "VAR 取消了这粒进球 📺",
    ],
    penalty_awarded: [
      "裁判判罚点球 🎯",
      "点球机会，等执行结果 🎯",
      "被判点球，等执行结果 🎯",
    ],
    penalty_missed: [
      "点球没有进 😮‍💨",
      "点球没进，继续加油 😮‍💨",
      "点球没进，守住了 🧤",
    ],
    fulltime: [
      "终场哨响，比赛结束 🏁",
      "终场，感谢这场比赛 🏁",
      "终场，感谢这场比赛 🏁",
    ],
    halftime: ["上半场结束 ⏸", "半场，稍作休息 ⏸", "半场，稍作休息 ⏸"],
    kickoff: ["比赛开始了 ⚽", "开球啦，一起看球 ⚽", "开球啦，一起看球 ⚽"],
  };
  const title =
    titles[event.type]?.[perspective === "neutral" ? 0 : aligned ? 1 : 2] ??
    `${eventLabels[event.type]} · 关注比赛动态`;
  // The body retains the exact source facts; emotion is confined to the heading.
  return { title, text: event.rawText };
}
