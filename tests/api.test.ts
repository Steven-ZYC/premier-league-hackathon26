import test from "node:test";
import assert from "node:assert/strict";
import type { Match } from "../shared/types";
import { normalizeEvents } from "../shared/engine";
import { buildPrefixContext } from "../api/src/context";
import { handleApi, principalUser } from "../api/src/handler";
import { clearServiceState, hash, throttle } from "../api/src/service";

function fixture(): Match {
  return {
    id: "test",
    version: "client-v1",
    title: "FUTURE_TITLE",
    competition: "Test",
    date: "2026-01-01",
    home: { name: "主队", short: "H", color: "#8855ff" },
    away: { name: "客队", short: "A", color: "#ffcc00" },
    events: normalizeEvents([
      {
        id: "a",
        period: 1,
        displayTime: "12",
        order: 0,
        activeMinute: 12,
        team: "home",
        type: "goal",
        rawText: "12 主队进球",
        confirmed: true,
      },
      {
        id: "b",
        period: 1,
        displayTime: "15",
        order: 1,
        activeMinute: 15,
        team: "away",
        type: "corner",
        rawText: "15 客队角球",
        confirmed: true,
      },
      {
        id: "c",
        period: 2,
        displayTime: "80",
        order: 2,
        activeMinute: 80,
        team: "home",
        type: "shot_off_target",
        rawText: "FUTURE_EVENT",
        confirmed: true,
      },
      {
        id: "d",
        period: 2,
        displayTime: "90",
        order: 3,
        activeMinute: 90,
        team: "unknown",
        type: "fulltime",
        rawText: "FUTURE_FULLTIME",
        confirmed: true,
      },
    ]),
    coverage: "excerpt",
    source: "FUTURE_SOURCE",
    rawInput: "RAW_INPUT_CONTAINS_FUTURE",
    demo: false,
    finalStats: {
      home: { goals: 1, passes: 999 },
      away: { goals: 0, passes: 888 },
    },
    snapshots: [
      { cursor: 1, home: { passes: 10 }, away: { passes: 11 } },
      { cursor: 3, home: { passes: 999 }, away: { passes: 888 } },
    ],
    duration: 90,
  };
}
const principal = Buffer.from(
  JSON.stringify({
    userId: "tester",
    identityProvider: "github",
    userRoles: ["authenticated"],
  }),
).toString("base64");
const modelResponse = (value: unknown) =>
  new Response(
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(value) } },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
test("server context omits future events, rawInput, finalStats and untrusted metadata", () => {
  const match = fixture(),
    context = buildPrefixContext(match, 1),
    serialized = JSON.stringify(context);
  for (const forbidden of ["FUTURE", "RAW_INPUT", "999", "888"])
    assert.ok(!serialized.includes(forbidden), forbidden);
  assert.equal(context.events.length, 2);
  assert.deepEqual(context.score, [1, 0]);
  assert.equal(context.knownStats.home.passes, 10);
  const changed = structuredClone(match);
  changed.events[2].rawText = "MODIFIED_LATER";
  changed.finalStats!.home.passes = 777;
  assert.deepEqual(
    buildPrefixContext(match, 1),
    buildPrefixContext(changed, 1),
  );
  assert.notEqual(hash(match), hash(changed));
});
test("health is public and does not expose key", async () => {
  const response = await handleApi(
    { path: "/api/health", method: "GET" },
    { DEEPSEEK_API_KEY: "secret" },
  );
  assert.equal(response.status, 200);
  assert.equal((response.body as { aiConfigured: boolean }).aiConfigured, true);
  assert.ok(!JSON.stringify(response.body).includes("secret"));
});
test("AI requests require authenticated trusted-platform identity", async () => {
  assert.equal(principalUser("bad"), undefined);
  assert.equal(
    principalUser(
      Buffer.from(
        JSON.stringify({
          userId: "fake",
          identityProvider: "github",
          userRoles: ["anonymous"],
        }),
      ).toString("base64"),
    ),
    undefined,
  );
  assert.equal(principalUser(principal), "github:tester");
  const response = await handleApi(
    {
      path: "/api/predict",
      method: "POST",
      body: { match: fixture(), cursor: 1, team: "home" },
    },
    {},
  );
  assert.equal(response.status, 401);
});
test("missing key returns explicit unavailable, never a pretend prediction", async () => {
  clearServiceState();
  const response = await handleApi(
    {
      path: "/api/predict",
      method: "POST",
      principal,
      body: { match: fixture(), cursor: 1, team: "home" },
    },
    {},
  );
  assert.equal(response.status, 503);
  assert.equal((response.body as { error: string }).error, "AI_UNAVAILABLE");
  assert.ok(!("direction" in (response.body as object)));
});
test("prediction sends prefix, caches immutable result, invalidates when future input changes", async () => {
  clearServiceState();
  let calls = 0;
  const requests: string[] = [];
  const fetcher: typeof fetch = async (_url, options) => {
    calls++;
    requests.push(String(options?.body));
    return modelResponse({
      direction: "up",
      explanation: "基于已知进球及角球信号，方向仍有不确定性。",
    });
  };
  const match = fixture(),
    request = {
      path: "/api/predict",
      method: "POST",
      principal,
      body: { match, cursor: 1, team: "home" },
    };
  const first = await handleApi(
    request,
    { DEEPSEEK_API_KEY: "mock-key" },
    fetcher,
  );
  assert.equal(first.status, 200);
  assert.equal((first.body as { cached: boolean }).cached, false);
  const second = await handleApi(
    request,
    { DEEPSEEK_API_KEY: "mock-key" },
    fetcher,
  );
  assert.equal((second.body as { cached: boolean }).cached, true);
  assert.equal(calls, 1);
  for (const forbidden of ["FUTURE", "RAW_INPUT", "999", "888"])
    assert.ok(!requests[0].includes(forbidden), forbidden);
  const changed = structuredClone(match);
  changed.events[2].rawText = "NEW_FUTURE";
  await handleApi(
    { ...request, body: { ...request.body, match: changed } },
    { DEEPSEEK_API_KEY: "mock-key" },
    fetcher,
  );
  assert.equal(calls, 2);
  assert.equal(requests[0], requests[1]);
});
test("commentary rejects future events and only forwards through selected event", async () => {
  clearServiceState();
  const match = fixture();
  const future = await handleApi(
    {
      path: "/api/commentary",
      method: "POST",
      principal,
      body: { match, cursor: 1, eventId: "c", perspective: "home" },
    },
    { DEEPSEEK_API_KEY: "test" },
  );
  assert.equal(future.status, 400);
  let submitted = "";
  const fetcher: typeof fetch = async (_url, options) => {
    submitted = String(options?.body);
    return modelResponse({ title: "球进了 ⚽", text: "12 主队进球" });
  };
  const result = await handleApi(
    {
      path: "/api/commentary",
      method: "POST",
      principal,
      body: { match, cursor: 3, eventId: "a", perspective: "home" },
    },
    { DEEPSEEK_API_KEY: "test" },
    fetcher,
  );
  assert.equal(result.status, 200);
  assert.ok(!submitted.includes("客队角球"));
  assert.ok(!submitted.includes("FUTURE"));
});
test("invalid model schema is rejected without caching", async () => {
  clearServiceState();
  const fetcher: typeof fetch = async () =>
    modelResponse({ direction: "win", explanation: "not valid" });
  const response = await handleApi(
    {
      path: "/api/predict",
      method: "POST",
      principal,
      body: { match: fixture(), cursor: 1, team: "home" },
    },
    { DEEPSEEK_API_KEY: "test" },
    fetcher,
  );
  assert.equal(response.status, 502);
  assert.equal((response.body as { error: string }).error, "AI_INVALID_OUTPUT");
});
test("cursor validation, methods, JSON schema and per-user throttling", async () => {
  clearServiceState();
  const invalid = await handleApi(
    {
      path: "/api/predict",
      method: "POST",
      principal,
      body: { match: fixture(), cursor: 999, team: "home" },
    },
    {},
  );
  assert.equal(invalid.status, 400);
  const method = await handleApi({ path: "/api/predict", method: "GET" }, {});
  assert.equal(method.status, 405);
  const malformed = await handleApi(
    { path: "/api/parse", method: "POST", principal, body: [] },
    {},
  );
  assert.equal(malformed.status, 400);
  for (let i = 0; i < 12; i++) throttle("same-user", 1000);
  assert.throws(() => throttle("same-user", 1000), /每分钟/);
  assert.doesNotThrow(() => throttle("another-user", 1000));
  assert.doesNotThrow(() => throttle("same-user", 61000));
});
