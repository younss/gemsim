// ============================================================================
// GEMSIM: AI GAME STUDIO SCENARIO GENERATOR & VALIDATOR
// Synthesizes and strictly validates full multi-round scenario schemas
// ============================================================================

import { AIRegistry } from './registry.js';
import { FallbackProvider } from './fallback.js';
import { ScenarioGenerationPrompt } from './types.js';
import { Scenario, TopologyNode, TopologyEdge, StakeholderPersona, RoundEvent, InitiativeTemplate } from '../types/index.js';

export class StudioScenarioGenerator {
  /**
   * Generates and validates a scenario from user prompt using the active AI provider
   */
  public static async generate(prompt: ScenarioGenerationPrompt): Promise<Scenario> {
    const registry = AIRegistry.getInstance();

    const { result: rawScenario, usedProvider } = await registry.executeWithFallback(async (provider) => {
      return provider.generateScenario(prompt);
    });

    console.log(`[StudioScenarioGenerator] Generated scenario using provider: ${usedProvider}`);

    // Validate and sanitize
    return this.validateAndEnrich(rawScenario, prompt, usedProvider);
  }

  /**
   * Validates and enriches partial AI output to guarantee complete playable scenario schema
   */
  public static validateAndEnrich(
    raw: Partial<Scenario>,
    prompt: ScenarioGenerationPrompt,
    providerUsed: string
  ): Scenario {
    const dynamicBlueprint = FallbackProvider.createDynamicScenario(prompt);

    const id = raw.id || `scen-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const title = raw.title || dynamicBlueprint.title;
    const industry = raw.industry || prompt.industry || 'Enterprise Technology';
    const difficulty = raw.difficulty || prompt.difficulty || 'INTERMEDIATE';
    const description = raw.description || dynamicBlueprint.description;
    const businessContext = raw.businessContext || prompt.businessChallenge || dynamicBlueprint.businessContext;

    // Validate nodes
    const rawNodes = Array.isArray(raw.topology?.nodes) ? raw.topology.nodes : [];
    const nodes: TopologyNode[] = rawNodes.length >= 4 ? rawNodes.map((n, i) => ({
      id: n.id || `node-${i + 1}`,
      name: n.name || `System Node ${i + 1}`,
      layer: n.layer || (i % 4 === 0 ? 'BUSINESS' : i % 4 === 1 ? 'APPLICATION' : i % 4 === 2 ? 'DATA' : 'INFRASTRUCTURE'),
      description: n.description || 'Enterprise component',
      health: typeof n.health === 'number' ? Math.max(10, Math.min(100, n.health)) : 65,
      technicalDebt: typeof n.technicalDebt === 'number' ? Math.max(0, Math.min(100, n.technicalDebt)) : 45,
      criticalPath: Boolean(n.criticalPath),
      costPerRound: n.costPerRound || 40,
      position: n.position || {
        x: ((i % 3) - 1) * 4,
        y: (Math.floor(i / 3) - 1) * 4,
        z: (i % 2 === 0 ? 1 : -1) * 2,
      },
      status: n.status || (n.technicalDebt > 60 ? 'DEGRADED' : 'HEALTHY'),
      dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
      telemetry: n.telemetry || {
        latencyMs: 45,
        throughputRps: 1200,
        errorRatePercent: 0.1,
        failureRisk: 20,
      },
    })) : dynamicBlueprint.topology.nodes;

    // Validate edges
    const nodeIds = new Set(nodes.map(n => n.id));
    const rawEdges = Array.isArray(raw.topology?.edges) ? raw.topology.edges : [];
    const edges: TopologyEdge[] = rawEdges.filter(e => nodeIds.has(e.fromId) && nodeIds.has(e.toId)).map((e, idx) => ({
      id: e.id || `edge-${idx + 1}`,
      fromId: e.fromId,
      toId: e.toId,
      protocol: e.protocol || 'HTTPS/REST',
      bandwidthMbps: e.bandwidthMbps || 1000,
      status: e.status || 'NORMAL',
      latencyMs: e.latencyMs || 25,
    }));

    if (edges.length === 0) {
      edges.push(...dynamicBlueprint.topology.edges);
    }

    // Validate stakeholders
    const rawStakeholders = Array.isArray(raw.stakeholders) ? raw.stakeholders : [];
    const stakeholders: StakeholderPersona[] = rawStakeholders.length >= 2 ? rawStakeholders.map((s, idx) => ({
      id: s.id || `sh-${idx + 1}`,
      name: s.name || `Executive ${idx + 1}`,
      title: s.title || 'Department VP',
      role: s.role || 'Business Leadership',
      avatar: s.avatar || '👔',
      personality: s.personality || 'Pragmatic executive',
      bias: s.bias || 'Balanced risk vs delivery',
      hiddenAgenda: s.hiddenAgenda || 'Meeting division targets',
      negotiationTolerance: typeof s.negotiationTolerance === 'number' ? s.negotiationTolerance : 50,
      baseTrust: typeof s.baseTrust === 'number' ? s.baseTrust : 60,
      decisionWeights: s.decisionWeights || {
        financialAcumen: 0.25,
        deliverySpeed: 0.25,
        architecturalRigor: 0.25,
        regulatoryCompliance: 0.25,
      },
      sampleDialogue: s.sampleDialogue || {
        greeting: 'Let us see the plan.',
        resistance: 'I have concerns about the timeline.',
        concession: 'If we can maintain service reliability, we agree.',
      },
    })) : dynamicBlueprint.stakeholders;

    // Validate round events
    const rawEvents = Array.isArray(raw.roundEvents) ? raw.roundEvents : [];
    const roundEvents: RoundEvent[] = rawEvents.length >= 4 ? rawEvents : dynamicBlueprint.roundEvents;

    // Validate initiatives
    const rawInitiatives = Array.isArray(raw.initiativesCatalog) ? raw.initiativesCatalog : [];
    const initiativesCatalog: InitiativeTemplate[] = rawInitiatives.length >= 4 ? rawInitiatives : dynamicBlueprint.initiativesCatalog;

    return {
      id,
      title,
      industry,
      difficulty,
      description,
      businessContext,
      baselineMetrics: raw.baselineMetrics || dynamicBlueprint.baselineMetrics,
      winLossConditions: raw.winLossConditions || dynamicBlueprint.winLossConditions,
      totalRounds: 4,
      topology: { nodes, edges },
      stakeholders,
      roundEvents,
      initiativesCatalog,
      tags: raw.tags || [industry, 'Architecture Strategy', difficulty],
      author: raw.author || `AI Studio (${providerUsed})`,
      isDefault: false,
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }
}

