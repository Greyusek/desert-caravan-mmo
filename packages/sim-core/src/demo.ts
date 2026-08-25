import {
  DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
  DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
  canSurviveDuration,
  createKnownObjectReturnNavigation,
  createPlayerDiscoveryLedger,
  createRumorSearchScenario,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  discoverStaticObjectsAlongRoute,
  evaluateDiscoveryStopLifecycle,
  evaluateExpeditionOutcome,
  evaluateStaticObjectDiscoveryDoctrine,
  findFirstCityArrival,
  findFirstExpeditionMonsterDangerDetection,
  findFirstExpeditionMonsterContact,
  findFirstExpeditionMonsterContactWithIdleStop,
  findFirstMovingEncounter,
  greatCircleDistance,
  generateSeededWorld,
  kilometers,
  meters,
  planExpeditionMonsterDangerResponse,
  planEmergencySupplyReturn,
  planEmergencySupplyReturnDuringIdleStop,
  positionAtTime,
  projectCitySettlementAtTime,
  projectCityStocksAtTime,
  projectSupplies,
  recordDirectDiscoveryObservation,
  resolveMonsterPowerContact,
  resumeStaticObjectDiscoveryDoctrine,
  timeToFirstDepletion,
  wanderingMonsterPositionAtTime,
  SECONDS_PER_CITY_DAY,
} from "./index.js";

const start = createWorldCoordinate(55.755864, 37.617698);
const speedMetersPerSecond = 5_000 / 3_600; // 5 km/h
const route = createRoutePlan(
  start,
  [
    { bearingDeg: 315, distanceMeters: kilometers(20) },
    { bearingDeg: 270, distanceMeters: kilometers(12) },
    { bearingDeg: 225, distanceMeters: kilometers(20) },
    { bearingDeg: 90, distanceMeters: kilometers(35) },
  ],
  speedMetersPerSecond,
);

console.log("Desert Caravan MMO — Checkpoint 37 demo");
console.log("Start:", start);
console.log("Speed: 5 km/h");
console.log("Segments:");
for (const segment of route.segments) {
  console.log(
    `  #${segment.index + 1}: ${segment.bearingDeg}° / ${(segment.distanceMeters / 1000).toFixed(1)} km -> ETA ${(segment.etaEndSeconds / 3600).toFixed(2)} h`,
  );
}
console.log(`Total distance: ${(route.totalDistanceMeters / 1000).toFixed(3)} km`);
console.log(`Total ETA: ${(route.totalDurationSeconds / 3600).toFixed(3)} h`);
console.log("Destination:", route.end);

const t = 5 * 3_600;
const atFiveHours = positionAtTime(route, t);
console.log("Position at T=5h:", atFiveHours.coordinate);
console.log(
  `At T=5h: segment=${(atFiveHours.segmentIndex ?? -1) + 1}, traveled=${(atFiveHours.traveledDistanceMeters / 1000).toFixed(3)} km, remaining=${(atFiveHours.remainingDistanceMeters / 1000).toFixed(3)} km`,
);

const finalCheck = route.segments.reduce(
  (sum, segment) => sum + greatCircleDistance(segment.start, segment.end),
  0,
);
console.log(`Segment distance check: ${(finalCheck / 1000).toFixed(6)} km`);

const supplies = { foodUnits: 12, waterUnits: 10 };
const consumption = {
  moving: { foodUnitsPerHour: 0.5, waterUnitsPerHour: 1.0 },
  idle: { foodUnitsPerHour: 0.25, waterUnitsPerHour: 0.4 },
};

console.log("\nSIM-006 supplies:");
console.log("Initial: food=12, water=10");
console.log("Moving rates: food=0.5/h, water=1.0/h");
console.log("Idle rates: food=0.25/h, water=0.4/h");

const atFiveHoursSupplies = projectSupplies(supplies, consumption, "moving", t);
console.log(
  `At T=5h moving: food=${atFiveHoursSupplies.foodRemaining.toFixed(3)}, water=${atFiveHoursSupplies.waterRemaining.toFixed(3)}`,
);

