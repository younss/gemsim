// ============================================================================
// GEMSIM STUDIO: DIFFICULTY CALIBRATION
// Plays the generated case and moves its targets until the requested difficulty
// holds, using what the engine actually reaches: the best path found by the
// beam search must win; the disciplined bot wins (entry, intermediate) or only
// reaches a partial success (executive, crisis chief); shortcuts must lose.
// ============================================================================

import type { OutcomeObjective, Scenario, SimulationOutcome, TeamMetrics } from '../types/index.js';
import { checkScenarioBalance, searchBestTeam, simulateStrategy } from '../engine/balance.js';
import { evaluateOutcome } from '../engine/outcome.js';

type Key = Exclude<OutcomeObjective['key'], 'solvency'>;

const FIELD: Record<Key, keyof Scenario['winLossConditions']> = {
  technicalDebtIndex: 'maxTechnicalDebtIndex',
  stakeholderTrust: 'minStakeholderTrustAvg',
  deliveryVelocity: 'minDeliveryVelocity',
  resilienceIndex: 'minResilienceIndex',
  tco: 'maxTCOBudget',
  modernizedNodesCount: 'targetCapabilitiesModernized',
  marketShare: 'minMarketShare',
  cumulativeProfit: 'minCumulativeProfit',
};

const ACTUAL: Record<Key, (m: TeamMetrics) => number> = {
  technicalDebtIndex: m => m.technicalDebtIndex,
  stakeholderTrust: m => m.stakeholderTrust,
  deliveryVelocity: m => m.deliveryVelocity,
  resilienceIndex: m => m.resilienceIndex,
  tco: m => m.tco,
  modernizedNodesCount: m => m.modernizedNodesCount,
  marketShare: m => m.marketShare ?? 0,
  cumulativeProfit: m => m.cumulativeProfit ?? 0,
};

export interface CalibrationReport {
  target: string; // the profile asked for
  met: boolean;
  iterations: number;
  adjustments: string[];
  best: Pick<SimulationOutcome, 'verdict' | 'grade' | 'score'>;
  architect: Pick<SimulationOutcome, 'verdict' | 'grade' | 'score'>;
  cowboy: Pick<SimulationOutcome, 'verdict' | 'grade' | 'score'>;
}

// What disciplined play (the ARCHITECT bot) must reach at each difficulty
type ArchitectTarget = 'VICTORY' | 'PARTIAL' | 'NOT_VICTORY';
const PROFILE: Record<Scenario['difficulty'], { architect: ArchitectTarget; label: string }> = {
  ENTRY: { architect: 'VICTORY', label: 'disciplined play wins' },
  INTERMEDIATE: { architect: 'VICTORY', label: 'disciplined play wins, shortcuts lose' },
  EXECUTIVE: { architect: 'PARTIAL', label: 'only a well-optimised path wins; disciplined play reaches a partial success' },
  CRISIS_CHIEF: { architect: 'NOT_VICTORY', label: 'only a well-optimised path wins' },
};

const round = (key: Key, v: number) => (key === 'tco' || key === 'cumulativeProfit' ? Math.round(v / 10) * 10 : key === 'marketShare' ? Math.round(v * 10) / 10 : Math.round(v));

