// ============================================================================
// GEMSIM: COMPETITIVE MARKET
// Teams of a session sell into the same segments, against each other and against
// scripted rivals. Customers choose with a multinomial logit on price, quality,
// availability, reliability and marketing: the transformation metrics (debt,
// capacity, resilience, compliance) become measurable competitive advantages.
//
// The market clears at the start of the quarter, on the capabilities each team
// brings into it, so this quarter's investments sell from the next one.
// Pure module with type-only imports: the client reuses it for projections.
// ============================================================================

import type {
  MarketDecision,
  MarketModel,
  MarketRival,
  MarketSegment,
  MarketSegmentResult,
  Scenario,
  Team,
  TeamMarketResult,
  TeamMetrics,
} from '../types/index.js';
import { calculateOpEx, seededRoll } from './math.js';

export const MARKET_PRICE_BOUNDS = { min: 0.5, max: 2 }; // price allowed, relative to the reference price
const PRICE_ELASTICITY = 3; // logit weight of a price ratio (log scale)
const CRITERION_WEIGHT = 3; // logit weight of quality, availability and reliability (0-1 scale, centered)
const MARKETING_WEIGHT = 0.6; // logit weight of log(1 + marketing / scale)
const MARKETING_SCALE_SHARE = 0.02; // marketing scale = 2% of the segment's reference revenue
const DEMAND_SHOCK = 0.1; // ±5% seeded demand variation per segment and quarter
const RIVAL_PRICE_CUT = 0.03; // per quarter, times the rival's aggressiveness
const RIVAL_CAPABILITY = 0.6; // rivals' availability and reliability (0-1)
const MARGIN_OVER_RUN = 1.6; // starting gross margin a generated market must reach, relative to the run budget

type Drivers = MarketSegmentResult['drivers'];

export function segmentDemand(segment: MarketSegment, round: number, seed?: string): number {
  const shock = seed ? (seededRoll(`${seed}|demand|${segment.id}|${round}`) - 0.5) * DEMAND_SHOCK : 0;
  return segment.baseDemand * Math.pow(1 + segment.growth, round - 1) * (1 + shock);
}

export function defaultPresence(market: MarketModel): string[] {
  return market.segments.filter(s => s.openAtStart !== false).map(s => s.id);
}

export function teamPresence(scenario: Scenario, team: Pick<Team, 'marketPresence'>): string[] {
  return scenario.market ? team.marketPresence ?? defaultPresence(scenario.market) : [];
}

/** The quarter's market decision with defaults: last quarter's prices (or the reference), no marketing. */
export function effectiveMarketDecision(
  scenario: Scenario,
  team: Pick<Team, 'lastMarketDecision'>,
  decision?: MarketDecision
): MarketDecision {
  const market = scenario.market;
  if (!market) return { prices: {}, marketing: {} };
  const prices: Record<string, number> = {};
  const marketing: Record<string, number> = {};
  for (const seg of market.segments) {
    prices[seg.id] = decision?.prices?.[seg.id] ?? team.lastMarketDecision?.prices?.[seg.id] ?? seg.referencePrice;
    marketing[seg.id] = Math.max(0, decision?.marketing?.[seg.id] ?? 0);
  }
  return { prices, marketing, enter: decision?.enter ?? [] };
}

/** Commercial spending of a decision, paid from the program cash: marketing plus segment entries. */
export function marketSpend(scenario: Scenario, decision?: MarketDecision): number {
  const market = scenario.market;
  if (!market || !decision) return 0;
  const marketing = Object.values(decision.marketing ?? {}).reduce((sum, v) => sum + Math.max(0, v), 0);
  const entries = (decision.enter ?? []).reduce((sum, id) => sum + (market.segments.find(s => s.id === id)?.entryCost ?? 0), 0);
  return Math.round(marketing + entries);
}

export function productQuality(metrics: Pick<TeamMetrics, 'technicalDebtIndex' | 'complianceScore'>): number {
  return ((100 - metrics.technicalDebtIndex) * 0.6 + metrics.complianceScore * 0.4) / 100;
}

function marketingTerm(segment: MarketSegment, marketing: number): number {
  const scale = Math.max(1, segment.baseDemand * segment.referencePrice * MARKETING_SCALE_SHARE);
  return MARKETING_WEIGHT * Math.log(1 + Math.max(0, marketing) / scale);
}

export function teamDrivers(segment: MarketSegment, metrics: TeamMetrics, price: number, marketing: number): Drivers {
  return {
    price: -segment.priceSensitivity * PRICE_ELASTICITY * Math.log(Math.max(0.01, price) / segment.referencePrice),
    quality: CRITERION_WEIGHT * segment.qualitySensitivity * (productQuality(metrics) - 0.5),
    availability: CRITERION_WEIGHT * segment.speedSensitivity * (metrics.deliveryVelocity / 100 - 0.5),
    reliability: CRITERION_WEIGHT * segment.reliabilitySensitivity * (metrics.resilienceIndex / 100 - 0.5),
    marketing: marketingTerm(segment, marketing),
  };
}

