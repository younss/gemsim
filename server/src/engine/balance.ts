// ============================================================================
// GEMSIM: SCENARIO BALANCE & PLAYABILITY CHECK
// Plays three scripted strategies through the real resolver and reports the
// outcome each one reaches. A playable scenario rewards modernization and
// punishes bypassing architecture.
// ============================================================================

import type { MarketDecision, RoundResult, Scenario, SimulationOutcome, Team, TeamDecision } from '../types/index.js';
import { SimulationResolver } from './resolver.js';
import { evaluateOutcome } from './outcome.js';
import { checkDecisions, getRoundEvent, lockedInitiativeIds } from './rules.js';
import { clearMarket, teamPresence } from './market.js';

export type BotStrategy = 'ARCHITECT' | 'PRUDENT' | 'COWBOY';

export interface BalanceReport {
  playable: boolean;
  issues: string[];
  results: Record<BotStrategy, SimulationOutcome>;
  bestAchievable: SimulationOutcome; // beam search over quarter decisions
  tournament?: Record<BotStrategy, SimulationOutcome>; // the three bots in one shared market
}

type MarketStyle = { priceIndex: number; marketingShare: number; enter: boolean };

// How each bot sells: the architect prices at the reference and invests in its brand,
// the prudent bot charges a premium without marketing, the cowboy buys share.
const BOT_MARKET: Record<BotStrategy, MarketStyle> = {
  ARCHITECT: { priceIndex: 1, marketingShare: 0.02, enter: true },
  PRUDENT: { priceIndex: 1.08, marketingShare: 0, enter: false },
  COWBOY: { priceIndex: 0.85, marketingShare: 0.05, enter: true },
};

function marketDecision(scenario: Scenario, team: Team, style: MarketStyle): MarketDecision | undefined {
  const market = scenario.market;
  if (!market) return undefined;
  const presence = teamPresence(scenario, team);
  const enter = style.enter ? market.segments.filter(s => !presence.includes(s.id)).map(s => s.id) : [];
  const prices: Record<string, number> = {};
  const marketing: Record<string, number> = {};
  for (const seg of market.segments) {
    prices[seg.id] = Math.round(seg.referencePrice * style.priceIndex * 100) / 100;
    const open = presence.includes(seg.id) || enter.includes(seg.id);
    marketing[seg.id] = open ? Math.round(seg.baseDemand * seg.referencePrice * style.marketingShare) : 0;
  }
  return { prices, marketing, enter };
}

/** Adds the market decision, dropping segment entries then marketing while the budget does not allow them. */
function withMarket(scenario: Scenario, team: Team, decision: TeamDecision, round: number, style: MarketStyle): TeamDecision {
  const market = marketDecision(scenario, team, style);
  if (!market) return decision;
  const attempts: MarketDecision[] = [
    market,
    { ...market, enter: [] , marketing: Object.fromEntries(Object.entries(market.marketing).map(([k, v]) => [k, (market.enter ?? []).includes(k) ? 0 : v])) },
    { ...market, enter: [], marketing: {} },
  ];
  for (const m of attempts) {
    const attempt = { ...decision, market: m };
    if (checkDecisions(scenario, team, attempt, round).ok) return attempt;
  }
  return { ...decision, market: { prices: market.prices, marketing: {}, enter: [] } };
}

/** Resolves one quarter for a team alone in the market (against the scripted rivals). */
function resolveSolo(scenario: Scenario, team: Team, decision: TeamDecision, round: number) {
  const market = clearMarket(scenario, [{ team, decision: decision.market }], round, team.sessionId);
  return SimulationResolver.resolveRound(scenario, { ...team, currentRoundDecisions: decision }, round, undefined, market[team.id]);
}

