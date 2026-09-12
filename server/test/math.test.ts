import { describe, it, expect } from 'vitest';
import {
  calculateCompoundDebtDrift,
  calculateEffectiveVelocity,
  calculateOpEx,
  calculateIncidentProbabilities,
  evaluateStakeholderSentiment,
} from '../src/engine/math.js';
import { SimulationResolver } from '../src/engine/resolver.js';
import { FallbackProvider } from '../src/ai/fallback.js';
import { SEED_SCENARIOS } from '../src/db/seeds.js';
import { Team } from '../src/types/index.js';

describe('GemSim Mathematical Engine Formulas', () => {
  it('compounds technical debt drastically faster when bypassing architecture', () => {
    const previousTdi = 50;
    const bypassResult = calculateCompoundDebtDrift(previousTdi, 'BYPASS_ARCH');
    const strictResult = calculateCompoundDebtDrift(previousTdi, 'STRICT_GOVERNANCE');

    expect(bypassResult.driftAmount).toBeGreaterThan(strictResult.driftAmount);
    expect(bypassResult.compoundRate).toBe(0.18);
    expect(strictResult.compoundRate).toBe(0.025);
  });

  it('imposes non-linear delivery velocity drag as technical debt climbs', () => {
    const lowDebtVelocity = calculateEffectiveVelocity(70, 20, 0);
    const highDebtVelocity = calculateEffectiveVelocity(70, 85, 0);

    expect(lowDebtVelocity.dragPercentage).toBeLessThan(10);
    expect(highDebtVelocity.dragPercentage).toBeGreaterThan(45);
    expect(highDebtVelocity.effectiveVelocity).toBeLessThan(lowDebtVelocity.effectiveVelocity);
  });

  it('calculates OpEx factoring in node upkeep and debt penalty', () => {
    const mockNodes: any = [
      { costPerRound: 50 },
      { costPerRound: 50 },
    ];
    const lowDebtOpEx = calculateOpEx(mockNodes, 20, 0);
    const highDebtOpEx = calculateOpEx(mockNodes, 80, 0);

    expect(highDebtOpEx).toBeGreaterThan(lowDebtOpEx);
  });

  it('evaluates stakeholder sentiment according to executive role weights', () => {
    const cfo: any = {
      name: 'Marcus Vance',
      title: 'CFO',
      decisionWeights: { financialAcumen: 0.8, deliverySpeed: 0.1, architecturalRigor: 0.1, regulatoryCompliance: 0.0 },
    };

    const goodFinance = evaluateStakeholderSentiment(cfo, { financialDelta: 0.8, velocityDelta: -0.2, architectureDelta: 0, complianceDelta: 0 }, 50);
    const badFinance = evaluateStakeholderSentiment(cfo, { financialDelta: -0.9, velocityDelta: 0.8, architectureDelta: 0, complianceDelta: 0 }, 50);

    expect(goodFinance.trustDelta).toBeGreaterThan(0);
    expect(badFinance.trustDelta).toBeLessThan(0);
  });
});

