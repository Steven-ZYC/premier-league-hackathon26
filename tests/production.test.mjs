import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

test(
  "prebuilt production package starts with npm start without node_modules or compilers",
  { timeout: 20_000 },
  async () => {
    const cwd = resolve("release");
    const files = await readdir(cwd);
    assert.deepEqual(files.sort(), [
      ".deployment",
      "build",
      "dist",
      "package.json",
    ]);
    const manifest = JSON.parse(
      await readFile(join(cwd, "package.json"), "utf8"),
    );
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.devDependencies, undefined);
    assert.match(manifest.scripts.start, /^node .*build\/server.cjs$/);
    const secret = "production-smoke-sentinel-key";
    const child = spawn("npm", ["start"], {
      cwd,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "0",
        DEEPSEEK_API_KEY: secret,
        DEEPSEEK_MODEL: "smoke-model",
        WEBSITE_SITE_NAME: "",
        WEBSITE_AUTH_ENABLED: "False",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(child, "exit");
    let logs = "";
    child.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    try {
      const port = await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("npm start did not become ready")),
          10_000,
        );
        const check = () => {
          const match = logs.match(/listening on 0\.0\.0\.0:(\d+)/);
          if (match) {
            clearTimeout(timeout);
            resolve(match[1]);
          }
        };
        child.stdout.on("data", check);
        child.once("exit", () => {
          clearTimeout(timeout);
          reject(new Error("npm start exited before readiness"));
        });
      });
      const base = `http://127.0.0.1:${port}`;
      const health = await fetch(`${base}/api/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), {
        ok: true,
        aiConfigured: true,
        model: "smoke-model",
        authRequired: true,
      });
      for (const path of ["/", "/replay/example"]) {
        const response = await fetch(base + path, {
          headers: { Accept: "text/html" },
        });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /id="root"/);
        assert.equal(response.headers.get("cache-control"), "no-cache");
        assert.equal(response.headers.get("x-powered-by"), null);
        const assets = [
          ...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g),
        ];
        assert.ok(assets.length > 0);
        for (const [, asset] of assets) {
          const result = await fetch(base + asset);
          assert.equal(result.status, 200);
          assert.match(result.headers.get("cache-control"), /immutable/);
        }
      }
      for (const path of [
        "/api/missing",
        "/assets/missing.js",
        "/.env",
        "/package.json",
        "/build/server.cjs",
        "/src/App.tsx",
        "/staticwebapp.config.json",
      ]) {
        const response = await fetch(base + path);
        assert.equal(response.status, 404, path);
        assert.ok(!(await response.text()).includes(secret));
      }
      for (const path of ["/.auth/me", "/.auth/login/github"]) {
        const response = await fetch(base + path);
        assert.equal(response.status, 503);
        assert.equal((await response.json()).error, "AUTH_NOT_CONFIGURED");
      }
      const principal = Buffer.from(
        JSON.stringify({
          auth_typ: "github",
          claims: [
            {
              typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
              val: "attacker",
            },
          ],
        }),
      ).toString("base64");
      for (const route of ["predict", "commentary", "parse"]) {
        const response = await fetch(`${base}/api/${route}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ms-client-principal": principal,
          },
          body: JSON.stringify({ local: true, userId: "github:attacker" }),
        });
        assert.equal(response.status, 401);
        assert.ok(!(await response.text()).includes(secret));
      }
      // Every deployed file is inspected, including lazy front-end chunks.
      async function scan(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) await scan(path);
          else {
            const data = await readFile(path);
            for (const key of [
              secret,
              "build-time-leak-sentinel-not-a-real-key",
            ])
              assert.ok(!data.includes(Buffer.from(key)), path);
          }
        }
      }
      await scan(cwd);
      assert.ok(!logs.includes(secret));
    } finally {
      // Kill the npm + Node process group so the test never leaves a server behind.
      if (child.exitCode === null) process.kill(-child.pid, "SIGTERM");
      await exited;
    }
  },
);
