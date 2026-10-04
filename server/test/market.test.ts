import { describe, it, expect } from 'vitest';
import { clearMarket, marketShareTarget, teamPresence } from '../src/engine/market.js';
import { checkDecisions } from '../src/engine/rules.js';
import { evaluateOutcome } from '../src/engine/outcome.js';
import { advanceSession } from '../src/engine/session-service.js';
import { checkScenarioBalance, playTournament } from '../src/engine/balance.js';
import { submitDecisionsSchema } from '../src/validation.js';
import { SEED_SCENARIOS } from '../src/db/seeds.js';
import { MarketDecision, Scenario, SimulationSession, Team, TeamDecision } from '../src/types/index.js';

const plant = SEED_SCENARIOS.find(s => s.id === 'scen-industrial-lyon')!;
const dumas = SEED_SCENARIOS.find(s => s.id === 'scen-expansion-dumas')!;

function makeTeam(scenario: Scenario, id = 'team-1', overrides: Partial<Team> = {}): Team {
  return {
    id,
    sessionId: 'sess-market',
    name: id,
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

const atPrice = (scenario: Scenario, index: number, marketing = 0): MarketDecision => ({
  prices: Object.fromEntries(scenario.market!.segments.map(s => [s.id, s.referencePrice * index])),
  marketing: Object.fromEntries(scenario.market!.segments.map(s => [s.id, s.openAtStart === false ? 0 : marketing])),
});

const decide = (d: Partial<TeamDecision>): TeamDecision => ({ selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [], ...d });

describe('Competitive market', () => {
  it('shares every segment between teams and rivals', () => {
    const teams = [makeTeam(plant, 'a'), makeTeam(plant, 'b')];
    const results = clearMarket(plant, teams.map(team => ({ team, decision: atPrice(plant, 1) })), 1, 'seed');
    const seg = plant.market!.segments[0];
    const teamShares = Object.values(results).reduce((sum, r) => sum + (r.segments.find(s => s.segmentId === seg.id)?.share ?? 0), 0);
    // Identical teams get identical results, and leave room for the rivals
    expect(results.a.revenue).toBe(results.b.revenue);
    expect(teamShares).toBeGreaterThan(0);
    expect(teamShares).toBeLessThan(1);
  });

  it('a lower price wins share where customers are price sensitive', () => {
    const cheap = makeTeam(plant, 'cheap');
    const dear = makeTeam(plant, 'dear');
    const results = clearMarket(plant, [{ team: cheap, decision: atPrice(plant, 0.85) }, { team: dear, decision: atPrice(plant, 1.15) }], 1);
    const oem = (id: string) => results[id].segments.find(s => s.segmentId === 'seg-ind-oem')!;
    expect(oem('cheap').unitsDemanded).toBeGreaterThan(oem('dear').unitsDemanded);
  });

  it('quality, capacity and resilience are competitive advantages', () => {
    const modern = makeTeam(plant, 'modern', { metrics: { ...plant.baselineMetrics, technicalDebtIndex: 30, complianceScore: 85, resilienceIndex: 80 } });
    const legacy = makeTeam(plant, 'legacy');
    const results = clearMarket(plant, [{ team: modern, decision: atPrice(plant, 1) }, { team: legacy, decision: atPrice(plant, 1) }], 1);
    const rail = (id: string) => results[id].segments.find(s => s.segmentId === 'seg-ind-rail')!;
    expect(rail('modern').share).toBeGreaterThan(rail('legacy').share);
    expect(rail('modern').drivers.quality).toBeGreaterThan(rail('legacy').drivers.quality);
  });

  it('caps sales at delivery capacity and reports lost demand', () => {
    const small = makeTeam(plant, 'small', { metrics: { ...plant.baselineMetrics, deliveryVelocity: 10 } });
    const r = clearMarket(plant, [{ team: small, decision: atPrice(plant, 0.6) }], 1).small;
    expect(r.unitsSold).toBeLessThanOrEqual(r.capacityUnits);
    expect(r.lostSales).toBeGreaterThan(0);
  });

  it('closed segments need an entry, paid once from the program cash', () => {
    const team = makeTeam(dumas);
    expect(teamPresence(dumas, team)).not.toContain('seg-exp-de');
    const without = clearMarket(dumas, [{ team, decision: atPrice(dumas, 1) }], 1)['team-1'];
    expect(without.segments.some(s => s.segmentId === 'seg-exp-de')).toBe(false);

    const entering = { ...atPrice(dumas, 1), enter: ['seg-exp-de'] };
    const withEntry = clearMarket(dumas, [{ team, decision: entering }], 1)['team-1'];
    expect(withEntry.segments.some(s => s.segmentId === 'seg-exp-de')).toBe(true);
    expect(withEntry.entryCosts).toBe(200);

    // Entering twice or marketing a closed segment is refused
    const again = checkDecisions(dumas, { ...team, marketPresence: ['seg-exp-fr', 'seg-exp-online', 'seg-exp-de'] }, decide({ market: entering }), 1);
    expect(again.issues.map(i => i.code)).toContain('rules.market.alreadyIn');
    const blind = checkDecisions(dumas, team, decide({ market: { ...atPrice(dumas, 1), marketing: { 'seg-exp-ca': 50 } } }), 1);
    expect(blind.issues.map(i => i.code)).toContain('rules.market.notPresent');
  });

  it('keeps prices within bounds and counts commercial spending in the budget', () => {
    const team = makeTeam(plant);
    const crazy = checkDecisions(plant, team, decide({ market: { prices: { 'seg-ind-oem': 1 }, marketing: {} } }), 1);
    expect(crazy.issues.map(i => i.code)).toContain('rules.market.price');
    const spend = checkDecisions(plant, team, decide({ market: { prices: {}, marketing: { 'seg-ind-oem': 300 } } }), 1);
    expect(spend.committedCost).toBe(300);
    const broke = checkDecisions(plant, team, decide({ market: { prices: {}, marketing: { 'seg-ind-oem': 5000 } } }), 1);
    expect(broke.issues.map(i => i.code)).toContain('rules.budget');
  });

  it('is deterministic for a given seed', () => {
    const team = makeTeam(plant);
    const a = clearMarket(plant, [{ team, decision: atPrice(plant, 1) }], 2, 'sess-x');
    const b = clearMarket(plant, [{ team, decision: atPrice(plant, 1) }], 2, 'sess-x');
    expect(a).toEqual(b);
  });

  it('a quarter in a shared market updates revenue, profit, share and cash', () => {
    const teams = [makeTeam(plant, 't1'), makeTeam(plant, 't2')];
    teams[0].currentRoundDecisions = decide({ market: atPrice(plant, 1) });
    teams[1].currentRoundDecisions = decide({ market: atPrice(plant, 0.9, 100) });
    const session: SimulationSession = {
      id: 'sess-shared',
      name: 'shared',
      scenarioId: plant.id,
      scenarioTitle: plant.title,
      state: 'ACTIVE',
      currentRound: 1,
      totalRounds: 4,
      timerSecondsRemaining: 600,
      roundDurationSeconds: 600,
      isTimerRunning: false,
      teams,
      createdAt: '',
      updatedAt: '',
    };
    const { results } = advanceSession(session, plant);
    for (const team of session.teams) {
      const r = results[team.id];
      expect(r.market).toBeDefined();
      expect(team.metrics.revenue).toBe(r.market!.revenue);
      expect(team.metrics.cumulativeProfit).toBe(r.market!.operatingProfit);
      expect(r.economics?.marketCash).toBe(r.market!.programCashDelta);
      expect(r.notes?.some(n => n.code === 'note.market')).toBe(true);
      expect(team.lastMarketDecision?.prices['seg-ind-oem']).toBeDefined();
    }
  });

  it('scales the market-share objective to the number of teams', () => {
    const solo = marketShareTarget(plant, 1)!;
    const four = marketShareTarget(plant, 4)!;
    expect(solo).toBe(plant.winLossConditions.minMarketShare);
    expect(four).toBeLessThan(solo);
    const outcome = evaluateOutcome(plant, { ...plant.baselineMetrics, marketShare: 20, cumulativeProfit: 0 }, 4);
    expect(outcome.objectives.map(o => o.key)).toEqual(expect.arrayContaining(['marketShare', 'cumulativeProfit']));
  });

  it('scenarios without a market keep exactly seven objectives', () => {
    const bank = SEED_SCENARIOS.find(s => s.id === 'scen-fintech-neotitan')!;
    expect(evaluateOutcome(bank, bank.baselineMetrics).objectives).toHaveLength(7);
  });

  it('validates market decisions in the request body', () => {
    const ok = submitDecisionsSchema.safeParse({
      teamId: 't',
      decisions: { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', market: { prices: { a: 8 }, marketing: { a: 10 }, enter: ['b'] } },
    });
    expect(ok.success).toBe(true);
    const bad = submitDecisionsSchema.safeParse({
      teamId: 't',
      decisions: { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', market: { prices: { a: -1 }, marketing: {} } },
    });
    expect(bad.success).toBe(false);
  });
});

describe('Market balance', () => {
  for (const scenario of [plant, dumas]) {
    it(`${scenario.id}: winnable, balanced play beats price wars in a shared market`, () => {
      const report = checkScenarioBalance(scenario);
      expect(report.issues).toEqual([]);
      expect(report.bestAchievable.verdict).toBe('VICTORY');
      expect(report.results.COWBOY.verdict).toBe('DEFEAT');
      const tournament = playTournament(scenario);
      expect(['VICTORY', 'PARTIAL']).toContain(tournament.ARCHITECT.verdict);
      expect(tournament.ARCHITECT.score).toBeGreaterThan(tournament.COWBOY.score);
      expect(tournament.ARCHITECT.score).toBeGreaterThan(tournament.PRUDENT.score);
    });
  }
});

describe('Studio market generation', () => {
  it('adds a calibrated market when asked, even without an AI provider', async () => {
    const { FallbackProvider } = await import('../src/ai/fallback.js');
    const { StudioScenarioGenerator } = await import('../src/ai/studio-generator.js');
    const prompt = {
      industry: 'Cosmétiques',
      businessChallenge: "Une marque de cosmétiques veut entrer sur le marché espagnol face à des concurrents bas coût.",
      domain: 'MARKET_EXPANSION' as const,
      withMarket: true,
    };
    const raw = FallbackProvider.createDynamicScenario(prompt);
    const scenario = StudioScenarioGenerator.validateAndEnrich(raw, prompt, 'fallback');
    expect(scenario.market?.segments.length).toBeGreaterThanOrEqual(2);
    expect(scenario.market!.fixedCosts).toBeGreaterThanOrEqual(0);
    expect(scenario.winLossConditions.minMarketShare).toBeGreaterThan(0);
    // Generated markets go through the same balance check as seeded ones
    const report = checkScenarioBalance(scenario);
    expect(report.tournament).toBeDefined();
  });

  it('bounds every number of a model-generated market', async () => {
    const { FallbackProvider } = await import('../src/ai/fallback.js');
    const { StudioScenarioGenerator } = await import('../src/ai/studio-generator.js');
    const prompt = { industry: 'Retail', businessChallenge: 'Expand to Spain.', withMarket: true };
    const raw: any = FallbackProvider.createDynamicScenario(prompt);
    raw.market = {
      unitCost: 999,
      segments: [
        { id: 'a', name: 'A', baseDemand: -5, referencePrice: 2, priceSensitivity: 9 },
        { id: 'b', name: 'B', baseDemand: 500, referencePrice: 3, openAtStart: false, entryCost: 1e9 },
      ],
      rivals: [{ name: 'X', priceIndex: 0.1, quality: 500 }],
    };
    const market = StudioScenarioGenerator.validateAndEnrich(raw, prompt, 'fallback').market!;
    expect(market.unitCost).toBeLessThan(2);
    expect(market.segments[0].baseDemand).toBeGreaterThan(0);
    expect(market.segments[0].priceSensitivity).toBeLessThanOrEqual(1);
    expect(market.segments[1].entryCost).toBeLessThanOrEqual(5000);
    expect(market.rivals[0].priceIndex).toBeGreaterThanOrEqual(0.6);
    expect(market.rivals[0].quality).toBeLessThanOrEqual(95);
  });
});

describe('Player view', () => {
  it("hides other teams' pending decisions (prices, initiatives) and keeps the viewer's own", async () => {
    const { viewerReplacer } = await import('../src/auth.js');
    const mine = makeTeam(plant, 'mine');
    const rival = makeTeam(plant, 'rival');
    mine.currentRoundDecisions = decide({ market: atPrice(plant, 0.9) });
    rival.currentRoundDecisions = decide({ selectedInitiativeIds: ['ind-init-mes'], market: atPrice(plant, 0.7) });
    const payload = { session: { facilitatorPasscode: 'x', teams: [mine, rival] } };
    const seen = JSON.parse(JSON.stringify(payload, viewerReplacer('mine')));
    expect(seen.session.facilitatorPasscode).toBeUndefined();
    expect(seen.session.teams[0].currentRoundDecisions.market).toBeDefined();
    expect(seen.session.teams[1].currentRoundDecisions.market).toBeUndefined();
    expect(seen.session.teams[1].currentRoundDecisions.selectedInitiativeIds).toEqual([]);
    // Submission status stays public
    expect(seen.session.teams[1].decisionSubmitted).toBe(false);
  });
});
