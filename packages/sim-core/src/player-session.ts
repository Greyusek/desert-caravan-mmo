import {
  createCityEconomyState,
  type CityEconomyState,
  type TradeGoodId,
} from "./city-economy.js";
import {
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  type CityLibraryArchive,
  type PhysicalKnowledgeBundle,
} from "./city-library.js";
import { quoteCityMarketPrices } from "./city-market.js";
import {
  quoteKnowledgeBundleForLibrary,
  sellKnowledgeBundleToLibrary,
} from "./information-market.js";
import {
  createTacticalCombatScenario,
  type TacticalCombatScenario,
} from "./tactical-combat-scenario.js";
import { deployTacticalCargo } from "./tactical-cargo.js";
import {
  beginTradeJourney,
  buyGoodFromCity,
  createTradeCaravanState,
  sellGoodToCity,
  usedCargoCapacity,
  type TradeCaravanState,
} from "./trade-route.js";
import type { PlayerWorldEvidenceEntry } from "./world-evidence.js";
import { generateSeededWorld } from "./world.js";

export type PlayerScreenId =
  | "global"
  | "city"
  | "preparation"
  | "battle"
  | "result";

export type PlayerSessionPhase = "city" | "ready" | "travelling";

export type PlayerSessionAction =
  | {
      readonly kind: "SELECT_DESTINATION";
      readonly destinationRef: string;
    }
  | { readonly kind: "START_JOURNEY" }
  | {
      readonly kind: "BUY_GOOD";
      readonly goodId: TradeGoodId;
      readonly units: number;
    }
  | {
      readonly kind: "SELL_GOOD";
      readonly goodId: TradeGoodId;
      readonly units: number;
    }
  | {
      readonly kind: "SELL_INFORMATION";
      readonly bundleRef: string;
    };

export type PlayerAvailableAction =
  | {
      readonly kind: "SELECT_DESTINATION";
      readonly label: string;
      readonly destinationRefs: readonly string[];
    }
  | {
      readonly kind: "START_JOURNEY";
      readonly label: string;
    }
  | {
      readonly kind: "BUY_GOOD";
      readonly label: string;
      readonly goodId: TradeGoodId;
      readonly units: 1;
      readonly totalCredits: number;
    }
  | {
      readonly kind: "SELL_GOOD";
      readonly label: string;
      readonly goodId: TradeGoodId;
      readonly units: 1;
      readonly totalCredits: number;
    }
  | {
      readonly kind: "SELL_INFORMATION";
      readonly label: string;
      readonly bundleRef: string;
      readonly totalCredits: number;
    };