export function rivalPrice(rival: MarketRival, segment: MarketSegment, round: number): number {
  return segment.referencePrice * rival.priceIndex * Math.max(0.5, 1 - RIVAL_PRICE_CUT * rival.aggressiveness * (round - 1));
}

function rivalDrivers(rival: MarketRival, segment: MarketSegment, round: number): Drivers {
  return {
    price: -segment.priceSensitivity * PRICE_ELASTICITY * Math.log(rivalPrice(rival, segment, round) / segment.referencePrice),
    quality: CRITERION_WEIGHT * segment.qualitySensitivity * (rival.quality / 100 - 0.5),
    availability: CRITERION_WEIGHT * segment.speedSensitivity * (RIVAL_CAPABILITY - 0.5),
    reliability: CRITERION_WEIGHT * segment.reliabilitySensitivity * (RIVAL_CAPABILITY - 0.5),
    marketing: 0,
  };
}

const sumDrivers = (d: Drivers) => d.price + d.quality + d.availability + d.reliability + d.marketing;

function rivalsIn(market: MarketModel, segmentId: string): MarketRival[] {
  return market.rivals.filter(r => !r.segmentIds || r.segmentIds.includes(segmentId));
}

/**
 * Market size grows with the number of teams so that, in symmetric play, each team
 * faces the same opportunity as a solo player against the rivals. Without a segment,
 * the scale uses every rival (used for the overall market-share target).
 */
export function marketScale(market: MarketModel, teamsInMarket: number, segmentId?: string): number {
  const rivals = segmentId ? rivalsIn(market, segmentId).length : market.rivals.length;
  return (Math.max(1, teamsInMarket) + rivals) / (1 + rivals);
}

/** Market-share objective for a team, scaled to the number of competing teams. */
export function marketShareTarget(scenario: Pick<Scenario, 'market' | 'winLossConditions'>, teamsInMarket = 1): number | undefined {
  const target = scenario.winLossConditions?.minMarketShare;
  if (target === undefined || !scenario.market) return undefined;
  return Math.round((target / marketScale(scenario.market, teamsInMarket)) * 10) / 10;
}

interface Participant {
  key: string; // team id or rival id
  team?: { team: Team; decision: MarketDecision };
  rival?: MarketRival;
  drivers: Drivers;
  attractiveness: number;
  price: number;
}

/**
 * Clears every segment for all teams at once. Each team's demand is capped by its
 * delivery capacity; demand it cannot serve goes to the other sellers.
 */
