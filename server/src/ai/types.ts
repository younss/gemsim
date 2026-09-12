// ============================================================================
// GEMSIM: PLUGGABLE AI ABSTRACTION INTERFACES
// Provider-Agnostic LLM Strategy Pattern
// ============================================================================

import {
  AIProviderType,
  ProposalEvaluation,
  Scenario,
  StakeholderPersona,
  ChatMessage,
} from '../types/index.js';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}

export interface StakeholderNegotiationContext {
  stakeholder: StakeholderPersona;
  currentTrust: number;
  chatHistory: ChatMessage[];
  playerMessage: string;
  currentRound: number;
  teamMetrics: {
    tco: number;
    budgetRemaining: number;
    technicalDebtIndex: number;
    deliveryVelocity: number;
  };
}

export interface ScenarioGenerationPrompt {
  industry: string;
  businessChallenge: string;
  targetScale?: string;
  difficulty?: 'ENTRY' | 'INTERMEDIATE' | 'EXECUTIVE' | 'CRISIS_CHIEF';
  customDirectives?: string;
}

export interface AIProvider {
  readonly providerType: AIProviderType;
  
  /**
   * Health check to test API connectivity and model availability
   */
  checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }>;

  /**
   * Structured text/JSON generation with fallback handling
   */
  generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string>;

  /**
   * Structured JSON parsing with type safety
   */
  generateJSON<T>(messages: AIMessage[], options?: AIGenerateOptions): Promise<T>;

  /**
   * Streaming response for live conversational stakeholder interactions
   */
  generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string>;

  /**
   * Evaluates a player proposal against stakeholder biases and hidden agendas
   */
  evaluateStakeholderProposal(
    context: StakeholderNegotiationContext
  ): Promise<{ responseDialogue: string; evaluation: ProposalEvaluation }>;

  /**
   * Evaluates a player proposal with real-time dialogue token streaming
   */
  evaluateStakeholderProposalStream?(
    context: StakeholderNegotiationContext,
    onDialogueChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<{ responseDialogue: string; evaluation: ProposalEvaluation }>;

  /**
   * Generates a fully playable scenario schema from a user prompt
   */
  generateScenario(
    prompt: ScenarioGenerationPrompt
  ): Promise<Partial<Scenario>>;
}