export interface PlayerSessionView {
  readonly revision: number;
  readonly phase: PlayerSessionPhase;
  readonly screens: readonly {
    readonly id: PlayerScreenId;
    readonly available: boolean;
    readonly reason?: string;
  }[];
  readonly map: {
    readonly orientation: "north-up";
    readonly currentPlaceRef: string | null;
    readonly places: readonly {
      readonly ref: string;
      readonly name: string;
      readonly kind: "city";
      readonly eastMeters: number;
      readonly northMeters: number;
    }[];
    readonly route: null | {
      readonly originRef: string;
      readonly destinationRef: string;
      readonly distanceMeters: number;
      readonly durationSeconds: number;
      readonly speedMetersPerSecond: number;
      readonly status: "planned" | "moving";
      readonly progressFraction: number;
      readonly etaSeconds: number;
    };
  };
  readonly caravan: {
    readonly credits: number;
    readonly supplies: {
      readonly foodUnits: number;
      readonly waterUnits: number;
    };
    readonly cargo: {
      readonly capacityCargoUnits: number;
      readonly usedCargoUnits: number;
      readonly freeCargoUnits: number;
      readonly stacks: readonly {
        readonly goodId: TradeGoodId;
        readonly units: number;
      }[];
    };
    readonly members: readonly {
      readonly ref: string;
      readonly role: "guard" | "skirmisher";
      readonly health: number;
      readonly maxHealth: number;
      readonly status: "ready";
    }[];
  };
  readonly city: null | {
    readonly placeRef: string;
    readonly name: string;
    readonly market: readonly {
      readonly goodId: TradeGoodId;
      readonly stockUnits: number;
      readonly ownedUnits: number;
      readonly cityBuyPriceCredits: number;
      readonly citySellPriceCredits: number;
    }[];
    readonly library: {
      readonly archiveEntryCount: number;
      readonly acceptedBundleCount: number;
      readonly carriedBundles: readonly {
        readonly ref: string;
        readonly title: string;
        readonly entryCount: number;
        readonly evidenceKind: "caravan-track" | "caravan-remains";
        readonly provenance: "direct-observation";
        readonly confidence: "probable" | "confirmed";
        readonly fidelityPercent: number;
        readonly localValueCredits: number;
      }[];
    };
  };
  readonly preparation: null | {
    readonly formation: {
      readonly mode: "fixed";
      readonly accepted: true;
      readonly reason: string;
      readonly columns: number;
      readonly rows: number;
      readonly combatants: readonly {
        readonly memberRef: string;
        readonly role: "guard" | "skirmisher";
        readonly position: {
          readonly column: number;
          readonly row: number;
        };
        readonly health: number;
        readonly maxHealth: number;
        readonly movementCells: number;
        readonly attackRangeCells: number;
        readonly attackDamage: number;
      }[];
      readonly baggage: readonly {
        readonly ref: string;
        readonly goodId: TradeGoodId;
        readonly units: number;
        readonly position: {
          readonly column: number;
          readonly row: number;
        };
        readonly durability: number;
        readonly maxDurability: number;
      }[];
    };
  };
  readonly journal: readonly {
    readonly sequence: number;
    readonly kind:
      | "session-ready"
      | "route-planned"
      | "departure"
      | "market-purchase"
      | "market-sale"
      | "information-sale";
    readonly message: string;
  }[];
  readonly availableActions: readonly PlayerAvailableAction[];
}

export interface PlayerSessionController {
  getView(): PlayerSessionView;
  dispatch(action: PlayerSessionAction): PlayerSessionController;
}

interface PrivatePlayerSessionState {
  readonly revision: number;
  readonly phase: PlayerSessionPhase;
  readonly scenario: TacticalCombatScenario;
  readonly caravan: TradeCaravanState;
  readonly supplies: {
    readonly foodUnits: number;
    readonly waterUnits: number;
  };
  readonly cityEconomy: CityEconomyState;
  readonly cityLibrary: CityLibraryArchive;
  readonly knowledgeBundles: readonly PhysicalKnowledgeBundle[];
  readonly journal: PlayerSessionView["journal"];
}

const ORIGIN_REF = "place:south-camp";
const DESTINATION_REF = "place:north-camp";
const FIELD_NOTES_REF = "bundle:field-notes";
const SESSION_WORLD_TIME_SECONDS = 0;

/**
 * PLAYER-PROJECTION-001 — composes existing authoritative systems behind an
 * allow-listed, immutable player contract. Private state is captured in the
 * controller closure and can only change through a validated player action.
 */
