import {
  canSurviveDuration,
  createRoutePlan,
  createWorldCoordinate,
  greatCircleDistance,
  generateSeededWorld,
  kilometers,
  positionAtTime,
  projectSupplies,
  timeToFirstDepletion,
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

console.log("Desert Caravan MMO — SIM-001..006 demo");
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

const world = generateSeededWorld("checkpoint-04");
console.log(`\nWORLD-001 seed=${world.seed}: ${world.cities.length} cities`);
for (const city of world.cities) {
  console.log(
    `  ${city.id} ${city.name}: ${city.position.latitudeDeg.toFixed(6)}, ${city.position.longitudeDeg.toFixed(6)}`,
  );
}
