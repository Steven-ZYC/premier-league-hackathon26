import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { createApp } from "../server/app";
import { easyAuthUser } from "../server/auth";
import { clearServiceState, type Environment } from "../api/src/service";

const subject =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64");
const principal = encode({
  auth_typ: "github",
  claims: [{ typ: subject, val: "tester" }],
  name_typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  role_typ: "roles",
});
const headers = { "x-ms-client-principal": principal };
// Test fixtures simulate the platform boundary. Never use these variables to
// turn on header trust on a public standalone Node server.
const platform = {
  WEBSITE_SITE_NAME: "test-app",
  WEBSITE_AUTH_ENABLED: "True",
};
const jsonHeaders = { ...headers, "Content-Type": "application/json" };

test("identity headers fail closed outside Azure or when Easy Auth is disabled", () => {
  for (const env of [
    {},
    { WEBSITE_SITE_NAME: "test-app" },
    { ...platform, WEBSITE_AUTH_ENABLED: "False" },
    { ...platform, WEBSITE_AUTH_ENABLED: "1" },
    { WEBSITE_AUTH_ENABLED: "True" },
  ]) {
    assert.equal(easyAuthUser(headers, env), undefined);
  }
  assert.equal(easyAuthUser(headers, platform), "github:tester");
  assert.equal(
    easyAuthUser(headers, { ...platform, WEBSITE_AUTH_ENABLED: "true" }),
    "github:tester",
  );
});

test("only valid Easy Auth subject claims identify users; SWA/alternative headers cannot", () => {
  const invalid = [
    "bad",
    "!" + principal,
    "a".repeat(12_001),
    encode(null),
    encode([]),
    encode({
      userId: "fake",
      identityProvider: "github",
      userRoles: ["authenticated"],
    }),
    encode({ auth_typ: "anonymous", claims: [{ typ: subject, val: "fake" }] }),
    encode({ auth_typ: "github", claims: [] }),
    encode({ auth_typ: "github", claims: [{ typ: "name", val: "fake" }] }),
    encode({ auth_typ: "github", claims: [{ typ: subject, val: "" }] }),
    encode({ auth_typ: "github", claims: [{ typ: subject, val: 123 }] }),
    encode({
      auth_typ: "github",
      claims: [{ typ: subject, val: "a".repeat(201) }],
    }),
    encode({ auth_typ: "github", claims: [{ typ: subject, val: "a\n" }] }),
    encode({
      auth_typ: "github",
      claims: [
        { typ: subject, val: "a" },
        { typ: subject, val: "b" },
      ],
    }),
  ];
  for (const value of invalid)
    assert.equal(
      easyAuthUser({ "x-ms-client-principal": value }, platform),
      undefined,
    );
  assert.equal(
    easyAuthUser({ "x-ms-client-principal": [principal, principal] }, platform),
    undefined,
  );
  assert.equal(
    easyAuthUser(
      {
        "x-ms-client-principal-id": "fake",
        "x-ms-client-principal-idp": "github",
        authorization: "Bearer fake",
      },
      platform,
    ),
    undefined,
  );
  assert.equal(
    easyAuthUser(
      {
        "x-ms-client-principal": encode({
          auth_typ: "aad",
          claims: [{ typ: subject, val: "tester" }],
        }),
      },
      platform,
    ),
    "aad:tester",
  );
});

