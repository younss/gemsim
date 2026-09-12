// ============================================================================
// GEMSIM: AI PROVIDER REGISTRY & LIFECYCLE MANAGER
// Dynamic Runtime Switching, Key Management, and Fallback Cascading
// ============================================================================

import { AIProvider } from './types.js';
import { OllamaProvider } from './ollama.js';
import { GeminiProvider } from './gemini.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { FallbackProvider } from './fallback.js';
import { AIProviderType, AISettingsState, AIProviderConfig } from '../types/index.js';

export class AIRegistry {
  private static instance: AIRegistry;

  private activeProviderType: AIProviderType = 'fallback';
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private configs: Record<AIProviderType, AIProviderConfig>;
  private fallbackChain: AIProviderType[] = ['gemini', 'ollama', 'fallback'];
  private cachedOllamaModels: string[] = [];

  private constructor() {
    // 1. Instantiate concrete providers
    const ollama = new OllamaProvider(
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      process.env.OLLAMA_MODEL || 'gemma4:12b'
    );
    const gemini = new GeminiProvider(
      process.env.GEMINI_API_KEY || '',
      process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    );
    const claude = new ClaudeProvider(
      process.env.ANTHROPIC_API_KEY || '',
      process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
    );
    const openai = new OpenAIProvider(
      process.env.OPENAI_API_KEY || '',
      process.env.OPENAI_MODEL || 'gpt-4o-mini'
    );
    const fallback = new FallbackProvider();

    this.providers.set('ollama', ollama);
    this.providers.set('gemini', gemini);
    this.providers.set('claude', claude);
    this.providers.set('openai', openai);
    this.providers.set('fallback', fallback);

    this.configs = {
      ollama: {
        type: 'ollama',
        model: process.env.OLLAMA_MODEL || 'gemma4:12b',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        enabled: true,
      },
      gemini: {
        type: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        apiKey: process.env.GEMINI_API_KEY || '',
        enabled: Boolean(process.env.GEMINI_API_KEY),
      },
      claude: {
        type: 'claude',
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        enabled: Boolean(process.env.ANTHROPIC_API_KEY),
      },
      openai: {
        type: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY || '',
        enabled: Boolean(process.env.OPENAI_API_KEY),
      },
      fallback: {
        type: 'fallback',
        model: 'heuristic-v1',
        enabled: true,
      },
    };

    // Determine initial default provider
    const requestedDefault = (process.env.DEFAULT_AI_PROVIDER || '').toLowerCase() as AIProviderType;
    if (requestedDefault && this.providers.has(requestedDefault)) {
      this.activeProviderType = requestedDefault;
    } else if (process.env.GEMINI_API_KEY) {
      this.activeProviderType = 'gemini';
    } else if (process.env.OPENAI_API_KEY) {
      this.activeProviderType = 'openai';
    } else if (process.env.OLLAMA_BASE_URL) {
      this.activeProviderType = 'ollama';
    } else {
      this.activeProviderType = 'fallback';
    }

    // Auto-detect Ollama in the background
    this.autoDetectOllama();
  }

