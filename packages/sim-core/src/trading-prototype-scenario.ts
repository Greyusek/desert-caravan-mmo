import {
  advanceCityEconomyToWorldTime,
  createCityEconomyState,
  type CityEconomyState,
  type CityGoodEconomy,
  type TradeGoodId,
} from "./city-economy.js";
import {
  quoteCityMarketPrices,
  type CityGoodPriceQuote,
} from "./city-market.js";
import {
  copyPhysicalKnowledgeBundle,
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  type CityLibraryArchive,
  type PhysicalKnowledgeBundle,
} from "./city-library.js";
import { greatCircleDistance, initialBearingDegrees } from "./geometry.js";
import {
  quoteKnowledgeBundleForLibrary,
  sellKnowledgeBundleToLibrary,
  type InformationBundleQuote,
  type InformationBundleSale,
} from "./information-market.js";
import {
  executeNpcTradeOrder,
  type NpcTradeExecution,
} from "./npc-trader.js";
import {
  createRoutePlan,
  positionAtTime,
  type RoutePlan,
  type RoutePosition,
} from "./route.js";
import {
  arriveTradeJourney,
  beginTradeJourney,
  buyGoodFromCity,
  createTradeCaravanState,
  sellGoodToCity,
  usedCargoCapacity,
  type TradeCargoStack,
  type TradeJournalEvent,
  type TradePurchaseResult,
  type TradeSaleResult,
  type TradeCaravanState,
} from "./trade-route.js";
import type { PlayerWorldEvidenceEntry } from "./world-evidence.js";
import { generateSeededWorld, type City } from "./world.js";

const TRADING_GOOD_ID = "ore" as const;
const PLAYER_TRADE_UNITS = 5;
const PLAYER_CAPACITY_CARGO_UNITS = 10;
const NPC_TRADE_UNITS = 10;
const TRADING_ROUTE_SPEED_METERS_PER_SECOND = 1_000;
const INFORMATION_OLD_AGE_SECONDS = 31 * 24 * 60 * 60;

export interface TradingGoodMarketView
  extends CityGoodEconomy,
    CityGoodPriceQuote {}

export interface TradingCityMarketView {
  readonly cityId: string;
  readonly cityName: string;
  readonly goods: readonly TradingGoodMarketView[];
}

export interface TradingPrototypeServerTruth {
  readonly worldSeed: string;
  readonly originCity: City;
  readonly destinationCity: City;
  readonly originInitialEconomy: CityEconomyState;
  readonly destinationInitialEconomy: CityEconomyState;
  readonly physicalTradeRoute: RoutePlan;
  readonly playerPurchase: TradePurchaseResult;
  readonly playerInTransit: TradeCaravanState;
  readonly playerSale: TradeSaleResult;
  readonly npcTrade: NpcTradeExecution;
  readonly informationDeliveryRoute: RoutePlan;
  readonly informationCarrierHalfway: RoutePosition;
  readonly informationCarrierArrival: RoutePosition;
  readonly informationBundle: PhysicalKnowledgeBundle;
  readonly copiedInformationBundle: PhysicalKnowledgeBundle;
  readonly destinationLibraryBeforeDelivery: CityLibraryArchive;
  readonly informationSale: InformationBundleSale;
  readonly copiedInformationQuote: InformationBundleQuote;
  readonly oldInformationQuote: InformationBundleQuote;
  readonly duplicateInformationQuote: InformationBundleQuote;
}

