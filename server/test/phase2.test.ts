import { describe, it, expect } from 'vitest';
import { advanceSession } from '../src/engine/session-service.js';
import { whatIf, canReplay } from '../src/engine/whatif.js';
import { coachQuarter } from '../src/engine/coach.js';
import { buildDebrief } from '../src/engine/debrief.js';
import { detectPromisedInitiatives, recordPromise, describePromises } from '../src/engine/promises.js';
import { SEED_SCENARIOS } from '../src/db/seeds.js';
import { Scenario, SimulationSession, Team, TeamDecision } from '../src/types/index.js';

const dumas = SEED_SCENARIOS.find(s => s.id === 'scen-expansion-dumas')!;
const bank = SEED_SCENARIOS.find(s => s.id === 'scen-fintech-neotitan')!;

function makeTeam(scenario: Scenario, id: string): Team {
  return {
    id,
    sessionId: 'sess-p2',
    name: id,
    color: '#fff',
    avatar: 'T',
    metrics: { ...scenario.baselineMetrics, modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length },
    stakeholderTrustMap: Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, sh.baseTrust ?? 60])),
    currentRoundDecisions: { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [] },
    decisionSubmitted: false,
    history: [],
    activeInitiatives: [],
    completedInitiativeIds: [],
    nodeHealthOverrides: {},
  };
}

const decide = (d: Partial<TeamDecision>): TeamDecision => ({ selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [], ...d });
const prices = (scenario: Scenario, index: number) => Object.fromEntries(scenario.market!.segments.map(s => [s.id, Math.round(s.referencePrice * index * 100) / 100]));

/** Plays 4 quarters with three contrasting teams, an injected crisis and negotiations between quarters. */
function playSession(scenario: Scenario): SimulationSession {
  const session: SimulationSession = {
    id: 'sess-p2',
    name: 'p2',
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    state: 'ACTIVE',
    currentRound: 1,
    totalRounds: 4,
    timerSecondsRemaining: 0,
    roundDurationSeconds: 600,
    isTimerRunning: false,
    teams: [makeTeam(scenario, 'arch'), makeTeam(scenario, 'cowboy'), makeTeam(scenario, 'idle')],
    createdAt: '',
    updatedAt: '',
  };
  const plans: Record<string, string[][]> = {
    arch: [['exp-init-erp', 'exp-init-compliance'], ['exp-init-3pl'], ['exp-init-plant', 'exp-init-localize'], ['exp-init-people']],
    cowboy: [['exp-init-blitz'], [], [], []],
    idle: [[], [], [], []],
  };
  for (let round = 1; round <= 4; round++) {
    const [arch, cowboy, idle] = session.teams;
    if (round === 1) {
      // A promise to the CFO and a board mandate
      recordPromise(scenario, arch, 'sh-exp-cfo', "Je lance l'ERP multi-pays et la certification produits ce trimestre", 1, 'ACCEPTED');
      arch.boardMandate = { round: 1, verdict: 'APPROVED', consensusScore: 80 };
      // An unkept promise for the cowboy team
      recordPromise(scenario, cowboy, 'sh-exp-ops', 'Nous financerons le partenaire logistique européen', 1, 'ACCEPTED');
    }
    if (round === 2) {
      // Trust won in negotiation between quarters, then a crisis injected by the facilitator
      arch.stakeholderTrustMap['sh-exp-export'] += 6;
      session.injectedEvents = [
        {
          roundNumber: 2,
          title: 'Injected',
          description: '',
          type: 'CRISIS',
          severity: 'HIGH',
          immediateImpact: { budgetFine: 100, tdiSurge: 5, velocityPenalty: -6, downedNodeIds: ['exp-3pl'] },
          impactAppliedAtInjection: true,
          choices: [],
        },
      ];
      for (const t of session.teams) {
        t.metrics.budgetRemaining -= 100;
        t.metrics.technicalDebtIndex = Math.min(100, t.metrics.technicalDebtIndex + 5);
        t.metrics.deliveryVelocity = Math.max(5, t.metrics.deliveryVelocity - 6);
        t.nodeHealthOverrides = { ...t.nodeHealthOverrides, 'exp-3pl': { health: 15, technicalDebt: 90, status: 'CRITICAL' } };
      }
    }
    arch.currentRoundDecisions = decide({
      selectedInitiativeIds: plans.arch[round - 1],
      governancePosture: 'ACCELERATED_MODERN',
      market: { prices: prices(scenario, 1), marketing: { 'seg-exp-fr': 60 }, enter: round === 2 ? ['seg-exp-de'] : [] },
    });
    cowboy.currentRoundDecisions = decide({
      selectedInitiativeIds: plans.cowboy[round - 1],
      governancePosture: 'BYPASS_ARCH',
      market: { prices: prices(scenario, 0.8), marketing: { 'seg-exp-online': 200 } },
    });
    idle.currentRoundDecisions = decide({ market: { prices: prices(scenario, 1), marketing: {} } });
    advanceSession(session, scenario);
  }
  return session;
}