function botDecision(strategy: BotStrategy, scenario: Scenario, team: Team, round: number): TeamDecision {
  const locked = lockedInitiativeIds(team);
  const available = scenario.initiativesCatalog.filter(i => !locked.has(i.id) && (!i.unlockedRound || i.unlockedRound <= round));
  const event = getRoundEvent(scenario, round);

  let picks = available;
  let governancePosture: TeamDecision['governancePosture'];
  let eventChoiceId: string | undefined;

  if (strategy === 'COWBOY') {
    picks = [...available].sort((a, b) => b.velocityDelta - a.velocityDelta);
    governancePosture = 'BYPASS_ARCH';
  } else if (strategy === 'ARCHITECT') {
    picks = available.filter(i => i.tdiDelta < 0).sort((a, b) => a.tdiDelta - a.resilienceDelta / 2 - (b.tdiDelta - b.resilienceDelta / 2));
    governancePosture = 'ACCELERATED_MODERN';
    eventChoiceId = event?.choices.length ? [...event.choices].sort((a, b) => a.tdiImpact - b.tdiImpact)[0].id : undefined;
  } else {
    picks = available.filter(i => i.tdiDelta < 0).sort((a, b) => a.capExCost - b.capExCost).slice(0, 1);
    governancePosture = 'STRICT_GOVERNANCE';
    eventChoiceId = event?.choices.length ? [...event.choices].sort((a, b) => a.capExImpact - b.capExImpact)[0].id : undefined;
  }

  // Greedily keep picks while the decision stays within the rules
  const decision: TeamDecision = { selectedInitiativeIds: [], governancePosture, eventChoiceId, customPacts: [] };
  if (!checkDecisions(scenario, team, decision, round).ok) decision.eventChoiceId = undefined;
  for (const init of picks) {
    const attempt = { ...decision, selectedInitiativeIds: [...decision.selectedInitiativeIds, init.id] };
    if (checkDecisions(scenario, team, attempt, round).ok) decision.selectedInitiativeIds = attempt.selectedInitiativeIds;
  }
  return withMarket(scenario, team, decision, round, BOT_MARKET[strategy]);
}

function initialTeam(scenario: Scenario, id: string): Team {
  return {
    id,
    sessionId: `balance-${scenario.id}`,
    name: id,
    color: '#fff',
    avatar: '🤖',
    metrics: {
      ...scenario.baselineMetrics,
      modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length,
    },
    stakeholderTrustMap: Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, sh.baseTrust ?? 60])),
    currentRoundDecisions: { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [] },
    decisionSubmitted: false,
    history: [],
    activeInitiatives: [],
    completedInitiativeIds: [],
    nodeHealthOverrides: {},
  };
}

/** Every legal decision for the quarter (initiative subsets within capacity × postures × crisis responses). */
function legalDecisions(scenario: Scenario, team: Team, round: number): TeamDecision[] {
  const locked = lockedInitiativeIds(team);
  const ids = scenario.initiativesCatalog
    .filter(i => !locked.has(i.id) && (!i.unlockedRound || i.unlockedRound <= round))
    .map(i => i.id);
  const capacity = scenario.maxInitiativesPerRound ?? 2;
  const subsets: string[][] = [[]];
  for (const id of ids) {
    for (const subset of [...subsets]) if (subset.length < capacity) subsets.push([...subset, id]);
  }
  const event = getRoundEvent(scenario, round);
  // Not answering the crisis is always a legal move (and the only one when cash runs out)
  const choices: Array<string | undefined> = event?.choices.length ? [...event.choices.map(c => c.id), undefined] : [undefined];
  const postures: TeamDecision['governancePosture'][] = ['BYPASS_ARCH', 'BALANCED_AGILE', 'STRICT_GOVERNANCE', 'ACCELERATED_MODERN'];

  // Market variants: the bots' three selling styles
  const styles: Array<MarketStyle | undefined> = scenario.market ? Object.values(BOT_MARKET) : [undefined];

  const out: TeamDecision[] = [];
  for (const selectedInitiativeIds of subsets) {
    for (const governancePosture of postures) {
      for (const eventChoiceId of choices) {
        const base: TeamDecision = { selectedInitiativeIds, governancePosture, eventChoiceId, customPacts: [] };
        if (!checkDecisions(scenario, team, base, round).ok) continue;
        for (const style of styles) out.push(style ? withMarket(scenario, team, base, round, style) : base);
      }
    }
  }
  return out;
}

/** Beam search over quarter decisions: the best outcome a well-informed player can reach. */
export function searchBestOutcome(scenario: Scenario, beamWidth = 40): SimulationOutcome {
  return evaluateOutcome(scenario, searchBestTeam(scenario, beamWidth).metrics);
}

/** The team at the end of the best path found; its history holds every quarter's decision. */
export function searchBestTeam(scenario: Scenario, beamWidth = 40): Team {
  let beam: Team[] = [initialTeam(scenario, 'search')];
  const rounds = scenario.totalRounds || 4;
  for (let round = 1; round <= rounds; round++) {
    const next: Array<{ team: Team; score: number }> = [];
    for (const team of beam) {
      for (const decision of legalDecisions(scenario, team, round)) {
        const resolved = resolveSolo(scenario, team, decision, round).updatedTeam;
        next.push({ team: resolved, score: evaluateOutcome(scenario, resolved.metrics).score });
      }
    }
    if (!next.length) break; // no legal move left: keep the best teams reached so far
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, beamWidth).map(n => n.team);
  }
  return beam[0];
}