async function withServer(
  env: Environment,
  run: (base: string) => Promise<void>,
  fetcher?: typeof fetch,
) {
  const server = createApp({ env, distDir: resolve("dist"), fetcher }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("HTTP adapter ignores forged identity and development bypasses", async () => {
  let calls = 0;
  for (const env of [
    { DEEPSEEK_API_KEY: "server-only-test-key" },
    {
      ...platform,
      WEBSITE_AUTH_ENABLED: "False",
      DEEPSEEK_API_KEY: "server-only-test-key",
    },
  ]) {
    await withServer(
      env,
      async (base) => {
        for (const route of ["predict", "commentary", "parse"]) {
          const response = await fetch(`${base}/api/${route}`, {
            method: "POST",
            headers: {
              ...jsonHeaders,
              "x-ms-client-principal-id": "fake",
              "x-ms-client-principal-idp": "github",
              "x-forwarded-for": "127.0.0.1",
              "website-auth-enabled": "True",
            },
            body: JSON.stringify({
              local: true,
              principal,
              userId: "github:admin",
              raw: "12 Home goal",
              useAI: true,
            }),
          });
          assert.equal(response.status, 401);
          assert.equal((await response.json()).error, "AUTH_REQUIRED");
        }
      },
      async () => {
        calls++;
        throw new Error("must not call DeepSeek");
      },
    );
  }
  assert.equal(calls, 0);
});

test("Easy Auth identity reaches unchanged API; absent key degrades safely", async () => {
  await withServer(platform, async (base) => {
    const response = await fetch(`${base}/api/parse`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        raw: "12 Home goal",
        home: "Home",
        away: "Away",
        useAI: true,
      }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "AI_UNAVAILABLE");
    const rules = await fetch(`${base}/api/parse`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        raw: "12 Home goal",
        home: "Home",
        away: "Away",
        useAI: false,
      }),
    });
    assert.equal(rules.status, 200);
    assert.equal((await rules.json()).mode, "rules");
  });
});

test("body limits include chunked input; invalid JSON/compression never echo body", async () => {
  await withServer(platform, async (base) => {
    for (const [body, status, error] of [
      ['{"secret":"sentinel"', 400, "INVALID_JSON"],
      [JSON.stringify({ raw: "a".repeat(250_001) }), 413, "INPUT_TOO_LARGE"],
    ] as const) {
      // Async stream intentionally omits Content-Length.
      const response = await fetch(`${base}/api/parse`, {
        method: "POST",
        headers: jsonHeaders,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            controller.close();
          },
        }),
        duplex: "half",
      } as RequestInit);
      assert.equal(response.status, status);
      assert.equal((await response.json()).error, error);
    }
    const compressed = await fetch(`${base}/api/parse`, {
      method: "POST",
      headers: { ...jsonHeaders, "Content-Encoding": "gzip" },
      body: "sentinel",
    });
    assert.equal(compressed.status, 415);
    assert.ok(!(await compressed.text()).includes("sentinel"));
    const missing = await fetch(`${base}/api/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type")!, /application\/json/);
    const method = await fetch(`${base}/api/predict`);
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "POST");
  });
});

test("server-only key/model reach DeepSeek and upstream errors cannot leak secrets", async () => {
  clearServiceState();
  const secret = "server-only-sentinel-key";
  let calls = 0;
  await withServer(
    {
      ...platform,
      DEEPSEEK_API_KEY: secret,
      DEEPSEEK_MODEL: "configured-model",
    },
    async (base) => {
      const health = await fetch(`${base}/api/health`);
      const body = await health.json();
      assert.equal(body.aiConfigured, true);
      assert.equal(body.model, "configured-model");
      assert.equal(body.authRequired, true);
      assert.ok(!JSON.stringify(body).includes(secret));
      for (let i = 0; i < 13; i++) {
        const response = await fetch(`${base}/api/parse`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            raw: "12 Home goal",
            home: "Home",
            away: "Away",
            useAI: true,
          }),
        });
        assert.equal(response.status, i < 12 ? 502 : 429);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.ok(!(await response.text()).includes(secret));
      }
    },
    async (url, options) => {
      calls++;
      assert.equal(url, "https://api.deepseek.com/chat/completions");
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        `Bearer ${secret}`,
      );
      assert.equal(JSON.parse(String(options?.body)).model, "configured-model");
      return new Response(`upstream echoed ${secret}`, { status: 401 });
    },
  );
  assert.equal(calls, 12);
});