export interface TradingPrototypePlayerView {
  readonly worldSeed: string;
  readonly markets: {
    readonly origin: TradingCityMarketView;
    readonly destination: TradingCityMarketView;
  };
  readonly route: {
    readonly originCityId: string;
    readonly destinationCityId: string;
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly departedAtWorldTimeSeconds: number;
    readonly arrivedAtWorldTimeSeconds: number;
  };
  readonly playerTrade: {
    readonly goodId: TradeGoodId;
    readonly units: number;
    readonly startingCredits: number;
    readonly endingCredits: number;
    readonly capacityCargoUnits: number;
    readonly loadedCargoUnits: number;
    readonly loadedStacks: readonly TradeCargoStack[];
    readonly endingStacks: readonly TradeCargoStack[];
    readonly purchaseUnitPriceCredits: number;
    readonly saleUnitPriceCredits: number;
    readonly profitCredits: number;
    readonly journal: readonly TradeJournalEvent[];
  };
  readonly npcImpact: {
    readonly traderId: string;
    readonly goodId: TradeGoodId;
    readonly units: number;
    readonly stockBeforeSale: number;
    readonly stockAfterSale: number;
    readonly playerBidBeforeSaleCredits: number;
    readonly playerBidAfterSaleCredits: number;
    readonly profitCredits: number;
    readonly journalKinds: readonly TradeJournalEvent["kind"][];
  };
  readonly informationTrade: {
    readonly bundleId: string;
    readonly carrierId: string;
    readonly sourceCityId: string;
    readonly targetLibraryCityId: string;
    readonly departedAtWorldTimeSeconds: number;
    readonly arrivedAtWorldTimeSeconds: number;
    readonly routeDistanceMeters: number;
    readonly novelValueCredits: number;
    readonly copiedValueCredits: number;
    readonly oldValueCredits: number;
    readonly duplicateValueCredits: number;
    readonly copyGeneration: number;
    readonly copiedFidelityFraction: number;
    readonly depositedEntryCount: number;
  };
}

export interface TradingPrototypeScenario {
  readonly serverTruth: TradingPrototypeServerTruth;
  readonly playerView: TradingPrototypePlayerView;
}

/**
 * TRADING-001 closes Stage 3 with one fixed-action seeded replay. Exact city
 * coordinates and RoutePlans remain server truth; the player payload exposes
 * only market facts, physical timing/distance, journals and local values.
 */
