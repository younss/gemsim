// ============================================================================
// GEMSIM: SYSTEM ONE DECISION CLIENT (Clef / Jev compatible)
// Non-autoregressive typed judgments: one forward pass, zero generated tokens.
// System 1 decides (verdicts, scores, triggers); System 2 LLMs write the prose.
// System 1 is configured on its own: Clef natively, or a general LLM (Ollama,
// Gemini, Claude, OpenAI, any OpenAI-compatible API) that emulates it in JSON.
// ============================================================================

import { CircuitBreaker } from './circuit-breaker.js';
import type { AIProvider } from './types.js';
import { OllamaProvider } from './ollama.js';
import { GeminiProvider } from './gemini.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { sanitizeAndParseJSON } from './repair-loop.js';

export type SystemOneQuestion =
  | { type: 'noul'; instructions?: string; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions?: string; criteria: Record<string, string> }
  | { type: 'score'; instructions?: string; criteria: string[] };

export interface NoulAnswer { type: 'noul'; noul: number }
export interface ChoiceAnswer { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
export interface ScoreAnswer {
  type: 'score';
  score: number; // expected value over option indices 0..n-1
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}
export type SystemOneAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

type AnswerFor<Q extends SystemOneQuestion> =
  Q extends { type: 'noul' } ? NoulAnswer : Q extends { type: 'choice' } ? ChoiceAnswer : ScoreAnswer;

export type SystemOneAnswers<Qs extends Record<string, SystemOneQuestion>> = { [K in keyof Qs]: AnswerFor<Qs[K]> };

export interface SystemOneResult<Qs extends Record<string, SystemOneQuestion>> {
  answers: SystemOneAnswers<Qs>;
  model: string;
  latencyMs: number;
}

/**
 * Who answers the judgments. On Ollama, a model with the "decision" capability
 * (Clef) answers natively: one forward pass, calibrated probabilities, no text.
 * Any other model (Ollama or cloud) is a general LLM asked to answer the same
 * questions as JSON probabilities: slower, but lets the facilitator compare.
 */
export type SystemOneProvider = 'ollama' | 'gemini' | 'claude' | 'openai' | 'custom';
export const SYSTEMONE_PROVIDERS: SystemOneProvider[] = ['ollama', 'gemini', 'claude', 'openai', 'custom'];

export interface SystemOneConfig {
  provider: SystemOneProvider;
  baseUrl: string; // ollama and custom only
  model: string;
  apiKey?: string; // gemini, claude, openai, custom
  timeoutMs: number;
  enabled: boolean;
}

export const SYSTEMONE_DEFAULTS: Record<SystemOneProvider, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'clef-flash' },
  gemini: { baseUrl: '', model: 'gemini-2.0-flash' },
  claude: { baseUrl: '', model: 'claude-haiku-4-5-20251001' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
};

/**
 * A fixed judgment from the game (an executive weighs a proposal), used to
 * compare System 1 models in the admin console: same input, verdict and latency side by side.
 */
const SAMPLE_STATE =
  'Executive: Chief Financial Officer, cautious, judged on short-term margin, hidden goal: keep the cost-cutting bonus.\n' +
  'Proposal from the team: "We will spend 300 K$ this quarter to replace the ageing billing system. In exchange, ' +
  'we commit to cutting run costs by 15 % within two quarters and we will report the savings to you every month."';
const SAMPLE_QUESTIONS = {
  verdict: {
    type: 'choice',
    instructions: 'How does the executive react to the proposal?',
    criteria: {
      ACCEPTED: 'Accepts as it is',
      CONDITIONAL_ACCEPTANCE: 'Accepts under conditions',
      REJECTED: 'Rejects it',
    },
  },
  effort: {
    type: 'score',
    instructions: 'How concrete and well argued is the proposal?',
    criteria: ['Vague', 'Somewhat argued', 'Concrete', 'Concrete with commitments'],
  },
  concession: { type: 'noul', instructions: 'Does the proposal offer the executive something in return?' },
} satisfies Record<string, SystemOneQuestion>;

