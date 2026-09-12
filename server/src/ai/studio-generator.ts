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
    let nodes: TopologyNode[];
    if (rawNodes.length >= 1) {
      nodes = rawNodes.map((n, i) => ({
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
      }));
      // Pad to at least 4 if fewer were generated
      if (nodes.length < 4) {
        const existingIds = new Set(nodes.map(n => n.id));
        for (const blueprintNode of dynamicBlueprint.topology.nodes) {
          if (!existingIds.has(blueprintNode.id)) {
            nodes.push(blueprintNode);
            existingIds.add(blueprintNode.id);
            if (nodes.length >= 4) break;
          }
        }
      }
    } else {
      nodes = dynamicBlueprint.topology.nodes;
    }

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
    let stakeholders: StakeholderPersona[];
    if (rawStakeholders.length >= 1) {
      stakeholders = rawStakeholders.map((s, idx) => ({
        id: s.id || `sh-${idx + 1}`,
        name: s.name || `Executive ${idx + 1}`,
        title: s.title || 'Department VP',
        role: s.role || 'Business Leadership',
        avatar: s.avatar || (idx === 0 ? '💼' : idx === 1 ? '🌍' : '⚠️'),
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
          greeting: 'Let us review the plan.',
          resistance: 'I have concerns about the operational tradeoffs.',
          concession: 'If we can maintain service reliability, we agree.',
        },
      }));
      // Pad to at least 3 if needed
      if (stakeholders.length < 3) {
        const existingIds = new Set(stakeholders.map(s => s.id));
        for (const blueprintStakeholder of dynamicBlueprint.stakeholders) {
          if (!existingIds.has(blueprintStakeholder.id)) {
            stakeholders.push(blueprintStakeholder);
            existingIds.add(blueprintStakeholder.id);
            if (stakeholders.length >= 3) break;
          }
        }
      }
    } else {
      stakeholders = dynamicBlueprint.stakeholders;
    }

    // Validate round events
    const rawEvents = Array.isArray(raw.roundEvents) ? raw.roundEvents : [];
    let roundEvents: RoundEvent[];
    if (rawEvents.length >= 1) {
      const validRounds: RoundEvent[] = rawEvents.map((e, idx) => ({
        roundNumber: e.roundNumber || idx + 1,
        title: e.title || `Q${idx + 1} Strategic Disruption`,
        description: e.description || 'Unexpected market or technology shift.',
        type: e.type || 'DISRUPTION',
        severity: e.severity || 'MEDIUM',
        immediateImpact: e.immediateImpact || { budgetFine: 50, tdiSurge: 5, velocityPenalty: -8 },
        choices: Array.isArray(e.choices) && e.choices.length > 0 ? e.choices.map((c, cIdx) => ({
          id: c.id || `ev${idx + 1}-${cIdx + 1}`,
          text: c.text || `Strategic option ${cIdx + 1}`,
          capExImpact: typeof c.capExImpact === 'number' ? c.capExImpact : 80,
          tdiImpact: typeof c.tdiImpact === 'number' ? c.tdiImpact : -6,
          velocityImpact: typeof c.velocityImpact === 'number' ? c.velocityImpact : 5,
          trustImpact: c.trustImpact || {},
          nodeHealthImpacts: c.nodeHealthImpacts,
        })) : [
          { id: `ev${idx + 1}-1`, text: 'Execute architectural remediation strategy', capExImpact: 120, tdiImpact: -8, velocityImpact: -4, trustImpact: {} },
          { id: `ev${idx + 1}-2`, text: 'Accept operational compromise and defer technical debt', capExImpact: 40, tdiImpact: 10, velocityImpact: 8, trustImpact: {} },
        ],
      }));

      // Pad up to 4 if fewer than 4 were generated
      while (validRounds.length < 4) {
        const nextRoundNum = validRounds.length + 1;
        const bp = dynamicBlueprint.roundEvents.find(r => r.roundNumber === nextRoundNum) || dynamicBlueprint.roundEvents[nextRoundNum - 1];
        if (bp) {
          validRounds.push({ ...bp, roundNumber: nextRoundNum });
        } else {
          break;
        }
      }
      roundEvents = validRounds.slice(0, 4);
    } else {
      roundEvents = dynamicBlueprint.roundEvents;
    }

    // Validate initiatives
    const rawInitiatives = Array.isArray(raw.initiativesCatalog) ? raw.initiativesCatalog : [];
    let initiativesCatalog: InitiativeTemplate[];
    if (rawInitiatives.length >= 1) {
      initiativesCatalog = rawInitiatives.map((init, idx) => ({
        id: init.id || `init-${idx + 1}`,
        name: init.name || `Strategic Initiative ${idx + 1}`,
        category: init.category || 'MODERNIZATION',
        description: init.description || 'Targeted architectural refactoring initiative.',
        capExCost: typeof init.capExCost === 'number' ? init.capExCost : 200,
        opExDelta: typeof init.opExDelta === 'number' ? init.opExDelta : -20,
        tdiDelta: typeof init.tdiDelta === 'number' ? init.tdiDelta : -12,
        velocityDelta: typeof init.velocityDelta === 'number' ? init.velocityDelta : 10,
        resilienceDelta: typeof init.resilienceDelta === 'number' ? init.resilienceDelta : 14,
        complianceDelta: typeof init.complianceDelta === 'number' ? init.complianceDelta : 8,
        trustDelta: init.trustDelta || {},
        affectedNodeIds: Array.isArray(init.affectedNodeIds) && init.affectedNodeIds.length > 0
          ? init.affectedNodeIds.filter(id => nodeIds.has(id))
          : [nodes[0]?.id || 'node-1'],
        durationRounds: init.durationRounds || 1,
        riskLevel: init.riskLevel || 'MEDIUM',
      }));

      while (initiativesCatalog.length < 4) {
        const nextInit = dynamicBlueprint.initiativesCatalog[initiativesCatalog.length];
        if (nextInit) {
          initiativesCatalog.push(nextInit);
        } else {
          break;
        }
      }
    } else {
      initiativesCatalog = dynamicBlueprint.initiativesCatalog;
    }

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
      author: raw.author || (providerUsed === 'fallback' ? 'AI Studio (Heuristic Engine)' : `AI Studio (${providerUsed})`),
      isDefault: false,
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }
}

