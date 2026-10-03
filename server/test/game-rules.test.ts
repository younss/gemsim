import { describe, it, expect } from 'vitest';
import { checkDecisions } from '../src/engine/rules.js';
import { evaluateOutcome } from '../src/engine/outcome.js';
import { SimulationResolver, getRunAllocation } from '../src/engine/resolver.js';
import { advanceSession } from '../src/engine/session-service.js';
import { seededRoll } from '../src/engine/math.js';
import { submitDecisionsSchema, injectEventSchema } from '../src/validation.js';
import { SEED_SCENARIOS } from '../src/db/seeds.js';
import { Scenario, SimulationSession, Team, TeamDecision } from '../src/types/index.js';

const neoTitan = SEED_SCENARIOS.find(s => s.id === 'scen-fintech-neotitan')!;

function makeTeam(scenario: Scenario, overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    sessionId: 'sess-test',
    name: 'Test',
    color: '#fff',
    avatar: 'T',
    metrics: { ...scenario.baselineMetrics },
    stakeholderTrustMap: Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, sh.baseTrust])),
    currentRoundDecisions: { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [] },
    decisionSubmitted: false,
    history: [],
    activeInitiatives: [],
    completedInitiativeIds: [],
    nodeHealthOverrides: {},
    ...overrides,
  };
}

const decide = (d: Partial<TeamDecision>): TeamDecision => ({
  selectedInitiativeIds: [],
  governancePosture: 'BALANCED_AGILE',
  customPacts: [],
  ...d,
});

describe('Quarter decision rules', () => {
  it('rejects portfolios above delivery capacity or the cash envelope', () => {
    const all = neoTitan.initiativesCatalog.map(i => i.id);
    const check = checkDecisions(neoTitan, makeTeam(neoTitan), decide({ selectedInitiativeIds: all }), 1);
    expect(check.ok).toBe(false);
    expect(check.errors.join(' ')).toMatch(/capacity/i);
    expect(check.errors.join(' ')).toMatch(/budget/i);
  });

  it('accepts an affordable two-initiative portfolio', () => {
    const check = checkDecisions(neoTitan, makeTeam(neoTitan), decide({ selectedInitiativeIds: ['init-strangler-core', 'init-kafka-ledger'] }), 1);
    expect(check.ok).toBe(true);
    expect(check.committedCost).toBe(630);
  });

  it('blocks re-buying a completed or in-progress initiative', () => {
    const team = makeTeam(neoTitan, {
      completedInitiativeIds: ['init-strangler-core'],
      activeInitiatives: [{ initiativeId: 'init-kafka-ledger', roundsRemaining: 1 }],
    });
    const check = checkDecisions(neoTitan, team, decide({ selectedInitiativeIds: ['init-strangler-core', 'init-kafka-ledger'] }), 2);
    expect(check.ok).toBe(false);
    expect(check.errors.filter(e => /already completed or in progress/.test(e))).toHaveLength(2);
  });

  it('counts crisis responses and pacts in the budget envelope', () => {
    const team = makeTeam(neoTitan, { metrics: { ...neoTitan.baselineMetrics, budgetRemaining: 300 } });
    const check = checkDecisions(
      neoTitan,
      team,
      decide({ eventChoiceId: 'ev1-strangler', customPacts: [{ stakeholderId: 'sh-cfo-marcus', concession: 'x', committedBudget: 200 }] }),
      1
    );
    expect(check.committedCost).toBe(360);
    expect(check.ok).toBe(false);
  });

  it('lets an insolvent team submit an empty quarter', () => {
    const team = makeTeam(neoTitan, { metrics: { ...neoTitan.baselineMetrics, budgetRemaining: -200 } });
    expect(checkDecisions(neoTitan, team, decide({}), 3).ok).toBe(true);
  });
});