export function calibrateDifficulty(input: Scenario, maxIterations = 10): { scenario: Scenario; report: CalibrationReport } {
  let scenario: Scenario = { ...input, winLossConditions: { ...input.winLossConditions } };
  const profile = PROFILE[scenario.difficulty] ?? PROFILE.INTERMEDIATE;
  const adjustments: string[] = [];
  const keys = (Object.keys(FIELD) as Key[]).filter(k => scenario.winLossConditions[FIELD[k]] !== undefined);
  let iterations = 0;

  const set = (key: Key, value: number, why: string) => {
    const before = scenario.winLossConditions[FIELD[key]];
    const v = round(key, value);
    if (before === v) return false;
    scenario = { ...scenario, winLossConditions: { ...scenario.winLossConditions, [FIELD[key]]: v } };
    adjustments.push(`${FIELD[key]}: ${before} → ${v} (${why})`);
    return true;
  };

  for (; iterations < maxIterations; iterations++) {
    const best = searchBestTeam(scenario);
    const bestOutcome = evaluateOutcome(scenario, best.metrics);
    const architect = simulateStrategy(scenario, 'ARCHITECT');
    const archActual = Object.fromEntries(architect.objectives.map(o => [o.key, o.actual])) as Record<string, number>;
    let changed = false;

    // Cash is not a target: when the reference play ends insolvent, the programme gets more money
    const fund = (deficit: number, why: string) => {
      const before = scenario.baselineMetrics.budgetRemaining;
      const after = Math.round((before + Math.abs(deficit) * 1.2 + 100) / 10) * 10;
      scenario = { ...scenario, baselineMetrics: { ...scenario.baselineMetrics, budgetRemaining: after } };
      adjustments.push(`budgetRemaining: ${before} → ${after} (${why})`);
      return true;
    };
    const bestCash = bestOutcome.objectives.find(o => o.key === 'solvency');
    if (bestCash && !bestCash.met) {
      fund(bestCash.actual, 'the best path must stay solvent');
      continue;
    }

    // 1. The best path must win: loosen what it misses, just below what it reaches
    for (const o of bestOutcome.objectives) {
      if (o.met || o.key === 'solvency') continue;
      const key = o.key as Key;
      const reached = ACTUAL[key](best.metrics);
      const slack = key === 'tco' || key === 'cumulativeProfit' ? Math.max(20, Math.abs(reached) * 0.03) : key === 'marketShare' ? 0.5 : 1;
      changed = set(key, o.comparator === '<=' ? reached + slack : reached - slack, 'the best path must win') || changed;
    }
    if (changed) continue;

    const slackOf = (key: Key, value: number) =>
      key === 'tco' || key === 'cumulativeProfit' ? Math.max(20, Math.abs(value) * 0.03) : key === 'marketShare' ? 0.5 : 1;

    if (profile.architect === 'PARTIAL' && architect.verdict === 'DEFEAT') {
      // 2c. Disciplined play must reach a partial success: fund it, then loosen its closest miss
      const archCash = architect.objectives.find(o => o.key === 'solvency');
      if (archCash && !archCash.met) {
        fund(archCash.actual, 'disciplined play must stay solvent');
        continue;
      }
      const closest = architect.objectives
        .filter(o => !o.met && o.key !== 'solvency')
        .sort((x, y) => x.attainment - y.attainment)
        .reverse()[0];
      if (closest) {
        const key = closest.key as Key;
        const slack = slackOf(key, closest.actual);
        changed = set(key, closest.comparator === '<=' ? closest.actual + slack : closest.actual - slack, 'disciplined play must reach a partial success');
      }
    } else if (profile.architect === 'VICTORY' && architect.verdict !== 'VICTORY') {
      // 2a. Disciplined play must win: fund it if it ends insolvent, loosen what it misses
      const archCash = architect.objectives.find(o => o.key === 'solvency');
      if (archCash && !archCash.met) {
        fund(archCash.actual, 'disciplined play must stay solvent');
        continue;
      }
      for (const o of architect.objectives) {
        if (o.met || o.key === 'solvency') continue;
        const key = o.key as Key;
        const slack = key === 'tco' || key === 'cumulativeProfit' ? Math.max(20, Math.abs(o.actual) * 0.03) : key === 'marketShare' ? 0.5 : 1;
        changed = set(key, o.comparator === '<=' ? o.actual + slack : o.actual - slack, 'disciplined play must win') || changed;
      }
    } else if (profile.architect !== 'VICTORY' && architect.verdict === 'VICTORY') {
      // 2b. Only the optimised path wins: tighten the objective where the best path beats the architect most
      const gaps = keys
        .map(key => {
          const o = bestOutcome.objectives.find(x => x.key === key);
          if (!o) return undefined;
          const b = ACTUAL[key](best.metrics);
          const a = archActual[key];
          const lead = o.comparator === '<=' ? a - b : b - a; // how much better the best path does
          const span = Math.max(1, Math.abs(o.target) * 0.1, key === 'marketShare' ? 2 : 1);
          return { key, comparator: o.comparator, b, a, lead, ratio: lead / span };
        })
        .filter((g): g is NonNullable<typeof g> => !!g && g.lead > (g.key === 'marketShare' ? 0.4 : 1))
        .sort((x, y) => y.ratio - x.ratio);
      const g = gaps[0];
      if (g) changed = set(g.key, (g.a + g.b) / 2, 'disciplined play must not be enough');
    }
    if (!changed) break;
  }

  const report = checkScenarioBalance(scenario);
  const best = report.bestAchievable;
  const met =
    best.verdict === 'VICTORY' &&
    report.results.COWBOY.verdict !== 'VICTORY' &&
    (profile.architect === 'VICTORY'
      ? report.results.ARCHITECT.verdict === 'VICTORY'
      : profile.architect === 'PARTIAL'
      ? report.results.ARCHITECT.verdict === 'PARTIAL'
      : report.results.ARCHITECT.verdict !== 'VICTORY');
  const pick = (o: SimulationOutcome) => ({ verdict: o.verdict, grade: o.grade, score: o.score });
  return {
    scenario,
    report: {
      target: profile.label,
      met,
      iterations,
      adjustments,
      best: pick(best),
      architect: pick(report.results.ARCHITECT),
      cowboy: pick(report.results.COWBOY),
    },
  };
}