const depletion = timeToFirstDepletion(supplies, consumption, "moving");
if (depletion.atSeconds !== null) {
  const deathPosition = positionAtTime(route, depletion.atSeconds);
  console.log(
    `First depletion: ${depletion.cause} at T=${(depletion.atSeconds / 3600).toFixed(3)} h, traveled=${(deathPosition.traveledDistanceMeters / 1000).toFixed(3)} km`,
  );
}

console.log(
  `Can finish 17.4h route with these supplies: ${canSurviveDuration(supplies, consumption, "moving", route.totalDurationSeconds)}`,
);

const idleAtTenHours = projectSupplies(supplies, consumption, "idle", 10 * 3_600);
console.log(
  `If idle for 10h instead: food=${idleAtTenHours.foodRemaining.toFixed(3)}, water=${idleAtTenHours.waterRemaining.toFixed(3)}`,
);

const failedExpedition = evaluateExpeditionOutcome(
  route,
  supplies,
  consumption,
  route.totalDurationSeconds,
);
const completedExpedition = evaluateExpeditionOutcome(
  route,
  { foodUnits: 20, waterUnits: 20 },
  consumption,
  route.totalDurationSeconds,
);
console.log("\nGAME-003 expedition outcomes:");
console.log(
  `  unsafe supplies: ${failedExpedition.status} at T=${((failedExpedition.endedAtSeconds ?? 0) / 3_600).toFixed(3)} h, cause=${failedExpedition.failureCause}`,
);
console.log(
  `  sufficient supplies: ${completedExpedition.status} at T=${((completedExpedition.endedAtSeconds ?? 0) / 3_600).toFixed(3)} h`,
);

const world = generateSeededWorld("checkpoint-04");
console.log(`\nWORLD-001 seed=${world.seed}: ${world.cities.length} cities`);
for (const city of world.cities) {
  console.log(
    `  ${city.id} ${city.name}: ${city.position.latitudeDeg.toFixed(6)}, ${city.position.longitudeDeg.toFixed(6)}`,
  );
}
console.log("CITY-001 finite city stocks:");
for (const stocks of world.cityStocks) {
  console.log(
    `  ${stocks.cityId}: food=${stocks.foodUnits}, water=${stocks.waterUnits}`,
  );
}
const firstCityStocks = world.cityStocks[0];
const firstCityPopulation = world.cityPopulations[0];
if (firstCityStocks && firstCityPopulation) {
  const projected = projectCityStocksAtTime(
    firstCityStocks,
    firstCityPopulation,
    10 * SECONDS_PER_CITY_DAY,
  );
  console.log(
    `CITY-002 ${firstCityStocks.cityId} after 10 days: population=${projected.population}, food=${projected.foodUnits.toFixed(1)}, water=${projected.waterUnits.toFixed(1)}, status=${projected.status}`,
  );
  const initialSettlement = projectCitySettlementAtTime(
    firstCityStocks,
    firstCityPopulation,
    0,
  );
  if (initialSettlement.firstDepletionAtSeconds !== null) {
    const afterTenShortageDays = projectCitySettlementAtTime(
      firstCityStocks,
      firstCityPopulation,
      initialSettlement.firstDepletionAtSeconds + 10 * SECONDS_PER_CITY_DAY,
    );
    console.log(
      `CITY-003 ${firstCityStocks.cityId} after 10 shortage days: population=${afterTenShortageDays.inhabitants}/${afterTenShortageDays.initialPopulation}, lost=${afterTenShortageDays.populationLost}, food=${afterTenShortageDays.foodUnits.toFixed(1)}, water=${afterTenShortageDays.waterUnits.toFixed(1)}, status=${afterTenShortageDays.status}`,
    );
  }
}
console.log(`WORLD-002 hidden static objects: ${world.staticObjects.length}`);
for (const object of world.staticObjects) {
  console.log(
    `  ${object.id} ${object.kind}: ${object.position.latitudeDeg.toFixed(6)}, ${object.position.longitudeDeg.toFixed(6)}`,
  );
}