export function createPlayerSessionController(
  worldSeed: string,
): PlayerSessionController {
  assertNonEmptyString(worldSeed, "worldSeed");
  const scenario = createTacticalCombatScenario(worldSeed);
  const generated = generateSeededWorld(worldSeed, {
    cityCount: 1,
    staticObjectCounts: { oasis: 0, mine: 0, ruins: 0, cave: 0 },
    wanderingMonsterCount: 0,
    npcCaravanCount: 0,
  });
  const stocks = generated.cityStocks[0];
  const population = generated.cityPopulations[0];
  if (!stocks || !population) {
    throw new Error("player session requires one generated city economy");
  }
  const economy = createCityEconomyState(
    worldSeed,
    { ...stocks, cityId: scenario.originCity.id },
    { ...population, cityId: scenario.originCity.id },
  );
  const knowledgeEntry = createInitialKnowledgeEntry();
  const knowledgeBundle = copyPlayerKnowledgeToBundle(
    { worldSeed, entries: [knowledgeEntry], journal: [] },
    "player-session-caravan",
    [knowledgeEntry.id],
    SESSION_WORLD_TIME_SECONDS,
  );
  const cargo = {
    capacityCargoUnits:
      scenario.resolution.cargoDeployment.sourceCapacityCargoUnits,
    stacks: scenario.resolution.cargoDeployment.baggageUnits.map((unit) => ({
      ...unit.cargoStack,
    })),
  };
  const caravan: TradeCaravanState = {
    ...createTradeCaravanState(
      "player-session-caravan",
      scenario.originCity.id,
      250,
      cargo.capacityCargoUnits,
    ),
    cargo,
  };

  return createController({
    revision: 0,
    phase: "city",
    scenario,
    caravan,
    supplies: { foodUnits: 100, waterUnits: 100 },
    cityEconomy: economy,
    cityLibrary: createCityLibraryArchive(worldSeed, scenario.originCity.id),
    knowledgeBundles: [knowledgeBundle],
    journal: [
      {
        sequence: 1,
        kind: "session-ready",
        message: `Caravan is ready at ${scenario.originCity.name}.`,
      },
    ],
  });
}

function createController(
  state: PrivatePlayerSessionState,
): PlayerSessionController {
  return Object.freeze({
    getView: (): PlayerSessionView => projectPlayerSession(state),
    dispatch: (action: PlayerSessionAction): PlayerSessionController =>
      createController(reducePlayerAction(state, action)),
  });
}

function reducePlayerAction(
  state: PrivatePlayerSessionState,
  action: PlayerSessionAction,
): PrivatePlayerSessionState {
  if (!action || typeof action !== "object" || typeof action.kind !== "string") {
    throw new TypeError("player action must have a kind");
  }
  if (action.kind === "SELECT_DESTINATION") {
    if (state.phase !== "city") {
      throw new RangeError("destination can only be selected while in a city");
    }
    if (action.destinationRef !== DESTINATION_REF) {
      throw new RangeError(`destination is not known: ${action.destinationRef}`);
    }
    return {
      ...state,
      revision: state.revision + 1,
      phase: "ready",
      journal: [
        ...state.journal,
        {
          sequence: state.journal.length + 1,
          kind: "route-planned",
          message: `Route planned to ${state.scenario.destinationCity.name}.`,
        },
      ],
    };
  }
  if (action.kind === "START_JOURNEY") {
    if (state.phase !== "ready") {
      throw new RangeError("journey can only start after route preparation");
    }
    const caravan = beginTradeJourney(
      state.caravan,
      state.scenario.originCity,
      state.scenario.destinationCity,
      state.scenario.expeditionRoute,
      0,
    );
    return {
      ...state,
      revision: state.revision + 1,
      phase: "travelling",
      caravan,
      journal: [
        ...state.journal,
        {
          sequence: state.journal.length + 1,
          kind: "departure",
          message: `Caravan departed for ${state.scenario.destinationCity.name}.`,
        },
      ],
    };
  }
  if (action.kind === "BUY_GOOD") {
    assertCityOperation(state);
    const purchase = buyGoodFromCity(
      state.cityEconomy,
      state.caravan,
      action.goodId,
      action.units,
      SESSION_WORLD_TIME_SECONDS,
    );
    return {
      ...state,
      revision: state.revision + 1,
      cityEconomy: purchase.cityEconomy,
      caravan: purchase.caravan,
      journal: appendJournal(
        state,
        "market-purchase",
        `Purchased ${action.units} ${action.goodId} for ${purchase.totalCostCredits} credits.`,
      ),
    };
  }
  if (action.kind === "SELL_GOOD") {
    assertCityOperation(state);
    const sale = sellGoodToCity(
      state.cityEconomy,
      state.caravan,
      action.goodId,
      action.units,
      SESSION_WORLD_TIME_SECONDS,
    );
    return {
      ...state,
      revision: state.revision + 1,
      cityEconomy: sale.cityEconomy,
      caravan: sale.caravan,
      journal: appendJournal(
        state,
        "market-sale",
        `Sold ${action.units} ${action.goodId} for ${sale.revenueCredits} credits.`,
      ),
    };
  }
  if (action.kind === "SELL_INFORMATION") {
    assertCityOperation(state);
    if (action.bundleRef !== FIELD_NOTES_REF) {
      throw new RangeError(`information bundle is not carried: ${action.bundleRef}`);
    }
    const bundle = state.knowledgeBundles[0];
    if (!bundle) {
      throw new RangeError(`information bundle is not carried: ${action.bundleRef}`);
    }
    const sale = sellKnowledgeBundleToLibrary(
      state.cityLibrary,
      bundle,
      SESSION_WORLD_TIME_SECONDS,
    );
    return {
      ...state,
      revision: state.revision + 1,
      cityLibrary: sale.deposit.library,
      knowledgeBundles: state.knowledgeBundles.slice(1),
      caravan: {
        ...state.caravan,
        credits: state.caravan.credits + sale.payoutCredits,
      },
      journal: appendJournal(
        state,
        "information-sale",
        `Field notes deposited for ${sale.payoutCredits} credits.`,
      ),
    };
  }
  throw new RangeError("unsupported player action");
}

