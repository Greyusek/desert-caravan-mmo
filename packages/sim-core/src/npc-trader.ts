import {
  advanceCityEconomyToWorldTime,
  type CityEconomyState,
  type TradeGoodId,
} from "./city-economy.js";
import {
  quoteCityGoodPrice,
  type CityGoodPriceQuote,
} from "./city-market.js";
import type { DurationSeconds, RoutePlan } from "./route.js";
import {
  arriveTradeJourney,
  beginTradeJourney,
  buyGoodFromCity,
  createTradeCaravanState,
  sellGoodToCity,
  tradeJourneyPositionAtWorldTime,
  type TradeCaravanState,
  type TradeJourneyPosition,
} from "./trade-route.js";
import type { City } from "./world.js";

export interface NpcTradeOrder {
  readonly npcTraderId: string;
  readonly goodId: TradeGoodId;
  readonly units: number;
  readonly startingCredits: number;
  readonly capacityCargoUnits: number;
  readonly departsAtWorldTimeSeconds: DurationSeconds;
  readonly originCity: City;
  readonly destinationCity: City;
  readonly route: RoutePlan;
}

export interface NpcTradeExecution {
  readonly order: NpcTradeOrder;
  readonly originBeforePurchase: CityEconomyState;
  readonly originAfterPurchase: CityEconomyState;
  readonly destinationBeforeSale: CityEconomyState;
  readonly destinationAfterSale: CityEconomyState;
  readonly destinationQuoteBeforeSale: CityGoodPriceQuote;
  readonly destinationQuoteAfterSale: CityGoodPriceQuote;
  readonly inTransit: TradeJourneyPosition;
  readonly npcTrader: TradeCaravanState;
  readonly purchaseCostCredits: number;
  readonly saleRevenueCredits: number;
  readonly profitCredits: number;
}

/**
 * TRADE-004 is intentionally orchestration, not a second NPC economy. The NPC
 * invokes the exact TRADE-003 purchase, cargo, route, arrival and sale actions
 * against the same immutable market states later quoted to the player.
 */
export function executeNpcTradeOrder(
  originEconomy: CityEconomyState,
  destinationEconomy: CityEconomyState,
  order: NpcTradeOrder,
): NpcTradeExecution {
  if (
    originEconomy.worldSeed !== destinationEconomy.worldSeed ||
    originEconomy.worldSeed.length === 0
  ) {
    throw new RangeError("NPC trade markets must share one worldSeed");
  }
  if (originEconomy.cityId !== order.originCity.id) {
    throw new RangeError("origin economy must match NPC trade origin city");
  }
  if (destinationEconomy.cityId !== order.destinationCity.id) {
    throw new RangeError(
      "destination economy must match NPC trade destination city",
    );
  }

  const originBeforePurchase = advanceCityEconomyToWorldTime(
    originEconomy,
    order.departsAtWorldTimeSeconds,
  );
  const npc = createTradeCaravanState(
    order.npcTraderId,
    order.originCity.id,
    order.startingCredits,
    order.capacityCargoUnits,
  );
  const purchase = buyGoodFromCity(
    originBeforePurchase,
    npc,
    order.goodId,
    order.units,
    order.departsAtWorldTimeSeconds,
  );
  const travelling = beginTradeJourney(
    purchase.caravan,
    order.originCity,
    order.destinationCity,
    order.route,
    order.departsAtWorldTimeSeconds,
  );
  const arrivalTime =
    order.departsAtWorldTimeSeconds + order.route.totalDurationSeconds;
  const inTransit = tradeJourneyPositionAtWorldTime(
    travelling,
    order.departsAtWorldTimeSeconds + order.route.totalDurationSeconds / 2,
  );
  const destinationBeforeSale = advanceCityEconomyToWorldTime(
    destinationEconomy,
    arrivalTime,
  );
  const destinationQuoteBeforeSale = quoteCityGoodPrice(
    destinationBeforeSale,
    order.goodId,
  );
  const arrived = arriveTradeJourney(travelling, arrivalTime);
  const sale = sellGoodToCity(
    destinationBeforeSale,
    arrived,
    order.goodId,
    order.units,
    arrivalTime,
  );
  const destinationQuoteAfterSale = quoteCityGoodPrice(
    sale.cityEconomy,
    order.goodId,
  );

  return {
    order,
    originBeforePurchase,
    originAfterPurchase: purchase.cityEconomy,
    destinationBeforeSale,
    destinationAfterSale: sale.cityEconomy,
    destinationQuoteBeforeSale,
    destinationQuoteAfterSale,
    inTransit,
    npcTrader: sale.caravan,
    purchaseCostCredits: purchase.totalCostCredits,
    saleRevenueCredits: sale.revenueCredits,
    profitCredits: sale.profitCredits,
  };
}
