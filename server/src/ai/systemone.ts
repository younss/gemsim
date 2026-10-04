// ============================================================================
// GEMSIM: SYSTEM ONE DECISION CLIENT (Clef / Jev compatible)
// Non-autoregressive typed judgments: one forward pass, zero generated tokens.
// System 1 decides (verdicts, scores, triggers); System 2 LLMs write the prose.
// ============================================================================

import { CircuitBreaker } from './circuit-breaker.js';

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

export class SystemOneClient {
  private static instance: SystemOneClient;

  private baseUrl: string;
  private model: string;
  private timeoutMs: number;
  private enabled: boolean;
  private breaker = new CircuitBreaker({ name: 'systemone', failureThreshold: 3, cooldownMs: 60000 });

  private constructor() {
    this.baseUrl = (process.env.SYSTEMONE_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = process.env.SYSTEMONE_MODEL || 'clef-flash';
    this.timeoutMs = Number(process.env.SYSTEMONE_TIMEOUT_MS) || 20000;
    this.enabled = process.env.SYSTEMONE_ENABLED !== 'false';
  }

  public static getInstance(): SystemOneClient {
    if (!SystemOneClient.instance) {
      SystemOneClient.instance = new SystemOneClient();
    }
    return SystemOneClient.instance;
  }

  public getModel(): string {
    return this.model;
  }

  /** False when disabled by config or while the circuit breaker is cooling down. */
  public isAvailable(): boolean {
    return this.enabled && this.breaker.getState() !== 'OPEN';
  }

  public async decide<Qs extends Record<string, SystemOneQuestion>>(
    state: unknown,
    questions: Qs,
    options: { timeoutMs?: number } = {}
  ): Promise<SystemOneResult<Qs>> {
    if (!this.enabled) {
      throw new Error('System One is disabled (SYSTEMONE_ENABLED=false)');
    }

    return this.breaker.execute(async () => {
      const start = Date.now();
      const response = await fetch(`${this.baseUrl}/v1/systemone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, state, questions }),
        signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
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
    });
  }

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number; model: string }> {
    const start = Date.now();
    try {
      await this.decide('Health probe.', { ok: { type: 'noul', instructions: 'Is this a health probe?' } });
      return { ok: true, message: `System One '${this.model}' online at ${this.baseUrl}`, latencyMs: Date.now() - start, model: this.model };
    } catch (err: any) {
      return { ok: false, message: err.message, latencyMs: Date.now() - start, model: this.model };
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
