import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  contentTypeForDebugMap,
  resolveDebugMapAsset,
} from "./serve-debug-map.mjs";

const repositoryRoot = path.resolve("test-repository-root");

test("UI-001 tooling: static server exposes only debug-map and compiled sim assets", () => {
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
});

test("UI-001 tooling: server returns browser-safe content types", () => {
  assert.equal(contentTypeForDebugMap("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeForDebugMap("main.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeForDebugMap("styles.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeForDebugMap("source.map"), "application/json; charset=utf-8");
  assert.equal(contentTypeForDebugMap("unknown.bin"), "application/octet-stream");
});
