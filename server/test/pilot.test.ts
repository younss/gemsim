import { describe, it, expect } from 'vitest';
import { PILOT_QUIZ, PILOT_SATISFACTION, pilotResults, quizScore } from '../src/engine/pilot.js';
import { viewerReplacer } from '../src/auth.js';
import { pilotResponseSchema } from '../src/validation.js';
import { PilotResponse } from '../src/types/index.js';

const right = PILOT_QUIZ.map(q => q.answer);
const wrong = PILOT_QUIZ.map(q => (q.answer + 1) % q.options.length);
const mixed = (n: number) => PILOT_QUIZ.map((q, i) => (i < n ? q.answer : (q.answer + 1) % q.options.length));

let k = 0;
const response = (teamId: string, phase: 'PRE' | 'POST', answers: number[], extra: Partial<PilotResponse> = {}): PilotResponse => ({
  id: `r${k++}`, teamId, phase, respondentId: `resp-${k}`, answers, submittedAt: '', ...extra,
});

const teams = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }] as any;

describe('Pilot questionnaire', () => {
  it('has the 7 questions and 5 satisfaction items of the protocol, in both languages', () => {
    expect(PILOT_QUIZ).toHaveLength(7);
    expect(PILOT_SATISFACTION).toHaveLength(5);
    for (const q of PILOT_QUIZ) {
      expect(q.text.fr && q.text.en).toBeTruthy();
      expect(q.options.every(o => o.fr && o.en)).toBe(true);
      expect(q.answer).toBeLessThan(q.options.length);
    }
    expect(quizScore(right)).toBe(7);
    expect(quizScore(wrong)).toBe(0);
    expect(quizScore(PILOT_QUIZ.map(() => -1))).toBe(0);
  });

  it('measures the learning gain and checks the success criteria', () => {
    const responses = [
      response('a', 'PRE', mixed(3)), response('a', 'PRE', mixed(4)), response('b', 'PRE', mixed(2)),
      response('a', 'POST', mixed(6), { satisfaction: [5, 4, 4, 5, 5], lesson: 'Finir les chantiers avant d’en ouvrir', hindrance: 'Le minuteur' }),
      response('a', 'POST', mixed(7), { satisfaction: [4, 4, 3, 4, 4], lesson: 'Préparer le conseil en individuel' }),
      response('b', 'POST', mixed(5), { satisfaction: [4, 5, 4, 4, 5] }),
    ];
    const r = pilotResults({ teams, pilot: { preOpen: false, postOpen: false, responses } });
    expect(r.counts).toEqual({ pre: 3, post: 3 });
    expect(r.score.pre).toBe(3);
    expect(r.score.post).toBe(6);
    expect(r.score.gain).toBe(3);
    expect(r.score.normalizedGain).toBe(0.75); // 3 points gained out of 4 possible
    expect(r.questions[0]).toEqual({ id: 'q1-debt', pre: 1, post: 1 });
    expect(r.questions[6].pre).toBe(0);
    expect(r.teams.find(t => t.teamId === 'a')).toMatchObject({ pre: 3.5, post: 6.5, n: { pre: 2, post: 2 } });
    expect(r.satisfaction[0]).toEqual({ id: 's1-rules', mean: 4.33, n: 3 });
    expect(r.lessons).toHaveLength(2);
    expect(r.hindrances).toEqual(['Le minuteur']);
    expect(r.criteria).toEqual({ gain: true, clarity: true, lessons: false }); // 2 of 3 cite a lesson (< 70 %)
  });

  it('reports nothing it cannot measure yet', () => {
    const r = pilotResults({ teams, pilot: { preOpen: true, postOpen: false, responses: [response('a', 'PRE', right)] } });
    expect(r.score.gain).toBeNull();
    expect(r.criteria).toEqual({ gain: null, clarity: null, lessons: null });
  });

  it('players never receive the answers', () => {
    const session = { id: 's', teams: [], pilot: { preOpen: true, postOpen: false, responses: [response('a', 'PRE', right)] } };
    const seen = JSON.parse(JSON.stringify(session, viewerReplacer('a')));
    expect(seen.pilot).toEqual({ preOpen: true, postOpen: false, responses: [] });
  });

  it('validates submitted answers', () => {
    const ok = pilotResponseSchema.safeParse({ teamId: 'a', phase: 'POST', respondentId: 'abcdefgh12', answers: right, satisfaction: [5, 4, 4, 5, 5], lesson: 'x' });
    expect(ok.success).toBe(true);
    expect(pilotResponseSchema.safeParse({ teamId: 'a', phase: 'POST', respondentId: 'abcdefgh12', answers: right, satisfaction: [6] }).success).toBe(false);
    expect(pilotResponseSchema.safeParse({ teamId: 'a', phase: 'LATER', respondentId: 'abcdefgh12', answers: right }).success).toBe(false);
  });
});
