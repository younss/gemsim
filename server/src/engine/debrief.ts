// ============================================================================
// GEMSIM: AUTOMATIC DEBRIEF
// From the session's real decisions and results: each team's score trajectory,
// its decisive quarters (biggest score swings, with their causes), the patterns
// worth discussing, cross-team comparisons and the questions to ask.
// Pure module with type-only imports (shared with the client).
// ============================================================================

import type { MessageCode, OutcomeObjective, Scenario, SimulationSession, Team } from '../types/index.js';
import { evaluateOutcome } from './outcome.js';
import { coachQuarter, priceIndex } from './coach.js';
import { getRoundEvent } from './rules.js';

export type DebriefPattern =
  | 'PRICE_WAR'
  | 'SHORTCUTS'
  | 'INSOLVENCY'
  | 'LOST_SALES'
  | 'IGNORED_CRISIS'
  | 'BROKEN_PROMISES'
  | 'LATE_START'
  | 'STRONG_FINISH'
  | 'EARNED_SHARE';

export interface DebriefMoment {
  round: number;
  scoreDelta: number;
  decision: MessageCode[]; // what the team chose that quarter
  causes: MessageCode[]; // top coach insights for the quarter
}

export interface TeamDebrief {
  teamId: string;
  teamName: string;
  scores: number[]; // projected score after each quarter
  moments: DebriefMoment[];
  patterns: DebriefPattern[];
}

export interface SessionDebrief {
  teams: TeamDebrief[];
  leaders: Array<{ key: OutcomeObjective['key']; teamName: string; value: number }>;
  questions: MessageCode[];
}

const MOMENTS_PER_TEAM = 3;
const MAX_QUESTIONS = 6;

function describeDecision(scenario: Scenario, team: Team, round: number): MessageCode[] {
  const result = team.history.find(h => h.roundNumber === round);
  const d = result?.decision;
  if (!d) return [];
  const out: MessageCode[] = [{ code: 'debrief.decision.posture', params: { posture: d.governancePosture } }];
  const names = d.selectedInitiativeIds.map(id => scenario.initiativesCatalog.find(i => i.id === id)?.name ?? id);
  out.push(names.length ? { code: 'debrief.decision.initiatives', params: { list: names.join(', ') } } : { code: 'debrief.decision.noInitiative' });
  const index = result ? priceIndex(scenario, result) : undefined;
  if (index !== undefined) out.push({ code: 'debrief.decision.price', params: { index: Math.round(index * 100) } });
  if (d.market?.enter?.length) {
    const segs = d.market.enter.map(id => scenario.market?.segments.find(s => s.id === id)?.name ?? id);
    out.push({ code: 'debrief.decision.enter', params: { list: segs.join(', ') } });
  }
  return out;
}

function patternsOf(scenario: Scenario, session: SimulationSession, team: Team, scores: number[]): DebriefPattern[] {
  const patterns: DebriefPattern[] = [];
  const h = team.history;
  const prices = h.map(r => priceIndex(scenario, r)).filter((x): x is number => x !== undefined);
  const profit = h.reduce((sum, r) => sum + (r.market?.operatingProfit ?? 0), 0);
  if (prices.length && prices.reduce((a, b) => a + b, 0) / prices.length < 0.93 && profit < 0) patterns.push('PRICE_WAR');
  if (h.filter(r => r.decision?.governancePosture === 'BYPASS_ARCH').length >= 2) patterns.push('SHORTCUTS');
  if (h.some(r => r.metricsAfter.budgetRemaining < 0)) patterns.push('INSOLVENCY');
  const sold = h.reduce((sum, r) => sum + (r.market?.unitsSold ?? 0), 0);
  const lost = h.reduce((sum, r) => sum + (r.market?.lostSales ?? 0), 0);
  if (sold > 0 && lost / sold > 0.1) patterns.push('LOST_SALES');
  if (h.some(r => r.decision && !r.decision.eventChoiceId && getRoundEvent(scenario, r.roundNumber, session.injectedEvents)?.choices.length)) {
    patterns.push('IGNORED_CRISIS');
  }
  if (h.some(r => r.promises?.some(p => p.status === 'BROKEN'))) patterns.push('BROKEN_PROMISES');
  if (h[0]?.decision && h[0].decision.selectedInitiativeIds.length === 0) patterns.push('LATE_START');
  if (scores.length >= 3 && scores[scores.length - 1] - scores[scores.length - 3] >= 10) patterns.push('STRONG_FINISH');
  if (scenario.market && profit > 0 && !patterns.includes('PRICE_WAR')) {
    const last = h[h.length - 1]?.market?.marketShare ?? 0;
    const first = h[0]?.market?.marketShare ?? 0;
    if (last > first) patterns.push('EARNED_SHARE');
  }
  return patterns;
}