function projectPlayerSession(
  state: PrivatePlayerSessionState,
): PlayerSessionView {
  const route =
    state.phase === "city"
      ? null
      : {
          originRef: ORIGIN_REF,
          destinationRef: DESTINATION_REF,
          distanceMeters: state.scenario.expeditionRoute.totalDistanceMeters,
          durationSeconds: state.scenario.expeditionRoute.totalDurationSeconds,
          speedMetersPerSecond:
            state.scenario.expeditionRoute.speedMetersPerSecond,
          status:
            state.phase === "ready"
              ? ("planned" as const)
              : ("moving" as const),
          progressFraction: 0,
          etaSeconds: state.scenario.expeditionRoute.totalDurationSeconds,
        };
  const usedCargoUnits = usedCargoCapacity(state.caravan.cargo);
  const members = state.scenario.resolution.initialBattle.units
    .filter((unit) => unit.side === "caravan")
    .map((unit) => {
      if (unit.unitClass !== "guard" && unit.unitClass !== "skirmisher") {
        throw new Error("player session supports guard and skirmisher members");
      }
      return {
        ref: `member:${unit.unitClass}`,
        role: unit.unitClass,
        health: unit.health,
        maxHealth: unit.stats.maxHealth,
        status: "ready" as const,
      };
    });
  const inCity = state.phase !== "travelling";
  const city = inCity ? projectCity(state) : null;
  const preparation = inCity ? projectPreparation(state) : null;
  const view: PlayerSessionView = {
    revision: state.revision,
    phase: state.phase,
    screens: [
      { id: "global", available: true },
      inCity
        ? { id: "city", available: true }
        : { id: "city", available: false, reason: "Caravan is travelling." },
      inCity
        ? { id: "preparation", available: true }
        : {
            id: "preparation",
            available: false,
            reason: "Journey is already underway.",
          },
      { id: "battle", available: false, reason: "No contact detected." },
      { id: "result", available: false, reason: "No encounter result." },
    ],
    map: {
      orientation: "north-up",
      currentPlaceRef: inCity ? ORIGIN_REF : null,
      places: [
        {
          ref: ORIGIN_REF,
          name: state.scenario.originCity.name,
          kind: "city",
          eastMeters: 0,
          northMeters: 0,
        },
        {
          ref: DESTINATION_REF,
          name: state.scenario.destinationCity.name,
          kind: "city",
          eastMeters: 0,
          northMeters: state.scenario.expeditionRoute.totalDistanceMeters,
        },
      ],
      route,
    },
    caravan: {
      credits: state.caravan.credits,
      supplies: { ...state.supplies },
      cargo: {
        capacityCargoUnits: state.caravan.cargo.capacityCargoUnits,
        usedCargoUnits,
        freeCargoUnits: state.caravan.cargo.capacityCargoUnits - usedCargoUnits,
        stacks: state.caravan.cargo.stacks.map((stack) => ({
          goodId: stack.goodId,
          units: stack.units,
        })),
      },
      members,
    },
    city,
    preparation,
    journal: state.journal.map((entry) => ({ ...entry })),
    availableActions: projectAvailableActions(state),
  };
  return deepFreeze(view);
}

