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
    const systemPrompt = `You are an elite Enterprise Architect and Executive Simulation Designer.
Generate a complete, playable enterprise simulation scenario in strict JSON format based on:
Industry: ${prompt.industry}
Challenge: ${prompt.businessChallenge}
Difficulty: ${prompt.difficulty || 'INTERMEDIATE'}
Directives: ${prompt.customDirectives || 'Standard executive pressures'}

Respond ONLY with valid JSON matching this schema:
{
  "title": "Codename: Operation Title",
  "industry": "${prompt.industry}",
  "difficulty": "${prompt.difficulty || 'INTERMEDIATE'}",
  "description": "Executive overview of the transformation challenge (2 paragraphs)",
  "businessContext": "Detailed corporate history and bottlenecks",
  "baselineMetrics": {
    "tco": 2000, "budgetRemaining": 1400, "opEx": 500, "capExSpent": 300,
    "technicalDebtIndex": 68, "deliveryVelocity": 46, "stakeholderTrust": 54,
    "resilienceIndex": 50, "complianceScore": 62, "modernizedNodesCount": 1
  },
  "winLossConditions": {
    "maxTechnicalDebtIndex": 45, "minStakeholderTrustAvg": 60,
    "minDeliveryVelocity": 65, "minResilienceIndex": 72,
    "maxTCOBudget": 4200, "targetCapabilitiesModernized": 4
  },
  "totalRounds": 4,
  "topology": {
    "nodes": [
      {
        "id": "node-1", "name": "Client Portal / Touchpoint", "layer": "BUSINESS",
        "description": "Customer channel", "health": 75, "technicalDebt": 30,
        "criticalPath": true, "costPerRound": 45, "position": {"x": -5, "y": 5, "z": 0},
        "status": "HEALTHY", "dependencies": ["node-2"],
        "telemetry": {"latencyMs": 45, "throughputRps": 2200, "errorRatePercent": 0.1, "failureRisk": 18}
      },
      {
        "id": "node-2", "name": "Core Monolithic Transaction Service", "layer": "APPLICATION",
        "description": "Legacy monolith bottleneck", "health": 40, "technicalDebt": 82,
        "criticalPath": true, "costPerRound": 160, "position": {"x": 0, "y": 2, "z": 0},
        "status": "CRITICAL", "dependencies": ["node-3"],
        "telemetry": {"latencyMs": 680, "throughputRps": 550, "errorRatePercent": 3.8, "failureRisk": 85}
      },
      {
        "id": "node-3", "name": "Enterprise Core Database", "layer": "DATA",
        "description": "Shared relational database with table locks", "health": 48, "technicalDebt": 74,
        "criticalPath": true, "costPerRound": 110, "position": {"x": 0, "y": -2, "z": 0},
        "status": "DEGRADED", "dependencies": ["node-4"],
        "telemetry": {"latencyMs": 420, "throughputRps": 900, "errorRatePercent": 2.4, "failureRisk": 72}
      },
      {
        "id": "node-4", "name": "Primary Datacenter Infrastructure", "layer": "INFRASTRUCTURE",
        "description": "Aging on-prem server footprint", "health": 55, "technicalDebt": 65,
        "criticalPath": true, "costPerRound": 130, "position": {"x": 0, "y": -5, "z": 0},
        "status": "DEGRADED", "dependencies": [],
        "telemetry": {"latencyMs": 110, "throughputRps": 3200, "errorRatePercent": 0.9, "failureRisk": 50}
      },
      {
        "id": "node-5", "name": "Cloud Native Microservices Mesh", "layer": "APPLICATION",
        "description": "Decoupled modern services", "health": 90, "technicalDebt": 12,
        "criticalPath": false, "costPerRound": 50, "position": {"x": 5, "y": 2, "z": 0},
        "status": "MODERNIZED", "dependencies": ["node-6"],
        "telemetry": {"latencyMs": 22, "throughputRps": 3800, "errorRatePercent": 0.02, "failureRisk": 8}
      },
      {
        "id": "node-6", "name": "Kafka Event Streaming Fabric", "layer": "DATA",
        "description": "High-throughput asynchronous streaming bus", "health": 92, "technicalDebt": 10,
        "criticalPath": false, "costPerRound": 45, "position": {"x": 4, "y": -2, "z": 0},
        "status": "MODERNIZED", "dependencies": [],
        "telemetry": {"latencyMs": 8, "throughputRps": 8500, "errorRatePercent": 0.01, "failureRisk": 5}
      }
    ],
    "edges": [
      {"id": "e1", "fromId": "node-1", "toId": "node-2", "protocol": "HTTPS/REST", "bandwidthMbps": 1500, "status": "BOTTLENECK", "latencyMs": 320},
      {"id": "e2", "fromId": "node-2", "toId": "node-3", "protocol": "JDBC Direct Pool", "bandwidthMbps": 500, "status": "BOTTLENECK", "latencyMs": 480},
      {"id": "e3", "fromId": "node-3", "toId": "node-4", "protocol": "Storage Fiber", "bandwidthMbps": 1000, "status": "NORMAL", "latencyMs": 35},
      {"id": "e4", "fromId": "node-1", "toId": "node-5", "protocol": "mTLS gRPC", "bandwidthMbps": 2500, "status": "OPTIMIZED", "latencyMs": 14},
      {"id": "e5", "fromId": "node-5", "toId": "node-6", "protocol": "Kafka Wire", "bandwidthMbps": 5000, "status": "OPTIMIZED", "latencyMs": 6}
    ]
  },
  "stakeholders": [
    {
      "id": "sh-cfo", "name": "Marcus Vance", "title": "Chief Financial Officer",
      "role": "Corporate Finance", "avatar": "💼", "personality": "Conservative, margin-obsessed",
      "bias": "Demands payback within 2 quarters", "hiddenAgenda": "Avoid earnings per share dilution",
      "negotiationTolerance": 50, "baseTrust": 55,
      "decisionWeights": {"financialAcumen": 0.7, "deliverySpeed": 0.1, "architecturalRigor": 0.1, "regulatoryCompliance": 0.1},
      "sampleDialogue": {"greeting": "Show me the ROI.", "resistance": "CapEx is excessive.", "concession": "Lower ongoing OpEx and I agree."}
    },
    {
      "id": "sh-cpo", "name": "Priya Patel", "title": "VP of Product",
      "role": "Commercial Growth", "avatar": "🚀", "personality": "Fast-paced, growth-oriented",
      "bias": "Cannot tolerate feature roadmap freezes", "hiddenAgenda": "Hit Q3 customer growth bonuses",
      "negotiationTolerance": 45, "baseTrust": 60,
      "decisionWeights": {"financialAcumen": 0.1, "deliverySpeed": 0.7, "architecturalRigor": 0.1, "regulatoryCompliance": 0.1},
      "sampleDialogue": {"greeting": "When do we ship?", "resistance": "Refactoring slows us down.", "concession": "Guarantee parallel squads and I support."}
    },
    {
      "id": "sh-cto", "name": "Dr. Elena Rostova", "title": "Chief Enterprise Architect",
      "role": "Architecture Governance", "avatar": "🛡️", "personality": "Principled, rigor-focused",
      "bias": "Opposes direct database shortcuts", "hiddenAgenda": "Establish domain-driven standards",
      "negotiationTolerance": 65, "baseTrust": 65,
      "decisionWeights": {"financialAcumen": 0.15, "deliverySpeed": 0.1, "architecturalRigor": 0.65, "regulatoryCompliance": 0.1},
      "sampleDialogue": {"greeting": "Shortcuts compound into outages.", "resistance": "Direct coupling will break.", "concession": "Use strangler fig patterns."}
    }
  ],
  "roundEvents": [
    {
      "roundNumber": 1, "title": "Q1: Challenger Feature Surge", "description": "Competitor launched agile features pulling customer share.",
      "type": "COMPETITIVE_SURGE", "severity": "MEDIUM",
      "immediateImpact": {"budgetFine": 50, "tdiSurge": 6, "velocityPenalty": 0},
      "choices": [
        {"id": "ev1-1", "text": "Deploy quick API bypass patch", "capExImpact": 60, "tdiImpact": 14, "velocityImpact": 15, "trustImpact": {"sh-cpo": 12, "sh-cto": -14}},
        {"id": "ev1-2", "text": "Build decoupled microservice contract", "capExImpact": 140, "tdiImpact": -8, "velocityImpact": -5, "trustImpact": {"sh-cto": 14, "sh-cpo": -6}}
      ]
    },
    {
      "roundNumber": 2, "title": "Q2: Regulatory Compliance Audit", "description": "Unannounced federal audit on legacy security and encryption.",
      "type": "AUDIT", "severity": "HIGH",
      "immediateImpact": {"budgetFine": 110, "tdiSurge": 0, "velocityPenalty": -10},
      "choices": [
        {"id": "ev2-1", "text": "Execute zero-trust audit remediation", "capExImpact": 160, "tdiImpact": -10, "velocityImpact": 5, "trustImpact": {"sh-cto": 12}},
        {"id": "ev2-2", "text": "Apply surface patches and pay penalty", "capExImpact": 70, "tdiImpact": 6, "velocityImpact": 0, "trustImpact": {"sh-cto": -12, "sh-cfo": 6}}
      ]
    },
    {
      "roundNumber": 3, "title": "Q3: Monolith Deadlock Crisis", "description": "High volume locks transaction tables for 40 minutes.",
      "type": "CRISIS", "severity": "BLACK_SWAN",
      "immediateImpact": {"budgetFine: 240, "tdiSurge": 8, "velocityPenalty: -20},
      "choices": [
        {"id": "ev3-1", "text": "Emergency Kafka read-replica sharding", "capExImpact": 180, "tdiImpact": -14, "velocityImpact": 6, "trustImpact": {"sh-cto": 16, "sh-cfo": -10}},
        {"id": "ev3-2", "text": "Overprovision hardware compute", "capExImpact": 240, "tdiImpact": 6, "velocityImpact": -4, "trustImpact": {"sh-cfo": -16, "sh-cpo": 8}}
      ]
    },
    {
      "roundNumber": 4, "title": "Q4: Executive Board Modernization Review", "description": "Final review of transformation progress and debt reduction.",
      "type": "MARKET_SHIFT", "severity": "HIGH",
      "immediateImpact": {"budgetFine: 0, "tdiSurge": 0, "velocityPenalty": 0},
      "choices": [
        {"id": "ev4-1", "text": "Present modernization achievements and scale roadmap", "capExImpact": 90, "tdiImpact": -4, "velocityImpact": 8, "trustImpact": {"sh-cfo": 10, "sh-cpo": 10, "sh-cto": 12}},
        {"id": "ev4-2", "text": "Enact budget freeze to inflate short-term cash reserves", "capExImpact": -80, "tdiImpact": 10, "velocityImpact: -14, "trustImpact": {"sh-cfo": 16, "sh-cto": -16, "sh-cpo": -12}}
      ]
    }
  ],
  "initiativesCatalog": [
    {
      "id": "init-strangler", "name": "Strangler Fig Core Modernization", "category": "MODERNIZATION",
      "description": "Decouple legacy monolith into domain microservices with anti-corruption layer.",
      "capExCost": 300, "opExDelta": -35, "tdiDelta": -20, "velocityDelta": 15,
      "resilienceDelta": 18, "complianceDelta": 10, "trustDelta": {"sh-cto": 14, "sh-cpo": 6},
      "affectedNodeIds": ["node-2", "node-5"], "durationRounds": 1, "riskLevel": "MEDIUM"
    },
    {
      "id": "init-kafka-bus", "name": "Event-Driven Messaging & Kafka Decoupling", "category": "MODERNIZATION",
      "description": "Replace synchronous point-to-point batch calls with distributed event streams.",
      "capExCost": 240, "opExDelta": -20, "tdiDelta": -15, "velocityDelta": 12,
      "resilienceDelta": 20, "complianceDelta": 6, "trustDelta": {"sh-cto": 12},
      "affectedNodeIds": ["node-3", "node-6"], "durationRounds": 1, "riskLevel": "LOW"
    },
    {
      "id": "init-cloud-mesh", "name": "Multi-Region Cloud Infrastructure Migration", "category": "CLOUD_INFRA",
      "description": "Retire bare-metal servers and deploy containerized autoscaling cloud mesh.",
      "capExCost": 340, "opExDelta": -40, "tdiDelta": -16, "velocityDelta": 14,
      "resilienceDelta": 24, "complianceDelta": 12, "trustDelta": {"sh-cfo": 10, "sh-cto": 12},
      "affectedNodeIds": ["node-4"], "durationRounds": 1, "riskLevel": "HIGH"
    },
    {
      "id": "init-feature-bypass", "name": "Fast-Track Direct Feature Surge", "category": "FEATURE_EXPEDITE",
      "description": "Bypass architecture standards to deploy urgent revenue-generating features.",
      "capExCost": 120, "opExDelta": 40, "tdiDelta": 18, "velocityDelta": 24,
      "resilienceDelta": -15, "complianceDelta": -18, "trustDelta": {"sh-cpo": 20, "sh-cto": -22},
      "affectedNodeIds": ["node-1", "node-2"], "durationRounds": 1, "riskLevel": "EXTREME"
    }
  ]
}`;

    const userPrompt = `Synthesize a realistic scenario for:
Industry: ${prompt.industry}
Challenge: ${prompt.businessChallenge}
Difficulty: ${prompt.difficulty || 'INTERMEDIATE'}
Target Output: Adapt all node names, stakeholder titles, round events, and initiatives to directly reflect ${prompt.businessChallenge}.`;

    return this.generateJSON<Partial<Scenario>>(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, responseFormat: 'json', temperature: 0.6, timeoutMs: 180000 }
    );
  }
}