export interface StrategyReplay {
  strategy: BotStrategy;
  quarters: Array<{ round: number; decision: TeamDecision; before: Team['metrics']; result: RoundResult }>;
  finalTeam: Team;
  outcome: SimulationOutcome;
}

/** Plays a bot strategy and keeps every quarter's decision and result (used by the commented demo). */
export function replayStrategy(scenario: Scenario, strategy: BotStrategy): StrategyReplay {
  let team = initialTeam(scenario, `demo-${strategy}`);
  const quarters: StrategyReplay['quarters'] = [];
  for (let round = 1; round <= (scenario.totalRounds || 4); round++) {
    const decision = botDecision(strategy, scenario, team, round);
    const before = { ...team.metrics };
    const { updatedTeam, roundResult } = resolveSolo(scenario, team, decision, round);
    quarters.push({ round, decision, before, result: roundResult });
    team = updatedTeam;
  }
  return { strategy, quarters, finalTeam: team, outcome: evaluateOutcome(scenario, team.metrics) };
}

export function simulateStrategy(scenario: Scenario, strategy: BotStrategy): SimulationOutcome {
  let team: Team = {
    id: `bot-${strategy}`,
    sessionId: `balance-${scenario.id}`,
    name: strategy,
    color: '#fff',
    avatar: '🤖',
    metrics: {
      ...scenario.baselineMetrics,
      modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length,
    },
    stakeholderTrustMap: Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, sh.baseTrust ?? 60])),
    currentRoundDecisions: { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [] },
    decisionSubmitted: false,
    history: [],
    activeInitiatives: [],
    completedInitiativeIds: [],
    nodeHealthOverrides: {},
  };

  for (let round = 1; round <= (scenario.totalRounds || 4); round++) {
    team = resolveSolo(scenario, team, botDecision(strategy, scenario, team, round), round).updatedTeam;
  }
  return evaluateOutcome(scenario, team.metrics);
}

/** The three bots compete in one shared market, as three teams of a session would. */
export function playTournament(scenario: Scenario): Record<BotStrategy, SimulationOutcome> {
  const strategies: BotStrategy[] = ['ARCHITECT', 'PRUDENT', 'COWBOY'];
  let teams = strategies.map(s => ({ ...initialTeam(scenario, `t-${s}`), sessionId: `tournament-${scenario.id}` }));
  for (let round = 1; round <= (scenario.totalRounds || 4); round++) {
    const decided = teams.map((team, i) => ({ ...team, currentRoundDecisions: botDecision(strategies[i], scenario, team, round) }));
    const market = clearMarket(scenario, decided.map(team => ({ team, decision: team.currentRoundDecisions.market })), round, `tournament-${scenario.id}`);
    teams = decided.map(team => SimulationResolver.resolveRound(scenario, team, round, undefined, market[team.id]).updatedTeam);
  }
  return Object.fromEntries(strategies.map((s, i) => [s, evaluateOutcome(scenario, teams[i].metrics, teams.length)])) as Record<BotStrategy, SimulationOutcome>;
}

export function checkScenarioBalance(scenario: Scenario): BalanceReport {
  const results = {
    ARCHITECT: simulateStrategy(scenario, 'ARCHITECT'),
    PRUDENT: simulateStrategy(scenario, 'PRUDENT'),
    COWBOY: simulateStrategy(scenario, 'COWBOY'),
  };

  const bestAchievable = searchBestOutcome(scenario);

  const issues: string[] = [];
  if (bestAchievable.verdict !== 'VICTORY') {
    issues.push(
      `Not winnable: the best decision path found reaches ${bestAchievable.verdict} (missed: ${bestAchievable.objectives
        .filter(o => !o.met)
        .map(o => o.label)
        .join(', ')}).`
    );
  }
  if (results.COWBOY.verdict !== 'DEFEAT') {
    issues.push('Bypassing architecture does not lose: debt, compliance or budget penalties are too weak.');
  }
  if (results.COWBOY.score >= results.ARCHITECT.score) {
    issues.push('The bypass strategy scores at least as well as modernization.');
  }
  if (!scenario.initiativesCatalog.some(i => i.tdiDelta < 0)) {
    issues.push('No debt-reducing initiative in the catalog.');
  }

  let tournament: BalanceReport['tournament'];
  if (scenario.market) {
    tournament = playTournament(scenario);
    if (tournament.COWBOY.score >= tournament.ARCHITECT.score) {
      issues.push('In a shared market, buying share with low prices beats the balanced strategy.');
    }
  }

  return { playable: issues.length === 0, issues, results, bestAchievable, tournament };
}