export function clearMarket(
  scenario: Scenario,
  entries: Array<{ team: Team; decision?: MarketDecision }>,
  round: number,
  seed = ''
): Record<string, TeamMarketResult> {
  const market = scenario.market;
  if (!market || entries.length === 0) return {};

  const teams = entries.map(e => ({ team: e.team, decision: effectiveMarketDecision(scenario, e.team, e.decision) }));
  const runAllocation = calculateOpEx(scenario.topology.nodes, scenario.baselineMetrics.technicalDebtIndex, 0);

  const capacity: Record<string, number> = {};
  for (const { team } of teams) capacity[team.id] = Math.max(0, team.metrics.deliveryVelocity * market.unitsPerCapacityPoint);

  // 1. Demand each team attracts in each segment (before capacity)
  const perSegment = market.segments.map(segment => {
    const demand = segmentDemand(segment, round, seed) * marketScale(market, teams.length, segment.id);
    const participants: Participant[] = [];
    for (const t of teams) {
      const present = teamPresence(scenario, t.team).includes(segment.id) || (t.decision.enter ?? []).includes(segment.id);
      if (!present) continue;
      const price = t.decision.prices[segment.id];
      const marketing = t.decision.marketing[segment.id] ?? 0;
      const drivers = teamDrivers(segment, t.team.metrics, price, marketing);
      participants.push({ key: t.team.id, team: t, drivers, attractiveness: Math.exp(sumDrivers(drivers)), price });
    }
    for (const rival of rivalsIn(market, segment.id)) {
      const drivers = rivalDrivers(rival, segment, round);
      participants.push({ key: rival.id, rival, drivers, attractiveness: Math.exp(sumDrivers(drivers)), price: rivalPrice(rival, segment, round) });
    }
    const total = participants.reduce((sum, p) => sum + p.attractiveness, 0);
    const demanded: Record<string, number> = {};
    for (const p of participants) demanded[p.key] = total > 0 ? (demand * p.attractiveness) / total : 0;
    return { segment, demand, participants, demanded };
  });

  // 2. Capacity: a team that cannot serve all its demand sells pro rata across segments
  const sold: Record<string, Record<string, number>> = {}; // segmentId -> key -> units
  const spare: Record<string, number> = {};
  for (const { team } of teams) {
    const wanted = perSegment.reduce((sum, s) => sum + (s.demanded[team.id] ?? 0), 0);
    const ratio = wanted > capacity[team.id] ? capacity[team.id] / wanted : 1;
    for (const s of perSegment) {
      if (s.demanded[team.id] === undefined) continue;
      (sold[s.segment.id] ??= {})[team.id] = s.demanded[team.id] * ratio;
    }
    spare[team.id] = capacity[team.id] - wanted * ratio;
  }
  for (const s of perSegment) {
    for (const p of s.participants) if (p.rival) (sold[s.segment.id] ??= {})[p.key] = s.demanded[p.key];
  }

  // 3. Unserved demand goes to the other sellers that can still deliver (rivals always can)
  for (const s of perSegment) {
    const lost = s.participants.reduce((sum, p) => sum + (p.team ? s.demanded[p.key] - sold[s.segment.id][p.key] : 0), 0);
    if (lost <= 0.5) continue;
    const takers = s.participants.filter(p => p.rival || (spare[p.key] ?? 0) > 0.5);
    const weight = takers.reduce((sum, p) => sum + p.attractiveness, 0);
    for (const p of takers) {
      let units = (lost * p.attractiveness) / weight;
      if (p.team) {
        units = Math.min(units, spare[p.key]);
        spare[p.key] -= units;
      }
      sold[s.segment.id][p.key] += units;
    }
  }

  // 4. Results per team
  const totalDemand = perSegment.reduce((sum, s) => sum + s.demand, 0);
  const results: Record<string, TeamMarketResult> = {};
  for (const { team, decision } of teams) {
    const segments: MarketSegmentResult[] = [];
    for (const s of perSegment) {
      const p = s.participants.find(x => x.key === team.id);
      if (!p) continue;
      const unitsSold = sold[s.segment.id][team.id];
      segments.push({
        segmentId: s.segment.id,
        demand: Math.round(s.demand),
        price: p.price,
        marketing: decision.marketing[s.segment.id] ?? 0,
        attractiveness: Math.round(p.attractiveness * 1000) / 1000,
        share: s.demand > 0 ? Math.round((unitsSold / s.demand) * 1000) / 1000 : 0,
        unitsDemanded: Math.round(s.demanded[team.id]),
        unitsSold: Math.round(unitsSold),
        revenue: Math.round(unitsSold * p.price),
        drivers: roundDrivers(p.drivers),
      });
    }
    const unitsSold = segments.reduce((sum, s) => sum + s.unitsSold, 0);
    const revenue = segments.reduce((sum, s) => sum + s.revenue, 0);
    const variableCost = Math.round(unitsSold * market.unitCost);
    const grossMargin = revenue - variableCost;
    const marketing = Math.round(Object.values(decision.marketing).reduce((sum, v) => sum + v, 0));
    const entryCosts = (decision.enter ?? [])
      .filter(id => !teamPresence(scenario, team).includes(id))
      .reduce((sum, id) => sum + (market.segments.find(seg => seg.id === id)?.entryCost ?? 0), 0);
    const opEx = team.metrics.opEx;
    const operatingProfit = Math.round(grossMargin - market.fixedCosts - opEx - marketing);
    // The business funds its fixed costs, the run budget and marketing, then reinvests a share of
    // what is left in the program (a loss is charged to it the same way). Entries are program investments.
    const programCashDelta = Math.round(market.cashRetention * (grossMargin - market.fixedCosts - runAllocation - marketing)) - entryCosts;

    results[team.id] = {
      segments,
      capacityUnits: Math.round(capacity[team.id]),
      unitsSold,
      lostSales: Math.max(0, segments.reduce((sum, s) => sum + s.unitsDemanded, 0) - unitsSold),
      revenue,
      variableCost,
      grossMargin,
      marketing,
      entryCosts,
      fixedCosts: market.fixedCosts,
      opEx,
      operatingProfit,
      programCashDelta,
      marketShare: totalDemand > 0 ? Math.round((segments.reduce((sum, s) => sum + sold[s.segmentId][team.id], 0) / totalDemand) * 1000) / 10 : 0,
      rivals: market.rivals.map(rival => {
        const inSegs = perSegment.filter(s => s.participants.some(p => p.key === rival.id));
        const units = inSegs.reduce((sum, s) => sum + sold[s.segment.id][rival.id], 0);
        const price = inSegs.length ? inSegs.reduce((sum, s) => sum + rivalPrice(rival, s.segment, round), 0) / inSegs.length : 0;
        return { id: rival.id, name: rival.name, share: totalDemand > 0 ? Math.round((units / totalDemand) * 1000) / 10 : 0, price: Math.round(price * 100) / 100 };
      }),
    };
  }
  return results;
}

