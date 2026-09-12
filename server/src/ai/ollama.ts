// ============================================================================
// GEMSIM: OLLAMA LOCAL AI PROVIDER
// Provider for local execution (Gemma, Llama, etc.) via Podman bridge or localhost
// ============================================================================

import { BaseAIProvider } from './base.js';
import { AIMessage, AIGenerateOptions } from './types.js';
import { AIProviderType } from '../types/index.js';

export class OllamaProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'gemma:2b') {
    super();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  public setConfig(baseUrl?: string, model?: string) {
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (model) this.model = model;
  }

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(4000),
      });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        const data = (await response.json()) as { version?: string };
        return {
          ok: true,
          message: `Ollama v${data.version || 'unknown'} online at ${this.baseUrl} (model: ${this.model})`,
          latencyMs,
        };
      }
      return { ok: false, message: `Ollama returned status ${response.status}`, latencyMs };
    } catch (err: any) {
      return {
        ok: false,
        message: `Ollama unreachable at ${this.baseUrl}: ${err.message || 'Connection refused'}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const timeoutMs = options?.timeoutMs || 45000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const formattedMessages: Array<{ role: string; content: string }> = [];
      if (options?.systemPrompt) {
        formattedMessages.push({ role: 'system', content: options.systemPrompt });
      }
      for (const m of messages) {
        formattedMessages.push({ role: m.role, content: m.content });
      }

      const body: Record<string, any> = {
        model: this.model,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
        },
      };

      if (options?.responseFormat === 'json') {
        body.format = 'json';
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as { message?: { content: string } };
      return data.message?.content || '';
    } finally {
      clearTimeout(timer);
    }
  }

  public async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string> {
    const formattedMessages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      formattedMessages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const m of messages) {
      formattedMessages.push({ role: m.role, content: m.content });
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(l => l.trim().length > 0);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as { message?: { content: string }; done?: boolean };
          if (parsed.message?.content) {
            accumulated += parsed.message.content;
            onChunk(parsed.message.content);
          }
        } catch {
          // Ignore partial line chunking
        }
      }
    }

    return accumulated;
  }
}
