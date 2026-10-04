// ============================================================================
// GEMSIM: "WHAT IF" REPLAY
// Replays a team's game from the start with the decisions it really took, or
// with one quarter's decision changed. Everything else is kept as it happened:
// other teams' prices and capabilities in the market, injected crises, trust
// won or lost in negotiations between quarters, board mandates and promises.
// Pure module with type-only imports.
// ============================================================================

import type { MessageCode, Scenario, SimulationOutcome, SimulationSession, Team, TeamDecision, TeamMetrics } from '../types/index.js';
import { SimulationResolver } from './resolver.js';
import { evaluateOutcome } from './outcome.js';
import { checkDecisions } from './rules.js';
import { clearMarket } from './market.js';

export interface ReplayResult {
  quarters: Array<{ round: number; metrics: TeamMetrics }>;
  outcome: SimulationOutcome;
}

export interface WhatIfResult {
  baseline: ReplayResult;
  alternative?: ReplayResult;
  issues: MessageCode[];
}

/** Sessions resolved before replay data was recorded cannot be replayed. */
export function canReplay(team: Team): boolean {
  return team.history.length > 0 && team.history.every(h => h.decision && h.trustMapBefore && h.trustMapAfter);
}

function startingTeam(scenario: Scenario, team: Team): Team {
  return {
    ...team,
    metrics: { ...scenario.baselineMetrics, modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length },
    stakeholderTrustMap: Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, sh.baseTrust ?? 60])),
    history: [],
    activeInitiatives: [],
    completedInitiativeIds: [],
    nodeHealthOverrides: {},
    honoredPacts: [],
    boardMandate: undefined,
    marketPresence: undefined,
    lastMarketDecision: undefined,
    outcome: undefined,
    // Promises are judged again against the replayed decisions
    promises: (team.promises ?? []).map(p => ({ ...p, status: 'PENDING' as const })),
  };
}

function replay(
  scenario: Scenario,
  session: SimulationSession,
  original: Team,
  override?: { round: number; decision: TeamDecision }
): { result?: ReplayResult; issues: MessageCode[] } {
  let team = startingTeam(scenario, original);
  const quarters: ReplayResult['quarters'] = [];
  let previousAfter: TeamMetrics = { ...team.metrics };
  let previousTrust: Record<string, number> = { ...team.stakeholderTrustMap };

  for (const recorded of original.history) {
    const round = recorded.roundNumber;

    // What happened between quarters: injected crises and negotiations
    const before = recorded.metricsBefore;
    team = {
      ...team,
      metrics: {
        ...team.metrics,
        budgetRemaining: team.metrics.budgetRemaining + (before.budgetRemaining - previousAfter.budgetRemaining),
        technicalDebtIndex: Math.max(5, Math.min(100, team.metrics.technicalDebtIndex + (before.technicalDebtIndex - previousAfter.technicalDebtIndex))),
        deliveryVelocity: Math.max(5, Math.min(100, team.metrics.deliveryVelocity + (before.deliveryVelocity - previousAfter.deliveryVelocity))),
      },
      stakeholderTrustMap: Object.fromEntries(
        Object.entries(team.stakeholderTrustMap).map(([id, trust]) => [
          id,
          Math.max(5, Math.min(100, trust + ((recorded.trustMapBefore?.[id] ?? trust) - (previousTrust[id] ?? trust)))),
        ])
      ),
      boardMandate: recorded.mandate ? { round, verdict: recorded.mandate, consensusScore: 0 } : undefined,
    };
    const injected = session.injectedEvents?.find(e => e.roundNumber === round);
    for (const nodeId of injected?.immediateImpact.downedNodeIds ?? []) {
      team.nodeHealthOverrides = { ...team.nodeHealthOverrides, [nodeId]: { health: 15, technicalDebt: 90, status: 'CRITICAL' } };
    }

    let decision = recorded.decision!;
    if (override && override.round === round) {
      decision = { ...override.decision, customPacts: override.decision.customPacts?.length ? override.decision.customPacts : recorded.decision!.customPacts };
      const check = checkDecisions(scenario, team, decision, round, session.injectedEvents);
      if (!check.ok) return { issues: check.issues };
    }

    // The market as it was: other teams with the capabilities and prices they really had
    const entries = session.teams.map(t => {
      if (t.id === original.id) return { team, decision: decision.market };
      const theirs = t.history.find(h => h.roundNumber === round);
      return {
        team: { ...t, metrics: theirs?.metricsBefore ?? t.metrics, marketPresence: theirs?.marketPresenceBefore, lastMarketDecision: undefined } as Team,
        decision: theirs?.decision?.market,
      };
    });
    const market = clearMarket(scenario, entries, round, session.id);

    team = SimulationResolver.resolveRound(scenario, { ...team, currentRoundDecisions: decision }, round, session.injectedEvents, market[team.id]).updatedTeam;
    quarters.push({ round, metrics: { ...team.metrics } });
    previousAfter = recorded.metricsAfter;
    previousTrust = recorded.trustMapAfter ?? previousTrust;
  }

  return { result: { quarters, outcome: evaluateOutcome(scenario, team.metrics, session.teams.length) }, issues: [] };
}

export function whatIf(
  scenario: Scenario,
  session: SimulationSession,
  teamId: string,
  override?: { round: number; decision: TeamDecision }
): WhatIfResult {
  const team = session.teams.find(t => t.id === teamId);
  if (!team) return { baseline: { quarters: [], outcome: evaluateOutcome(scenario, scenario.baselineMetrics) }, issues: [{ code: 'whatif.noTeam' }] };
  if (!canReplay(team)) {
    return { baseline: { quarters: [], outcome: evaluateOutcome(scenario, team.metrics, session.teams.length) }, issues: [{ code: 'whatif.unavailable' }] };
  }
  const baseline = replay(scenario, session, team).result!;
  if (!override) return { baseline, issues: [] };
  if (!team.history.some(h => h.roundNumber === override.round)) return { baseline, issues: [{ code: 'whatif.badRound' }] };
  const alt = replay(scenario, session, team, override);
  return { baseline, alternative: alt.result, issues: alt.issues };
}
