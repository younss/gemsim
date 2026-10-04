// ============================================================================
// GEMSIM STUDIO: SYSTEM 1 — THE JUDGE
// Clef reads each element the author wrote and classifies it in closed
// categories (one forward pass, typed answers with probabilities). Where it is
// confident, its judgment wins over the author's own tag; where it hesitates,
// the author's tag stays and the element is flagged for review. Without System 1
// the author's tags are used as they are.
// ============================================================================

import { SystemOneClient, normalizeScore, type ChoiceAnswer, type NoulAnswer, type ScoreAnswer, type SystemOneQuestion } from '../ai/systemone.js';
import type { AnswerKind, CaseDraft, InitiativeKind, Level, Size } from './draft.js';
import type { ReviewItem } from './report.js';

/** Above this confidence, System 1 overrides the author's tag. */
export const CONFIDENT = 0.7;
const BATCH = 10; // questions per System 1 pass
const STUDIO_TIMEOUT_MS = 120000; // the Studio can wait: the model may be busy (translation, generation)

export interface Judgment {
  engine: string; // System 1 model, or 'author-tags' without it
  answerKinds: Record<string, AnswerKind>; // answer id -> kind
  initiativeKinds: Record<string, InitiativeKind>;
  initiativeSizes: Record<string, Size>;
  trapScores: Record<string, number>; // System 1's belief that an initiative is a trap (0..1)
  priorities: Record<string, { financialAcumen: number; deliverySpeed: number; architecturalRigor: number; regulatoryCompliance: number }>; // 0..1 each
  startingState: CaseDraft['startingState'];
  review: ReviewItem[];
}

const ANSWER_CRITERIA: Record<AnswerKind, string> = {
  QUICK_FIX: 'a fast, cheap patch or workaround that leaves the root cause in place',
  LASTING: 'a slower, costlier answer that fixes the root cause durably',
  AVOIDANCE: 'ignoring, postponing, denying or hiding the problem',
};

// Initiatives are judged with three yes/no questions rather than one abstract 4-way choice
const INITIATIVE_QUESTIONS = {
  trap: 'Is this initiative a shortcut that brings speed or savings now but creates risk, debt, unrest or non-compliance later?',
  quick: 'Is this initiative mainly a fast, visible gain with little lasting effect?',
  long: 'Does delivering this initiative take more than one quarter (several months of deep change across the organisation)?',
};

/** Kind from the three answers, with the confidence of the deciding answer (0..1). */
function initiativeKind(p: { trap: number; quick: number; long: number }): { kind: InitiativeKind; confidence: number } {
  const sure = (x: number) => Math.abs(x - 0.5) * 2;
  if (p.trap > 0.5) return { kind: 'TRAP', confidence: sure(p.trap) };
  if (p.quick > 0.5) return { kind: 'QUICK_WIN', confidence: sure(p.quick) };
  if (p.long > 0.6) return { kind: 'TRANSFORMATION', confidence: sure(p.long) };
  return { kind: 'IMPROVEMENT', confidence: Math.min(sure(p.trap), sure(p.quick), sure(p.long)) };
}

const SCALE = ['not at all', 'a little', 'moderately', 'strongly', 'above everything'];
const SEVERITY = ['very light', 'light', 'significant', 'heavy', 'critical'];

const PRIORITIES = {
  financialAcumen: 'financial results, costs and return on investment',
  deliverySpeed: 'speed of delivery, growth and visible results',
  architecturalRigor: 'robust, well-designed and sustainable operations',
  regulatoryCompliance: 'compliance, safety, regulation and reputation',
} as const;

function levelFromSeverity(score: ScoreAnswer): Level {
  const v = normalizeScore(score); // 0..1
  return v < 0.3 ? 'LOW' : v < 0.55 ? 'MODERATE' : v < 0.8 ? 'HIGH' : 'SEVERE';
}

/** The author's tags, used as they are (System 1 unavailable). */
export function authorJudgment(draft: CaseDraft): Judgment {
  const priorities: Judgment['priorities'] = {};
  const level = { LOW: 0.2, MEDIUM: 0.5, HIGH: 0.9 };
  draft.stakeholders.forEach((s, i) => {
    if (s.priorities) {
      // The author's own view of each executive
      priorities[s.id] = {
        financialAcumen: level[s.priorities.finance],
        deliverySpeed: level[s.priorities.speed],
        architecturalRigor: level[s.priorities.rigour],
        regulatoryCompliance: level[s.priorities.compliance],
      };
      return;
    }
    // Nothing to go on: spread priorities so that executives disagree
    const order = ['financialAcumen', 'deliverySpeed', 'architecturalRigor', 'regulatoryCompliance'] as const;
    const main = order[i % 4];
    priorities[s.id] = { financialAcumen: 0.3, deliverySpeed: 0.3, architecturalRigor: 0.3, regulatoryCompliance: 0.3, [main]: 0.9 };
  });
  return {
    engine: 'author-tags',
    answerKinds: Object.fromEntries(draft.crises.flatMap(c => c.answers.map(a => [a.id, a.kind]))),
    initiativeKinds: Object.fromEntries(draft.initiatives.map(i => [i.id, i.kind])),
    initiativeSizes: Object.fromEntries(draft.initiatives.map(i => [i.id, i.size])),
    trapScores: {},
    priorities,
    startingState: draft.startingState,
    review: [],
  };
}

