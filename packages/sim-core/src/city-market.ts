import {
  TRADE_GOODS,
  cityGood,
  type CityEconomyState,
  type TradeGoodId,
} from "./city-economy.js";

export const CITY_MARKET_TARGET_STOCK_DAYS = 30;
export const CITY_MARKET_MINIMUM_PRICE_MULTIPLIER = 0.5;
export const CITY_MARKET_MAXIMUM_PRICE_MULTIPLIER = 3;
export const CITY_MARKET_SPREAD_FRACTION = 0.1;

export const TRADE_GOOD_REFERENCE_PRICES: Readonly<
  Record<TradeGoodId, number>
> = Object.freeze({
  food: 10,
  water: 8,
  salt: 15,
  textiles: 30,
  ore: 20,
  medicine: 80,
  tools: 50,
});

export interface CityGoodPriceQuote {
  readonly cityId: string;
  readonly goodId: TradeGoodId;
  readonly stockUnits: number;
  readonly targetStockUnits: number;
  readonly stockCoverageDays: number;
  readonly scarcityMultiplier: number;
  /** Credits paid by the city when a caravan sells one unit. */
  readonly cityBuyPriceCredits: number;
  /** Credits charged by the city when a caravan buys one unit. */
  readonly citySellPriceCredits: number;
}

/**
 * TRADE-002: target stock equals thirty days of current deterministic demand.
 * Price pressure is target/current stock, clamped to 0.5x..3x. The city then
 * quotes a fixed 10% bid/ask spread around that transparent local value.
 */
export function quoteCityGoodPrice(
  economy: CityEconomyState,
  goodId: TradeGoodId,
): CityGoodPriceQuote {
  const good = cityGood(economy, goodId);
  if (good.consumptionUnitsPerDay <= 0) {
    throw new RangeError("market demand must be positive");
  }
  const referencePrice = TRADE_GOOD_REFERENCE_PRICES[goodId];
  const targetStockUnits =
    good.consumptionUnitsPerDay * CITY_MARKET_TARGET_STOCK_DAYS;
  const stockCoverageDays = good.stockUnits / good.consumptionUnitsPerDay;
  const unclampedScarcity =
    good.stockUnits === 0
      ? CITY_MARKET_MAXIMUM_PRICE_MULTIPLIER
      : targetStockUnits / good.stockUnits;
  const scarcityMultiplier = clamp(
    unclampedScarcity,
    CITY_MARKET_MINIMUM_PRICE_MULTIPLIER,
    CITY_MARKET_MAXIMUM_PRICE_MULTIPLIER,
  );
  const localReferencePrice = referencePrice * scarcityMultiplier;
  const cityBuyPriceCredits = Math.max(
    1,
    Math.floor(localReferencePrice * (1 - CITY_MARKET_SPREAD_FRACTION)),
  );
  const citySellPriceCredits = Math.max(
    cityBuyPriceCredits + 1,
    Math.ceil(localReferencePrice * (1 + CITY_MARKET_SPREAD_FRACTION)),
  );

  return {
    cityId: economy.cityId,
    goodId,
    stockUnits: good.stockUnits,
    targetStockUnits,
    stockCoverageDays,
    scarcityMultiplier,
    cityBuyPriceCredits,
    citySellPriceCredits,
  };
}

export function quoteCityMarketPrices(
  economy: CityEconomyState,
): readonly CityGoodPriceQuote[] {
  return TRADE_GOODS.map((good) => quoteCityGoodPrice(economy, good.id));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
