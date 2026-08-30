import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../../sim-core/dist/src/index.js";
import {
  PLAYER_SCREEN_DEFINITIONS,
  createPlayerShellState,
} from "../shell-model.js";

const view = createPlayerSessionController("player-shell-test").getView();

test("PLAYER-SHELL-001: navigation contains the five canonical player screens", () => {
  const shell = createPlayerShellState(view);

  assert.deepEqual(
    shell.screens.map((screen) => screen.id),
    ["global", "city", "preparation", "battle", "result"],
  );
  assert.equal(shell.activeScreenId, "global");
  assert.equal(shell.screens.length, PLAYER_SCREEN_DEFINITIONS.length);
});

test("PLAYER-SHELL-001: navigation availability comes only from projection", () => {
  const shell = createPlayerShellState(view);

  assert.deepEqual(
    shell.screens.map((screen) => [screen.id, screen.available]),
    [
      ["global", true],
      ["city", true],
      ["preparation", true],
      ["battle", false],
      ["result", false],
    ],
  );
  assert.equal(
    shell.screens.find((screen) => screen.id === "battle")?.reason,
    "No contact detected.",
  );
});

test("PLAYER-SHELL-001: another available top-level screen can become active", () => {
  assert.equal(createPlayerShellState(view, "city").activeScreen.title, "Город");
  assert.equal(
    createPlayerShellState(view, "preparation").activeScreen.title,
    "Подготовка каравана",
  );
});

test("PLAYER-SHELL-001: unavailable and unknown screens cannot be selected", () => {
  assert.throws(
    () => createPlayerShellState(view, "battle"),
    /screen is unavailable/,
  );
  assert.throws(
    () => createPlayerShellState(view, "settings"),
    /unknown player screen/,
  );
});

test("PLAYER-SHELL-001: travelling projection closes city and preparation navigation", () => {
  const travelling = createPlayerSessionController("player-shell-test")
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .dispatch({ kind: "START_JOURNEY" })
    .getView();
  const shell = createPlayerShellState(travelling);

  assert.deepEqual(
    shell.screens
      .filter((screen) => screen.available)
      .map((screen) => screen.id),
    ["global"],
  );
  assert.throws(
    () => createPlayerShellState(travelling, "city"),
    /screen is unavailable/,
  );
});

test("PLAYER-SHELL-001: incomplete projection cannot invent a missing screen", () => {
  assert.throws(
    () => createPlayerShellState({ ...view, screens: view.screens.slice(0, 4) }),
    /missing screen: result/,
  );
});

test("PLAYER-SHELL-001: shell presentation state is deeply immutable", () => {
  const shell = createPlayerShellState(view);

  assert.equal(Object.isFrozen(shell), true);
  assert.equal(Object.isFrozen(shell.screens), true);
  assert.equal(Object.isFrozen(shell.screens[0]), true);
  assert.throws(() => shell.screens.push({}), TypeError);
});
