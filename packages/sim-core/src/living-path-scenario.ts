import {
  createNpcCaravanDetectionSubject,
  findAsymmetricCaravanDetections,
  type AsymmetricCaravanDetections,
} from "./caravan-detection.js";
import {
  createNpcCaravanRemains,
  projectCaravanRemainsAtWorldTime,
  recoverCaravanRemainsLoot,
  type MinimalCaravanLoot,
  type ProjectedCaravanRemains,
} from "./caravan-remains.js";
import {
  deriveNpcCaravanTrackMarks,
  observeCaravanTrack,
  type NpcCaravanTrackMark,
  type ObservedCaravanTrack,
} from "./caravan-track.js";
import {
  copyCityLibraryKnowledgeToBundle,
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  depositKnowledgeBundle,
  type CityLibraryArchive,
} from "./city-library.js";
import {
  planNpcCaravanPursuitEvasion,
  type CaravanPursuitEvasionPlan,
} from "./caravan-pursuit.js";
import { destinationPoint, greatCircleDistance, initialBearingDegrees } from "./geometry.js";
import type { NpcCaravan } from "./npc-caravan.js";
import { createRoutePlan, positionAtTime, type RoutePlan } from "./route.js";
import {
  createPlayerWorldEvidenceState,
  recordObservedCaravanRemains,
  recordObservedCaravanTrack,
  type PlayerWorldEvidenceState,
} from "./world-evidence.js";
import { createWorldRumor, type WorldRumor } from "./world-rumor.js";
import { generateSeededWorld } from "./world.js";

const PARALLEL_CARAVAN_SEPARATION_METERS = 300;
const LIVING_PATH_ROUTE_DISTANCE_METERS = 5_000;
const LIVING_PATH_SPEED_METERS_PER_SECOND = 1.25;
const TRACK_OBSERVATION_DELAY_SECONDS = 2 * 60 * 60;
const REMAINS_OBSERVATION_DELAY_SECONDS = 3 * 24 * 60 * 60;
const LIBRARY_CARRIER_SPEED_METERS_PER_SECOND = 5;

export interface LivingPathServerTruth {
  readonly worldSeed: string;
  readonly playerCaravan: NpcCaravan;
  readonly npcCaravan: NpcCaravan;
  readonly detections: AsymmetricCaravanDetections;
  readonly pursuitEvasion: CaravanPursuitEvasionPlan;
  readonly trackMarks: readonly NpcCaravanTrackMark[];
  readonly remainsAtObservation: ProjectedCaravanRemains;
  readonly remainsAfterRecovery: ProjectedCaravanRemains;
  readonly originDeliveryRoute: RoutePlan;
  readonly libraryTransferRoute: RoutePlan;
}

export interface LivingPathPlayerView {
  readonly worldSeed: string;
  readonly sighting: NonNullable<AsymmetricCaravanDetections["firstDetectsSecond"]>;
  readonly reciprocalSighting: null;
  readonly maneuver: {
    readonly kind: "pursuit";
    readonly durationSeconds: number;
  };
  readonly track: ObservedCaravanTrack;
  readonly recoveredLoot: MinimalCaravanLoot;
  readonly knowledge: PlayerWorldEvidenceState;
  readonly originLibrary: CityLibraryArchive;
  readonly destinationLibraryBeforeDelivery: CityLibraryArchive;
  readonly destinationLibraryAfterDelivery: CityLibraryArchive;
  readonly originDelivery: {
    readonly carrierId: string;
    readonly bundleId: string;
    readonly departedAtWorldTimeSeconds: number;
    readonly arrivedAtWorldTimeSeconds: number;
  };
  readonly physicalTransfer: {
    readonly carrierId: string;
    readonly bundleId: string;
    readonly departedAtWorldTimeSeconds: number;
    readonly arrivedAtWorldTimeSeconds: number;
  };
  readonly rumor: WorldRumor;
}

export interface LivingPathScenario {
  readonly serverTruth: LivingPathServerTruth;
  readonly playerView: LivingPathPlayerView;
}

/**
 * MVP1-001 — composes the existing Living Path primitives into one replayable
 * journey. Server coordinates stay in serverTruth; playerView remains a
 * coordinate-free payload suitable for knowledge and journal consumers.
 */