const rumorOrigin = world.cities[0];
if (rumorOrigin) {
  const rumorScenario = createRumorSearchScenario(world.seed, rumorOrigin);
  const rumorRoute = createRoutePlan(
    rumorOrigin.position,
    [
      {
        bearingDeg: rumorScenario.serverTruth.exactBearingDeg,
        distanceMeters: rumorScenario.serverTruth.exactDistanceMeters,
      },
    ],
    speedMetersPerSecond,
  );
  const rumorDiscovery = discoverStaticObjectsAlongRoute(
    rumorRoute,
    [rumorScenario.serverTruth.target],
  )[0];

  console.log("\nGAME-001 rumor search:");
  console.log(
    `  player clue: ${rumorScenario.rumor.bearingSector.name}, ${(rumorScenario.rumor.distanceRange.minimumMeters / 1_000).toFixed(0)}-${(rumorScenario.rumor.distanceRange.maximumMeters / 1_000).toFixed(0)} km from ${rumorOrigin.id}`,
  );
  console.log(
    `  DEV truth: ${rumorScenario.serverTruth.target.id}, bearing=${rumorScenario.serverTruth.exactBearingDeg.toFixed(6)}°, distance=${(rumorScenario.serverTruth.exactDistanceMeters / 1_000).toFixed(6)} km`,
  );
  console.log(
    `  direct route: ${rumorDiscovery ? `found at ${(rumorDiscovery.routeDistanceMeters / 1_000).toFixed(6)} km / T=${(rumorDiscovery.elapsedSeconds / 3_600).toFixed(6)} h` : "missed"}`,
  );

  if (rumorDiscovery) {
    console.log("GAME-002 discovery doctrine:");
    for (const doctrine of ["STOP", "MARK_AND_CONTINUE"] as const) {
      const evaluation = evaluateStaticObjectDiscoveryDoctrine(
        rumorDiscovery,
        doctrine,
        rumorDiscovery.elapsedSeconds + 3_600,
      );
      console.log(
        `  ${doctrine}: status=${evaluation.status}, route-time=${(evaluation.movementElapsedSeconds / 3_600).toFixed(6)} h, continues=${evaluation.decision?.continuesRoute ?? false}`,
      );
    }
    const stopped = evaluateStaticObjectDiscoveryDoctrine(
      rumorDiscovery,
      "STOP",
      rumorDiscovery.elapsedSeconds + 3_600,
    );
    const resumed = resumeStaticObjectDiscoveryDoctrine(
      stopped,
      rumorDiscovery.object.id,
    );
    console.log(
      `GAME-008 resume: object=${resumed.resumeDecision.objectId}, resumed-at=${(resumed.resumeDecision.resumedAtSeconds / 3_600).toFixed(6)} h, route-time=${(resumed.movementElapsedSeconds / 3_600).toFixed(6)} h`,
    );
    const idleDurationSeconds = 6 * 3_600;
    const stopLifecycle = evaluateDiscoveryStopLifecycle(
      rumorRoute,
      supplies,
      consumption,
      rumorDiscovery.elapsedSeconds + 3 * 3_600,
      rumorDiscovery.elapsedSeconds,
      idleDurationSeconds,
    );
    console.log(
      `GAME-009 STOP lifecycle: phase=${stopLifecycle.phase}, world-time=${(stopLifecycle.evaluatedAtSeconds / 3_600).toFixed(6)} h, route-time=${(stopLifecycle.movementElapsedSeconds / 3_600).toFixed(6)} h, idle=${(stopLifecycle.idleElapsedSeconds / 3_600).toFixed(3)} / ${(idleDurationSeconds / 3_600).toFixed(3)} h`,
    );
    const firstLedgerRecord = recordDirectDiscoveryObservation(
      createPlayerDiscoveryLedger(world.seed),
      {
        expeditionNumber: 1,
        objectId: rumorDiscovery.object.id,
        objectKind: rumorDiscovery.object.kind,
        originCityId: rumorOrigin.id,
        rumorId: rumorScenario.rumor.id,
        observedAtSeconds: rumorDiscovery.elapsedSeconds,
        segmentIndex: rumorDiscovery.segmentIndex,
        routeDistanceMeters: rumorDiscovery.routeDistanceMeters,
        originBearingDeg: rumorScenario.serverTruth.exactBearingDeg,
        originDistanceMeters: rumorScenario.serverTruth.exactDistanceMeters,
      },
    );
    const secondLedgerRecord = recordDirectDiscoveryObservation(
      firstLedgerRecord.ledger,
      {
        expeditionNumber: 2,
        objectId: rumorDiscovery.object.id,
        objectKind: rumorDiscovery.object.kind,
        originCityId: rumorOrigin.id,
        rumorId: rumorScenario.rumor.id,
        observedAtSeconds: rumorDiscovery.elapsedSeconds,
        segmentIndex: rumorDiscovery.segmentIndex,
        routeDistanceMeters: rumorDiscovery.routeDistanceMeters,
        originBearingDeg: rumorScenario.serverTruth.exactBearingDeg,
        originDistanceMeters: rumorScenario.serverTruth.exactDistanceMeters,
      },
    );
    const returnNavigation = createKnownObjectReturnNavigation(
      secondLedgerRecord.ledger,
      rumorDiscovery.object.id,
    );
    console.log(
      `GAME-011 session knowledge: first=${firstLedgerRecord.status}, repeat=${secondLedgerRecord.status}, observations=${secondLedgerRecord.entry.observationCount}, coordinates-stored=false`,
    );
    console.log(
      `GAME-012 known-object return: origin=${returnNavigation.originCityId}, bearing=${returnNavigation.command.bearingDeg.toFixed(6)}°, distance=${(returnNavigation.command.distanceMeters / 1_000).toFixed(6)} km`,
    );
  }
}

