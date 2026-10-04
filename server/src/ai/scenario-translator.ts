// ============================================================================
// GEMSIM: SCENARIO TRANSLATOR (STUDIO)
// Translates a scenario's text with the active LLM, chunk by chunk, under a
// dedicated system prompt. Every chunk is checked (same paths, figures intact)
// and retried once with the problems listed; the engine data never goes to the
// model, so a translation cannot change the game's balance.
// ============================================================================

import { AIRegistry } from './registry.js';
import { getAITimeout } from './timeout.js';
import type { Scenario, ScenarioTranslation } from '../types/index.js';
import { extractText, textHash, validateTranslation, type TextPack } from '../engine/scenario-text.js';

const CHUNK_SIZE = 25;
const MAX_ATTEMPTS = 3; // per chunk; later attempts only carry the texts still missing
const LANG_NAME = { fr: 'French', en: 'English' } as const;

export class NoTranslatorError extends Error {
  constructor() {
    super('No AI model is available to translate: configure a provider (Ollama, Gemini, Claude or OpenAI) in Settings.');
    this.name = 'NoTranslatorError';
  }
}

function systemPrompt(from: 'fr' | 'en', to: 'fr' | 'en'): string {
  return `You are a professional translator of business school case studies and executive simulations.
Translate every value of the JSON object from ${LANG_NAME[from]} into ${LANG_NAME[to]}.
Rules:
- Keep exactly the same keys, in the same order. Translate the values only.
- Keep people's names, company and brand names, product codes and acronyms unchanged.
- Keep every figure exactly as written: numbers, percentages, amounts, years, quarter numbers. Never convert units or currencies.
- Use the vocabulary of executives and the business domain; keep the tone (concise, concrete, sometimes tense).
- Quarter labels: "T1"…"T4" in French are "Q1"…"Q4" in English, and the reverse.
- Output only the JSON object, without comments or code fences.`;
}

/** Quarter labels follow the target language ("T1 :" in French, "Q1:" in English), whatever the model did. */
function quarterLabels(pack: TextPack, to: 'fr' | 'en'): TextPack {
  const fix = (text: string) =>
    to === 'fr' ? text.replace(/\bQ([1-9])\s*:/g, 'T$1 :').replace(/\bQ([1-9])\b/g, 'T$1') : text.replace(/\bT([1-9])\s*:/g, 'Q$1:').replace(/\bT([1-9])\b/g, 'Q$1');
  return Object.fromEntries(Object.entries(pack).map(([k, v]) => [k, fix(v)]));
}

function chunks(pack: TextPack): TextPack[] {
  const keys = Object.keys(pack);
  const out: TextPack[] = [];
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    out.push(Object.fromEntries(keys.slice(i, i + CHUNK_SIZE).map(k => [k, pack[k]])));
  }
  return out;
}

/**
 * Translates the scenario into `to`. Calls `onProgress(done, total)` after each chunk.
 * Throws NoTranslatorError when only the heuristic provider is available.
 */
export async function translateScenario(
  scenario: Scenario,
  to: 'fr' | 'en',
  onProgress?: (done: number, total: number) => void
): Promise<ScenarioTranslation> {
  const from = scenario.language ?? (to === 'fr' ? 'en' : 'fr');
  if (from === to) throw new Error(`The scenario is already in ${LANG_NAME[to]}.`);
  const source = extractText(scenario);
  const parts = chunks(source);
  const registry = AIRegistry.getInstance();
  const texts: TextPack = {};
  let provider = '';

  for (let i = 0; i < parts.length; i++) {
    // Valid texts are kept; only the missing or rejected ones are asked again
    let pending: TextPack = parts[i];
    let issues: string[] = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS && Object.keys(pending).length; attempt++) {
      const user =
        attempt === 0
          ? JSON.stringify(pending, null, 1)
          : `${JSON.stringify(pending, null, 1)}\n\nTranslate ALL of these keys. Your previous answer had these problems: ${issues.slice(0, 10).join('; ')}`;
      const { result, usedProvider } = await registry.executeWithFallback(p =>
        p.generateJSON<Record<string, unknown>>(
          [
            { role: 'system', content: systemPrompt(from, to) },
            { role: 'user', content: user },
          ],
          { temperature: 0.2, maxTokens: 6000, responseFormat: 'json', timeoutMs: getAITimeout('STUDIO'), reasoning: false }
        )
      );
      if (usedProvider === 'fallback') throw new NoTranslatorError();
      provider = usedProvider;
      const answer = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
      issues = validateTranslation(pending, answer);
      const valid: TextPack = {};
      for (const key of Object.keys(pending)) {
        if (validateTranslation({ [key]: pending[key] }, { [key]: answer[key] }).length === 0) valid[key] = answer[key] as string;
      }
      Object.assign(texts, quarterLabels(valid, to));
      pending = Object.fromEntries(Object.entries(pending).filter(([key]) => !(key in valid)));
    }
    if (Object.keys(pending).length) throw new Error(`Translation rejected (${issues.slice(0, 3).join('; ')}).`);
    onProgress?.(i + 1, parts.length);
  }

  return { sourceHash: textHash(source), texts, provider, translatedAt: new Date().toISOString() };
}
