import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  contentTypeForPlayerUi,
  createPlayerUiSessionPayload,
  resolvePlayerUiAsset,
} from "./serve-player-ui.mjs";

const repositoryRoot = path.resolve("test-repository-root");
const actualRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const playerUiRoot = path.join(actualRepositoryRoot, "packages", "player-ui");

test("PLAYER-SHELL-001 tooling: server exposes only Player UI assets", () => {
  assert.equal(
    resolvePlayerUiAsset(repositoryRoot, "/"),
    path.join(repositoryRoot, "packages", "player-ui", "index.html"),
  );
  assert.equal(
    resolvePlayerUiAsset(repositoryRoot, "/packages/player-ui/main.js?v=1"),
    path.join(repositoryRoot, "packages", "player-ui", "main.js"),
  );
  assert.equal(resolvePlayerUiAsset(repositoryRoot, "/package.json"), null);
  assert.equal(
    resolvePlayerUiAsset(repositoryRoot, "/packages/debug-map/index.html"),
    null,
  );
  assert.equal(
    resolvePlayerUiAsset(repositoryRoot, "/packages/sim-core/dist/src/index.js"),
    null,
  );
});

test("PLAYER-SHELL-001 tooling: server uses browser-safe content types", () => {
  assert.equal(contentTypeForPlayerUi("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeForPlayerUi("main.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeForPlayerUi("styles.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeForPlayerUi("unknown.bin"), "application/octet-stream");
});

test("PLAYER-SHELL-001 tooling: root document references only routable player assets", async () => {
  const html = await readFile(path.join(playerUiRoot, "index.html"), "utf8");
  const assets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((asset) => asset.startsWith("/packages/"));

  assert.deepEqual(assets, [
    "/packages/player-ui/styles.css",
    "/packages/player-ui/main.js",
  ]);
  assert.ok(
    assets.every(
      (asset) => resolvePlayerUiAsset(actualRepositoryRoot, asset) !== null,
    ),
  );
});

test("PLAYER-SHELL-001 tooling: browser source contains no privileged controls or fields", async () => {
  const source = (
    await Promise.all(
      ["index.html", "main.js", "shell-model.js"].map((file) =>
        readFile(path.join(playerUiRoot, file), "utf8"),
      ),
    )
  ).join("\n");
  const lower = source.toLowerCase();

  for (const forbidden of [
    "worldseed",
    "latitude",
    "longitude",
    "battleid",
    "scarcitymultiplier",
    "costbasiscredits",
    "dev overlay",
    "sim-core/dist/src/index.js\";",
  ]) {
    assert.equal(lower.includes(forbidden), false, forbidden);
  }
  assert.doesNotMatch(source, /PLAYER_UI_SEED/);
});

test("PLAYER-SHELL-001 tooling: HTML exposes accessible navigation and state regions", async () => {
  const html = await readFile(path.join(playerUiRoot, "index.html"), "utf8");

  assert.match(html, /id="primary-navigation"/);
  assert.match(html, /aria-label="Разделы игры"/);
  assert.match(html, /role="status"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /class="skip-link"/);
});

test("PLAYER-SHELL-001 tooling: local API serializes only the safe player view", () => {
  const payload = createPlayerUiSessionPayload("player-shell-api-test");
  const parsed = JSON.parse(payload);

  assert.equal(parsed.phase, "city");
  assert.equal(parsed.screens.length, 5);
  for (const forbidden of [
    "player-shell-api-test",
    "latitudeDeg",
    "longitudeDeg",
    "monster",
    "battlefield",
    "battleId",
    "costBasisCredits",
    "scarcityMultiplier",
  ]) {
    assert.equal(payload.includes(forbidden), false, forbidden);
  }
});
