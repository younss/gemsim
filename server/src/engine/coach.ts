// ============================================================================
// GEMSIM: QUARTER COACH
// Explains a team's quarter from the engine's own breakdown: which mechanisms
// moved debt, capacity, cash, trust and the market, ranked by impact, plus a
// few concrete next steps. Pure module with type-only imports (shared with the
// client); output is translatable message codes, an LLM may only rephrase it.
// ============================================================================

import type { MarketSegmentResult, MessageCode, RoundResult, Scenario, SimulationSession, Team } from '../types/index.js';
import { lockedInitiativeIds } from './rules.js';

export interface CoachReport {
  round: number;
  insights: MessageCode[]; // ranked, most important first
  advice: MessageCode[]; // only for the latest quarter
}

type Weighted = MessageCode & { weight: number };

const MAX_INSIGHTS = 5;
const MAX_ADVICE = 3;

/** Demand-weighted price index of a quarter (1 = reference price). */
export function priceIndex(scenario: Scenario, result: Pick<RoundResult, 'market'>): number | undefined {
  const segments = result.market?.segments ?? [];
  const weight = segments.reduce((sum, s) => sum + s.unitsSold, 0);
  if (!segments.length || weight === 0) return undefined;
  const ref = (s: MarketSegmentResult) => scenario.market?.segments.find(x => x.id === s.segmentId)?.referencePrice ?? s.price;
  return segments.reduce((sum, s) => sum + (s.price / ref(s)) * s.unitsSold, 0) / weight;
}

/** Demand-weighted average of each customer-choice driver. */
function averageDrivers(result: Pick<RoundResult, 'market'>): MarketSegmentResult['drivers'] | undefined {
  const segments = result.market?.segments ?? [];
  const weight = segments.reduce((sum, s) => sum + s.demand, 0);
  if (!segments.length || weight === 0) return undefined;
  const avg = (k: keyof MarketSegmentResult['drivers']) => segments.reduce((sum, s) => sum + s.drivers[k] * s.demand, 0) / weight;
  return { price: avg('price'), quality: avg('quality'), availability: avg('availability'), reliability: avg('reliability'), marketing: avg('marketing') };
}

/** The component that moved a total the most in its direction. */
function mainCause(components: Record<string, number>, direction: number): [string, number] | undefined {
  const entries = Object.entries(components).filter(([, v]) => Math.sign(v) === Math.sign(direction) && v !== 0);
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return entries[0];
}

