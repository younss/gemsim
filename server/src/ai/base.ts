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
      return JSON.parse(rawText) as T;
    } catch {
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/gi, '')
        .trim();
      
      try {
        return JSON.parse(cleaned) as T;
      } catch {
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
    "empathyScore": number (0 to 100),
    "financialAcumenScore": number (0 to 100),
    "strategicAlignmentScore": number (0 to 100),
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
      { systemPrompt, responseFormat: 'json', temperature: 0.6, timeoutMs: 60000 }
    );
  }

  public async generateScenario(
    prompt: ScenarioGenerationPrompt
  ): Promise<Partial<Scenario>> {
    const systemPrompt = `You are an elite Enterprise Architect and Executive Simulation Game Designer.
Your task is to transform the user's scenario specification into a complete, operational, playable enterprise simulation scenario in strict JSON format.

CRITICAL DESIGN DIRECTIVES:
1. DOMAIN & PROMPT FIDELITY: You MUST invent or extract all scenario elements directly from the user's prompt. NEVER output hardcoded defaults (such as "Marcus Vance", "Priya Patel", "Dr. Elena Rostova", "Strangler Fig Core", or generic banking monoliths) unless the prompt specifically asks for them.
2. LANGUAGE RULE: If the user's prompt is in French, generate ALL titles, descriptions, stakeholder names, dialogues, round event dilemmas, and initiative names in French! If in English, in English.
3. 3D SPATIAL TOPOLOGY: Build a realistic spatial topology (minimum 6 nodes, 6 edges) reflecting the problem domain:
   - If the prompt specifies Onshore vs Offshore (or Cloud vs Edge): place Onshore / Core nodes on the left (x: -7 to -2), Central Bridge / Governance nodes at (x: 0), and Offshore / External nodes on the right (x: 2 to 7).
   - Assign realistic positions: layer ('BUSINESS', 'APPLICATION', 'DATA', 'INFRASTRUCTURE'), health (10-100), technicalDebt (0-100), telemetry.
4. AUTONOMOUS PERSONAS: Generate 3 to 4 executive NPCs directly matching the factions in the prompt (e.g. CFO / Finance, Vendor / ESN Account Director, Onshore Operations Delivery Lead). Include their distinct personality, hidden agenda, biases, decision weights, and reactive dialogue.
5. 4-QUARTER CHRONOLOGICAL TIMELINE: Generate exactly 4 round events (Q1, Q2, Q3, Q4) with meaningful strategic dilemmas and selectable remediation choices matching the story arc.
6. STRATEGIC INITIATIVES CATALOG: Generate 4 to 6 strategic initiatives directly addressing the trade-offs described in the prompt.

Output ONLY valid JSON matching this structure:
{
  "title": "<Specific, evocative scenario title, e.g. from prompt>",
  "industry": "${prompt.industry}",
  "difficulty": "${prompt.difficulty || 'INTERMEDIATE'}",
  "description": "<Executive overview in 2 paragraphs tailored to the prompt>",
  "businessContext": "<Detailed corporate context and crisis triggers from the prompt>",
  "baselineMetrics": {
    "tco": 2200, "budgetRemaining": 1500, "opEx": 550, "capExSpent": 350,
    "technicalDebtIndex": 45, "deliveryVelocity": 55, "stakeholderTrust": 45,
    "resilienceIndex": 50, "complianceScore": 75, "modernizedNodesCount": 1
  },
  "winLossConditions": {
    "maxTechnicalDebtIndex": 45, "minStakeholderTrustAvg": 60,
    "minDeliveryVelocity": 65, "minResilienceIndex": 70,
    "maxTCOBudget": 4500, "targetCapabilitiesModernized": 4
  },
  "totalRounds": 4,
  "topology": {
    "nodes": [
      {
        "id": "node-1", "name": "<Node Name reflecting the domain>", "layer": "BUSINESS",
        "description": "<Component role in the enterprise architecture>", "health": 70, "technicalDebt": 35,
        "criticalPath": true, "costPerRound": 50, "position": {"x": -6, "y": 4, "z": 0},
        "status": "HEALTHY", "dependencies": ["node-2"],
        "telemetry": {"latencyMs": 50, "throughputRps": 2000, "errorRatePercent": 0.1, "failureRisk": 20}
      },
      {
        "id": "node-2", "name": "<Critical Core/Monolith or Gateway Node>", "layer": "APPLICATION",
        "description": "<System description>", "health": 45, "technicalDebt": 75,
        "criticalPath": true, "costPerRound": 150, "position": {"x": -2, "y": 2, "z": 0},
        "status": "CRITICAL", "dependencies": ["node-3"],
        "telemetry": {"latencyMs": 600, "throughputRps": 600, "errorRatePercent": 3.5, "failureRisk": 80}
      },
      {
        "id": "node-3", "name": "<Integration Bridge / Cross-Border Pipeline / Data Fabric>", "layer": "INFRASTRUCTURE",
        "description": "<Bridge between architectures>", "health": 60, "technicalDebt": 50,
        "criticalPath": true, "costPerRound": 80, "position": {"x": 0, "y": 0, "z": 0},
        "status": "DEGRADED", "dependencies": ["node-4"],
        "telemetry": {"latencyMs": 150, "throughputRps": 1800, "errorRatePercent": 1.2, "failureRisk": 45}
      },
      {
        "id": "node-4", "name": "<External / Offshore / Remote Delivery Node>", "layer": "APPLICATION",
        "description": "<Remote delivery center or cloud cluster>", "health": 55, "technicalDebt": 65,
        "criticalPath": false, "costPerRound": 90, "position": {"x": 4, "y": 2, "z": 0},
        "status": "DEGRADED", "dependencies": [],
        "telemetry": {"latencyMs": 280, "throughputRps": 1200, "errorRatePercent": 2.0, "failureRisk": 60}
      },
      {
        "id": "node-5", "name": "<Core Database / Sovereign Vault>", "layer": "DATA",
        "description": "<Regulated data storage>", "health": 65, "technicalDebt": 55,
        "criticalPath": true, "costPerRound": 100, "position": {"x": -4, "y": -3, "z": 0},
        "status": "HEALTHY", "dependencies": [],
        "telemetry": {"latencyMs": 80, "throughputRps": 3000, "errorRatePercent": 0.3, "failureRisk": 35}
      },
      {
        "id": "node-6", "name": "<Remote Software Factory / Secondary Node>", "layer": "APPLICATION",
        "description": "<Distributed feature factory>", "health": 50, "technicalDebt": 70,
        "criticalPath": false, "costPerRound": 60, "position": {"x": 6, "y": 5, "z": 0},
        "status": "DEGRADED", "dependencies": [],
        "telemetry": {"latencyMs": 320, "throughputRps": 800, "errorRatePercent": 2.5, "failureRisk": 65}
      }
    ],
    "edges": [
      {"id": "e1", "fromId": "node-1", "toId": "node-2", "protocol": "HTTPS/REST", "bandwidthMbps": 1000, "status": "NORMAL", "latencyMs": 30},
      {"id": "e2", "fromId": "node-2", "toId": "node-3", "protocol": "CI/CD Pipeline", "bandwidthMbps": 500, "status": "BOTTLENECK", "latencyMs": 220},
      {"id": "e3", "fromId": "node-3", "toId": "node-4", "protocol": "VPN Transfrontalier", "bandwidthMbps": 300, "status": "BOTTLENECK", "latencyMs": 290},
      {"id": "e4", "fromId": "node-2", "toId": "node-5", "protocol": "JDBC Direct Pool", "bandwidthMbps": 1500, "status": "OPTIMIZED", "latencyMs": 20},
      {"id": "e5", "fromId": "node-4", "toId": "node-6", "protocol": "Remote Git / Code Stream", "bandwidthMbps": 1000, "status": "NORMAL", "latencyMs": 110}
    ]
  },
  "stakeholders": [
    {
      "id": "sh-1", "name": "<Stakeholder 1 Name>", "title": "<Executive Title, e.g. CFO>",
      "role": "<Role in the organization>", "avatar": "💼", "personality": "<Psychological description>",
      "bias": "<Primary bias>", "hiddenAgenda": "<Secret objective>",
      "negotiationTolerance": 45, "baseTrust": 50,
      "decisionWeights": {"financialAcumen": 0.6, "deliverySpeed": 0.2, "architecturalRigor": 0.1, "regulatoryCompliance": 0.1},
      "sampleDialogue": {"greeting": "<In-character greeting>", "resistance": "<Pushback statement>", "concession": "<Condition for agreement>"}
    },
    {
      "id": "sh-2", "name": "<Stakeholder 2 Name>", "title": "<Executive Title, e.g. Vendor / ESN Director>",
      "role": "<Role in the organization>", "avatar": "🌍", "personality": "<Psychological description>",
      "bias": "<Primary bias>", "hiddenAgenda": "<Secret objective>",
      "negotiationTolerance": 55, "baseTrust": 50,
      "decisionWeights": {"financialAcumen": 0.2, "deliverySpeed": 0.5, "architecturalRigor": 0.1, "regulatoryCompliance": 0.2},
      "sampleDialogue": {"greeting": "<In-character greeting>", "resistance": "<Pushback statement>", "concession": "<Condition for agreement>"}
    },
    {
      "id": "sh-3", "name": "<Stakeholder 3 Name>", "title": "<Executive Title, e.g. Delivery / Operations Lead>",
      "role": "<Role in the organization>", "avatar": "⚠️", "personality": "<Psychological description>",
      "bias": "<Primary bias>", "hiddenAgenda": "<Secret objective>",
      "negotiationTolerance": 35, "baseTrust": 60,
      "decisionWeights": {"financialAcumen": 0.1, "deliverySpeed": 0.2, "architecturalRigor": 0.4, "regulatoryCompliance": 0.3},
      "sampleDialogue": {"greeting": "<In-character greeting>", "resistance": "<Pushback statement>", "concession": "<Condition for agreement>"}
    }
  ],
  "roundEvents": [
    {
      "roundNumber": 1, "title": "<Q1 Event Title matching the prompt's 1st challenge>",
      "description": "<Contextual event description>", "type": "COMPETITIVE_SURGE", "severity": "MEDIUM",
      "immediateImpact": {"budgetFine": 60, "tdiSurge": 8, "velocityPenalty": -10},
      "choices": [
        {"id": "ev1-1", "text": "<Dilemma Option A>", "capExImpact": 120, "tdiImpact": -8, "velocityImpact": -5, "trustImpact": {"sh-1": -5, "sh-3": 12}},
        {"id": "ev1-2", "text": "<Dilemma Option B>", "capExImpact": 40, "tdiImpact": 12, "velocityImpact": 10, "trustImpact": {"sh-1": 10, "sh-3": -12}}
      ]
    },
    {
      "roundNumber": 2, "title": "<Q2 Event Title matching the prompt's 2nd challenge>",
      "description": "<Contextual event description>", "type": "AUDIT", "severity": "HIGH",
      "immediateImpact": {"budgetFine": 120, "tdiSurge": 6, "velocityPenalty": -15},
      "choices": [
        {"id": "ev2-1", "text": "<Dilemma Option A>", "capExImpact": 150, "tdiImpact": -10, "velocityImpact": 5, "trustImpact": {"sh-3": 14, "sh-1": -8}},
        {"id": "ev2-2", "text": "<Dilemma Option B>", "capExImpact": 60, "tdiImpact": 8, "velocityImpact": -5, "trustImpact": {"sh-2": 8, "sh-3": -10}}
      ]
    },
    {
      "roundNumber": 3, "title": "<Q3 Event Title matching the prompt's 3rd challenge>",
      "description": "<Contextual event description>", "type": "CRISIS", "severity": "BLACK_SWAN",
      "immediateImpact": {"budgetFine": 200, "tdiSurge": 10, "velocityPenalty": -20},
      "choices": [
        {"id": "ev3-1", "text": "<Dilemma Option A>", "capExImpact": 180, "tdiImpact": -12, "velocityImpact": 8, "trustImpact": {"sh-3": 15, "sh-1": -10}},
        {"id": "ev3-2", "text": "<Dilemma Option B>", "capExImpact": 90, "tdiImpact": 10, "velocityImpact": -10, "trustImpact": {"sh-2": 10, "sh-3": -15}}
      ]
    },
    {
      "roundNumber": 4, "title": "<Q4 Event Title matching the prompt's 4th challenge / Target Model>",
      "description": "<Contextual event description>", "type": "MARKET_SHIFT", "severity": "HIGH",
      "immediateImpact": {"budgetFine": 0, "tdiSurge": 0, "velocityPenalty": 0},
      "choices": [
        {"id": "ev4-1", "text": "<Target Model Option A>", "capExImpact": 100, "tdiImpact": -6, "velocityImpact": 10, "trustImpact": {"sh-1": 12, "sh-3": 10}},
        {"id": "ev4-2", "text": "<Target Model Option B>", "capExImpact": 0, "tdiImpact": 14, "velocityImpact": -10, "trustImpact": {"sh-2": 15, "sh-3": -20}}
      ]
    }
  ],
  "initiativesCatalog": [
    {
      "id": "init-1", "name": "<Strategic Initiative 1 directly reflecting prompt solution>", "category": "MODERNIZATION",
      "description": "<Detailed description of architectural initiative>",
      "capExCost": 280, "opExDelta": -35, "tdiDelta": -18, "velocityDelta": 15,
      "resilienceDelta": 20, "complianceDelta": 12, "trustDelta": {"sh-3": 14, "sh-1": 6},
      "affectedNodeIds": ["node-2", "node-3"], "durationRounds": 1, "riskLevel": "MEDIUM"
    },
    {
      "id": "init-2", "name": "<Strategic Initiative 2 directly reflecting prompt solution>", "category": "MODERNIZATION",
      "description": "<Detailed description of architectural initiative>",
      "capExCost": 220, "opExDelta": -20, "tdiDelta": -14, "velocityDelta": 12,
      "resilienceDelta": 16, "complianceDelta": 10, "trustDelta": {"sh-3": 12},
      "affectedNodeIds": ["node-3", "node-4"], "durationRounds": 1, "riskLevel": "LOW"
    },
    {
      "id": "init-3", "name": "<Strategic Initiative 3 directly reflecting prompt solution>", "category": "CLOUD_INFRA",
      "description": "<Detailed description of architectural initiative>",
      "capExCost": 320, "opExDelta": -40, "tdiDelta": -16, "velocityDelta": 14,
      "resilienceDelta": 22, "complianceDelta": 14, "trustDelta": {"sh-1": 10, "sh-3": 12},
      "affectedNodeIds": ["node-4", "node-6"], "durationRounds": 1, "riskLevel": "HIGH"
    },
    {
      "id": "init-4", "name": "<Strategic Initiative 4 directly reflecting prompt trade-off>", "category": "FEATURE_EXPEDITE",
      "description": "<Detailed description of architectural initiative>",
      "capExCost": 110, "opExDelta": 35, "tdiDelta": 16, "velocityDelta": 22,
      "resilienceDelta": -12, "complianceDelta": -16, "trustDelta": {"sh-2": 18, "sh-3": -20},
      "affectedNodeIds": ["node-1", "node-4"], "durationRounds": 1, "riskLevel": "EXTREME"
    }
  ]
}`;

    const userPrompt = `Synthesize a realistic scenario strictly adhering to this specification:
Industry: ${prompt.industry}
Challenge & Specification: ${prompt.businessChallenge}
Difficulty: ${prompt.difficulty || 'INTERMEDIATE'}
Directives: ${prompt.customDirectives || 'Full architectural and executive realism'}

IMPORTANT: Extract or synthesize all titles, names, node architecture, stakeholder personas, round dilemmas, and initiatives directly from the Challenge text. If the Challenge is in French, respond entirely in French!`;

    return this.generateJSON<Partial<Scenario>>(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, responseFormat: 'json', temperature: 0.6, timeoutMs: 300000 }
    );
  }
}
