// ============================================================================
// GEMSIM: WIN / LOSS EVALUATION
// Scores a team against the scenario's winLossConditions. Pure function with
// type-only imports so the client can reuse it for live objective tracking.
// ============================================================================

import type { OutcomeObjective, Scenario, SimulationOutcome, TeamMetrics } from '../types/index.js';
import { marketShareTarget } from './market.js';

function attainment(comparator: '<=' | '>=', target: number, actual: number, span: number): number {
  const gap = comparator === '<=' ? actual - target : target - actual;
  if (gap <= 0) return 1;
  return Math.max(0, 1 - gap / span);
}

/**
 * `teamsInMarket` is the number of teams competing in the session's market: the
 * market-share target is scaled to it (see marketShareTarget).
 */
export function evaluateOutcome(
  scenario: Pick<Scenario, 'winLossConditions' | 'baselineMetrics'> & Partial<Pick<Scenario, 'market'>>,
  metrics: TeamMetrics,
  teamsInMarket = 1
): SimulationOutcome {
  const base = scenario.baselineMetrics;
  // Generated scenarios may omit conditions: fall back to reasonable targets
  const w: Scenario['winLossConditions'] = {
    maxTechnicalDebtIndex: 45,
    minStakeholderTrustAvg: 60,
    minDeliveryVelocity: 60,
    minResilienceIndex: 70,
    maxTCOBudget: base.tco + base.budgetRemaining * 1.5,
    targetCapabilitiesModernized: base.modernizedNodesCount + 2,
    ...(scenario.winLossConditions as Partial<Scenario['winLossConditions']>),
  };

  const defs: Array<Omit<OutcomeObjective, 'met' | 'attainment'> & { span: number }> = [
    { key: 'technicalDebtIndex', label: 'Technical Debt Index', comparator: '<=', target: w.maxTechnicalDebtIndex, actual: metrics.technicalDebtIndex, span: 40 },
    { key: 'stakeholderTrust', label: 'Average Stakeholder Trust', comparator: '>=', target: w.minStakeholderTrustAvg, actual: metrics.stakeholderTrust, span: 40 },
    { key: 'deliveryVelocity', label: 'Delivery Velocity', comparator: '>=', target: w.minDeliveryVelocity, actual: metrics.deliveryVelocity, span: 40 },
    { key: 'resilienceIndex', label: 'Resilience Index', comparator: '>=', target: w.minResilienceIndex, actual: metrics.resilienceIndex, span: 40 },
    { key: 'tco', label: 'Total Cost of Ownership ($K)', comparator: '<=', target: w.maxTCOBudget, actual: metrics.tco, span: Math.max(500, w.maxTCOBudget * 0.3) },
    { key: 'modernizedNodesCount', label: 'Capabilities Modernized', comparator: '>=', target: w.targetCapabilitiesModernized, actual: metrics.modernizedNodesCount, span: Math.max(1, w.targetCapabilitiesModernized) },
    { key: 'solvency', label: 'Cash Remaining ($K)', comparator: '>=', target: 0, actual: metrics.budgetRemaining, span: Math.max(500, base.budgetRemaining) },
  ];

  // Competitive market objectives, only when the scenario sets them
  const shareTarget = marketShareTarget({ market: scenario.market, winLossConditions: w }, teamsInMarket);
  if (shareTarget !== undefined) {
    defs.push({ key: 'marketShare', label: 'Market Share (%)', comparator: '>=', target: shareTarget, actual: metrics.marketShare ?? 0, span: Math.max(5, shareTarget) });
  }
  if (scenario.market && w.minCumulativeProfit !== undefined) {
    const target = w.minCumulativeProfit;
    defs.push({ key: 'cumulativeProfit', label: 'Cumulative Profit ($K)', comparator: '>=', target, actual: metrics.cumulativeProfit ?? 0, span: Math.max(500, Math.abs(target)) });
  }

  const objectives: OutcomeObjective[] = defs.map(({ span, ...d }) => {
    const met = d.comparator === '<=' ? d.actual <= d.target : d.actual >= d.target;
    return { ...d, met, attainment: Math.round(attainment(d.comparator, d.target, d.actual, span) * 100) / 100 };
  });

  const objectivesMet = objectives.filter(o => o.met).length;
  // 90 points for reaching the targets (partial credit by distance), 10 for the headroom beyond them
  const reach = objectives.reduce((sum, o) => sum + o.attainment, 0) / objectives.length;
  const headroom =
    objectives.reduce((sum, o, i) => {
      if (!o.met) return sum;
      const margin = o.comparator === '<=' ? o.target - o.actual : o.actual - o.target;
      return sum + Math.min(1, margin / (defs[i].span / 2));
    }, 0) / objectives.length;
  const score = Math.round(reach * 90 + headroom * 10);
  const solvent = metrics.budgetRemaining >= 0;

  // Insolvency caps the result whatever the other metrics say
  let verdict: SimulationOutcome['verdict'];
  if (objectivesMet === objectives.length) verdict = 'VICTORY';
  else if (solvent && objectivesMet >= Math.ceil(objectives.length / 2)) verdict = 'PARTIAL';
  else verdict = 'DEFEAT';

  let grade: SimulationOutcome['grade'];
  if (verdict === 'VICTORY' && score >= 97) grade = 'A+';
  else if (verdict === 'VICTORY') grade = 'A';
  else if (verdict === 'PARTIAL' && score >= 80) grade = 'B';
  else if (verdict === 'PARTIAL') grade = 'C';
  else if (solvent && score >= 55) grade = 'D';
  else grade = 'F';

  return { verdict, grade, score, objectivesMet, objectives };
}