export async function judgeDraft(draft: CaseDraft): Promise<Judgment> {
  const client = SystemOneClient.getInstance();
  const fallback = authorJudgment(draft);
  if (!client.isAvailable()) return fallback;

  const questions: Record<string, SystemOneQuestion> = {};
  draft.crises.forEach((c, i) =>
    c.answers.forEach((a, j) => {
      questions[`a_${i}_${j}`] = {
        type: 'choice',
        instructions: `Crisis "${c.title}": ${c.description}\nClassify this answer to the crisis: "${a.text}"`,
        criteria: ANSWER_CRITERIA,
      };
    })
  );
  draft.initiatives.forEach((it, i) => {
    for (const [key, q] of Object.entries(INITIATIVE_QUESTIONS)) {
      questions[`i_${i}_${key}`] = { type: 'noul', instructions: `Initiative: "${it.name}" — ${it.description}\n${q}` };
    }
    questions[`s_${i}`] = { type: 'score', instructions: `How large is the effort and impact of this initiative: "${it.name}" — ${it.description}`, criteria: ['small', 'medium', 'large'] };
  });
  draft.stakeholders.forEach((s, i) => {
    for (const [key, what] of Object.entries(PRIORITIES)) {
      questions[`p_${i}_${key}`] = {
        type: 'score',
        instructions: `${s.name}, ${s.title}. Role: ${s.role}. Personality: ${s.personality}. Bias: ${s.bias}. Hidden agenda: ${s.hiddenAgenda}.\nHow much does this person weigh ${what} when judging a proposal?`,
        criteria: SCALE,
      };
    }
  });
  const context = `${draft.title}. ${draft.businessContext}`;
  const stateQuestions: Record<keyof CaseDraft['startingState'], string> = {
    debt: 'How heavily do accumulated debt, ageing assets or underinvestment weigh on the organisation today?',
    capacity: 'How weak is the organisation’s current capacity to deliver (critical = almost nothing can be delivered)?',
    resilience: 'How fragile is the organisation in the face of incidents and shocks?',
    compliance: 'How serious are its compliance, safety or regulatory problems?',
    cash: 'How tight is the money available for the programme (critical = almost none)?',
  };
  for (const [key, q] of Object.entries(stateQuestions)) questions[`st_${key}`] = { type: 'score', instructions: `${context}\n${q}`, criteria: SEVERITY };

  // Several small passes rather than one huge one; a batch that fails twice leaves its
  // elements to the author's tags instead of discarding the whole judgment
  const keys = Object.keys(questions);
  const a: Record<string, ChoiceAnswer | ScoreAnswer | NoulAnswer> = {};
  let model = '';
  let failed = 0;
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = Object.fromEntries(keys.slice(i, i + BATCH).map(k => [k, questions[k]]));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await client.decide({ case: draft.title, industry: draft.industry, context: draft.businessContext }, batch, { timeoutMs: STUDIO_TIMEOUT_MS });
        Object.assign(a, result.answers);
        model = result.model;
        break;
      } catch (err: any) {
        if (attempt === 1) {
          failed++;
          console.warn(`[Studio] System 1 batch skipped (${err.message})`);
        }
      }
    }
  }
  if (!model) return fallback;

  const review: Judgment['review'] = [];
  const arbitrate = <K extends string>(element: string, author: K, judge: K, confidence: number): K => {
    if (judge === author) return author;
    const kept = confidence >= CONFIDENT ? 'judge' : 'author';
    review.push({ element, author, judge, confidence: Math.round(confidence * 100) / 100, kept });
    return kept === 'judge' ? judge : author;
  };

  const answerKinds: Judgment['answerKinds'] = { ...fallback.answerKinds };
  draft.crises.forEach((c, i) =>
    c.answers.forEach((ans, j) => {
      const judged = a[`a_${i}_${j}`] as ChoiceAnswer | undefined;
      if (judged) answerKinds[ans.id] = arbitrate(`${c.title} → ${ans.text}`, ans.kind, judged.choice as AnswerKind, judged.confidence);
    })
  );

  const initiativeKinds: Judgment['initiativeKinds'] = { ...fallback.initiativeKinds };
  const initiativeSizes: Judgment['initiativeSizes'] = { ...fallback.initiativeSizes };
  const trapScores: Judgment['trapScores'] = {};
  draft.initiatives.forEach((it, i) => {
    const answers = ['trap', 'quick', 'long'].map(k => a[`i_${i}_${k}`] as NoulAnswer | undefined);
    if (answers.every(Boolean)) {
      const [trap, quick, long] = answers.map(x => x!.noul);
      trapScores[it.id] = trap;
      const judged = initiativeKind({ trap, quick, long });
      initiativeKinds[it.id] = arbitrate(it.name, it.kind, judged.kind, judged.confidence);
    }
    const size = a[`s_${i}`] as ScoreAnswer | undefined;
    if (size) {
      const v = normalizeScore(size);
      initiativeSizes[it.id] = v < 0.34 ? 'SMALL' : v < 0.67 ? 'MEDIUM' : 'LARGE';
    }
  });

  const priorities: Judgment['priorities'] = { ...fallback.priorities };
  draft.stakeholders.forEach((s, i) => {
    const scores = Object.keys(PRIORITIES).map(key => a[`p_${i}_${key}`] as ScoreAnswer | undefined);
    if (scores.every(Boolean)) {
      priorities[s.id] = Object.fromEntries(Object.keys(PRIORITIES).map((key, k) => [key, normalizeScore(scores[k]!)])) as Judgment['priorities'][string];
    }
  });

  const startingState = { ...fallback.startingState };
  for (const key of Object.keys(stateQuestions) as Array<keyof CaseDraft['startingState']>) {
    const score = a[`st_${key}`] as ScoreAnswer | undefined;
    if (score) startingState[key] = levelFromSeverity(score);
  }

  return { engine: failed ? `${model} (partial)` : model, answerKinds, initiativeKinds, initiativeSizes, trapScores, priorities, startingState, review };
}
