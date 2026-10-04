// ============================================================================
// GEMSIM: PILOT QUESTIONNAIRES
// The pilot protocol of the facilitator kit, in the app: the same 7-question
// knowledge quiz before and after the workshop, a 1-5 satisfaction scale and two
// open questions after it. Responses are anonymous and attached to a team only.
// Scoring, learning gain and the protocol's success criteria are computed here.
// Pure module with type-only imports (shared with the client).
// ============================================================================

import type { PilotPhase, PilotResponse, SimulationSession } from '../types/index.js';

type Text = { fr: string; en: string };

export interface QuizQuestion {
  id: string;
  text: Text;
  options: Text[];
  answer: number; // index of the correct option
}

export const PILOT_QUIZ: QuizQuestion[] = [
  {
    id: 'q1-debt',
    text: { fr: 'Une dette technique (ou industrielle) qui n’est pas remboursée…', en: 'Technical (or industrial) debt that is not paid back…' },
    options: [
      { fr: 'reste stable', en: 'stays stable' },
      { fr: 'augmente avec le temps', en: 'grows over time' },
      { fr: 'disparaît à la mise en production', en: 'disappears once in production' },
    ],
    answer: 1,
  },
  {
    id: 'q2-run',
    text: { fr: 'Baisser les coûts récurrents d’exploitation sert surtout à…', en: 'Lowering recurring run costs mainly serves to…' },
    options: [
      { fr: 'améliorer la marge du trimestre', en: 'improve the quarter’s margin' },
      { fr: 'libérer de la capacité d’investissement', en: 'free up capacity to invest' },
      { fr: 'rien, c’est un autre budget', en: 'nothing, it is another budget' },
    ],
    answer: 1,
  },
  {
    id: 'q3-shortcut',
    text: { fr: 'Contourner les contrôles qualité pour livrer plus vite produit…', en: 'Bypassing quality controls to deliver faster produces…' },
    options: [
      { fr: 'un gain durable', en: 'a lasting gain' },
      { fr: 'un gain immédiat puis un coût croissant', en: 'an immediate gain, then a growing cost' },
      { fr: 'aucun effet', en: 'no effect' },
    ],
    answer: 1,
  },
  {
    id: 'q4-committee',
    text: { fr: 'Avant de présenter une stratégie à un comité, il est préférable de…', en: 'Before presenting a strategy to a committee, it is better to…' },
    options: [
      { fr: 'convaincre le plus haut placé', en: 'convince the most senior member' },
      { fr: 'comprendre les intérêts de chaque membre', en: 'understand each member’s interests' },
      { fr: 'préparer plus de diapositives', en: 'prepare more slides' },
    ],
    answer: 1,
  },
  {
    id: 'q5-concession',
    text: { fr: 'Un décideur qui exige une concession…', en: 'An executive who demands a concession…' },
    options: [
      { fr: 'bloque la négociation', en: 'blocks the negotiation' },
      { fr: 'ouvre un échange : la concession peut être monnayée', en: 'opens an exchange: the concession can be traded' },
      { fr: 'doit être contourné', en: 'must be bypassed' },
    ],
    answer: 1,
  },
  {
    id: 'q6-crisis',
    text: { fr: 'Face à une crise, la réponse la moins chère est…', en: 'In a crisis, the cheapest answer is…' },
    options: [
      { fr: 'toujours la meilleure', en: 'always the best' },
      { fr: 'à comparer au coût du risque et de la confiance perdue', en: 'to be weighed against the cost of risk and lost trust' },
      { fr: 'à éviter', en: 'to be avoided' },
    ],
    answer: 1,
  },
  {
    id: 'q7-focus',
    text: { fr: 'Moderniser un peu partout plutôt que finir quelques chantiers…', en: 'Modernising a little everywhere rather than finishing a few projects…' },
    options: [
      { fr: 'disperse les gains', en: 'scatters the gains' },
      { fr: 'maximise les gains', en: 'maximises the gains' },
      { fr: 'n’a pas d’effet', en: 'has no effect' },
    ],
    answer: 0,
  },
];

