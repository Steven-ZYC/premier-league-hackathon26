import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

// Allow-list deployable files. Never upload the repository, .env, dev tools,
// frontend source, Functions runtime, or node_modules to the F1 worker.
await rm("release", { recursive: true, force: true });
await mkdir("release/build", { recursive: true });
await cp("dist", "release/dist", { recursive: true });
await cp("build/server.cjs", "release/build/server.cjs");
const source = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  "release/package.json",
  JSON.stringify(
    {
      name: source.name,
      version: source.version,
      private: true,
      scripts: { start: source.scripts.start },
      engines: source.engines,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "release/.deployment",
  "[config]\nSCM_DO_BUILD_DURING_DEPLOYMENT=false\n",
);
console.log(
  "App Service package ready in release/ (bundled server, no runtime install).",
);
