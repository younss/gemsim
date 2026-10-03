// ============================================================================
// GEMSIM: SYSTEM ONE STAKEHOLDER JUDGE
// Decides verdict, trust shift and scores for stakeholder negotiations with a
// System One model. The LLM is then only asked to voice the decision.
// ============================================================================

import { ChatMessage, ProposalEvaluation, StakeholderPersona } from '../types/index.js';
import {
  ChoiceAnswer,
  NoulAnswer,
  SystemOneClient,
  SystemOneQuestion,
  ScoreAnswer,
  normalizeScore,
  sampleChoice,
} from './systemone.js';

type Verdict = ProposalEvaluation['verdict'];

export interface JudgeContext {
  stakeholder: StakeholderPersona;
  currentTrust: number;
  chatHistory: ChatMessage[];
  playerMessage: string;
  currentRound: number;
  teamMetrics: Record<string, number>;
  teamDecisions?: string[];
  patience?: number;
  metricLabels?: { debt: string; velocity: string; cash: string };
  isFrench: boolean;
}

const LEVELS_5 = ['None', 'Weak', 'Adequate', 'Strong', 'Excellent'];

function stakeholderQuestions(prefix = ''): Record<string, SystemOneQuestion> {
  return {
    [`${prefix}verdict`]: {
      type: 'choice',
      instructions: "Acting as this stakeholder, given their bias, hidden agenda and current trust, how do they respond to the player's message and to the team's submitted decisions?",
      criteria: {
        ACCEPTED: 'The proposal serves my interests and is credible; I support it.',
        CONDITIONAL_ACCEPTANCE: 'Promising, but I need a concrete, binding commitment before supporting it.',
        REJECTED: 'The proposal threatens my interests, ignores my concerns or lacks substance.',
      },
    },
    [`${prefix}trust_shift`]: {
      type: 'score',
      instructions: "How does this exchange change the stakeholder's trust in the player?",
      criteria: ['Strongly damaged', 'Slightly damaged', 'Unchanged', 'Slightly improved', 'Strongly improved'],
    },
    [`${prefix}empathy`]: {
      type: 'score',
      instructions: "Does the player address this stakeholder's own concerns and incentives?",
      criteria: LEVELS_5,
    },
    [`${prefix}financial_acumen`]: {
      type: 'score',
      instructions: 'How quantified and financially rigorous is the proposal from this stakeholder\'s point of view?',
      criteria: LEVELS_5,
    },
    [`${prefix}strategic_alignment`]: {
      type: 'score',
      instructions: "How well does the proposal fit this stakeholder's strategic priorities and decision weights?",
      criteria: LEVELS_5,
    },
  };
}

// Questions about the message itself, independent of who reads it.
const MESSAGE_QUESTIONS: Record<string, SystemOneQuestion> = {
  low_effort: {
    type: 'noul',
    instructions: 'Is the player message vague, a pressure tactic, or flattery without concrete substance (numbers, commitments, trade-offs)?',
  },
  rehash: {
    type: 'noul',
    instructions: 'Does the player message merely restate one of their previous proposals without adding new facts, numbers or concessions?',
  },
};

/**
 * The player's earlier proposals. Routes save the new message before judging,
 * so the history ends with it: drop that copy or every pitch looks like a rehash.
 * Exported for unit tests.
 */
export function previousProposals(history: ChatMessage[], playerMessage: string): string[] {
  const proposals = history.filter(m => m.sender === 'PLAYER').map(m => m.content);
  if (proposals.length > 0 && proposals[proposals.length - 1].trim() === playerMessage.trim()) proposals.pop();
  return proposals.slice(-3);
}

function personaState(stakeholder: StakeholderPersona, currentTrust: number) {
  return {
    name: stakeholder.name,
    title: stakeholder.title,
    personality: stakeholder.personality,
    bias: stakeholder.bias,
    hiddenAgenda: stakeholder.hiddenAgenda,
    negotiationTolerance: stakeholder.negotiationTolerance,
    decisionWeights: stakeholder.decisionWeights,
    currentTrust,
  };
}

/**
 * Pure mapping from System One answers to a Gemsim ProposalEvaluation.
 * Exported for unit tests.
 */
export function toEvaluation(
  answers: {
    verdict: ChoiceAnswer;
    trust_shift: ScoreAnswer;
    empathy: ScoreAnswer;
    financial_acumen: ScoreAnswer;
    strategic_alignment: ScoreAnswer;
    low_effort: NoulAnswer;
    rehash: NoulAnswer;
  },
  isFrench: boolean,
  rng?: () => number
): ProposalEvaluation {
  const lowEffort = answers.low_effort.noul;
  const rehash = answers.rehash.noul;

  // Substance-free or rehashed pitches shift mass toward rejection.
  const penalty = Math.max(lowEffort, rehash);
  const probs = { ...answers.verdict.probabilities } as Record<Verdict, number>;
  probs.REJECTED = (probs.REJECTED ?? 0) + penalty * 0.6;
  probs.ACCEPTED = (probs.ACCEPTED ?? 0) * (1 - penalty * 0.8);
  const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(probs) as Verdict[]) probs[k] = probs[k] / total;

  const verdict: Verdict = rng
    ? sampleChoice(probs, rng)
    : (Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0] as Verdict);

  // trust_shift expected value 0..4 -> -20..+20, minus up to 10 for empty or rehashed pitches.
  const rawDelta = (answers.trust_shift.score - 2) * 10 - penalty * 10;
  const trustDelta = Math.max(-20, Math.min(20, Math.round(rawDelta)));

  const pct = (a: ScoreAnswer) => Math.round(normalizeScore(a) * 100);
  const reasons: string[] = [];
  if (rehash > 0.6) reasons.push(isFrench ? 'reprise d\'une proposition déjà faite' : 'restates an earlier proposal');
  if (lowEffort > 0.6) reasons.push(isFrench ? 'manque de substance chiffrée' : 'lacks quantified substance');
  if (pct(answers.empathy) >= 65) reasons.push(isFrench ? 'répond à mes enjeux propres' : 'addresses my own concerns');
  if (pct(answers.financial_acumen) >= 65) reasons.push(isFrench ? 'argumentaire financier solide' : 'solid financial case');

  return {
    empathyScore: pct(answers.empathy),
    financialAcumenScore: pct(answers.financial_acumen),
    strategicAlignmentScore: pct(answers.strategic_alignment),
    trustDelta,
    verdict,
    rationale: reasons.length > 0 ? reasons.join(' ; ') : (isFrench ? 'Évaluation System One' : 'System One evaluation'),
    verdictProbabilities: probs,
  };
}

