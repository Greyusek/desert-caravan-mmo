import test from "node:test";
import assert from "node:assert/strict";
import {
  createTacticalBattlefield,
  createTacticalCell,
  isCellInDeploymentZone,
  isCellInsideBattlefield,
} from "../dist/src/index.js";

test("TACTICAL-001: default battlefield has explicit terrain-free geometry", () => {
  const battlefield = createTacticalBattlefield("checkpoint-63");
  assert.equal(battlefield.width, 12);
  assert.equal(battlefield.height, 8);
  assert.equal(battlefield.deploymentDepth, 2);
});

test("TACTICAL-001: identical seed and config reproduce complete geometry", () => {
  const first = createTacticalBattlefield("same", { width: 9, height: 5 });
  const second = createTacticalBattlefield("same", { width: 9, height: 5 });
  assert.deepEqual(first, second);
  assert.notEqual(first.id, createTacticalBattlefield("different").id);
});

test("TACTICAL-001: sides receive stable opposite deployment zones", () => {
  const battlefield = createTacticalBattlefield("zones", {
    width: 9,
    height: 3,
    deploymentDepth: 2,
  });
  assert.deepEqual(
    battlefield.deploymentZones.caravan.cells.slice(0, 4),
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 0 },
    ],
  );
  assert.equal(battlefield.deploymentZones.hostile.minX, 7);
  assert.equal(battlefield.deploymentZones.hostile.cells.length, 6);
});

test("TACTICAL-001: deployment zones leave a neutral battlefield lane", () => {
  const battlefield = createTacticalBattlefield("neutral", {
    width: 5,
    height: 2,
    deploymentDepth: 2,
  });
  const middle = createTacticalCell(2, 1);
  assert.equal(isCellInDeploymentZone(battlefield, "caravan", middle), false);
  assert.equal(isCellInDeploymentZone(battlefield, "hostile", middle), false);
});

test("TACTICAL-001: battlefield containment uses integer cell boundaries", () => {
  const battlefield = createTacticalBattlefield("bounds");
  assert.equal(isCellInsideBattlefield(battlefield, { x: 0, y: 0 }), true);
  assert.equal(isCellInsideBattlefield(battlefield, { x: 11, y: 7 }), true);
  assert.equal(isCellInsideBattlefield(battlefield, { x: 12, y: 7 }), false);
  assert.equal(isCellInsideBattlefield(battlefield, { x: -1, y: 0 }), false);
  assert.throws(
    () => isCellInsideBattlefield(battlefield, { x: 0.5, y: 0 }),
    TypeError,
  );
});

test("TACTICAL-001: invalid geometry cannot create overlapping zones", () => {
  assert.throws(
    () => createTacticalBattlefield("small", { width: 4, deploymentDepth: 2 }),
    RangeError,
  );
  assert.throws(() => createTacticalBattlefield("", {}), TypeError);
  assert.throws(
    () => createTacticalBattlefield("fraction", { height: 2.5 }),
    TypeError,
  );
});
