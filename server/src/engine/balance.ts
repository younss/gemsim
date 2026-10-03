// ============================================================================
// GEMSIM: SCENARIO BALANCE & PLAYABILITY CHECK
// Plays three scripted strategies through the real resolver and reports the
// outcome each one reaches. A playable scenario rewards modernization and
// punishes bypassing architecture.
// ============================================================================

import { Scenario, SimulationOutcome, Team, TeamDecision } from '../types/index.js';
import { SimulationResolver } from './resolver.js';
import { evaluateOutcome } from './outcome.js';
import { checkDecisions, getRoundEvent, lockedInitiativeIds } from './rules.js';

export type BotStrategy = 'ARCHITECT' | 'PRUDENT' | 'COWBOY';

export interface BalanceReport {
  playable: boolean;
  issues: string[];
  results: Record<BotStrategy, SimulationOutcome>;
  bestAchievable: SimulationOutcome; // beam search over quarter decisions
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
  return decision;
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
  const choices: Array<string | undefined> = event?.choices.length ? event.choices.map(c => c.id) : [undefined];
  const postures: TeamDecision['governancePosture'][] = ['BYPASS_ARCH', 'BALANCED_AGILE', 'STRICT_GOVERNANCE', 'ACCELERATED_MODERN'];

  const out: TeamDecision[] = [];
  for (const selectedInitiativeIds of subsets) {
    for (const governancePosture of postures) {
      for (const eventChoiceId of choices) {
        const d: TeamDecision = { selectedInitiativeIds, governancePosture, eventChoiceId, customPacts: [] };
        if (checkDecisions(scenario, team, d, round).ok) out.push(d);
      }
    }
  }
  return out;
}

/** Beam search over quarter decisions: the best outcome a well-informed player can reach. */
export function searchBestOutcome(scenario: Scenario, beamWidth = 40): SimulationOutcome {
  let beam: Team[] = [initialTeam(scenario, 'search')];
  const rounds = scenario.totalRounds || 4;
  for (let round = 1; round <= rounds; round++) {
    const next: Array<{ team: Team; score: number }> = [];
    for (const team of beam) {
      for (const decision of legalDecisions(scenario, team, round)) {
        const resolved = SimulationResolver.resolveRound(scenario, { ...team, currentRoundDecisions: decision }, round).updatedTeam;
        next.push({ team: resolved, score: evaluateOutcome(scenario, resolved.metrics).score });
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, beamWidth).map(n => n.team);
  }
  return evaluateOutcome(scenario, beam[0].metrics);
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
    team = { ...team, currentRoundDecisions: botDecision(strategy, scenario, team, round) };
    team = SimulationResolver.resolveRound(scenario, team, round).updatedTeam;
  }
  return evaluateOutcome(scenario, team.metrics);
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

  return { playable: issues.length === 0, issues, results, bestAchievable };
}