export const PILOT_SATISFACTION: Array<{ id: string; text: Text }> = [
  { id: 's1-rules', text: { fr: 'Les règles étaient claires.', en: 'The rules were clear.' } },
  { id: 's2-vocabulary', text: { fr: 'Le vocabulaire était compréhensible sans connaissances techniques.', en: 'The vocabulary was understandable without technical knowledge.' } },
  { id: 's3-executives', text: { fr: 'Les décideurs IA étaient crédibles.', en: 'The AI executives were credible.' } },
  { id: 's4-learning', text: { fr: 'J’ai appris quelque chose d’applicable à mon travail.', en: 'I learnt something I can apply in my work.' } },
  { id: 's5-recommend', text: { fr: 'Je recommanderais cet atelier.', en: 'I would recommend this workshop.' } },
];

/** The protocol's success thresholds. */
export const PILOT_CRITERIA = { gain: 2, clarity: 4, lessonShare: 0.7 };

export function quizScore(answers: number[]): number {
  return PILOT_QUIZ.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0);
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

export interface PilotResults {
  counts: { pre: number; post: number };
  score: { pre: number | null; post: number | null; gain: number | null; normalizedGain: number | null }; // out of 7; normalized = (post-pre)/(7-pre)
  questions: Array<{ id: string; pre: number | null; post: number | null }>; // share of correct answers (0-1)
  teams: Array<{ teamId: string; teamName: string; pre: number | null; post: number | null; n: { pre: number; post: number } }>;
  satisfaction: Array<{ id: string; mean: number | null; n: number }>;
  hindrances: string[];
  lessons: string[];
  criteria: { gain: boolean | null; clarity: boolean | null; lessons: boolean | null };
}

export function pilotResults(session: Pick<SimulationSession, 'teams' | 'pilot'>): PilotResults {
  const responses = session.pilot?.responses ?? [];
  const of = (phase: PilotPhase) => responses.filter(r => r.phase === phase);
  const pre = of('PRE');
  const post = of('POST');
  const preScore = mean(pre.map(r => quizScore(r.answers)));
  const postScore = mean(post.map(r => quizScore(r.answers)));
  const gain = preScore !== null && postScore !== null ? Math.round((postScore - preScore) * 100) / 100 : null;
  const normalizedGain = gain !== null && preScore !== null && preScore < PILOT_QUIZ.length ? Math.round((gain / (PILOT_QUIZ.length - preScore)) * 100) / 100 : null;

  const share = (rs: PilotResponse[], i: number) =>
    rs.length ? Math.round((rs.filter(r => r.answers[i] === PILOT_QUIZ[i].answer).length / rs.length) * 100) / 100 : null;

  const satisfaction = PILOT_SATISFACTION.map((item, i) => {
    const values = post.map(r => r.satisfaction?.[i]).filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);
    return { id: item.id, mean: mean(values), n: values.length };
  });
  const clarity = [satisfaction[0].mean, satisfaction[1].mean].filter((v): v is number => v !== null);
  const lessons = post.map(r => r.lesson?.trim() ?? '').filter(Boolean);

  return {
    counts: { pre: pre.length, post: post.length },
    score: { pre: preScore, post: postScore, gain, normalizedGain },
    questions: PILOT_QUIZ.map((q, i) => ({ id: q.id, pre: share(pre, i), post: share(post, i) })),
    teams: session.teams.map(t => {
      const tp = pre.filter(r => r.teamId === t.id);
      const tq = post.filter(r => r.teamId === t.id);
      return { teamId: t.id, teamName: t.name, pre: mean(tp.map(r => quizScore(r.answers))), post: mean(tq.map(r => quizScore(r.answers))), n: { pre: tp.length, post: tq.length } };
    }),
    satisfaction,
    hindrances: post.map(r => r.hindrance?.trim() ?? '').filter(Boolean),
    lessons,
    criteria: {
      gain: gain === null ? null : gain >= PILOT_CRITERIA.gain,
      clarity: clarity.length < 2 ? null : clarity.every(v => v >= PILOT_CRITERIA.clarity),
      lessons: post.length ? lessons.length / post.length >= PILOT_CRITERIA.lessonShare : null,
    },
  };
}
