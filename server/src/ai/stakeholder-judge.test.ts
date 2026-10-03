import assert from 'node:assert';
import { describe, it } from 'vitest';
import { toEvaluation } from './stakeholder-judge.js';
import { sampleChoice, ScoreAnswer } from './systemone.js';

const score = (value: number): ScoreAnswer => ({
  type: 'score',
  score: value,
  confidence: 0.5,
  legend: { '0': 'a', '1': 'b', '2': 'c', '3': 'd', '4': 'e' },
  probabilities: {},
});

const answers = (over: { verdict?: Record<string, number>; trust?: number; lowEffort?: number; rehash?: number } = {}) => ({
  verdict: {
    type: 'choice' as const,
    choice: 'ACCEPTED',
    confidence: 0.5,
    probabilities: over.verdict ?? { ACCEPTED: 0.6, CONDITIONAL_ACCEPTANCE: 0.3, REJECTED: 0.1 },
  },
  trust_shift: score(over.trust ?? 3),
  empathy: score(3),
  financial_acumen: score(2),
  strategic_alignment: score(4),
  low_effort: { type: 'noul' as const, noul: over.lowEffort ?? 0.05 },
  rehash: { type: 'noul' as const, noul: over.rehash ?? 0.05 },
});

describe('System One stakeholder judge', () => {
  it('maps a substantive proposal to the top verdict, trust delta and 0-100 scores', () => {
    const e = toEvaluation(answers(), false);
    assert.strictEqual(e.verdict, 'ACCEPTED');
    assert.strictEqual(e.trustDelta, 10);
    assert.strictEqual(e.empathyScore, 75);
    assert.strictEqual(e.strategicAlignmentScore, 100);
  });

  it('pushes empty or rehashed pitches toward rejection and negative trust', () => {
    const e = toEvaluation(answers({ lowEffort: 0.9, trust: 2 }), true);
    assert.strictEqual(e.verdict, 'REJECTED');
    assert.ok(e.trustDelta < 0);
    assert.match(e.rationale, /substance/);
  });

  it('keeps the trust delta within -20..+20', () => {
    assert.strictEqual(toEvaluation(answers({ trust: 4 }), false).trustDelta, 20);
    assert.strictEqual(toEvaluation(answers({ trust: 0, rehash: 1 }), false).trustDelta, -20);
  });

  it('samples verdicts from the distribution when an rng is given', () => {
    assert.strictEqual(sampleChoice({ a: 0.2, b: 0.8 }, () => 0.1), 'a');
    assert.strictEqual(sampleChoice({ a: 0.2, b: 0.8 }, () => 0.5), 'b');
    assert.strictEqual(toEvaluation(answers(), false, () => 0.99).verdict, 'REJECTED');
  });
});

describe('Fallback provider with a System One decision', () => {
  it('voices the decided verdict instead of its own heuristic', async () => {
    const { FallbackProvider } = await import('./fallback.js');
    const { SEED_SCENARIOS } = await import('../db/seeds.js');
    const stakeholder = SEED_SCENARIOS[0].stakeholders[0];
    const decision = { ...toEvaluation(answers({ lowEffort: 0.95 }), false) };
    const res = await new FallbackProvider().evaluateStakeholderProposal({
      stakeholder,
      currentTrust: 50,
      chatHistory: [],
      playerMessage: 'We should collaborate together on a shared roadmap',
      currentRound: 1,
      teamMetrics: { tco: 0, budgetRemaining: 1000, technicalDebtIndex: 50, deliveryVelocity: 50 },
      decision,
    });
    assert.strictEqual(res.evaluation.verdict, 'REJECTED');
    assert.strictEqual(res.responseDialogue, stakeholder.sampleDialogue.resistance);
  });
});

describe('previousProposals', () => {
  const msg = (content: string) => ({ id: content, sender: 'PLAYER' as const, senderName: 'p', content, timestamp: '' });
  it('drops the just-saved current message but keeps genuine earlier repeats', async () => {
    const { previousProposals } = await import('./stakeholder-judge.js');
    assert.deepStrictEqual(previousProposals([msg('pitch A')], 'pitch A'), []);
    assert.deepStrictEqual(previousProposals([msg('pitch A'), msg('pitch A')], 'pitch A'), ['pitch A']);
    assert.deepStrictEqual(previousProposals([msg('old'), msg('new')], 'new'), ['old']);
  });
});