export interface SystemOneSample {
  ok: boolean;
  provider: SystemOneProvider;
  native?: boolean; // answered by a decision model rather than emulated
  model: string;
  latencyMs: number;
  message?: string;
  verdict?: { choice: string; confidence: number };
  effort?: number; // 0..1
  concession?: number; // probability (0..1)
}

/** Builds the general-LLM provider that emulates System 1 (separate from System 2's instances). */
function emulator(cfg: SystemOneConfig): AIProvider {
  switch (cfg.provider) {
    case 'ollama':
      return new OllamaProvider(cfg.baseUrl, cfg.model);
    case 'gemini':
      return new GeminiProvider(cfg.apiKey ?? '', cfg.model);
    case 'claude':
      return new ClaudeProvider(cfg.apiKey ?? '', cfg.model);
    case 'openai':
      return new OpenAIProvider(cfg.apiKey ?? '', cfg.model);
    default:
      return new OpenAIProvider(cfg.apiKey ?? '', cfg.model, cfg.baseUrl, 'custom');
  }
}

/** The questions, rewritten for a general LLM that must answer with probabilities in JSON. */
export function emulationPrompt(state: unknown, questions: Record<string, SystemOneQuestion>): { system: string; user: string } {
  const lines: string[] = [];
  const shape: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(questions)) {
    const ask = q.instructions ?? '';
    if (q.type === 'choice') {
      lines.push(`- "${id}" (pick one): ${ask} Options: ${Object.entries(q.criteria).map(([k, v]) => `${k} = ${v}`).join('; ')}.`);
      shape[id] = Object.fromEntries(Object.keys(q.criteria).map(k => [k, 0.0]));
    } else if (q.type === 'score') {
      lines.push(`- "${id}" (scale): ${ask} Levels: ${q.criteria.map((c, i) => `${i} = ${c}`).join('; ')}.`);
      shape[id] = Object.fromEntries(q.criteria.map((_, i) => [String(i), 0.0]));
    } else {
      const meaning = q.criteria?.true ? ` (yes means: ${q.criteria.true})` : '';
      lines.push(`- "${id}" (yes/no): ${ask}${meaning}`);
      shape[id] = 0.0;
    }
  }
  return {
    system:
      'You are a judgment module, not a writer. Read the situation and answer every question with probabilities. ' +
      'For a pick-one or scale question, give a probability for every option (they sum to 1). ' +
      'For a yes/no question, give the probability of yes. Reply with JSON only, exactly in this shape: ' +
      JSON.stringify(shape),
    user: `Situation:\n${typeof state === 'string' ? state : JSON.stringify(state)}\n\nQuestions:\n${lines.join('\n')}`,
  };
}

/** Turns whatever the LLM returned into System 1 answers (missing or odd values fall back to uniform). */
export function parseEmulation<Qs extends Record<string, SystemOneQuestion>>(raw: any, questions: Qs): SystemOneAnswers<Qs> {
  const distribution = (keys: string[], value: any): Record<string, number> => {
    // A model that names an option instead of giving probabilities gets that option for sure
    if (typeof value === 'string' && keys.includes(value)) return Object.fromEntries(keys.map(k => [k, k === value ? 1 : 0]));
    const probs = keys.map(k => Math.max(0, Number(value?.[k]) || 0));
    const total = probs.reduce((a, b) => a + b, 0);
    return Object.fromEntries(keys.map((k, i) => [k, total > 0 ? probs[i] / total : 1 / keys.length]));
  };
  const answers: Record<string, SystemOneAnswer> = {};
  for (const [id, q] of Object.entries(questions)) {
    const value = raw?.[id];
    if (q.type === 'choice') {
      const probabilities = distribution(Object.keys(q.criteria), value);
      const [choice, confidence] = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0];
      answers[id] = { type: 'choice', choice, confidence, probabilities };
    } else if (q.type === 'score') {
      const keys = q.criteria.map((_, i) => String(i));
      const probabilities = typeof value === 'number' && keys.includes(String(Math.round(value)))
        ? distribution(keys, String(Math.round(value)))
        : distribution(keys, value);
      answers[id] = {
        type: 'score',
        score: keys.reduce((sum, k) => sum + Number(k) * probabilities[k], 0),
        confidence: Math.max(...Object.values(probabilities)),
        legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])),
        probabilities,
      };
    } else {
      const p = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
      answers[id] = { type: 'noul', noul: Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0.5 };
    }
  }
  return answers as SystemOneAnswers<Qs>;
}

