import {
  createCityEconomyState,
  type TradeGoodId,
} from "./city-economy.js";
import { quoteCityMarketPrices } from "./city-market.js";
import {
  createTacticalCombatScenario,
  type TacticalCombatScenario,
} from "./tactical-combat-scenario.js";
import {
  beginTradeJourney,
  createTradeCaravanState,
  usedCargoCapacity,
  type TradeCaravanState,
} from "./trade-route.js";
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
  | { readonly kind: "START_JOURNEY" };

export type PlayerAvailableAction =
  | {
      readonly kind: "SELECT_DESTINATION";
      readonly label: string;
      readonly destinationRefs: readonly string[];
    }
  | {
      readonly kind: "START_JOURNEY";
      readonly label: string;
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
      readonly cityBuyPriceCredits: number;
      readonly citySellPriceCredits: number;
    }[];
  };
  readonly journal: readonly {
    readonly sequence: number;
    readonly kind: "session-ready" | "route-planned" | "departure";
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
  readonly cityMarket: NonNullable<PlayerSessionView["city"]>;
  readonly journal: PlayerSessionView["journal"];
}

const ORIGIN_REF = "place:south-camp";
const DESTINATION_REF = "place:north-camp";

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
  const cityMarket: NonNullable<PlayerSessionView["city"]> = {
    placeRef: ORIGIN_REF,
    name: scenario.originCity.name,
    market: quoteCityMarketPrices(economy).map((quote) => ({
      goodId: quote.goodId,
      stockUnits: quote.stockUnits,
      cityBuyPriceCredits: quote.cityBuyPriceCredits,
      citySellPriceCredits: quote.citySellPriceCredits,
    })),
  };
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
    cityMarket,
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
    city: inCity ? state.cityMarket : null,
    journal: state.journal.map((entry) => ({ ...entry })),
    availableActions:
      state.phase === "city"
        ? [
            {
              kind: "SELECT_DESTINATION",
              label: "Plan route to North Camp",
              destinationRefs: [DESTINATION_REF],
            },
          ]
        : state.phase === "ready"
          ? [{ kind: "START_JOURNEY", label: "Start journey" }]
          : [],
  };
  return deepFreeze(view);
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