function rngFromEnv(): (() => number) | undefined {
  return process.env.SYSTEMONE_STOCHASTIC === 'true' ? Math.random : undefined;
}

/**
 * Judges a player proposal for one stakeholder. Returns null when System One is
 * unavailable so callers keep the LLM-only path.
 */
export async function judgeProposal(ctx: JudgeContext): Promise<ProposalEvaluation | null> {
  const client = SystemOneClient.getInstance();
  if (!client.isAvailable()) return null;

  try {
    const { answers, latencyMs, model } = await client.decide(
      {
        stakeholder: { ...personaState(ctx.stakeholder, ctx.currentTrust), patienceWithPlayer: ctx.patience ?? 100 },
        company: { round: ctx.currentRound, ...ctx.teamMetrics, metricMeaning: ctx.metricLabels },
        teamDecisions: ctx.teamDecisions ?? [],
        previousPlayerProposals: previousProposals(ctx.chatHistory, ctx.playerMessage),
        playerMessage: ctx.playerMessage,
      },
      { ...stakeholderQuestions(), ...MESSAGE_QUESTIONS }
    );
    const evaluation = toEvaluation(answers as Parameters<typeof toEvaluation>[0], ctx.isFrench, rngFromEnv());
    console.log(`[SystemOne] ${model} judged ${ctx.stakeholder.name}: ${evaluation.verdict} (Δtrust ${evaluation.trustDelta}) in ${latencyMs}ms`);
    return { ...evaluation, decisionEngine: model };
  } catch (err: any) {
    console.warn(`[SystemOne] Judge unavailable, using LLM-only evaluation: ${err.message}`);
    return null;
  }
}

/**
 * Judges a proposal for every board member in a single System One pass
 * (one question set per stakeholder, shared message questions).
 */
export async function judgeBoard(
  stakeholders: StakeholderPersona[],
  trustMap: Record<string, number>,
  ctx: Omit<JudgeContext, 'stakeholder' | 'currentTrust'>
): Promise<Record<string, ProposalEvaluation> | null> {
  const client = SystemOneClient.getInstance();
  if (!client.isAvailable() || stakeholders.length === 0) return null;

  const questions: Record<string, SystemOneQuestion> = { ...MESSAGE_QUESTIONS };
  stakeholders.forEach((sh, i) => {
    for (const [id, q] of Object.entries(stakeholderQuestions(`s${i}_`))) {
      questions[id] = { ...q, instructions: `[Stakeholder s${i}: ${sh.name}] ${q.instructions}` };
    }
  });

  try {
    const { answers, latencyMs, model } = await client.decide(
      {
        boardMembers: Object.fromEntries(
          stakeholders.map((sh, i) => [`s${i}`, personaState(sh, trustMap[sh.id] ?? sh.baseTrust ?? 60)])
        ),
        company: { round: ctx.currentRound, ...ctx.teamMetrics, metricMeaning: ctx.metricLabels },
        teamDecisions: ctx.teamDecisions ?? [],
        previousPlayerProposals: previousProposals(ctx.chatHistory, ctx.playerMessage),
        playerMessage: ctx.playerMessage,
      },
      questions
    );

    const a = answers as Record<string, any>;
    const rng = rngFromEnv();
    const result: Record<string, ProposalEvaluation> = {};
    stakeholders.forEach((sh, i) => {
      const p = `s${i}_`;
      result[sh.id] = {
        ...toEvaluation(
          {
            verdict: a[`${p}verdict`],
            trust_shift: a[`${p}trust_shift`],
            empathy: a[`${p}empathy`],
            financial_acumen: a[`${p}financial_acumen`],
            strategic_alignment: a[`${p}strategic_alignment`],
            low_effort: a.low_effort,
            rehash: a.rehash,
          },
          ctx.isFrench,
          rng
        ),
        decisionEngine: model,
      };
    });
    console.log(`[SystemOne] ${model} judged a ${stakeholders.length}-member board in ${latencyMs}ms`);
    return result;
  } catch (err: any) {
    console.warn(`[SystemOne] Board judge unavailable, using LLM-only deliberation: ${err.message}`);
    return null;
  }
}

/**
 * Keeps System One's decision (verdict, scores, trust) authoritative and the
 * LLM's wording (rationale, concession) when it produced one.
 */
export function mergeDecision(llmEvaluation: ProposalEvaluation | undefined, decision: ProposalEvaluation): ProposalEvaluation {
  return {
    ...decision,
    rationale: llmEvaluation?.rationale || decision.rationale,
    concessionRequired: llmEvaluation?.concessionRequired ?? decision.concessionRequired,
  };
}