export class SystemOneClient {
  private static instance: SystemOneClient;

  private config: SystemOneConfig;
  // Whether an Ollama model has the "decision" capability, per server and model
  private capabilities = new Map<string, boolean>();
  private breaker = new CircuitBreaker({ name: 'systemone', failureThreshold: 3, cooldownMs: 60000 });

  private constructor() {
    const provider = (SYSTEMONE_PROVIDERS as string[]).includes(process.env.SYSTEMONE_PROVIDER ?? '')
      ? (process.env.SYSTEMONE_PROVIDER as SystemOneProvider)
      : 'ollama';
    this.config = {
      provider,
      baseUrl: (process.env.SYSTEMONE_BASE_URL || (provider === 'ollama' ? process.env.OLLAMA_BASE_URL : '') || SYSTEMONE_DEFAULTS[provider].baseUrl).replace(/\/+$/, ''),
      model: process.env.SYSTEMONE_MODEL || SYSTEMONE_DEFAULTS[provider].model,
      apiKey: process.env.SYSTEMONE_API_KEY || undefined,
      timeoutMs: Number(process.env.SYSTEMONE_TIMEOUT_MS) || 20000,
      enabled: process.env.SYSTEMONE_ENABLED !== 'false',
    };
  }

  public static getInstance(): SystemOneClient {
    if (!SystemOneClient.instance) {
      SystemOneClient.instance = new SystemOneClient();
    }
    return SystemOneClient.instance;
  }

  public getModel(): string {
    return this.config.model;
  }

  /** The configuration for the admin console (the key is masked). */
  public getConfig(): Omit<SystemOneConfig, 'apiKey'> & { apiKey?: string; circuit: string } {
    const key = this.config.apiKey;
    return { ...this.config, apiKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : undefined, circuit: this.breaker.getState() };
  }

