// ============================================================================
// GEMSIM: GOOGLE GEMINI AI PROVIDER
// Production BYOK Adapter for Google Gemini Models
// ============================================================================

import { BaseAIProvider } from './base.js';
import { AIMessage, AIGenerateOptions } from './types.js';
import { AIProviderType } from '../types/index.js';

export class GeminiProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string = '', model: string = 'gemini-1.5-flash') {
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
      return { ok: false, message: 'Google Gemini API key not configured', latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}?key=${this.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return {
          ok: true,
          message: `Gemini API reachable (Model: ${this.model})`,
          latencyMs,
        };
      }
      const err = await response.text();
      return { ok: false, message: `Gemini health error (${response.status}): ${err.substring(0, 100)}`, latencyMs };
    } catch (err: any) {
      return {
        ok: false,
        message: `Gemini connection failed: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Gemini API Key is missing. Configure it in Settings.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    if (options?.systemPrompt) {
      body.system_instruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    if (options?.responseFormat === 'json') {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeoutMs || 60000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as any;
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;

    if (!textPart) {
      throw new Error('Empty response from Gemini model');
    }

    return textPart;
  }

  public async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Gemini API Key is missing.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
      },
    };

    if (options?.systemPrompt) {
      body.system_instruction = { parts: [{ text: options.systemPrompt }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Gemini streaming error: ${response.statusText}`);
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
          try {
            const json = JSON.parse(line.substring(6));
            const part = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (part) {
              accumulated += part;
              onChunk(part);
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