describe('What-if replay', () => {
  it('replays the game exactly as played', () => {
    const session = playSession(dumas);
    for (const team of session.teams) {
      expect(canReplay(team)).toBe(true);
      const { baseline, issues } = whatIf(dumas, session, team.id);
      expect(issues).toEqual([]);
      baseline.quarters.forEach((q, i) => expect(q.metrics).toEqual(team.history[i].metricsAfter));
      const last = baseline.quarters[baseline.quarters.length - 1].metrics;
      expect(last).toEqual(team.metrics);
    }
  });

  it('changes only the chosen quarter and reports the new outcome', () => {
    const session = playSession(dumas);
    const cowboy = session.teams[1];
    const original = whatIf(dumas, session, cowboy.id).baseline;
    const alt = whatIf(dumas, session, cowboy.id, {
      round: 1,
      decision: decide({ selectedInitiativeIds: ['exp-init-compliance'], governancePosture: 'STRICT_GOVERNANCE', market: { prices: prices(dumas, 1), marketing: {} } }),
    });
    expect(alt.issues).toEqual([]);
    expect(alt.alternative!.quarters).toHaveLength(4);
    expect(alt.alternative!.outcome.score).toBeGreaterThan(original.outcome.score);
  });

  it('refuses an illegal alternative with the rule issues', () => {
    const session = playSession(dumas);
    const alt = whatIf(dumas, session, session.teams[0].id, {
      round: 1,
      decision: decide({ selectedInitiativeIds: ['exp-init-erp', 'exp-init-3pl', 'exp-init-plant', 'exp-init-people'] }),
    });
    expect(alt.alternative).toBeUndefined();
    expect(alt.issues.map(i => i.code)).toContain('rules.capacity');
  });
});

describe('Promise memory', () => {
  it('detects the initiatives a message commits to', () => {
    expect(detectPromisedInitiatives(dumas, "Je lance l'ERP multi-pays dès ce trimestre")).toEqual(['exp-init-erp']);
    expect(detectPromisedInitiatives(dumas, 'Nous allons y réfléchir')).toEqual([]);
  });

  it('only accepted proposals become promises', () => {
    const team = makeTeam(dumas, 't');
    expect(recordPromise(dumas, team, 'sh-exp-cfo', "ERP multi-pays", 1, 'REJECTED')).toBeUndefined();
    expect(recordPromise(dumas, team, 'sh-exp-cfo', "ERP multi-pays", 1, 'ACCEPTED')).toBeDefined();
  });

  it('kept promises build trust, broken ones cost it, and executives remember', () => {
    const session = playSession(dumas);
    const [arch, cowboy] = session.teams;
    expect(arch.promises![0].status).toBe('KEPT');
    expect(cowboy.promises![0].status).toBe('BROKEN');
    const q1 = cowboy.history[0];
    expect(q1.notes?.some(n => n.code === 'note.promisesBroken')).toBe(true);
    expect(q1.stakeholderReactions.find(r => r.stakeholderId === 'sh-exp-ops')!.notes!.some(n => n.code === 'reaction.promiseBroken')).toBe(true);
    expect(describePromises(dumas, cowboy, 'sh-exp-ops')[0]).toMatch(/BROKE/);
    expect(describePromises(dumas, cowboy, 'sh-exp-cfo')).toEqual([]);
  });
});

describe('Coach', () => {
  it('explains each quarter with ranked causes from the engine breakdown', () => {
    const session = playSession(dumas);
    const cowboy = session.teams[1];
    const report = coachQuarter(dumas, cowboy, 1, session)!;
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.insights.map(i => i.code)).toContain('coach.debt.up');
    const debt = report.insights.find(i => i.code === 'coach.debt.up')!;
    expect(String(debt.params!.cause)).toMatch(/^coach\.cause\.debt\./);
    // Advice only for the latest quarter
    expect(report.advice).toEqual([]);
    expect(coachQuarter(dumas, cowboy, 4, session)!.advice.length).toBeGreaterThan(0);
  });

  it('works without a market and without replay data', () => {
    const team = makeTeam(bank, 'b');
    const session = { ...playSession(dumas), teams: [team] } as SimulationSession;
    team.currentRoundDecisions = decide({ governancePosture: 'BYPASS_ARCH' });
    advanceSession({ ...session, id: 'x', scenarioId: bank.id, currentRound: 1, state: 'ACTIVE' }, bank);
    expect(coachQuarter(bank, team, 1)).toBeUndefined(); // advanceSession returned a new team list
  });
});

describe('Automatic debrief', () => {
  it('finds decisive moments, patterns and questions from real decisions', () => {
    const session = playSession(dumas);
    const debrief = buildDebrief(dumas, session);
    const cowboy = debrief.teams.find(t => t.teamId === 'cowboy')!;
    expect(cowboy.scores).toHaveLength(4);
    expect(cowboy.moments.length).toBeGreaterThan(0);
    expect(cowboy.moments[0].decision.length).toBeGreaterThan(0);
    expect(cowboy.patterns).toEqual(expect.arrayContaining(['PRICE_WAR', 'SHORTCUTS', 'BROKEN_PROMISES']));
    const idle = debrief.teams.find(t => t.teamId === 'idle')!;
    expect(idle.patterns).toContain('LATE_START');
    expect(debrief.questions.length).toBeGreaterThanOrEqual(2);
    expect(debrief.questions.some(q => q.code === 'debrief.q.priceWar')).toBe(true);
    expect(debrief.leaders.some(l => l.key === 'marketShare')).toBe(true);
  });
});