  /** Merges a change from the admin console; a masked or empty key keeps the stored one. */
  private merged(update: Partial<SystemOneConfig>): SystemOneConfig {
    const next = { ...this.config, ...Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) } as SystemOneConfig;
    if (!update.apiKey || update.apiKey.includes('...')) next.apiKey = this.config.apiKey;
    next.baseUrl = (next.baseUrl || SYSTEMONE_DEFAULTS[next.provider].baseUrl).replace(/\/+$/, '');
    return next;
  }

  /** Runtime change from the admin console (until the server restarts; the env vars stay the defaults). */
  public configure(update: Partial<SystemOneConfig>): void {
    this.config = this.merged(update);
    // A new model or address deserves a fresh start, not the previous one's failures
    this.breaker.reset();
  }

  /** Models installed on an Ollama server, decision models (Clef) first. */
  public async listModels(baseUrl = this.config.baseUrl): Promise<Array<{ name: string; decision: boolean }>> {
    const url = baseUrl.replace(/\/+$/, '');
    try {
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = await Promise.all((data.models ?? []).map(async m => ({ name: m.name, decision: await this.hasDecision(url, m.name) })));
      return models.sort((a, b) => Number(b.decision) - Number(a.decision));
    } catch {
      return [];
    }
  }

  /** True when the Ollama model declares the "decision" capability (Clef): it is then called natively. */
  private async hasDecision(baseUrl: string, model: string): Promise<boolean> {
    const key = `${baseUrl}|${model.replace(/:latest$/, '')}`;
    const known = this.capabilities.get(key);
    if (known !== undefined) return known;
    try {
      const res = await fetch(`${baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { capabilities?: string[] };
      const decision = (data.capabilities ?? []).includes('decision');
      this.capabilities.set(key, decision);
      return decision;
    } catch {
      return false; // not cached: the server may just be down
    }
  }

  private async isNative(cfg: SystemOneConfig): Promise<boolean> {
    return cfg.provider === 'ollama' && this.hasDecision(cfg.baseUrl, cfg.model);
  }

  /** Runs the sample judgment with a candidate configuration, without applying it. */
  public async sample(candidate: Partial<SystemOneConfig> = {}): Promise<SystemOneSample> {
    const cfg = this.merged({ ...candidate, enabled: true });
    const start = Date.now();
    const native = await this.isNative(cfg);
    try {
      const { answers, latencyMs } = await this.run(cfg, SAMPLE_STATE, SAMPLE_QUESTIONS, cfg.timeoutMs);
      return {
        ok: true,
        provider: cfg.provider,
        native,
        model: cfg.model,
        latencyMs,
        verdict: { choice: answers.verdict.choice, confidence: answers.verdict.confidence },
        effort: Math.round(normalizeScore(answers.effort) * 100) / 100,
        concession: Math.round(answers.concession.noul * 100) / 100,
      };
    } catch (err: any) {
      return { ok: false, provider: cfg.provider, native, model: cfg.model, latencyMs: Date.now() - start, message: err.message };
    }
  }

  /** False when disabled by config or while the circuit breaker is cooling down. */
  public isAvailable(): boolean {
    return this.config.enabled && this.breaker.getState() !== 'OPEN';
  }

  public async decide<Qs extends Record<string, SystemOneQuestion>>(
    state: unknown,
    questions: Qs,
    options: { timeoutMs?: number } = {}
  ): Promise<SystemOneResult<Qs>> {
    if (!this.config.enabled) {
      throw new Error('System One is disabled (SYSTEMONE_ENABLED=false)');
    }
    const cfg = this.config;
    return this.breaker.execute(() => this.run(cfg, state, questions, options.timeoutMs ?? cfg.timeoutMs));
  }

  private async run<Qs extends Record<string, SystemOneQuestion>>(
    cfg: SystemOneConfig,
    state: unknown,
    questions: Qs,
    timeoutMs: number
  ): Promise<SystemOneResult<Qs>> {
    const start = Date.now();
    if (!(await this.isNative(cfg))) {
      const { system, user } = emulationPrompt(state, questions);
      const call = emulator(cfg).generateText([{ role: 'user', content: user }], {
        systemPrompt: system,
        responseFormat: 'json',
        temperature: 0,
        maxTokens: 600,
        reasoning: false,
        timeoutMs,
      });
      // Some providers enforce a longer minimum timeout: System 1 keeps its own
      const text = await Promise.race([
        call,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`System One timed out after ${timeoutMs} ms`)), timeoutMs)),
      ]);
      const answers = parseEmulation(sanitizeAndParseJSON<any>(text), questions);
      return { answers, model: cfg.model, latencyMs: Date.now() - start };
    }

    const response = await fetch(`${cfg.baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, state, questions }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`System One API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as { model: string; answers: SystemOneAnswers<Qs> };
    for (const id of Object.keys(questions)) {
      if (!data.answers?.[id]) {
        throw new Error(`System One response is missing an answer for '${id}'`);
      }
    }
    return { answers: data.answers, model: data.model, latencyMs: Date.now() - start };
  }

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number; model: string }> {
    const start = Date.now();
    const { provider, model, baseUrl } = this.config;
    try {
      await this.decide('Health probe.', { ok: { type: 'noul', instructions: 'Is this a health probe?' } });
      return { ok: true, message: `System One '${model}' (${provider}) online${baseUrl ? ` at ${baseUrl}` : ''}`, latencyMs: Date.now() - start, model };
    } catch (err: any) {
      return { ok: false, message: err.message, latencyMs: Date.now() - start, model };
    }
  }
}

/**
 * Roulette-wheel selection over a choice distribution: lets two NPCs in the
 * same situation react differently, in proportion to the model's beliefs.
 */
export function sampleChoice<K extends string>(probabilities: Record<K, number>, rng: () => number = Math.random): K {
  const entries = Object.entries(probabilities) as Array<[K, number]>;
  const total = entries.reduce((sum, [, p]) => sum + p, 0);
  let r = rng() * total;
  for (const [option, p] of entries) {
    r -= p;
    if (r <= 0) return option;
  }
  return entries[entries.length - 1][0];
}

/** Normalizes a score answer's expected value to 0..1. */
export function normalizeScore(answer: ScoreAnswer): number {
  const maxIndex = Object.keys(answer.legend).length - 1;
  return maxIndex > 0 ? answer.score / maxIndex : 0;
}
