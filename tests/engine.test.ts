import { test } from "node:test";
import assert from "node:assert/strict";
import type { Match, MatchEvent } from "../shared/types";
import {
  momentum,
  normalizeEvents,
  playersAt,
  sampleSeries,
  scoreAt,
  statsAt,
  nextEffectiveIndex,
  isFullTime,
} from "../shared/engine";
import { parseText, validateMatch, versionMatch } from "../shared/parser";
import { demoMatches } from "../shared/demos";

function fixture(lines: string[]): Match {
  return {
    ...demoMatches[0],
    id: "test",
    demo: false,
    version: "test",
    home: { name: "主队", short: "H", color: "#ff0000" },
    away: { name: "客队", short: "A", color: "#ffffff" },
    events: parseText(lines.join("\n"), "主队", "客队"),
    finalStats: undefined,
    snapshots: undefined,
    coverage: "excerpt",
  };
}

test("all three fictional demos contain >=20 events, valid explicit scores and deterministic curves", () => {
  assert.equal(demoMatches.length, 3);
  for (const match of demoMatches) {
    assert.equal(match.demo, true);
    assert.ok(match.events.length >= 20);
    assert.deepEqual(scoreAt(match, match.events.length - 1), [
      match.finalStats!.home.goals,
      match.finalStats!.away.goals,
    ]);
    assert.deepEqual(
      sampleSeries(match, "home", 10),
      sampleSeries(match, "home", 10),
    );
    assert.ok(match.events.every((e) => e.confirmed));
  }
});
test("45+2 remains before 46; same-minute original order is preserved without fabricated seconds", () => {
  const match = fixture([
    "46′ 主队射偏。",
    "45+2′ 客队角球。",
    "46′ 主队射正。",
  ]);
  assert.deepEqual(
    match.events.map((e) => e.displayTime),
    ["45+2", "46", "46"],
  );
  assert.deepEqual(
    match.events.map((e) => e.order),
    [1, 0, 2],
  );
  assert.equal(match.events[0].period, 1);
  assert.equal(match.events[1].period, 2);
  assert.ok(match.events[0].activeMinute < match.events[1].activeMinute);
  assert.equal(match.events[1].activeMinute, match.events[2].activeMinute);
});
test("momentum follows half-life, window, baseline, and independent team weights", () => {
  const match = fixture(["12′ 主队进球。"]);
  assert.equal(momentum(match, "home", 0), 62);
  assert.equal(momentum(match, "away", 0), 44);
  assert.equal(momentum(match, "home", 0, 15), 56);
  assert.equal(momentum(match, "away", 0, 15), 47);
  assert.equal(momentum(match, "home", 0, 21), 50);
  assert.notEqual(momentum(match, "home", 0) + momentum(match, "away", 0), 100);
});
test("changing future event cannot change earlier state or curve", () => {
  const match = fixture(["12′ 主队进球。", "20′ 客队角球。", "38′ 客队进球。"]);
  const changed = {
    ...match,
    events: match.events.map((e, i) =>
      i === 2
        ? { ...e, type: "red_card" as const, rawText: "future modification" }
        : e,
    ),
  };
  assert.equal(momentum(match, "home", 1), momentum(changed, "home", 1));
  assert.deepEqual(scoreAt(match, 1), scoreAt(changed, 1));
  assert.deepEqual(
    sampleSeries(match, "away", 1),
    sampleSeries(changed, "away", 1),
  );
  assert.notEqual(versionMatch(match), versionMatch(changed));
});
test("VAR cancels score and residual weight only from the decision onward", () => {
  const match = fixture(["10′ 主队进球。", "12′ VAR 取消主队进球。"]);
  assert.deepEqual(scoreAt(match, 0), [1, 0]);
  assert.equal(momentum(match, "home", 0), 62);
  assert.deepEqual(scoreAt(match, 1), [0, 0]);
  assert.equal(momentum(match, "home", 1), 50);
  assert.equal(match.events[1].relatedEventId, match.events[0].id);
});
test("own goal benefits opposing team and a red-card population persists after momentum decays", () => {
  const match = fixture([
    "8′ 主队乌龙球。",
    "14′ 客队红牌。",
    "40′ 主队角球。",
  ]);
  assert.deepEqual(scoreAt(match, 0), [0, 1]);
  assert.equal(momentum(match, "away", 0), 62);
  assert.deepEqual(playersAt(match, 2), [11, 10]);
  assert.equal(momentum(match, "away", 2), 50);
});
test("linked duplicate shot/save and linked shot/goal each count one attempt", () => {
  const match = fixture(["10′ 主队射正。", "10′ 客队扑救。", "10′ 主队进球。"]);
  match.events[1].relatedEventId = match.events[0].id;
  match.events[2].relatedEventId = match.events[0].id;
  assert.equal(momentum(match, "home", 1), 55);
  assert.equal(momentum(match, "home", 2), 62);
  assert.equal(statsAt(match, 2).home.shots, 1);
  assert.equal(statsAt(match, 2).home.shotsOnTarget, 1);
});
test("partial records leave unsupported statistics missing and final stats do not leak before full time", () => {
  const match = fixture(["10′ 主队角球。", "90′ 全场结束。"]);
  match.finalStats = {
    home: { passes: 500, successfulPasses: 450 },
    away: { passes: 300 },
  };
  assert.equal(statsAt(match, 0).home.passes, undefined);
  assert.equal(statsAt(match, 0).home.shots, undefined);
  assert.equal(statsAt(match, 1).home.passAccuracy, 90);
  assert.equal(statsAt(match, 1).away.passAccuracy, undefined);
});
test("parser preserves unknown raw content and never guesses player affiliation", () => {
  const match = fixture(["12′ Rashford射偏。", "18′ 主队进行未知战术。"]);
  assert.equal(match.events[0].team, "unknown");
  assert.equal(match.events[0].confirmed, false);
  assert.equal(match.events[1].type, "unknown");
  assert.equal(match.events[1].rawText, "18′ 主队进行未知战术。");
});
test("prediction steps skip non-effective events and return -1 after last effective event", () => {
  const match = fixture([
    "1′ 比赛开球。",
    "2′ 主队犯规。",
    "3′ 主队角球。",
    "90′ 全场结束。",
  ]);
  assert.equal(nextEffectiveIndex(match, -1), 2);
  assert.equal(nextEffectiveIndex(match, 2), -1);
});
test("series breaks in explicit missing-data ranges and never includes future points", () => {
  const match = fixture(["10′ 主队角球。", "20′ 客队射偏。"]);
  match.missingRanges = [{ from: 5, to: 8 }];
  const series = sampleSeries(match, "home", 0);
  assert.ok(series.some((p) => p.minute === 6 && p.value === null));
  assert.ok(series.every((p) => p.minute <= 10));
});
test("strict JSON rejects duplicate ids, invalid links and conflicting final-score statistics", () => {
  const match = fixture(["10′ 主队进球。", "20′ 客队角球。"]);
  assert.equal(validateMatch(match).demo, false);
  assert.throws(
    () =>
      validateMatch({ ...match, events: [match.events[0], match.events[0]] }),
    /ID/,
  );
  assert.throws(
    () =>
      validateMatch({
        ...match,
        events: [
          { ...match.events[0], relatedEventId: "missing" },
          match.events[1],
        ],
      }),
    /关联/,
  );
  assert.throws(
    () =>
      validateMatch({
        ...match,
        coverage: "complete",
        finalStats: { home: { goals: 0 }, away: { goals: 0 } },
      }),
    /冲突/,
  );
  assert.throws(
    () =>
      normalizeEvents([
        { ...match.events[0], displayTime: "45+99" } as MatchEvent,
      ]),
    /时间/,
  );
});
test("JSON snapshot stays attached to the same event when imported events are sorted", () => {
  const match = fixture(["10′ 主队角球。", "20′ 客队射偏。"]);
  const imported = validateMatch({
    ...match,
    events: [match.events[1], match.events[0]],
    snapshots: [{ cursor: 0, home: { passes: 100 }, away: { passes: 80 } }],
  });
  assert.equal(imported.snapshots![0].cursor, 1);
  assert.equal(statsAt(imported, 0).home.passes, undefined);
  assert.equal(statsAt(imported, 1).home.passes, 100);
});
test("an explicit historical sample resolves only relations visible at its time", () => {
  const match = fixture(["10′ 主队进球。", "12′ VAR 取消主队进球。"]);
  assert.equal(momentum(match, "home", 1, 10), 62);
  assert.equal(momentum(match, "away", 1, 10), 44);
  assert.equal(momentum(match, "home", 1, 12), 50);
});
test("prototype enum names are treated as unknown and cannot poison numeric calculations", () => {
  const match = fixture(["10′ 主队角球。"]);
  const imported = validateMatch({
    ...match,
    events: [{ ...match.events[0], type: "constructor" }],
  });
  assert.equal(imported.events[0].type, "unknown");
  assert.equal(momentum(imported, "home", 0), 50);
  const direct = {
    ...match,
    events: [{ ...match.events[0], type: "constructor" as MatchEvent["type"] }],
  };
  assert.equal(momentum(direct, "home", 0), 50);
  assert.equal(nextEffectiveIndex(direct, -1), -1);
});
test("a goal relation cannot erase an unrelated red card", () => {
  const match = fixture(["10′ 主队红牌。", "12′ 主队进球。"]);
  match.events[1].relatedEventId = match.events[0].id;
  assert.deepEqual(playersAt(match, 1), [10, 11]);
  assert.equal(momentum(match, "home", 1), 62 - 8 * 2 ** (-2 / 3));
});
test("duplicate goals retain the first signal time and VAR cancels the entire linked action", () => {
  const match = fixture([
    "10′ 主队进球。",
    "11′ 主队进球。",
    "12′ VAR 取消主队进球。",
  ]);
  match.events[1].relatedEventId = match.events[0].id;
  match.events[2].relatedEventId = match.events[0].id;
  assert.deepEqual(scoreAt(match, 1), [1, 0]);
  assert.equal(momentum(match, "home", 1), 50 + 12 * 2 ** (-1 / 3));
  assert.deepEqual(scoreAt(match, 2), [0, 0]);
  assert.equal(momentum(match, "home", 2), 50);
  assert.equal(nextEffectiveIndex(match, 0), 2);
});
test("predictions skip duplicate signals and expired VAR momentum corrections", () => {
  const match = fixture([
    "10′ 主队进球。",
    "11′ 主队进球。",
    "30′ VAR 取消主队进球。",
    "35′ 客队角球。",
  ]);
  match.events[1].relatedEventId = match.events[0].id;
  match.events[2].relatedEventId = match.events[0].id;
  assert.equal(nextEffectiveIndex(match, 0), 3);
});
test("JSON rejects impossible calendar days, fractional counts and conflicting passing percentages", () => {
  const match = fixture(["10′ 主队角球。"]);
  assert.throws(() => validateMatch({ ...match, date: "2026-02-31" }), /日期/);
  assert.throws(
    () =>
      validateMatch({
        ...match,
        finalStats: { home: { shots: 1.5 }, away: {} },
      }),
    /整数/,
  );
  assert.throws(
    () =>
      validateMatch({
        ...match,
        finalStats: {
          home: { passes: 100, successfulPasses: 80, passAccuracy: 50 },
          away: {},
        },
      }),
    /冲突/,
  );
});
test("an excerpt ending at 67 is end-of-record, never a gateway to final statistics", () => {
  const match = fixture(["12′ 主队进球。", "67′ 主队射正。"]);
  match.finalStats = {
    home: { goals: 2, passes: 500 },
    away: { goals: 1, passes: 400 },
  };
  const imported = validateMatch(match);
  assert.equal(isFullTime(imported, 1), false);
  assert.equal(statsAt(imported, 1).home.passes, undefined);
  assert.equal(statsAt(imported, 1).home.goals, 1);
  const finished = fixture([
    "12′ 主队进球。",
    "67′ 主队射正。",
    "90′ 全场结束。",
  ]);
  finished.finalStats = {
    home: { goals: 1, passes: 500 },
    away: { goals: 0, passes: 400 },
  };
  assert.equal(isFullTime(finished, 2), true);
  assert.equal(statsAt(finished, 2).home.passes, 500);
});
test("first-half added time cannot be assigned to the second half by malformed JSON", () => {
  const match = fixture(["45+2′ 主队角球。"]);
  assert.throws(
    () =>
      validateMatch({ ...match, events: [{ ...match.events[0], period: 2 }] }),
    /阶段/,
  );
});