const discoveryTarget = world.staticObjects[0];
if (discoveryTarget) {
  const discoveryStart = destinationPoint(discoveryTarget.position, 180, meters(500));
  const discoveryRoute = createRoutePlan(
    discoveryStart,
    [{ bearingDeg: 0, distanceMeters: meters(1_000) }],
    5,
  );
  const discoveries = discoverStaticObjectsAlongRoute(
    discoveryRoute,
    world.staticObjects,
  );

  console.log(
    `WORLD-003 route discovery: radius=${DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS} m, found=${discoveries.length}`,
  );
  for (const discovery of discoveries) {
    console.log(
      `  ${discovery.object.id}: route=${discovery.routeDistanceMeters.toFixed(3)} m, T=${discovery.elapsedSeconds.toFixed(3)} s, separation=${discovery.distanceToObjectMeters.toFixed(3)} m`,
    );
  }
}

console.log(`WORLD-004 wandering monsters: ${world.wanderingMonsters.length}`);
for (const monster of world.wanderingMonsters) {
  const period = monster.patrolRoute.totalDurationSeconds;
  const sampleTime = period * 1.25;
  const samplePosition = wanderingMonsterPositionAtTime(monster, sampleTime);
  console.log(
    `  ${monster.id}: power=${monster.power}, legs=${monster.patrolRoute.segments.length}, loop=${(monster.patrolRoute.totalDistanceMeters / 1_000).toFixed(3)} km / ${(period / 3_600).toFixed(3)} h`,
  );
  console.log(
    `    T=1.25 loops: cycle=${samplePosition.cycleIndex}, segment=${samplePosition.segmentIndex + 1}, position=${samplePosition.coordinate.latitudeDeg.toFixed(6)}, ${samplePosition.coordinate.longitudeDeg.toFixed(6)}`,
  );
}

const encounterPoint = createWorldCoordinate(0, 0);
const patrolStart = destinationPoint(encounterPoint, 270, meters(1_000));
const caravanStart = destinationPoint(encounterPoint, 180, meters(1_000));
const encounterPatrol = createRoutePlan(
  patrolStart,
  [
    { bearingDeg: 90, distanceMeters: meters(2_000) },
    { bearingDeg: 270, distanceMeters: meters(2_000) },
  ],
  10,
);
const encounterCaravan = createRoutePlan(
  caravanStart,
  [{ bearingDeg: 0, distanceMeters: meters(2_000) }],
  10,
);
const synchronizedEncounter = findFirstMovingEncounter(
  { route: encounterPatrol, startsAtSeconds: 0, mode: "cyclic" },
  { route: encounterCaravan, startsAtSeconds: 0, mode: "finite" },
  { startSeconds: 0, endSeconds: 400 },
);
const delayedEncounter = findFirstMovingEncounter(
  { route: encounterPatrol, startsAtSeconds: 0, mode: "cyclic" },
  { route: encounterCaravan, startsAtSeconds: 100, mode: "finite" },
  { startSeconds: 0, endSeconds: 400 },
);

