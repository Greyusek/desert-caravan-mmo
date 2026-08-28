import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./manual-tactical-cargo.mjs", import.meta.url));

test("TACTICAL-004: manual acceptance runner proves all three cargo outcomes", () => {
  const result = spawnSync(process.execPath, [script, "all"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[SURVIVE\]/);
  assert.match(result.stdout, /\[DESTROY\]/);
  assert.match(result.stdout, /\[CAPTURE\]/);
  assert.equal((result.stdout.match(/conservation: 7 source = 7 accounted — PASS/g) ?? []).length, 3);
});