describe('GemSim Turn Resolver State Machine', () => {
  it('resolves a round deterministically and updates metrics, history, and debt', () => {
    const scenario = SEED_SCENARIOS[0];
    const initialTrustMap: Record<string, number> = {};
    for (const sh of scenario.stakeholders) {
      initialTrustMap[sh.id] = sh.baseTrust ?? 60;
    }

    const testTeam: Team = {
      id: 'team-test-1',
      sessionId: 'sess-test',
      name: 'Test Team',
      color: '#00f0ff',
      avatar: '⚡',
      metrics: { ...scenario.baselineMetrics },
      stakeholderTrustMap: initialTrustMap,
      currentRoundDecisions: {
        selectedInitiativeIds: ['init-strangler-core'],
        governancePosture: 'BALANCED_AGILE',
        customPacts: [],
      },
      decisionSubmitted: true,
      history: [],
      activeInitiatives: [],
      nodeHealthOverrides: {},
    };

    const { updatedTeam, roundResult } = SimulationResolver.resolveRound(scenario, testTeam, 1);

    expect(roundResult.roundNumber).toBe(1);
    expect(updatedTeam.history.length).toBe(1);
    expect(updatedTeam.metrics.tco).toBeGreaterThan(testTeam.metrics.tco);
    expect(updatedTeam.metrics.budgetRemaining).toBeLessThan(testTeam.metrics.budgetRemaining);
    expect(updatedTeam.decisionSubmitted).toBe(false); // reset for next round
  });

  it('resolves an injected crisis dynamically overriding scheduled events and recovering nodes', () => {
    const scenario = SEED_SCENARIOS[0];
    const initialTrustMap: Record<string, number> = {};
    for (const sh of scenario.stakeholders) {
      initialTrustMap[sh.id] = sh.baseTrust ?? 60;
    }

    const injectedCrisis = {
      roundNumber: 1,
      title: 'Injected Zero-Day Crisis',
      description: 'Zero-day vulnerability in gateway',
      type: 'CRISIS' as const,
      severity: 'BLACK_SWAN' as const,
      immediateImpact: {
        budgetFine: 150,
        tdiSurge: 12,
        velocityPenalty: 15,
        downedNodeIds: ['node-api-gw'],
      },
      choices: [
        {
          id: 'inj-choice-patch',
          text: 'Apply emergency patch',
          capExImpact: 140,
          tdiImpact: -10,
          velocityImpact: -8,
          trustImpact: { 'sh-ciso': 10 },
          nodeHealthImpacts: { 'node-api-gw': 50 },
        },
      ],
    };

    const testTeam: Team = {
      id: 'team-crisis-1',
      sessionId: 'sess-test',
      name: 'Crisis Test Team',
      color: '#ff0055',
      avatar: '🛡️',
      metrics: { ...scenario.baselineMetrics },
      stakeholderTrustMap: initialTrustMap,
      currentRoundDecisions: {
        selectedInitiativeIds: [],
        governancePosture: 'BALANCED_AGILE',
        eventChoiceId: 'inj-choice-patch',
        customPacts: [],
      },
      decisionSubmitted: true,
      history: [],
      activeInitiatives: [],
      nodeHealthOverrides: {
        'node-api-gw': { health: 15, technicalDebt: 90, status: 'CRITICAL' },
      },
    };

    const { updatedTeam, roundResult } = SimulationResolver.resolveRound(
      scenario,
      testTeam,
      1,
      [injectedCrisis]
    );

    expect(roundResult.roundNumber).toBe(1);
    // Verified choice was resolved
    expect(updatedTeam.nodeHealthOverrides['node-api-gw'].health).toBeGreaterThan(15);
  });
});

describe('Fallback AI Provider', () => {
  const fallback = new FallbackProvider();

  it('generates a full validated scenario from plain text prompt', async () => {
    const scenario = await fallback.generateScenario({
      industry: 'FinTech',
      businessChallenge: 'Decoupling monolithic mainframe payment ledger',
    });

    expect(scenario.title).toBeDefined();
    expect(scenario.topology?.nodes.length).toBeGreaterThanOrEqual(4);
    expect(scenario.stakeholders?.length).toBeGreaterThanOrEqual(2);
    expect(scenario.initiativesCatalog?.length).toBeGreaterThanOrEqual(3);
    expect(scenario.roundEvents?.length).toBe(4);
  });

  it('evaluates stakeholder negotiations with responsive score and dialogue', async () => {
    const result = await fallback.evaluateStakeholderProposal({
      stakeholder: {
        id: 'sh-cfo',
        name: 'Marcus Sterling',
        title: 'CFO',
        role: 'Finance',
        avatar: '💼',
        personality: 'Conservative',
        bias: 'Cost focus',
        hiddenAgenda: 'Protect margin',
        negotiationTolerance: 50,
        baseTrust: 55,
        decisionWeights: { financialAcumen: 0.8, deliverySpeed: 0.1, architecturalRigor: 0.1, regulatoryCompliance: 0 },
        sampleDialogue: { greeting: 'Hi', resistance: 'No', concession: 'Ok' },
      },
      currentTrust: 55,
      chatHistory: [],
      playerMessage: 'We have modeled a solution that will reduce our ongoing maintenance OpEx and protect the quarterly budget.',
      currentRound: 1,
      teamMetrics: { tco: 1500, budgetRemaining: 1000, technicalDebtIndex: 65, deliveryVelocity: 50 },
    });

    expect(result.responseDialogue.length).toBeGreaterThan(10);
    expect(result.evaluation.verdict).toBe('ACCEPTED');
    expect(result.evaluation.financialAcumenScore).toBeGreaterThanOrEqual(70);
    expect(result.evaluation.trustDelta).toBeGreaterThan(0);
  });
});