function roundDrivers(d: Drivers): Drivers {
  const r = (x: number) => Math.round(x * 100) / 100;
  return { price: r(d.price), quality: r(d.quality), availability: r(d.availability), reliability: r(d.reliability), marketing: r(d.marketing) };
}

/** Rules for a market decision; returns translatable issue codes. */
export function marketDecisionIssues(
  scenario: Scenario,
  team: Pick<Team, 'marketPresence'>,
  decision?: MarketDecision
): Array<{ code: string; params?: Record<string, string | number>; message: string }> {
  const market = scenario.market;
  if (!decision) return [];
  if (!market) return [{ code: 'rules.market.none', message: 'This scenario has no market.' }];
  const issues: Array<{ code: string; params?: Record<string, string | number>; message: string }> = [];
  const segments = new Map(market.segments.map(s => [s.id, s]));
  const presence = teamPresence(scenario, team);
  for (const [id, price] of Object.entries(decision.prices ?? {})) {
    const seg = segments.get(id);
    if (!seg) {
      issues.push({ code: 'rules.market.segment', params: { id }, message: `Unknown segment '${id}'.` });
      continue;
    }
    const min = seg.referencePrice * MARKET_PRICE_BOUNDS.min;
    const max = seg.referencePrice * MARKET_PRICE_BOUNDS.max;
    if (!(price >= min && price <= max)) {
      issues.push({
        code: 'rules.market.price',
        params: { name: seg.name, min: round2(min), max: round2(max) },
        message: `Price for "${seg.name}" must be between ${round2(min)} and ${round2(max)}.`,
      });
    }
  }
  for (const [id, amount] of Object.entries(decision.marketing ?? {})) {
    if (!segments.has(id)) issues.push({ code: 'rules.market.segment', params: { id }, message: `Unknown segment '${id}'.` });
    else if (!(amount >= 0)) issues.push({ code: 'rules.market.marketing', params: { name: segments.get(id)!.name }, message: 'Marketing cannot be negative.' });
    else if (amount > 0 && !presence.includes(id) && !(decision.enter ?? []).includes(id)) {
      const name = segments.get(id)!.name;
      issues.push({ code: 'rules.market.notPresent', params: { name }, message: `Enter "${name}" before marketing there.` });
    }
  }
  for (const id of decision.enter ?? []) {
    const seg = segments.get(id);
    if (!seg) issues.push({ code: 'rules.market.segment', params: { id }, message: `Unknown segment '${id}'.` });
    else if (presence.includes(id)) issues.push({ code: 'rules.market.alreadyIn', params: { name: seg.name }, message: `Already selling in "${seg.name}".` });
  }
  return issues;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Calibrates a generated market against the scenario's economics: fixed costs are
 * set so that the starting company breaks even after its run budget (alone against
 * the rivals, at reference prices), and missing market objectives are derived from
 * the starting position.
 */
export function calibrateMarket(scenario: Scenario): Scenario {
  if (!scenario.market) return scenario;
  const team = {
    id: 'calibration',
    metrics: { ...scenario.baselineMetrics },
    marketPresence: undefined,
    lastMarketDecision: undefined,
  } as unknown as Team;
  const probe = (market: MarketModel) => clearMarket({ ...scenario, market: { ...market, fixedCosts: 0 } }, [{ team }], 1).calibration;
  const runAllocation = calculateOpEx(scenario.topology.nodes, scenario.baselineMetrics.technicalDebtIndex, 0);

  // The business must be able to fund its run budget: when the starting margin is too small for
  // this organisation's costs, volumes and capacity grow together (prices stay as written)
  let market: MarketModel = scenario.market;
  let start = probe(market);
  const needed = runAllocation * MARGIN_OVER_RUN;
  if (start.grossMargin > 0 && start.grossMargin < needed) {
    const k = needed / start.grossMargin;
    market = {
      ...market,
      segments: market.segments.map(seg => ({ ...seg, baseDemand: Math.round(seg.baseDemand * k) })),
      unitsPerCapacityPoint: Math.round(market.unitsPerCapacityPoint * k * 100) / 100,
    };
    start = probe(market);
  }

  const fixedCosts = Math.max(0, Math.round(start.grossMargin - runAllocation));
  const conditions = { ...scenario.winLossConditions };
  if (conditions.minMarketShare === undefined) conditions.minMarketShare = Math.round(start.marketShare + 8);
  if (conditions.minCumulativeProfit === undefined) conditions.minCumulativeProfit = Math.round(scenario.baselineMetrics.budgetRemaining * 1.5);
  return { ...scenario, market: { ...market, fixedCosts }, winLossConditions: conditions };
}
