// ============================================================================
// GEMSIM: SESSION ROUND ADVANCEMENT
// Single code path for resolving a quarter, whichever channel triggers it
// (REST, WebSocket facilitator control or BullMQ worker).
// ============================================================================

import { RoundResult, Scenario, SimulationSession } from '../types/index.js';
import { SimulationResolver } from './resolver.js';
import { evaluateOutcome } from './outcome.js';
import { clearMarket } from './market.js';

// Patience recovered by every stakeholder at the start of a new quarter
const QUARTERLY_PATIENCE_RECOVERY = 50;

export function advanceSession(
  session: SimulationSession,
  scenario: Scenario
): { session: SimulationSession; results: Record<string, RoundResult> } {
  if (session.state === 'COMPLETED') {
    throw new Error('Simulation already completed');
  }

  const results: Record<string, RoundResult> = {};
  // The only coupling between teams: they sell into the same market
  const market = clearMarket(
    scenario,
    session.teams.map(team => ({ team, decision: team.currentRoundDecisions?.market })),
    session.currentRound,
    session.id
  );
  session.teams = session.teams.map(team => {
    const { updatedTeam, roundResult } = SimulationResolver.resolveRound(
      scenario,
      team,
      session.currentRound,
      session.injectedEvents,
      market[team.id]
    );
    results[team.id] = roundResult;

    const patience: Record<string, number> = {};
    for (const sh of scenario.stakeholders) {
      patience[sh.id] = Math.min(100, (updatedTeam.stakeholderPatience?.[sh.id] ?? 100) + QUARTERLY_PATIENCE_RECOVERY);
    }
    updatedTeam.stakeholderPatience = patience;
    return updatedTeam;
  });

  session.activeCrisis = null;

  if (session.currentRound >= session.totalRounds) {
    session.state = 'COMPLETED';
    session.isTimerRunning = false;
    for (const team of session.teams) {
      team.outcome = evaluateOutcome(scenario, team.metrics, session.teams.length);
    }
  } else {
    session.currentRound += 1;
    session.timerSecondsRemaining = session.roundDurationSeconds;
    session.state = 'ACTIVE';
  }

  session.updatedAt = new Date().toISOString();
  return { session, results };
}