  public async autoDetectOllama(): Promise<void> {
    const ollama = this.providers.get('ollama');
    if (ollama instanceof OllamaProvider) {
      try {
        const health = await ollama.checkHealth();
        if (health.ok) {
          this.configs.ollama.baseUrl = ollama.getBaseUrl();
          this.configs.ollama.model = ollama.getModel();
          this.configs.ollama.enabled = true;
          this.cachedOllamaModels = health.models || [];

          // If no cloud API key was configured, switch to Ollama as the active local engine!
          if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
            this.activeProviderType = 'ollama';
            console.log(`[AIRegistry] Auto-activated local Ollama with model '${this.configs.ollama.model}' at ${this.configs.ollama.baseUrl}`);
          }
        }
      } catch (err: any) {
        console.warn(`[AIRegistry] Background Ollama detection skipped: ${err.message}`);
      }
    }
  }

  public static getInstance(): AIRegistry {
    if (!AIRegistry.instance) {
      AIRegistry.instance = new AIRegistry();
    }
    return AIRegistry.instance;
  }

  public getActiveProvider(): AIProvider {
    const provider = this.providers.get(this.activeProviderType);
    return provider || this.providers.get('fallback')!;
  }

  public getProvider(type: AIProviderType): AIProvider {
    return this.providers.get(type) || this.providers.get('fallback')!;
  }

  public setActiveProvider(type: AIProviderType) {
    if (this.providers.has(type)) {
      this.activeProviderType = type;
      console.log(`[AIRegistry] Active AI provider set to: ${type}`);
    }
  }

  public getSettings(): AISettingsState {
    const maskedConfigs: Record<AIProviderType, AIProviderConfig> = {} as any;

    for (const [key, cfg] of Object.entries(this.configs)) {
      const type = key as AIProviderType;
      maskedConfigs[type] = {
        ...cfg,
        apiKey: cfg.apiKey ? `${cfg.apiKey.substring(0, 4)}...${cfg.apiKey.slice(-4)}` : undefined,
      };
    }

    const ollama = this.providers.get('ollama');
    if (ollama instanceof OllamaProvider) {
      maskedConfigs.ollama.baseUrl = ollama.getBaseUrl();
      maskedConfigs.ollama.model = ollama.getModel();
    }

    return {
      activeProvider: this.activeProviderType,
      providers: maskedConfigs,
      fallbackChain: [...this.fallbackChain],
      availableOllamaModels: this.cachedOllamaModels,
    };
  }

  public updateProviderConfig(
    type: AIProviderType,
    updates: Partial<AIProviderConfig>
  ) {
    if (!this.configs[type]) return;

    const current = this.configs[type];
    if (updates.apiKey !== undefined && updates.apiKey !== '') {
      if (!updates.apiKey.includes('...')) {
        current.apiKey = updates.apiKey;
      }
    }
    if (updates.baseUrl) current.baseUrl = updates.baseUrl;
    if (updates.model) current.model = updates.model;
    if (updates.enabled !== undefined) current.enabled = updates.enabled;

    const provider = this.providers.get(type);
    if (type === 'ollama' && provider instanceof OllamaProvider) {
      provider.setConfig(current.baseUrl, current.model);
    } else if (type === 'gemini' && provider instanceof GeminiProvider) {
      provider.setConfig(current.apiKey, current.model);
    } else if (type === 'claude' && provider instanceof ClaudeProvider) {
      provider.setConfig(current.apiKey, current.model);
    } else if (type === 'openai' && provider instanceof OpenAIProvider) {
      provider.setConfig(current.apiKey, current.model);
    }
  }

  public async testProvider(type: AIProviderType) {
    const provider = this.providers.get(type);
    if (!provider) {
      return { ok: false, message: `Unknown provider: ${type}`, latencyMs: 0 };
    }
    const res = await provider.checkHealth();
    if (type === 'ollama' && res.ok) {
      this.cachedOllamaModels = (res as any).models || [];
      if ((res as any).model) {
        this.configs.ollama.model = (res as any).model;
      }
    }
    return res;
  }

  /**
   * Executes an AI action with automatic fallback if primary provider fails
   */
  public async executeWithFallback<T>(
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<{ result: T; usedProvider: AIProviderType }> {
    const candidates: AIProviderType[] = [];

    // 1. Primary candidate: activeProviderType (if not fallback)
    if (this.activeProviderType !== 'fallback') {
      candidates.push(this.activeProviderType);
    }

    // 2. Chain candidates: real LLM providers in preferred order
    for (const t of this.fallbackChain) {
      if (t !== 'fallback' && !candidates.includes(t)) {
        if (this.configs[t]?.enabled) {
          candidates.push(t);
        }
      }
    }

    // 3. Fallback heuristic: absolute last resort
    candidates.push('fallback');

    let lastError: any = null;

    for (const candidateType of candidates) {
      const provider = this.providers.get(candidateType);
      if (!provider) continue;

      try {
        console.log(`[AIRegistry] Attempting scenario execution with provider: '${candidateType}'...`);
        const result = await operation(provider);
        console.log(`[AIRegistry] Execution successful with provider: '${candidateType}'`);
        return { result, usedProvider: candidateType };
      } catch (err: any) {
        lastError = err;
        console.warn(`[AIRegistry] Provider '${candidateType}' failed: ${err.message}. Falling back to next provider.`);
      }
    }

    const fallbackProvider = this.providers.get('fallback')!;
    const result = await operation(fallbackProvider);
    return { result, usedProvider: 'fallback' };
  }
}