console.log("\nSIM-008 moving encounter:");
if (synchronizedEncounter) {
  console.log(
    `  synchronized crossing: T=${synchronizedEncounter.atSeconds.toFixed(6)} s, separation=${synchronizedEncounter.separationMeters.toFixed(3)} m`,
  );
}
console.log(
  `  same paths with 100 s delay: ${delayedEncounter === null ? "no encounter" : "encounter"}`,
);

const demoMonster = {
  id: "demo-monster",
  kind: "wandering-monster" as const,
  power: 90,
  visionRadiusMeters: 300,
  interactionRadiusMeters: 500,
  patrolRoute: encounterPatrol,
};
const dangerDetection = findFirstExpeditionMonsterDangerDetection(
  encounterCaravan,
  demoMonster,
);
const expeditionContact = findFirstExpeditionMonsterContact(
  encounterCaravan,
  demoMonster,
);
const dangerAvoidance = planExpeditionMonsterDangerResponse(
  encounterCaravan,
  demoMonster,
  "AVOID",
);
console.log("\nGAME-019 detected danger:");
console.log(
  dangerDetection
    ? `  ${dangerDetection.monsterId}: detected at ${dangerDetection.detectionRadiusMeters.toFixed(0)} m / T=${dangerDetection.expeditionElapsedSeconds.toFixed(6)} s; contact=${dangerDetection.interactionRadiusMeters.toFixed(0)} m in ${(dangerDetection.secondsUntilContact ?? 0).toFixed(6)} s; order=${dangerDetection.contactOrder}`
    : "  no danger detected",
);
console.log("\nGAME-020 danger doctrine:");
console.log(
  dangerAvoidance.status === "avoided"
    ? `  AVOID: side=${dangerAvoidance.detourSide}; extra=${((dangerAvoidance.addedDistanceMeters ?? 0) / 1_000).toFixed(3)} km; contact-after=${dangerAvoidance.effectiveContact === null ? "none" : "unsafe"}`
    : `  AVOID: ${dangerAvoidance.status}`,
);
console.log("\nGAME-004 expedition contact:");
console.log(
  expeditionContact
    ? `  ${expeditionContact.monsterId}: contact at T=${expeditionContact.expeditionElapsedSeconds.toFixed(6)} s, separation=${expeditionContact.separationMeters.toFixed(3)} m, power=${expeditionContact.monsterPower}`
    : "  no contact",
);

const idlePatrolStart = destinationPoint(
  encounterPoint,
  270,
  meters(1_500),
);
const idlePatrolRoute = createRoutePlan(
  idlePatrolStart,
  [
    { bearingDeg: 90, distanceMeters: meters(3_000) },
    { bearingDeg: 270, distanceMeters: meters(3_000) },
  ],
  10,
);
const idleContact = findFirstExpeditionMonsterContactWithIdleStop(
  encounterCaravan,
  {
    id: "idle-demo-monster",
    kind: "wandering-monster",
    power: 110,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 100,
    patrolRoute: idlePatrolRoute,
  },
  100,
  100,
);
console.log("\nGAME-010 stationary STOP contact:");
console.log(
  idleContact
    ? `  ${idleContact.monsterId}: ${idleContact.caravanActivity} contact at world T=${idleContact.expeditionElapsedSeconds.toFixed(6)} s, route T=${idleContact.routeElapsedSeconds.toFixed(6)} s`
    : "  no stationary contact",
);

console.log("\nGAME-005 Power contact resolution:");
for (const [monsterPower, doctrine] of [
  [90, "FLEE"],
  [110, "FLEE"],
  [110, "ACCEPT_FIGHT"],
] as const) {
  const resolution = resolveMonsterPowerContact(monsterPower, doctrine);
  console.log(
    `  player=${resolution.playerPower} vs monster=${monsterPower}, doctrine=${resolution.doctrine ?? "AUTO"}: ${resolution.status} / route=${resolution.routeDisposition}`,
  );
}