export function createTradingPrototypeScenario(
  worldSeed: string,
): TradingPrototypeScenario {
  const world = generateSeededWorld(worldSeed, { cityCount: 2 });
  const originCity = world.cities[0];
  const destinationCity = world.cities[1];
  const originStocks = world.cityStocks[0];
  const destinationStocks = world.cityStocks[1];
  const originPopulation = world.cityPopulations[0];
  const destinationPopulation = world.cityPopulations[1];
  if (
    !originCity ||
    !destinationCity ||
    !originStocks ||
    !destinationStocks ||
    !originPopulation ||
    !destinationPopulation
  ) {
    throw new Error("Trading Prototype requires two complete seeded cities");
  }

  const originInitialEconomy = withScenarioOreProfile(
    createCityEconomyState(worldSeed, originStocks, originPopulation),
    1_000,
  );
  const destinationInitialEconomy = withScenarioOreProfile(
    createCityEconomyState(
      worldSeed,
      destinationStocks,
      destinationPopulation,
    ),
    0,
  );
  const routeDistanceMeters = greatCircleDistance(
    originCity.position,
    destinationCity.position,
  );
  const physicalTradeRoute = createRoutePlan(
    originCity.position,
    [
      {
        bearingDeg: initialBearingDegrees(
          originCity.position,
          destinationCity.position,
        ),
        distanceMeters: routeDistanceMeters,
      },
    ],
    TRADING_ROUTE_SPEED_METERS_PER_SECOND,
  );

  const playerInitial = createTradeCaravanState(
    "trading-player",
    originCity.id,
    10_000,
    PLAYER_CAPACITY_CARGO_UNITS,
  );
  const playerPurchase = buyGoodFromCity(
    originInitialEconomy,
    playerInitial,
    TRADING_GOOD_ID,
    PLAYER_TRADE_UNITS,
    0,
  );
  const playerInTransit = beginTradeJourney(
    playerPurchase.caravan,
    originCity,
    destinationCity,
    physicalTradeRoute,
    0,
  );
  const playerArrivalTime = physicalTradeRoute.totalDurationSeconds;
  const destinationAtPlayerArrival = advanceCityEconomyToWorldTime(
    destinationInitialEconomy,
    playerArrivalTime,
  );
  const playerArrived = arriveTradeJourney(
    playerInTransit,
    playerArrivalTime,
  );
  const playerSale = sellGoodToCity(
    destinationAtPlayerArrival,
    playerArrived,
    TRADING_GOOD_ID,
    PLAYER_TRADE_UNITS,
    playerArrivalTime,
  );

  const npcTrade = executeNpcTradeOrder(
    playerPurchase.cityEconomy,
    playerSale.cityEconomy,
    {
      npcTraderId: `trading-npc-${opaqueKey(worldSeed)}`,
      goodId: TRADING_GOOD_ID,
      units: NPC_TRADE_UNITS,
      startingCredits: 10_000,
      capacityCargoUnits: NPC_TRADE_UNITS * 2,
      departsAtWorldTimeSeconds: playerArrivalTime,
      originCity,
      destinationCity,
      route: physicalTradeRoute,
    },
  );

  const npcArrival = npcTrade.npcTrader.journal.find(
    (event) => event.kind === "arrival",
  );
  if (!npcArrival) throw new Error("Trading Prototype NPC must arrive");
  const evidence = createScenarioEvidence(npcArrival.atWorldTimeSeconds);
  const informationDepartureTime = npcArrival.atWorldTimeSeconds + 100;
  const informationBundle = copyPlayerKnowledgeToBundle(
    { worldSeed, entries: [evidence], journal: [] },
    "trading-information-carrier",
    [evidence.id],
    informationDepartureTime,
  );
  const copiedInformationBundle = copyPhysicalKnowledgeBundle(
    informationBundle,
    "trading-information-copy-carrier",
    [evidence.id],
    informationDepartureTime + 1,
  );
  const informationDeliveryRoute = physicalTradeRoute;
  const informationArrivalTime =
    informationDepartureTime + informationDeliveryRoute.totalDurationSeconds;
  const informationCarrierHalfway = positionAtTime(
    informationDeliveryRoute,
    informationDeliveryRoute.totalDurationSeconds / 2,
  );
  const informationCarrierArrival = positionAtTime(
    informationDeliveryRoute,
    informationDeliveryRoute.totalDurationSeconds,
  );
  if (
    informationCarrierArrival.status !== "arrived" ||
    greatCircleDistance(
      informationCarrierArrival.coordinate,
      destinationCity.position,
    ) > 0.001
  ) {
    throw new Error("physical information carrier must reach destination library");
  }

  const destinationLibraryBeforeDelivery = createCityLibraryArchive(
    worldSeed,
    destinationCity.id,
  );
  const copiedInformationQuote = quoteKnowledgeBundleForLibrary(
    destinationLibraryBeforeDelivery,
    copiedInformationBundle,
    informationArrivalTime,
  );
  const oldInformationQuote = quoteKnowledgeBundleForLibrary(
    destinationLibraryBeforeDelivery,
    informationBundle,
    informationArrivalTime + INFORMATION_OLD_AGE_SECONDS,
  );
  const informationSale = sellKnowledgeBundleToLibrary(
    destinationLibraryBeforeDelivery,
    informationBundle,
    informationArrivalTime,
  );
  const duplicateInformationQuote = quoteKnowledgeBundleForLibrary(
    informationSale.deposit.library,
    informationBundle,
    informationArrivalTime + 1,
  );

  const playerPurchaseEvent = playerSale.caravan.journal.find(
    (event) => event.kind === "purchase",
  );
  const playerSaleEvent = playerSale.caravan.journal.find(
    (event) => event.kind === "sale",
  );
  if (!playerPurchaseEvent || !playerSaleEvent) {
    throw new Error("Trading Prototype player journal invariant failed");
  }

  return {
    serverTruth: {
      worldSeed,
      originCity,
      destinationCity,
      originInitialEconomy,
      destinationInitialEconomy,
      physicalTradeRoute,
      playerPurchase,
      playerInTransit,
      playerSale,
      npcTrade,
      informationDeliveryRoute,
      informationCarrierHalfway,
      informationCarrierArrival,
      informationBundle,
      copiedInformationBundle,
      destinationLibraryBeforeDelivery,
      informationSale,
      copiedInformationQuote,
      oldInformationQuote,
      duplicateInformationQuote,
    },
    playerView: {
      worldSeed,
      markets: {
        origin: projectMarket(originCity, originInitialEconomy),
        destination: projectMarket(destinationCity, destinationInitialEconomy),
      },
      route: {
        originCityId: originCity.id,
        destinationCityId: destinationCity.id,
        distanceMeters: physicalTradeRoute.totalDistanceMeters,
        durationSeconds: physicalTradeRoute.totalDurationSeconds,
        departedAtWorldTimeSeconds: 0,
        arrivedAtWorldTimeSeconds: playerArrivalTime,
      },
      playerTrade: {
        goodId: TRADING_GOOD_ID,
        units: PLAYER_TRADE_UNITS,
        startingCredits: playerInitial.credits,
        endingCredits: playerSale.caravan.credits,
        capacityCargoUnits: playerInitial.cargo.capacityCargoUnits,
        loadedCargoUnits: usedCargoCapacity(playerPurchase.caravan.cargo),
        loadedStacks: playerPurchase.caravan.cargo.stacks,
        endingStacks: playerSale.caravan.cargo.stacks,
        purchaseUnitPriceCredits: playerPurchaseEvent.unitPriceCredits,
        saleUnitPriceCredits: playerSaleEvent.unitPriceCredits,
        profitCredits: playerSale.profitCredits,
        journal: playerSale.caravan.journal,
      },
      npcImpact: {
        traderId: npcTrade.order.npcTraderId,
        goodId: npcTrade.order.goodId,
        units: npcTrade.order.units,
        stockBeforeSale: npcTrade.destinationQuoteBeforeSale.stockUnits,
        stockAfterSale: npcTrade.destinationQuoteAfterSale.stockUnits,
        playerBidBeforeSaleCredits:
          npcTrade.destinationQuoteBeforeSale.cityBuyPriceCredits,
        playerBidAfterSaleCredits:
          npcTrade.destinationQuoteAfterSale.cityBuyPriceCredits,
        profitCredits: npcTrade.profitCredits,
        journalKinds: npcTrade.npcTrader.journal.map((event) => event.kind),
      },
      informationTrade: {
        bundleId: informationBundle.id,
        carrierId: informationBundle.carrierId,
        sourceCityId: originCity.id,
        targetLibraryCityId: destinationCity.id,
        departedAtWorldTimeSeconds: informationDepartureTime,
        arrivedAtWorldTimeSeconds: informationArrivalTime,
        routeDistanceMeters: informationDeliveryRoute.totalDistanceMeters,
        novelValueCredits: informationSale.quote.totalValueCredits,
        copiedValueCredits: copiedInformationQuote.totalValueCredits,
        oldValueCredits: oldInformationQuote.totalValueCredits,
        duplicateValueCredits: duplicateInformationQuote.totalValueCredits,
        copyGeneration: copiedInformationBundle.copyGeneration,
        copiedFidelityFraction: copiedInformationBundle.fidelityFraction,
        depositedEntryCount: informationSale.deposit.library.entries.length,
      },
    },
  };
}

