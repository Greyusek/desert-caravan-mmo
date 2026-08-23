import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorldCoordinate,
  evaluateStaticObjectDiscoveryDoctrine,
  resumeStaticObjectDiscoveryDoctrine,
} from "../dist/src/index.js";

const discovery = {
  object: {
    id: "rumor-mine-city-01",
    kind: "mine",
    position: createWorldCoordinate(10, 20),
  },
  segmentIndex: 1,
  routeDistanceMeters: 32_700,
  elapsedSeconds: 6_540,
  caravanPosition: createWorldCoordinate(9.9, 19.9),
  distanceToObjectMeters: 150,
};

test("GAME-002: doctrine stays pending before authoritative discovery", () => {
  assert.deepEqual(
    evaluateStaticObjectDiscoveryDoctrine(discovery, "STOP", 6_539),
    {
      doctrine: "STOP",
      status: "pending",
      evaluatedAtSeconds: 6_539,
      movementElapsedSeconds: 6_539,
      decision: null,
    },
  );
});

test("GAME-002: STOP freezes movement at the exact discovery moment", () => {
  const result = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "STOP",
    discovery.elapsedSeconds,
  );

  assert.equal(result.status, "stopped");
  assert.equal(result.movementElapsedSeconds, discovery.elapsedSeconds);
  assert.deepEqual(result.decision, {
    doctrine: "STOP",
    objectId: "rumor-mine-city-01",
    objectKind: "mine",
    decidedAtSeconds: 6_540,
    segmentIndex: 1,
    routeDistanceMeters: 32_700,
    caravanPosition: discovery.caravanPosition,
    continuesRoute: false,
  });
});

test("GAME-002: STOP remains pinned when simulation time advances", () => {
  const result = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "STOP",
    discovery.elapsedSeconds + 99_999,
  );

  assert.equal(result.status, "stopped");
  assert.equal(result.evaluatedAtSeconds, 106_539);
  assert.equal(result.movementElapsedSeconds, discovery.elapsedSeconds);
  assert.equal(result.decision?.continuesRoute, false);
});

test("GAME-002: MARK_AND_CONTINUE records the target without capping movement", () => {
  const elapsedSeconds = discovery.elapsedSeconds + 3_600;
  const result = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "MARK_AND_CONTINUE",
    elapsedSeconds,
  );

  assert.equal(result.status, "marked-and-continuing");
  assert.equal(result.movementElapsedSeconds, elapsedSeconds);
  assert.equal(result.decision?.doctrine, "MARK_AND_CONTINUE");
  assert.equal(result.decision?.continuesRoute, true);
  assert.equal(result.decision?.decidedAtSeconds, discovery.elapsedSeconds);
});

test("GAME-002: missing discovery never invents a doctrine decision", () => {
  const result = evaluateStaticObjectDiscoveryDoctrine(
    null,
    "MARK_AND_CONTINUE",
    50_000,
  );

  assert.equal(result.status, "pending");
  assert.equal(result.movementElapsedSeconds, 50_000);
  assert.equal(result.decision, null);
});

test("GAME-002: invalid doctrine and simulation time are rejected", () => {
  assert.throws(
    () => evaluateStaticObjectDiscoveryDoctrine(discovery, "FLEE", 0),
    /doctrine must be STOP or MARK_AND_CONTINUE/,
  );
  assert.throws(
    () => evaluateStaticObjectDiscoveryDoctrine(discovery, "STOP", -1),
    /elapsedSeconds must be a non-negative finite number/,
  );
});

test("GAME-008: an executed STOP resumes at the exact discovery boundary", () => {
  const stopped = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "STOP",
    discovery.elapsedSeconds,
  );
  const resumed = resumeStaticObjectDiscoveryDoctrine(
    stopped,
    discovery.object.id,
  );

  assert.equal(resumed.status, "resumed-and-continuing");
  assert.equal(resumed.movementElapsedSeconds, discovery.elapsedSeconds);
  assert.equal(resumed.decision, stopped.decision);
  assert.deepEqual(resumed.resumeDecision, {
    objectId: discovery.object.id,
    objectKind: discovery.object.kind,
    resumedAtSeconds: discovery.elapsedSeconds,
    segmentIndex: discovery.segmentIndex,
    routeDistanceMeters: discovery.routeDistanceMeters,
    caravanPosition: discovery.caravanPosition,
  });
});

test("GAME-008: the acknowledged target no longer caps later route time", () => {
  const evaluatedAtSeconds = discovery.elapsedSeconds + 3_600;
  const stopped = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "STOP",
    evaluatedAtSeconds,
  );
  const resumed = resumeStaticObjectDiscoveryDoctrine(
    stopped,
    discovery.object.id,
  );

  assert.equal(resumed.movementElapsedSeconds, evaluatedAtSeconds);
  assert.equal(resumed.resumeDecision.resumedAtSeconds, discovery.elapsedSeconds);
});

test("GAME-008: resume is bound to the authoritative discovered object", () => {
  const stopped = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "STOP",
    discovery.elapsedSeconds,
  );

  assert.throws(
    () => resumeStaticObjectDiscoveryDoctrine(stopped, "another-object"),
    /objectId must match the stopped discovery/,
  );
});

test("GAME-008: pending or continuing doctrine cannot invent a resume", () => {
  const pending = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "STOP",
    discovery.elapsedSeconds - 1,
  );
  const continuing = evaluateStaticObjectDiscoveryDoctrine(
    discovery,
    "MARK_AND_CONTINUE",
    discovery.elapsedSeconds,
  );

  assert.throws(
    () => resumeStaticObjectDiscoveryDoctrine(pending, discovery.object.id),
    /only an executed STOP discovery can be resumed/,
  );
  assert.throws(
    () => resumeStaticObjectDiscoveryDoctrine(continuing, discovery.object.id),
    /only an executed STOP discovery can be resumed/,
  );
});