console.log("\nGAME-006 deterministic FLEE:");
for (const fleeSpeedKilometersPerHour of [6, 5]) {
  const resolution = resolveMonsterPowerContact(110, "FLEE", 100, {
    caravanSpeedMetersPerSecond: fleeSpeedKilometersPerHour / 3.6,
    monsterSpeedMetersPerSecond: 5.4 / 3.6,
    contactSeparationMeters: 500,
    safeSeparationMeters: 1_000,
  });
  console.log(
    `  caravan=${fleeSpeedKilometersPerHour.toFixed(1)} km/h vs monster=5.4 km/h: ${resolution.status}, safe-gap=${resolution.fleeResolution?.secondsToSafeSeparation?.toFixed(3) ?? "unreachable"} s, route=${resolution.routeDisposition}`,
  );
}

const returnCity = {
  id: "demo-city",
  name: "Demo City",
  position: start,
};
const cityReturnRoute = createRoutePlan(
  start,
  [
    { bearingDeg: 0, distanceMeters: kilometers(10) },
    { bearingDeg: 180, distanceMeters: kilometers(10) },
  ],
  speedMetersPerSecond,
);
const cityArrival = findFirstCityArrival(cityReturnRoute, returnCity);

console.log("\nGAME-007 authoritative city arrival:");
console.log(
  cityArrival
    ? `  ${cityArrival.kind} into ${cityArrival.city.name}: radius=${DEFAULT_CITY_ARRIVAL_RADIUS_METERS} m, route=${(cityArrival.routeDistanceMeters / 1_000).toFixed(3)} km, T=${(cityArrival.elapsedSeconds / 3_600).toFixed(3)} h`
    : "  return route missed the city",
);

const emergencySupplies = { foodUnits: 100, waterUnits: 100 };
const emergencyConsumption = {
  moving: { foodUnitsPerHour: 12.5, waterUnitsPerHour: 12.5 },
  idle: { foodUnitsPerHour: 2, waterUnitsPerHour: 2 },
};
const emergencyOutboundRoute = createRoutePlan(
  start,
  [{ bearingDeg: 90, distanceMeters: kilometers(40) }],
  speedMetersPerSecond,
);
const emergencyReturn = planEmergencySupplyReturn(
  emergencyOutboundRoute,
  emergencySupplies,
  emergencyConsumption,
  "RETURN_TO_ORIGIN",
);
const emergencyArrival = findFirstCityArrival(
  emergencyReturn.effectiveRoute,
  returnCity,
);

console.log("\nGAME-017 emergency supply doctrine:");
console.log(
  emergencyReturn.threshold && emergencyArrival
    ? `  ${emergencyReturn.threshold.cause} reaches ${(emergencyReturn.threshold.remainingFraction * 100).toFixed(0)}% at T=${(emergencyReturn.threshold.atSeconds / 3_600).toFixed(3)} h; direct return=${((emergencyReturn.returnDistanceMeters ?? 0) / 1_000).toFixed(3)} km; ${emergencyArrival.kind} at T=${(emergencyArrival.elapsedSeconds / 3_600).toFixed(3)} h`
    : "  emergency return was not triggered",
);

const idleEmergency = planEmergencySupplyReturnDuringIdleStop(
  emergencyOutboundRoute,
  emergencySupplies,
  {
    moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 25, waterUnitsPerHour: 25 },
  },
  "RETURN_TO_ORIGIN",
  2 * 3_600,
  6 * 3_600,
);
console.log("\nGAME-018 emergency doctrine during discovery STOP:");
console.log(
  idleEmergency.threshold
    ? `  ${idleEmergency.threshold.cause} reaches ${(idleEmergency.threshold.remainingFraction * 100).toFixed(0)}% at world T=${(idleEmergency.threshold.atSeconds / 3_600).toFixed(3)} h; idle=${(idleEmergency.effectiveIdleDurationSeconds / 3_600).toFixed(3)} / ${(idleEmergency.scheduledIdleDurationSeconds / 3_600).toFixed(3)} h; direct return=${((idleEmergency.returnDistanceMeters ?? 0) / 1_000).toFixed(3)} km; origin at world T=${((idleEmergency.returnToOriginAtExpeditionSeconds ?? 0) / 3_600).toFixed(3)} h`
    : "  idle emergency return was not triggered",
);

console.log(
  "\nCheckpoint 37 danger avoidance: npm run debug-map -> http://127.0.0.1:4173",
);
