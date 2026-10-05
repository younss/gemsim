import { describe, it, expect } from 'vitest';
import { emulationPrompt, parseEmulation, normalizeScore, type SystemOneQuestion } from '../src/ai/systemone.js';

const QUESTIONS = {
  verdict: { type: 'choice', instructions: 'Reaction?', criteria: { YES: 'Accepts', NO: 'Rejects' } },
  effort: { type: 'score', instructions: 'Effort?', criteria: ['Low', 'Medium', 'High'] },
  concession: { type: 'noul', instructions: 'Trade-off?' },
} satisfies Record<string, SystemOneQuestion>;

describe('System 1 emulated by a general LLM', () => {
  it('asks every question with the expected JSON shape', () => {
    const { system, user } = emulationPrompt('A proposal.', QUESTIONS);
    expect(system).toContain('"verdict":{"YES":0,"NO":0}');
    expect(system).toContain('"effort":{"0":0,"1":0,"2":0}');
    expect(user).toContain('YES = Accepts');
    expect(user).toContain('2 = High');
  });

  it('turns probabilities into System 1 answers', () => {
    const a = parseEmulation({ verdict: { YES: 0.2, NO: 0.6 }, effort: { '0': 0, '1': 0.5, '2': 0.5 }, concession: 0.8 }, QUESTIONS);
    expect(a.verdict.choice).toBe('NO');
    expect(a.verdict.confidence).toBeCloseTo(0.75); // normalised: 0.6 / 0.8
    expect(normalizeScore(a.effort)).toBeCloseTo(0.75);
    expect(a.concession.noul).toBe(0.8);
  });

  it('copes with loose answers', () => {
    const a = parseEmulation({ verdict: 'YES', effort: 2, concession: true }, QUESTIONS);
    expect(a.verdict).toMatchObject({ choice: 'YES', confidence: 1 });
    expect(a.effort.score).toBe(2);
    expect(a.concession.noul).toBe(1);
    const empty = parseEmulation({}, QUESTIONS);
    expect(empty.verdict.probabilities).toEqual({ YES: 0.5, NO: 0.5 });
    expect(empty.concession.noul).toBe(0.5);
  });
});

describe('Negotiation reply language', () => {
  it("follows the player's interface language, the message only without it", async () => {
    const { replyInFrench } = await import('../src/routes/ai.js');
    expect(replyInFrench('en', 'Nous proposons un budget de 300 K€')).toBe(false);
    expect(replyInFrench('fr', 'We propose a 300K budget')).toBe(true);
    // English words that used to trigger French ("budget", "architecture")
    expect(replyInFrench(undefined, 'Our budget covers the architecture work')).toBe(false);
    expect(replyInFrench(undefined, 'Nous proposons un plan pour la marge')).toBe(true);
  });
});