export function coachQuarter(scenario: Scenario, team: Team, round: number, session?: SimulationSession): CoachReport | undefined {
  const result = team.history.find(h => h.roundNumber === round);
  if (!result) return undefined;
  const previous = team.history.find(h => h.roundNumber === round - 1);
  const insights: Weighted[] = [];
  const md = result.metricDeltas;
  const b = result.breakdown;

  // Debt
  if (md.technicalDebtIndex !== 0) {
    const cause = b ? mainCause(b.debt, md.technicalDebtIndex) : undefined;
    insights.push({
      code: md.technicalDebtIndex > 0 ? 'coach.debt.up' : 'coach.debt.down',
      params: { delta: Math.abs(md.technicalDebtIndex), cause: cause ? `coach.cause.debt.${cause[0]}` : 'coach.cause.mixed', amount: cause ? Math.abs(cause[1]) : 0 },
      weight: Math.abs(md.technicalDebtIndex) * 2,
    });
  }

  // Delivery capacity: compare the breakdown with last quarter's when there is one
  if (md.deliveryVelocity !== 0 && b) {
    const components = previous?.breakdown
      ? (Object.fromEntries(Object.entries(b.velocity).map(([k, v]) => [k, v - previous.breakdown!.velocity[k as keyof typeof b.velocity]])) as Record<string, number>)
      : (b.velocity as unknown as Record<string, number>);
    const cause = mainCause(components, md.deliveryVelocity);
    insights.push({
      code: md.deliveryVelocity > 0 ? 'coach.velocity.up' : 'coach.velocity.down',
      params: { delta: Math.abs(md.deliveryVelocity), cause: cause ? `coach.cause.velocity.${cause[0]}` : 'coach.cause.mixed', amount: cause ? Math.abs(Math.round(cause[1])) : 0 },
      weight: Math.abs(md.deliveryVelocity),
    });
  }

  // Cash
  if (b) {
    const drain = mainCause(b.cash, -1);
    if (drain && Math.abs(drain[1]) >= 50) {
      insights.push({ code: 'coach.cash.drain', params: { amount: Math.abs(drain[1]), cause: `coach.cause.cash.${drain[0]}` }, weight: Math.abs(drain[1]) / 25 });
    }
    if (b.cash.market >= 100) insights.push({ code: 'coach.cash.market', params: { amount: b.cash.market }, weight: b.cash.market / 30 });
  }

  // Incidents
  if (result.incidentsTriggered.length) {
    const cost = result.incidentsTriggered.reduce((sum, i) => sum + i.costImpact, 0);
    insights.push({
      code: 'coach.incidents',
      params: { count: result.incidentsTriggered.length, cost, node: result.incidentsTriggered[0].nodeName ?? result.incidentsTriggered[0].title },
      weight: cost / 20,
    });
  }

  // Executives
  const reactions = [...result.stakeholderReactions].sort((x, y) => x.trustDelta - y.trustDelta);
  const worst = reactions[0];
  const best = reactions[reactions.length - 1];
  if (worst && worst.trustDelta <= -5) insights.push({ code: 'coach.trust.down', params: { name: worst.name, delta: -worst.trustDelta }, weight: -worst.trustDelta });
  if (best && best.trustDelta >= 8) insights.push({ code: 'coach.trust.up', params: { name: best.name, delta: best.trustDelta }, weight: best.trustDelta / 2 });

  // Promises
  const broken = result.promises?.filter(p => p.status === 'BROKEN').length ?? 0;
  if (broken) insights.push({ code: 'coach.promises.broken', params: { count: broken }, weight: 12 });

  // Market
  const market = result.market;
  if (market) {
    const index = priceIndex(scenario, result);
    if (previous?.market) {
      const shareDelta = Math.round((market.marketShare - previous.market.marketShare) * 10) / 10;
      const now = averageDrivers(result);
      const before = averageDrivers(previous);
      if (now && before && Math.abs(shareDelta) >= 1) {
        const changes = Object.fromEntries(Object.keys(now).map(k => [k, now[k as keyof typeof now] - before[k as keyof typeof now]]));
        const cause = mainCause(changes, shareDelta);
        insights.push({
          code: shareDelta > 0 ? 'coach.market.shareUp' : 'coach.market.shareDown',
          params: { delta: Math.abs(shareDelta), driver: cause ? `market.criteria.${cause[0]}` : 'coach.cause.competition' },
          weight: Math.abs(shareDelta) * 1.5,
        });
      }
    }
    if (market.lostSales > 0) {
      insights.push({ code: 'coach.market.lost', params: { units: market.lostSales }, weight: (market.lostSales / Math.max(1, market.capacityUnits)) * 30 });
    }
    if (market.operatingProfit < 0) {
      const reason = index !== undefined && index < 0.95 ? 'coach.cause.market.price' : market.marketing > market.revenue * 0.05 ? 'coach.cause.market.marketing' : 'coach.cause.market.volume';
      insights.push({ code: 'coach.market.loss', params: { profit: -market.operatingProfit, cause: reason }, weight: -market.operatingProfit / 40 });
    }
    // Competitors cutting prices (their decisions are public once the quarter is resolved)
    const cutters = (session?.teams ?? [])
      .filter(o => o.id !== team.id)
      .filter(o => {
        const theirs = o.history.find(h => h.roundNumber === round);
        const i = theirs ? priceIndex(scenario, theirs) : undefined;
        return i !== undefined && i < 0.92;
      })
      .map(o => o.name);
    if (cutters.length) insights.push({ code: 'coach.market.priceWar', params: { teams: cutters.join(', ') }, weight: 8 });
  }

  insights.sort((x, y) => y.weight - x.weight);

  // Next steps, from the state the team is in now (latest quarter only)
  const advice: MessageCode[] = [];
  const isLatest = team.history[team.history.length - 1]?.roundNumber === round;
  if (isLatest) {
    const m = result.metricsAfter;
    const locked = lockedInitiativeIds(team);
    const available = scenario.initiativesCatalog.filter(i => !locked.has(i.id) && i.riskLevel !== 'EXTREME');
    const bestDebt = [...available].sort((x, y) => x.tdiDelta - y.tdiDelta)[0];
    const bestCapacity = [...available].sort((x, y) => y.velocityDelta - x.velocityDelta)[0];
    const lowest = Object.entries(team.stakeholderTrustMap).sort((x, y) => x[1] - y[1])[0];

    if (m.technicalDebtIndex >= 65 && bestDebt && bestDebt.tdiDelta < 0) advice.push({ code: 'coach.advice.debt', params: { initiative: bestDebt.name } });
    if (broken) advice.push({ code: 'coach.advice.promises' });
    if (market && market.lostSales > 0 && bestCapacity) advice.push({ code: 'coach.advice.capacity', params: { initiative: bestCapacity.name } });
    if (market && market.operatingProfit < 0 && (priceIndex(scenario, result) ?? 1) < 0.95) advice.push({ code: 'coach.advice.price' });
    if (m.complianceScore < 55) advice.push({ code: 'coach.advice.compliance' });
    if (m.resilienceIndex < 50 && result.incidentsTriggered.length) advice.push({ code: 'coach.advice.resilience' });
    if (m.budgetRemaining < 300) advice.push({ code: 'coach.advice.cash' });
    if (lowest && lowest[1] < 45) {
      const name = scenario.stakeholders.find(s => s.id === lowest[0])?.name ?? lowest[0];
      advice.push({ code: 'coach.advice.trust', params: { name } });
    }
  }

  return {
    round,
    insights: insights.slice(0, MAX_INSIGHTS).map(({ weight: _w, ...code }) => code),
    advice: advice.slice(0, MAX_ADVICE),
  };
}