function withScenarioOreProfile(
  economy: CityEconomyState,
  stockUnits: number,
): CityEconomyState {
  return {
    ...economy,
    goods: economy.goods.map((good) =>
      good.goodId === TRADING_GOOD_ID
        ? {
            ...good,
            stockUnits,
            productionUnitsPerDay: 0,
            consumptionUnitsPerDay: 1,
          }
        : good,
    ),
  };
}

function projectMarket(
  city: City,
  economy: CityEconomyState,
): TradingCityMarketView {
  return {
    cityId: city.id,
    cityName: city.name,
    goods: quoteCityMarketPrices(economy).map((quote) => {
      const good = economy.goods.find(
        (candidate) => candidate.goodId === quote.goodId,
      );
      if (!good) throw new Error(`Trading Prototype missing ${quote.goodId}`);
      return { ...good, ...quote };
    }),
  };
}

function createScenarioEvidence(
  observedAtWorldTimeSeconds: number,
): PlayerWorldEvidenceEntry {
  return {
    id: "knowledge-caravan-track-trading-npc",
    evidenceKind: "caravan-track",
    subjectId: "trading-npc-track",
    firstObservedAtWorldTimeSeconds: observedAtWorldTimeSeconds,
    latestObservedAtWorldTimeSeconds: observedAtWorldTimeSeconds,
    confidence: "confirmed",
    facts: {
      kind: "caravan-track",
      approximateAge: "fresh",
      approximateDirection: "east",
    },
    provenance: [
      {
        source: "direct-track-observation",
        sourceEvidenceId: "trading-npc-track-observation",
        observedAtWorldTimeSeconds,
        confidence: "confirmed",
      },
    ],
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