function projectPreparation(
  state: PrivatePlayerSessionState,
): NonNullable<PlayerSessionView["preparation"]> {
  const field = state.scenario.resolution.battlefield;
  const caravanZone = field.deploymentZones.caravan;
  const combatants = state.scenario.resolution.initialBattle.units.filter(
    (unit) => unit.side === "caravan",
  );
  const cargoDeployment = deployTacticalCargo(
    field,
    state.caravan.cargo,
    combatants,
  );
  return {
    formation: {
      mode: "fixed",
      accepted: true,
      reason:
        "The tactical core has validated this formation; repositioning is not available yet.",
      columns: caravanZone.maxX - caravanZone.minX + 1,
      rows: field.height,
      combatants: combatants.map((unit) => {
        if (unit.unitClass !== "guard" && unit.unitClass !== "skirmisher") {
          throw new Error("player preparation supports caravan combatants only");
        }
        return {
          memberRef: `member:${unit.unitClass}`,
          role: unit.unitClass,
          position: {
            column: unit.position.x - caravanZone.minX,
            row: unit.position.y,
          },
          health: unit.health,
          maxHealth: unit.stats.maxHealth,
          movementCells: unit.stats.movementCells,
          attackRangeCells: unit.stats.attackRangeCells,
          attackDamage: unit.stats.attackDamage,
        };
      }),
      baggage: cargoDeployment.baggageUnits.map((unit, index) => ({
        ref: `baggage:${index + 1}`,
        goodId: unit.cargoStack.goodId,
        units: unit.cargoStack.units,
        position: {
          column: unit.position.x - caravanZone.minX,
          row: unit.position.y,
        },
        durability: unit.durability,
        maxDurability: unit.maxDurability,
      })),
    },
  };
}

function projectCity(
  state: PrivatePlayerSessionState,
): NonNullable<PlayerSessionView["city"]> {
  const bundle = state.knowledgeBundles[0];
  const informationQuote = bundle
    ? quoteKnowledgeBundleForLibrary(
        state.cityLibrary,
        bundle,
        SESSION_WORLD_TIME_SECONDS,
      )
    : null;
  return {
    placeRef: ORIGIN_REF,
    name: state.scenario.originCity.name,
    market: quoteCityMarketPrices(state.cityEconomy).map((quote) => ({
      goodId: quote.goodId,
      stockUnits: quote.stockUnits,
      ownedUnits:
        state.caravan.cargo.stacks.find(
          (stack) => stack.goodId === quote.goodId,
        )?.units ?? 0,
      cityBuyPriceCredits: quote.cityBuyPriceCredits,
      citySellPriceCredits: quote.citySellPriceCredits,
    })),
    library: {
      archiveEntryCount: state.cityLibrary.entries.length,
      acceptedBundleCount: state.cityLibrary.acceptedBundleIds.length,
      carriedBundles:
        bundle && informationQuote
          ? [
              {
                ref: FIELD_NOTES_REF,
                title: "Caravan trail field notes",
                entryCount: bundle.entries.length,
                evidenceKind: bundle.entries[0]?.evidenceKind ?? "caravan-track",
                provenance: "direct-observation",
                confidence: bundle.entries[0]?.confidence ?? "probable",
                fidelityPercent: Math.round(bundle.fidelityFraction * 100),
                localValueCredits: informationQuote.totalValueCredits,
              },
            ]
          : [],
    },
  };
}