const QUESTION_FOR: Record<DebriefPattern, string> = {
  PRICE_WAR: 'debrief.q.priceWar',
  SHORTCUTS: 'debrief.q.shortcuts',
  INSOLVENCY: 'debrief.q.insolvency',
  LOST_SALES: 'debrief.q.lostSales',
  IGNORED_CRISIS: 'debrief.q.ignoredCrisis',
  BROKEN_PROMISES: 'debrief.q.brokenPromises',
  LATE_START: 'debrief.q.lateStart',
  STRONG_FINISH: 'debrief.q.strongFinish',
  EARNED_SHARE: 'debrief.q.earnedShare',
};

export function buildDebrief(scenario: Scenario, session: SimulationSession): SessionDebrief {
  const n = session.teams.length;
  const teams: TeamDebrief[] = session.teams.map(team => {
    const start = evaluateOutcome(scenario, team.history[0]?.metricsBefore ?? team.metrics, n).score;
    const scores = team.history.map(r => evaluateOutcome(scenario, r.metricsAfter, n).score);
    const deltas = scores.map((s, i) => ({ round: team.history[i].roundNumber, delta: s - (i === 0 ? start : scores[i - 1]) }));
    const moments = [...deltas]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, MOMENTS_PER_TEAM)
      .sort((a, b) => a.round - b.round)
      .map(({ round, delta }) => ({
        round,
        scoreDelta: delta,
        decision: describeDecision(scenario, team, round),
        causes: coachQuarter(scenario, team, round, session)?.insights.slice(0, 2) ?? [],
      }));
    return { teamId: team.id, teamName: team.name, scores, moments, patterns: patternsOf(scenario, session, team, scores) };
  });

  // Who leads on each objective at the end
  const outcomes = session.teams.map(t => ({ team: t, outcome: t.outcome ?? evaluateOutcome(scenario, t.metrics, n) }));
  const leaders: SessionDebrief['leaders'] = [];
  for (const objective of outcomes[0]?.outcome.objectives ?? []) {
    const ranked = outcomes
      .map(o => ({ name: o.team.name, value: o.outcome.objectives.find(x => x.key === objective.key)?.actual ?? 0 }))
      .sort((a, b) => (objective.comparator === '<=' ? a.value - b.value : b.value - a.value));
    if (ranked[0]) leaders.push({ key: objective.key, teamName: ranked[0].name, value: ranked[0].value });
  }

  // Questions: one per pattern, naming the teams concerned
  const byPattern = new Map<DebriefPattern, string[]>();
  for (const t of teams) for (const p of t.patterns) byPattern.set(p, [...(byPattern.get(p) ?? []), t.teamName]);
  const questions: MessageCode[] = [...byPattern.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_QUESTIONS)
    .map(([pattern, names]) => ({ code: QUESTION_FOR[pattern], params: { teams: names.join(', ') } }));
  if (questions.length < 2) questions.push({ code: 'debrief.q.general' });

  return { teams, leaders, questions };
}
