// ============================================================================
// GEMSIM STUDIO: AUTHORING PIPELINE
//   ① System 2 (LLM) writes the case and qualifies each element
//   ② System 1 (Clef) judges the qualifications from the text
//   ③ The engine turns them into numbers and completes the structure
//   ④ The engine plays the case and calibrates its difficulty
// The LLM never sets an effect number; the engine never writes prose.
// ============================================================================

import { AIRegistry } from '../ai/registry.js';
import { getAITimeout } from '../ai/timeout.js';
import { sanitizeAndParseJSON } from '../ai/repair-loop.js';
import type { ScenarioGenerationPrompt } from '../ai/types.js';
import type { Scenario } from '../types/index.js';
import { authorSystemPrompt, authorUserPrompt, briefLanguage, completionPrompt, missingParts, sanitizeDraft, type CaseDraft } from './draft.js';
import { judgeDraft } from './judge.js';
import { quantify } from './quantify.js';
import { calibrateDifficulty } from './difficulty.js';
import type { PipelineReport } from './report.js';

export type PipelineStage = 'writing' | 'completing' | 'judging' | 'quantifying' | 'calibrating';

export type { PipelineReport } from './report.js';

export class NoAuthorError extends Error {
  constructor() {
    super('No AI model is available to write the case.');
    this.name = 'NoAuthorError';
  }
}

const MAX_COMPLETIONS = 2;

/** The author's JSON, also when it is wrapped in another object ({ "case": {...} }). */
function parse(raw: unknown): any {
  let value: any;
  try {
    value = sanitizeAndParseJSON<any>(String(raw));
  } catch {
    return {};
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && !value.nodes && !value.initiatives) {
    const inner = Object.values(value).find((v: any) => v && typeof v === 'object' && (v.nodes || v.initiatives || v.crises));
    if (inner) return inner;
  }
  return value ?? {};
}

export async function runAuthoringPipeline(
  prompt: ScenarioGenerationPrompt,
  events: { onStage?: (stage: PipelineStage, detail?: string) => void; onChunk?: (text: string) => void } = {}
): Promise<{ scenario: Scenario; report: PipelineReport }> {
  const registry = AIRegistry.getInstance();
  const domain = prompt.domain ?? 'IT';
  const withMarket = !!prompt.withMarket;
  const rounds = Math.max(1, Math.min(4, prompt.rounds ?? 4));
  // The brief's language is authoritative: the model is told, and its own guess is not kept
  const language = briefLanguage(prompt.businessChallenge);
  const options = { temperature: 0.5, maxTokens: 8000, responseFormat: 'json' as const, timeoutMs: getAITimeout('STUDIO'), reasoning: false };

  // ① System 2 writes
  events.onStage?.('writing');
  const { result: raw, usedProvider } = await registry.executeWithFallback(provider =>
    provider.generateStream(
      [
        { role: 'system', content: authorSystemPrompt(domain, withMarket, rounds, language) },
        { role: 'user', content: authorUserPrompt(prompt) },
      ],
      chunk => events.onChunk?.(chunk),
      options
    )
  );
  if (usedProvider === 'fallback') throw new NoAuthorError();
  let draft: CaseDraft = { ...sanitizeDraft(parse(raw), language), language };

  // An unusable answer (truncated or off-format JSON): write it again once, without streaming
  if (!draft.nodes.length && !draft.crises.length && !draft.initiatives.length) {
    console.warn(`[Studio] Unusable draft (${String(raw).length} chars: ${String(raw).slice(0, 160)}…), writing again`);
    events.onStage?.('writing', 'retry');
    const { result } = await registry.executeWithFallback(provider =>
      provider.generateJSON<any>(
        [
          { role: 'system', content: authorSystemPrompt(domain, withMarket, rounds, language) },
          { role: 'user', content: authorUserPrompt(prompt) },
        ],
        options
      )
    );
    draft = { ...sanitizeDraft(result, language), language };
  }

  // Completion: ask again only for what is missing
  const completions: string[][] = [];
  for (let i = 0; i < MAX_COMPLETIONS; i++) {
    const missing = missingParts(draft, withMarket, rounds);
    if (!missing.length) break;
    completions.push(missing);
    events.onStage?.('completing', missing.join('; '));
    try {
      const { result } = await registry.executeWithFallback(provider =>
        provider.generateJSON<any>(
          [
            { role: 'system', content: authorSystemPrompt(domain, withMarket, rounds, language) },
            { role: 'user', content: completionPrompt(draft, missing) },
          ],
          options
        )
      );
      const before = missing.length;
      draft = sanitizeDraft(parse(JSON.stringify(result)), language, draft);
      if (missingParts(draft, withMarket, rounds).length === before) console.warn(`[Studio] Completion added nothing: ${JSON.stringify(result).slice(0, 200)}`);
    } catch (err: any) {
      console.warn(`[Studio] Completion request failed: ${err.message}`);
      break;
    }
  }

  // ② System 1 judges
  events.onStage?.('judging');
  const judgment = await judgeDraft(draft);

  // ③ The engine quantifies
  events.onStage?.('quantifying');
  const { scenario: quantified, notes } = quantify(draft, judgment, {
    domain,
    difficulty: prompt.difficulty ?? 'INTERMEDIATE',
    withMarket,
    rounds,
    author: `AI Studio (${usedProvider} + ${judgment.engine})`,
  });

  // ④ The engine calibrates the difficulty
  events.onStage?.('calibrating');
  const { scenario, report: calibration } = calibrateDifficulty(quantified);

  return {
    scenario,
    report: { author: usedProvider, judge: judgment.engine, completions, review: judgment.review, forced: notes.forced, calibration },
  };
}
