// ============================================================================
// GEMSIM: OLLAMA LOCAL AI PROVIDER
// Provider for local execution (Gemma 4, Llama, etc.) with host bridge auto-discovery
// ============================================================================

import { BaseAIProvider } from './base.js';
import { AIMessage, AIGenerateOptions } from './types.js';
import { AIProviderType } from '../types/index.js';
import { getAITimeout } from './timeout.js';

export class OllamaProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'ollama';
  private baseUrl: string;
  private model: string;
  private discoveredModels: string[] = [];

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'gemma4:12b') {
    super();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  public setConfig(baseUrl?: string, model?: string) {
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (model) this.model = model;
  }

  public getModel(): string {
    return this.model;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Probes candidate host endpoints and discovers installed local models
   */
  public async discoverHostAndModels(): Promise<{ connectedUrl: string | null; models: string[] }> {
    const candidateUrls = [
      this.baseUrl,
      'http://host.containers.internal:11434',
      'http://host.docker.internal:11434',
      'http://localhost:11434',
      'http://127.0.0.1:11434',
      'http://gemsim-ollama:11434',
    ];

    const uniqueCandidates = Array.from(new Set(candidateUrls.map(u => u.replace(/\/+$/, ''))));

    for (const url of uniqueCandidates) {
      try {
        const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = (await res.json()) as { models?: Array<{ name: string }> };
          const models = (data.models || []).map(m => m.name);
          this.baseUrl = url;
          this.discoveredModels = models;

          // If current model is not installed, select best match
          if (models.length > 0 && !models.includes(this.model)) {
            const preferred = models.find(m => m.startsWith('gemma4') || m.startsWith('gemma') || m.startsWith('qwen') || m.startsWith('granite'));
            this.model = preferred || models[0];
          }

          console.log(`[OllamaProvider] Auto-connected to Ollama at ${url} with model '${this.model}' (Available: ${models.join(', ')})`);
          return { connectedUrl: url, models };
        }
      } catch {
        // Continue to next candidate
      }
    }

    return { connectedUrl: null, models: [] };
  }

  public async getInstalledModels(): Promise<string[]> {
    if (this.discoveredModels.length > 0) return this.discoveredModels;
    const { models } = await this.discoverHostAndModels();
    return models;
  }

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number; model?: string; models?: string[] }> {
    const start = Date.now();
    const { connectedUrl, models } = await this.discoverHostAndModels();
    const latencyMs = Date.now() - start;

    if (connectedUrl) {
      return {
        ok: true,
        message: `Ollama online at ${connectedUrl} (Active model: ${this.model})`,
        latencyMs,
        model: this.model,
        models,
      };
    }

    return {
      ok: false,
      message: `Ollama unreachable across candidate endpoints (${this.baseUrl}, host.containers.internal, localhost)`,
      latencyMs,
    };
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    // Ensure host is discovered
    await this.discoverHostAndModels();

    const timeoutMs = getAITimeout('DEFAULT', options?.timeoutMs);
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
          temperature: options?.temperature ?? 0.6,
          num_ctx: 16384,
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
    await this.discoverHostAndModels();

    const timeoutMs = getAITimeout('CHAT', options?.timeoutMs);
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

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.6,
          },
        }),
        signal: controller.signal,
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
            // Ignore partial chunk
          }
        }
      }

      return accumulated;
    } finally {
      clearTimeout(timer);
    }
  }
}
