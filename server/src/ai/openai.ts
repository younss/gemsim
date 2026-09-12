// ============================================================================
// GEMSIM: OPENAI AI PROVIDER
// Production BYOK Adapter for OpenAI (GPT-4o, GPT-4o-mini, etc.)
// ============================================================================

import { BaseAIProvider } from './base.js';
import { AIMessage, AIGenerateOptions } from './types.js';
import { AIProviderType } from '../types/index.js';

export class OpenAIProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'openai';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string = '', model: string = 'gpt-4o-mini') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  public setConfig(apiKey?: string, model?: string) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (model) this.model = model;
  }

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    if (!this.apiKey) {
      return { ok: false, message: 'OpenAI API key not configured', latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return {
          ok: true,
          message: `OpenAI API reachable (Target Model: ${this.model})`,
          latencyMs,
        };
      }
      return { ok: false, message: `OpenAI returned status ${response.status}`, latencyMs };
    } catch (err: any) {
      return {
        ok: false,
        message: `OpenAI connection failed: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing. Configure it in Settings.');
    }

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
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeoutMs || 60000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  public async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing.');
    }

    const formattedMessages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      formattedMessages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const m of messages) {
      formattedMessages.push({ role: m.role, content: m.content });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI stream error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      const lines = raw.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              onChunk(delta);
            }
          } catch {
            // Ignore incomplete chunks
          }
        }
      }
    }

    return accumulated;
  }
}
