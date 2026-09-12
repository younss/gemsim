// ============================================================================
// GEMSIM: BASE AI PROVIDER CLASS
// Common parsing, error handling, and prompt templates
// ============================================================================

import {
  AIProvider,
  AIMessage,
  AIGenerateOptions,
  StakeholderNegotiationContext,
  ScenarioGenerationPrompt,
} from './types.js';
import { AIProviderType, ProposalEvaluation, Scenario } from '../types/index.js';

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly providerType: AIProviderType;

  abstract checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }>;

  abstract generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string>;

  abstract generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string>;

  /**
   * Helper to parse JSON from AI response, safely stripping markdown code blocks
   */
  protected parseJSON<T>(rawText: string): T {
    try {
      // First attempt direct parse
      return JSON.parse(rawText) as T;
    } catch {
      // Try stripping markdown ```json ... ```
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/gi, '')
        .trim();
      
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        // Extract substring between first { or [ and last } or ]
        const firstBracket = cleaned.search(/[\{\[]/);
        const lastBracket = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          const substring = cleaned.substring(firstBracket, lastBracket + 1);
          return JSON.parse(substring) as T;
        }
        throw new Error(`Failed to parse structured JSON from model response: ${rawText.substring(0, 200)}...`);
      }
    }
  }

  public async generateJSON<T>(messages: AIMessage[], options?: AIGenerateOptions): Promise<T> {
    const text = await this.generateText(messages, {
      ...options,
      responseFormat: 'json',
    });
    return this.parseJSON<T>(text);
  }

  public async evaluateStakeholderProposal(
    context: StakeholderNegotiationContext
  ): Promise<{ responseDialogue: string; evaluation: ProposalEvaluation }> {
    const systemPrompt = `You are roleplaying as ${context.stakeholder.name}, the ${context.stakeholder.title} in an enterprise business simulation.
Your Personality: ${context.stakeholder.personality}
Your Core Bias: ${context.stakeholder.bias}
Your Hidden Agenda: ${context.stakeholder.hiddenAgenda}
Your Current Trust in the Architecture/Leadership Team: ${context.currentTrust}/100.
Your Negotiation Tolerance: ${context.stakeholder.negotiationTolerance}/100.

Current Corporate Context:
- Round: ${context.currentRound}
- Technical Debt Index: ${context.teamMetrics.technicalDebtIndex}/100
- Delivery Velocity: ${context.teamMetrics.deliveryVelocity}/100
- Cash Remaining: $${context.teamMetrics.budgetRemaining}K

Evaluate the player's message/proposal. Maintain realistic executive friction, push back where your interests are threatened, but be open to genuine compromise.
Respond ONLY with a valid JSON object matching this exact schema:
{
  "responseDialogue": "Your in-character spoken reply to the player (concise, sharp, professional, realistic)",
  "evaluation": {
    "empathyScore": number (0 to 100, how well the player addressed your concerns),
    "financialAcumenScore": number (0 to 100, how realistic or protective of budget/resources they are),
    "strategicAlignmentScore": number (0 to 100, how aligned with enterprise outcomes),
    "trustDelta": number (-20 to +20 change in your trust based on this exchange),
    "verdict": "ACCEPTED" | "REJECTED" | "CONDITIONAL_ACCEPTANCE",
    "rationale": "One-line internal rationale for your score",
    "concessionRequired": "Optional concession you demand in exchange for support, or null"
  }
}`;

    const conversationHistory: AIMessage[] = context.chatHistory.map(m => ({
      role: m.sender === 'PLAYER' ? 'user' : 'assistant',
      content: m.content,
    }));

    conversationHistory.push({
      role: 'user',
      content: context.playerMessage,
    });

    return this.generateJSON<{ responseDialogue: string; evaluation: ProposalEvaluation }>(
      conversationHistory,
      { systemPrompt, responseFormat: 'json', temperature: 0.6 }
    );
  }

  public async generateScenario(
    prompt: ScenarioGenerationPrompt
  ): Promise<Partial<Scenario>> {
    const systemPrompt = `You are an elite Enterprise Architect and Executive Business Simulation Game Designer.
Generate a comprehensive, playable enterprise architecture and strategy scenario schema based on the user's prompt.
Industry: ${prompt.industry}
Challenge: ${prompt.businessChallenge}
Difficulty: ${prompt.difficulty || 'INTERMEDIATE'}
Scale: ${prompt.targetScale || 'Enterprise Tier-1'}
Directives: ${prompt.customDirectives || 'Standard realistic corporate pressures'}

You must output a JSON object adhering strictly to the Scenario schema with:
1. "title": Punchy corporate operation codename
2. "industry": string
3. "difficulty": "ENTRY" | "INTERMEDIATE" | "EXECUTIVE" | "CRISIS_CHIEF"
4. "description": 2-3 paragraph scenario overview
5. "businessContext": detailed business operational background
6. "baselineMetrics": { tco, budgetRemaining, opEx, capExSpent, technicalDebtIndex (40-75), deliveryVelocity (40-70), stakeholderTrust (45-65), resilienceIndex (40-70), complianceScore (50-80), modernizedNodesCount: 0 }
7. "winLossConditions": { maxTechnicalDebtIndex, minStakeholderTrustAvg, minDeliveryVelocity, minResilienceIndex, maxTCOBudget, targetCapabilitiesModernized }
8. "totalRounds": 4 (representing Q1 to Q4)
9. "topology": {
    "nodes": Array of 8-12 TopologyNode objects with id, name, layer ('BUSINESS'|'APPLICATION'|'DATA'|'INFRASTRUCTURE'), description, health (30-80), technicalDebt (20-80), criticalPath (bool), costPerRound (20-100), position: {x, y, z}, status: 'HEALTHY'|'DEGRADED'|'CRITICAL', dependencies: string[], telemetry: { latencyMs, throughputRps, errorRatePercent, failureRisk }
    "edges": Array of 10-16 TopologyEdge objects connecting nodes
   }
10. "stakeholders": Array of 4 personas (e.g. CFO, VP Product, Chief Security Officer, Head of Platform/Ops) with id, name, title, role, avatar, personality, bias, hiddenAgenda, negotiationTolerance, baseTrust (40-70), decisionWeights: { financialAcumen, deliverySpeed, architecturalRigor, regulatoryCompliance }, sampleDialogue
11. "roundEvents": 4 events (one per round: Q1, Q2, Q3, Q4) with title, description, type ('DISRUPTION'|'CRISIS'|'AUDIT'|'MARKET_SHIFT'), severity, immediateImpact, choices (array of 3 distinct remediation choices)
12. "initiativesCatalog": Array of 8-10 actionable initiatives players can fund (modernization, fast features, refactoring, microservices, cloud migrations) with capExCost, opExDelta, tdiDelta, velocityDelta, resilienceDelta, complianceDelta, affectedNodeIds, durationRounds, riskLevel.`;

    const userPrompt = `Generate the complete scenario for ${prompt.industry}: ${prompt.businessChallenge}`;

    return this.generateJSON<Partial<Scenario>>(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, responseFormat: 'json', temperature: 0.7, timeoutMs: 90000 }
    );
  }
}