describe('Round resolution economics and progression', () => {
  it('delivers multi-quarter initiatives only when they complete', () => {
    const scenario: Scenario = {
      ...neoTitan,
      initiativesCatalog: neoTitan.initiativesCatalog.map(i => (i.id === 'init-cloud-mesh' ? { ...i, durationRounds: 2 } : i)),
    };
    const team = makeTeam(scenario, { currentRoundDecisions: decide({ selectedInitiativeIds: ['init-cloud-mesh'] }) });

    const q1 = SimulationResolver.resolveRound(scenario, team, 1);
    expect(q1.updatedTeam.activeInitiatives).toEqual([{ initiativeId: 'init-cloud-mesh', roundsRemaining: 1 }]);
    expect(q1.updatedTeam.completedInitiativeIds).toEqual([]);
    expect(q1.roundResult.economics?.capExSpent).toBe(400);

    const q2 = SimulationResolver.resolveRound(scenario, q1.updatedTeam, 2);
    expect(q2.updatedTeam.completedInitiativeIds).toEqual(['init-cloud-mesh']);
    expect(q2.updatedTeam.activeInitiatives).toEqual([]);
    expect(q2.roundResult.economics?.capExSpent).toBe(0);
  });

  it('funds the run budget: an untouched estate costs nothing beyond its allocation', () => {
    const team = makeTeam(neoTitan, { currentRoundDecisions: decide({ governancePosture: 'BALANCED_AGILE' }) });
    const { roundResult } = SimulationResolver.resolveRound(neoTitan, team, 4); // Q4 has no scheduled fine
    expect(roundResult.economics?.runAllocation).toBe(getRunAllocation(neoTitan));
    expect(Math.abs(roundResult.economics!.opExOverrun)).toBeLessThan(100);
  });

  it('punishes insolvency with trust losses', () => {
    const team = makeTeam(neoTitan, { metrics: { ...neoTitan.baselineMetrics, budgetRemaining: 10 } });
    const { updatedTeam, roundResult } = SimulationResolver.resolveRound(neoTitan, team, 1);
    expect(updatedTeam.metrics.budgetRemaining).toBeLessThan(0);
    expect(roundResult.facilitatorFeedback).toMatch(/INSOLVENT/);
    expect(roundResult.stakeholderReactions.every(r => r.comment.includes('Cash reserves are negative'))).toBe(true);
  });

  it('honors stakeholder pacts: cost charged, trust granted', () => {
    const pact = { stakeholderId: 'sh-cfo-marcus', concession: 'Decommission 10% MIPS by Q4', committedBudget: 100 };
    const base = SimulationResolver.resolveRound(neoTitan, makeTeam(neoTitan), 4);
    const withPact = SimulationResolver.resolveRound(
      neoTitan,
      makeTeam(neoTitan, { currentRoundDecisions: decide({ customPacts: [pact] }) }),
      4
    );
    expect(withPact.roundResult.economics?.pactCost).toBe(100);
    expect(withPact.updatedTeam.stakeholderTrustMap['sh-cfo-marcus']).toBeGreaterThan(base.updatedTeam.stakeholderTrustMap['sh-cfo-marcus']);
    expect(withPact.updatedTeam.honoredPacts).toEqual([pact]);
  });

  it('does not re-apply an injected crisis impact at resolution', () => {
    const crisis = {
      roundNumber: 1,
      title: 'Ransomware',
      description: '',
      type: 'CRISIS' as const,
      severity: 'BLACK_SWAN' as const,
      immediateImpact: { budgetFine: 500, tdiSurge: 0, velocityPenalty: 0 },
      impactAppliedAtInjection: true,
      choices: [],
    };
    const withCrisis = SimulationResolver.resolveRound(neoTitan, makeTeam(neoTitan), 1, [crisis]);
    expect(withCrisis.roundResult.economics?.eventCost).toBe(0);
  });

  it('rolls incidents reproducibly from the seed', () => {
    expect(seededRoll('a|b|1|node')).toBe(seededRoll('a|b|1|node'));
    expect(seededRoll('a|b|1|node')).not.toBe(seededRoll('a|b|2|node'));
    const r = seededRoll('x');
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });
});

describe('Win / loss evaluation', () => {
  it('declares victory only when every objective is met', () => {
    const w = neoTitan.winLossConditions;
    const outcome = evaluateOutcome(neoTitan, {
      ...neoTitan.baselineMetrics,
      technicalDebtIndex: w.maxTechnicalDebtIndex - 5,
      stakeholderTrust: w.minStakeholderTrustAvg + 5,
      deliveryVelocity: w.minDeliveryVelocity + 5,
      resilienceIndex: w.minResilienceIndex + 5,
      tco: w.maxTCOBudget - 100,
      modernizedNodesCount: w.targetCapabilitiesModernized,
      budgetRemaining: 100,
    });
    expect(outcome.verdict).toBe('VICTORY');
    expect(outcome.grade).toBe('A+');
  });

  it('fails an insolvent team even with strong metrics', () => {
    const w = neoTitan.winLossConditions;
    const outcome = evaluateOutcome(neoTitan, {
      ...neoTitan.baselineMetrics,
      technicalDebtIndex: 10,
      stakeholderTrust: 90,
      deliveryVelocity: 90,
      resilienceIndex: 90,
      tco: w.maxTCOBudget + 2000,
      modernizedNodesCount: 1,
      budgetRemaining: -500,
    });
    expect(outcome.verdict).toBe('DEFEAT');
    expect(outcome.objectives.find(o => o.key === 'solvency')?.met).toBe(false);
  });

  it('records the final outcome on every team when the last quarter resolves', () => {
    const session: SimulationSession = {
      id: 'sess-test',
      name: 'Test',
      scenarioId: neoTitan.id,
      scenarioTitle: neoTitan.title,
      state: 'ACTIVE',
      currentRound: neoTitan.totalRounds,
      totalRounds: neoTitan.totalRounds,
      timerSecondsRemaining: 300,
      roundDurationSeconds: 300,
      isTimerRunning: false,
      teams: [makeTeam(neoTitan)],
      createdAt: '',
      updatedAt: '',
    };
    const { session: done } = advanceSession(session, neoTitan);
    expect(done.state).toBe('COMPLETED');
    expect(done.teams[0].outcome?.verdict).toBeDefined();
    expect(() => advanceSession(done, neoTitan)).toThrow(/already completed/);
  });
});

describe('Request validation', () => {
  it('rejects malformed decisions and unknown governance postures', () => {
    expect(submitDecisionsSchema.safeParse({ teamId: 't', decisions: { selectedInitiativeIds: [], governancePosture: 'YOLO' } }).success).toBe(false);
    expect(submitDecisionsSchema.safeParse({ teamId: 't', decisions: { selectedInitiativeIds: ['a'], governancePosture: 'STRICT_GOVERNANCE' } }).success).toBe(true);
  });

  it('fills defaults on injected crisis payloads', () => {
    const parsed = injectEventSchema.parse({ event: { title: 'Outage' } });
    expect(parsed.event.type).toBe('CRISIS');
    expect(parsed.event.severity).toBe('HIGH');
  });
});
