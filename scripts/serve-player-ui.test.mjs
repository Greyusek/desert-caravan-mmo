import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  contentTypeForPlayerUi,
  createPlayerUiSessionPayload,
  createPlayerUiSessionStore,
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
    "/packages/player-ui/bootstrap.js",
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
      [
        "index.html",
        "bootstrap.js",
        "main.js",
        "shell-model.js",
        "global-model.js",
      ].map((file) =>
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

test("PLAYER-SHELL-001 tooling: bootstrap cannot leave loading active indefinitely", async () => {
  const [html, bootstrap, main] = await Promise.all(
    ["index.html", "bootstrap.js", "main.js"].map((file) =>
      readFile(path.join(playerUiRoot, file), "utf8"),
    ),
  );

  assert.match(html, /id="error-detail"/);
  assert.match(html, /id="retry-button"/);
  assert.match(bootstrap, /BOOTSTRAP_TIMEOUT_MS = 10_000/);
  assert.match(bootstrap, /import\("\.\/main\.js"\)\.catch/);
  assert.match(bootstrap, /loadingState\.hidden = true/);
  assert.match(main, /PLAYER_SESSION_TIMEOUT_MS = 8_000/);
  assert.match(main, /signal: abortController\.signal/);
  assert.match(main, /player-ui:ready/);
  assert.match(main, /player-ui:error/);
});

test("PLAYER-SHELL-001 tooling: runtime element checks match the actual HTML tags", async () => {
  const [html, main] = await Promise.all(
    ["index.html", "main.js"].map((file) =>
      readFile(path.join(playerUiRoot, file), "utf8"),
    ),
  );
  const specializedTags = new Map([
    ["HTMLHeadingElement", new Set(["h1", "h2", "h3", "h4", "h5", "h6"])],
    ["HTMLParagraphElement", new Set(["p"])],
    ["HTMLSpanElement", new Set(["span"])],
  ]);
  const requirements = [
    ...main.matchAll(/requireElement\("([^"]+)", ([A-Za-z]+)\)/g),
  ];

  assert.ok(requirements.length > 0);
  for (const [, id, constructorName] of requirements) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tagMatch = html.match(
      new RegExp(`<([a-z][a-z0-9-]*)\\b[^>]*\\bid="${escapedId}"`),
    );
    assert.ok(tagMatch, `missing HTML element: ${id}`);
    const allowedTags = specializedTags.get(constructorName);
    if (allowedTags) {
      assert.ok(
        allowedTags.has(tagMatch[1]),
        `${id} is <${tagMatch[1]}> but requires ${constructorName}`,
      );
    }
  }
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

test("PLAYER-GLOBAL-001 tooling: local session store dispatches only projected actions", () => {
  const store = createPlayerUiSessionStore("player-global-action-test");
  const initial = JSON.parse(store.getPayload());
  const ready = JSON.parse(
    store.dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    }),
  );
  const travelling = JSON.parse(store.dispatch({ kind: "START_JOURNEY" }));

  assert.equal(initial.phase, "city");
  assert.equal(ready.phase, "ready");
  assert.equal(ready.map.route.status, "planned");
  assert.equal(travelling.phase, "travelling");
  assert.equal(travelling.map.route.status, "moving");
  assert.equal(JSON.stringify(store), "{}");
});

test("PLAYER-GLOBAL-001 tooling: rejected actions cannot advance the session", () => {
  const store = createPlayerUiSessionStore("player-global-rejection-test");

  assert.throws(
    () =>
      store.dispatch({
        kind: "SELECT_DESTINATION",
        destinationRef: "place:unknown",
      }),
    /destination is not known/,
  );
  assert.throws(() => store.dispatch({ kind: "DELETE_WORLD" }), /unsupported/);
  assert.equal(JSON.parse(store.getPayload()).revision, 0);
});
