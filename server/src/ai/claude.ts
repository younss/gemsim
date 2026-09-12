// ============================================================================
// GEMSIM: ANTHROPIC CLAUDE AI PROVIDER
// Production BYOK Adapter for Anthropic Claude Models
// ============================================================================

import { BaseAIProvider } from './base.js';
import { AIMessage, AIGenerateOptions } from './types.js';
import { AIProviderType } from '../types/index.js';
import { getAITimeout } from './timeout.js';

export class ClaudeProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'claude';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string = '', model: string = 'claude-3-5-sonnet-20241022') {
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
      return { ok: false, message: 'Anthropic API key not configured', latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Date.now() - start;
      if (response.ok) {
        return {
          ok: true,
          message: `Anthropic Claude API reachable (Model: ${this.model})`,
          latencyMs,
        };
      }
      const err = await response.text();
      return { ok: false, message: `Claude API error (${response.status}): ${err.substring(0, 100)}`, latencyMs };
    } catch (err: any) {
      return {
        ok: false,
        message: `Claude connection failed: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key is missing. Configure it in Settings.');
    }

    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const body: Record<string, any> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      messages: formattedMessages,
    };

    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const timeoutMs = getAITimeout('DEFAULT', options?.timeoutMs);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as any;
    const text = data.content?.[0]?.text || '';
    return text;
  }

  public async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key is missing.');
    }

    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const body: Record<string, any> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      messages: formattedMessages,
      stream: true,
    };

    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const streamTimeoutMs = getAITimeout('CHAT', options?.timeoutMs);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(streamTimeoutMs),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Claude stream error: ${response.statusText}`);
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
            if (data.type === 'content_block_delta' && data.delta?.text) {
              accumulated += data.delta.text;
              onChunk(data.delta.text);
            }
          } catch {
            // Ignore incomplete events
          }
        }
      }
    }

    return accumulated;
  }
}