function projectAvailableActions(
  state: PrivatePlayerSessionState,
): PlayerSessionView["availableActions"] {
  if (state.phase === "travelling") return [];
  const actions: PlayerAvailableAction[] = [];
  if (state.phase === "city") {
    actions.push({
      kind: "SELECT_DESTINATION",
      label: "Plan route to North Camp",
      destinationRefs: [DESTINATION_REF],
    });
  } else {
    actions.push({ kind: "START_JOURNEY", label: "Start journey" });
  }
  for (const quote of quoteCityMarketPrices(state.cityEconomy)) {
    if (
      canExecute(() =>
        buyGoodFromCity(
          state.cityEconomy,
          state.caravan,
          quote.goodId,
          1,
          SESSION_WORLD_TIME_SECONDS,
        ),
      )
    ) {
      actions.push({
        kind: "BUY_GOOD",
        label: `Buy 1 ${quote.goodId}`,
        goodId: quote.goodId,
        units: 1,
        totalCredits: quote.citySellPriceCredits,
      });
    }
    if (
      canExecute(() =>
        sellGoodToCity(
          state.cityEconomy,
          state.caravan,
          quote.goodId,
          1,
          SESSION_WORLD_TIME_SECONDS,
        ),
      )
    ) {
      actions.push({
        kind: "SELL_GOOD",
        label: `Sell 1 ${quote.goodId}`,
        goodId: quote.goodId,
        units: 1,
        totalCredits: quote.cityBuyPriceCredits,
      });
    }
  }
  const bundle = state.knowledgeBundles[0];
  if (bundle) {
    actions.push({
      kind: "SELL_INFORMATION",
      label: "Deposit field notes",
      bundleRef: FIELD_NOTES_REF,
      totalCredits: quoteKnowledgeBundleForLibrary(
        state.cityLibrary,
        bundle,
        SESSION_WORLD_TIME_SECONDS,
      ).totalValueCredits,
    });
  }
  return actions;
}

function assertCityOperation(state: PrivatePlayerSessionState): void {
  if (state.phase === "travelling" || state.caravan.currentCityId === null) {
    throw new RangeError("city operation requires a caravan in the city");
  }
}

function appendJournal(
  state: PrivatePlayerSessionState,
  kind: PlayerSessionView["journal"][number]["kind"],
  message: string,
): PlayerSessionView["journal"] {
  return [
    ...state.journal,
    { sequence: state.journal.length + 1, kind, message },
  ];
}

function canExecute(operation: () => unknown): boolean {
  try {
    operation();
    return true;
  } catch {
    return false;
  }
}

function createInitialKnowledgeEntry(): PlayerWorldEvidenceEntry {
  return {
    id: "knowledge-caravan-track-player-session",
    evidenceKind: "caravan-track",
    subjectId: "player-session-trail",
    firstObservedAtWorldTimeSeconds: SESSION_WORLD_TIME_SECONDS,
    latestObservedAtWorldTimeSeconds: SESSION_WORLD_TIME_SECONDS,
    confidence: "confirmed",
    facts: {
      kind: "caravan-track",
      approximateAge: "fresh",
      approximateDirection: "north",
    },
    provenance: [
      {
        source: "direct-track-observation",
        sourceEvidenceId: "player-session-trail-observation",
        observedAtWorldTimeSeconds: SESSION_WORLD_TIME_SECONDS,
        confidence: "confirmed",
      },
    ],
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${label} must not be empty`);
  }
}