export function createLivingPathScenario(worldSeed: string): LivingPathScenario {
  const world = generateSeededWorld(worldSeed, { cityCount: 2 });
  const origin = world.cities[0];
  const destination = world.cities[1];
  if (!origin || !destination) throw new Error("living path requires two cities");

  const playerRoute = createRoutePlan(
    origin.position,
    [{ bearingDeg: 0, distanceMeters: LIVING_PATH_ROUTE_DISTANCE_METERS }],
    LIVING_PATH_SPEED_METERS_PER_SECOND,
  );
  const npcStart = destinationPoint(
    origin.position,
    90,
    PARALLEL_CARAVAN_SEPARATION_METERS,
  );
  const npcRoute = createRoutePlan(
    npcStart,
    [{ bearingDeg: 0, distanceMeters: LIVING_PATH_ROUTE_DISTANCE_METERS }],
    LIVING_PATH_SPEED_METERS_PER_SECOND,
  );
  const playerCaravan: NpcCaravan = {
    id: "player-caravan",
    kind: "npc-caravan",
    originCityId: origin.id,
    destinationCityId: destination.id,
    departsAtSeconds: 0,
    visionRadiusMeters: 500,
    interactionRadiusMeters: 500,
    route: playerRoute,
  };
  const npcCaravan: NpcCaravan = {
    id: `living-npc-${opaqueKey(worldSeed)}`,
    kind: "npc-caravan",
    originCityId: origin.id,
    destinationCityId: destination.id,
    departsAtSeconds: 0,
    visionRadiusMeters: 100,
    interactionRadiusMeters: 500,
    route: npcRoute,
  };

  const detections = findAsymmetricCaravanDetections(
    createNpcCaravanDetectionSubject(playerCaravan),
    createNpcCaravanDetectionSubject(npcCaravan),
    { startSeconds: 0, endSeconds: playerRoute.totalDurationSeconds },
  );
  if (!detections.firstDetectsSecond || detections.secondDetectsFirst) {
    throw new Error("living path asymmetric sighting invariant failed");
  }
  const pursuitEvasion = planNpcCaravanPursuitEvasion(
    playerCaravan,
    npcCaravan,
    detections,
  );
  if (!pursuitEvasion.pursuit || pursuitEvasion.evasion) {
    throw new Error("living path pursuit invariant failed");
  }

  const npcTravelTimeSeconds = 1_200;
  const trackMarks = deriveNpcCaravanTrackMarks(npcCaravan, npcTravelTimeSeconds);
  const latestTrack = trackMarks.at(-1);
  if (!latestTrack) throw new Error("living path must produce an executed track");
  const track = observeCaravanTrack(
    latestTrack,
    npcTravelTimeSeconds + TRACK_OBSERVATION_DELAY_SECONDS,
  );

  const destroyedAtWorldTimeSeconds = 10_000;
  const remains = createNpcCaravanRemains(
    worldSeed,
    npcCaravan,
    destroyedAtWorldTimeSeconds,
    "supply-depletion",
  );
  const remainsObservedAtWorldTimeSeconds =
    destroyedAtWorldTimeSeconds + REMAINS_OBSERVATION_DELAY_SECONDS;
  const remainsAtObservation = projectCaravanRemainsAtWorldTime(
    remains,
    remainsObservedAtWorldTimeSeconds,
  );
  const recovery = recoverCaravanRemainsLoot(
    remains,
    remainsObservedAtWorldTimeSeconds,
  );
  const remainsAfterRecovery = projectCaravanRemainsAtWorldTime(
    recovery.remains,
    remainsObservedAtWorldTimeSeconds,
  );

  let knowledge = createPlayerWorldEvidenceState(worldSeed);
  knowledge = recordObservedCaravanTrack(knowledge, track).state;
  knowledge = recordObservedCaravanRemains(
    knowledge,
    remainsAtObservation,
  ).state;
  const selectedEntryIds = knowledge.entries.map((entry) => entry.id);
  const travellerBundle = copyPlayerKnowledgeToBundle(
    knowledge,
    playerCaravan.id,
    selectedEntryIds,
    remainsObservedAtWorldTimeSeconds + 100,
  );
  const originDeliveryRoute = createRoutePlan(
    remains.position,
    [
      {
        bearingDeg: initialBearingDegrees(remains.position, origin.position),
        distanceMeters: greatCircleDistance(remains.position, origin.position),
      },
    ],
    LIBRARY_CARRIER_SPEED_METERS_PER_SECOND,
  );
  const originDeliveryArrivedAtWorldTimeSeconds =
    travellerBundle.createdAtWorldTimeSeconds +
    originDeliveryRoute.totalDurationSeconds;
  const originArrival = positionAtTime(
    originDeliveryRoute,
    originDeliveryRoute.totalDurationSeconds,
  );
  if (greatCircleDistance(originArrival.coordinate, origin.position) > 0.001) {
    throw new Error("knowledge carrier must physically return to the origin city");
  }
  const originDeposit = depositKnowledgeBundle(
    createCityLibraryArchive(worldSeed, origin.id),
    travellerBundle,
  );
  const destinationLibraryBeforeDelivery = createCityLibraryArchive(
    worldSeed,
    destination.id,
  );

  const transferDepartedAtWorldTimeSeconds =
    originDeliveryArrivedAtWorldTimeSeconds + 100;
  const libraryTransferRoute = createRoutePlan(
    origin.position,
    [
      {
        bearingDeg: initialBearingDegrees(origin.position, destination.position),
        distanceMeters: greatCircleDistance(origin.position, destination.position),
      },
    ],
    LIBRARY_CARRIER_SPEED_METERS_PER_SECOND,
  );
  const transferArrivedAtWorldTimeSeconds =
    transferDepartedAtWorldTimeSeconds + libraryTransferRoute.totalDurationSeconds;
  const arrival = positionAtTime(
    libraryTransferRoute,
    libraryTransferRoute.totalDurationSeconds,
  );
  if (greatCircleDistance(arrival.coordinate, destination.position) > 0.001) {
    throw new Error("physical library carrier must reach the destination city");
  }
  const libraryBundle = copyCityLibraryKnowledgeToBundle(
    originDeposit.library,
    playerCaravan.id,
    selectedEntryIds,
    transferDepartedAtWorldTimeSeconds,
  );
  const destinationDeposit = depositKnowledgeBundle(
    destinationLibraryBeforeDelivery,
    libraryBundle,
  );
  const remainsKnowledge = knowledge.entries.find(
    (entry) => entry.evidenceKind === "caravan-remains",
  );
  if (!remainsKnowledge) throw new Error("remains knowledge must be recorded");
  const rumor = createWorldRumor({
    worldSeed,
    originCityId: destination.id,
    subjectId: remainsKnowledge.subjectId,
    observedAtWorldTimeSeconds:
      remainsKnowledge.firstObservedAtWorldTimeSeconds,
    createdAtWorldTimeSeconds: transferArrivedAtWorldTimeSeconds,
    sourceEvidenceIds: [remainsKnowledge.id],
    sourceConfidence: remainsKnowledge.confidence,
    facts: {
      type: "caravan-loss",
      condition: remainsAtObservation.condition,
    },
  });

  return {
    serverTruth: {
      worldSeed,
      playerCaravan,
      npcCaravan,
      detections,
      pursuitEvasion,
      trackMarks,
      remainsAtObservation,
      remainsAfterRecovery,
      originDeliveryRoute,
      libraryTransferRoute,
    },
    playerView: {
      worldSeed,
      sighting: detections.firstDetectsSecond,
      reciprocalSighting: null,
      maneuver: {
        kind: "pursuit",
        durationSeconds: pursuitEvasion.pursuit.durationSeconds,
      },
      track,
      recoveredLoot: recovery.recovered,
      knowledge,
      originLibrary: originDeposit.library,
      destinationLibraryBeforeDelivery,
      destinationLibraryAfterDelivery: destinationDeposit.library,
      originDelivery: {
        carrierId: travellerBundle.carrierId,
        bundleId: travellerBundle.id,
        departedAtWorldTimeSeconds: travellerBundle.createdAtWorldTimeSeconds,
        arrivedAtWorldTimeSeconds: originDeliveryArrivedAtWorldTimeSeconds,
      },
      physicalTransfer: {
        carrierId: libraryBundle.carrierId,
        bundleId: libraryBundle.id,
        departedAtWorldTimeSeconds: transferDepartedAtWorldTimeSeconds,
        arrivedAtWorldTimeSeconds: transferArrivedAtWorldTimeSeconds,
      },
      rumor,
    },
  };
}

function opaqueKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
