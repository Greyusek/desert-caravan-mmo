import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentTypeForDebugMap,
  resolveDebugMapAsset,
} from "./serve-debug-map.mjs";

const repositoryRoot = path.resolve("test-repository-root");
const actualRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("UI-001 tooling: root document references only routable debug-map assets", async () => {
  assert.equal(
    resolveDebugMapAsset(repositoryRoot, "/"),
    path.join(repositoryRoot, "packages", "debug-map", "index.html"),
  );
  assert.equal(
    resolveDebugMapAsset(repositoryRoot, "/packages/debug-map/styles.css?v=1"),
    path.join(repositoryRoot, "packages", "debug-map", "styles.css"),
  );
  assert.equal(
    resolveDebugMapAsset(repositoryRoot, "/packages/sim-core/dist/src/index.js"),
    path.join(repositoryRoot, "packages", "sim-core", "dist", "src", "index.js"),
  );
  assert.equal(resolveDebugMapAsset(repositoryRoot, "/package.json"), null);
  assert.equal(
    resolveDebugMapAsset(repositoryRoot, "/packages/debug-map/../../package.json"),
    null,
  );

  const html = await readFile(
    path.join(actualRepositoryRoot, "packages", "debug-map", "index.html"),
    "utf8",
  );
  const referencedAssets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(referencedAssets, [
    "/packages/debug-map/styles.css",
    "/packages/debug-map/main.js",
  ]);
  for (const asset of referencedAssets) {
    assert.notEqual(resolveDebugMapAsset(actualRepositoryRoot, asset), null);
  }
});

test("UI-001 tooling: server returns browser-safe content types", () => {
  assert.equal(contentTypeForDebugMap("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeForDebugMap("main.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeForDebugMap("styles.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeForDebugMap("source.map"), "application/json; charset=utf-8");
  assert.equal(contentTypeForDebugMap("unknown.bin"), "application/octet-stream");
});

test("UI-008 tooling: tactical panel is wired as a projection-only browser view", async () => {
  const html = await readFile(
    path.join(actualRepositoryRoot, "packages", "debug-map", "index.html"),
    "utf8",
  );
  const main = await readFile(
    path.join(actualRepositoryRoot, "packages", "debug-map", "main.js"),
    "utf8",
  );

  for (const id of [
    "tactical-result",
    "tactical-field",
    "tactical-unit-list",
    "tactical-event-list",
    "tactical-outcome-summary",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(main, /createTacticalDebugSnapshot/);
  assert.doesNotMatch(main, /executeTacticalCommand/);
  assert.doesNotMatch(main, /resolvePveMonsterContact/);
  assert.doesNotMatch(main, /applyTacticalBattleToWorld/);
  assert.doesNotMatch(main, /resolveTacticalCargoOutcome/);
});
