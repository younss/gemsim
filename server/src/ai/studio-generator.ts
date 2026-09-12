// ============================================================================
// GEMSIM: AI GAME STUDIO SCENARIO GENERATOR & VALIDATOR
// Synthesizes and strictly validates full multi-round scenario schemas
// ============================================================================

import { AIRegistry } from './registry.js';
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
    const id = raw.id || `scen-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const title = raw.title || `${prompt.industry} Modernization: Crisis Operation`;
    const industry = raw.industry || prompt.industry || 'Enterprise Technology';
    const difficulty = raw.difficulty || prompt.difficulty || 'INTERMEDIATE';
    const description = raw.description || `Enterprise architecture simulation for ${industry}.`;
    const businessContext = raw.businessContext || prompt.businessChallenge || 'Accelerating digital transformation under tech debt.';

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
    })) : this.createFallbackNodes(industry);

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
      // Connect sequentially by layer if no edges were generated
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-auto-${i + 1}`,
          fromId: nodes[i].id,
          toId: nodes[i + 1].id,
          protocol: 'HTTPS/REST',
          bandwidthMbps: 1000,
          status: 'NORMAL',
          latencyMs: 20,
        });
      }
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
    })) : this.createFallbackStakeholders();

    // Validate round events
    const rawEvents = Array.isArray(raw.roundEvents) ? raw.roundEvents : [];
    const roundEvents: RoundEvent[] = rawEvents.length >= 4 ? rawEvents : this.createFallbackEvents();

    // Validate initiatives
    const rawInitiatives = Array.isArray(raw.initiativesCatalog) ? raw.initiativesCatalog : [];
    const initiativesCatalog: InitiativeTemplate[] = rawInitiatives.length >= 4 ? rawInitiatives : this.createFallbackInitiatives(nodes);

    return {
      id,
      title,
      industry,
      difficulty,
      description,
      businessContext,
      baselineMetrics: raw.baselineMetrics || {
        tco: 1800,
        budgetRemaining: 1200,
        opEx: 450,
        capExSpent: 200,
        technicalDebtIndex: 65,
        deliveryVelocity: 50,
        stakeholderTrust: 55,
        resilienceIndex: 55,
        complianceScore: 60,
        modernizedNodesCount: 1,
      },
      winLossConditions: raw.winLossConditions || {
        maxTechnicalDebtIndex: 45,
        minStakeholderTrustAvg: 60,
        minDeliveryVelocity: 65,
        minResilienceIndex: 70,
        maxTCOBudget: 3500,
        targetCapabilitiesModernized: 4,
      },
      totalRounds: 4,
      topology: { nodes, edges },
      stakeholders,
      roundEvents,
      initiativesCatalog,
      tags: raw.tags || [industry, 'Architecture Strategy', difficulty],
      author: raw.author || `AI Studio (${providerUsed})`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
  }

  private static createFallbackNodes(industry: string): TopologyNode[] {
    return [
      {
        id: 'node-1',
        name: 'Client Digital Portal',
        layer: 'BUSINESS',
        description: 'Customer-facing interface',
        health: 75,
        technicalDebt: 30,
        criticalPath: true,
        costPerRound: 40,
        position: { x: -4, y: 4, z: 0 },
        status: 'HEALTHY',
        dependencies: ['node-2'],
        telemetry: { latencyMs: 60, throughputRps: 2000, errorRatePercent: 0.1, failureRisk: 15 },
      },
      {
        id: 'node-2',
        name: 'Core Monolithic Processing Service',
        layer: 'APPLICATION',
        description: 'Legacy core transaction engine',
        health: 45,
        technicalDebt: 75,
        criticalPath: true,
        costPerRound: 120,
        position: { x: 0, y: 1, z: 0 },
        status: 'CRITICAL',
        dependencies: ['node-3'],
        telemetry: { latencyMs: 450, throughputRps: 600, errorRatePercent: 2.8, failureRisk: 78 },
      },
      {
        id: 'node-3',
        name: 'Enterprise Central Database',
        layer: 'DATA',
        description: 'Shared relational database',
        health: 55,
        technicalDebt: 68,
        criticalPath: true,
        costPerRound: 90,
        position: { x: 0, y: -2, z: 0 },
        status: 'DEGRADED',
        dependencies: ['node-4'],
        telemetry: { latencyMs: 280, throughputRps: 1100, errorRatePercent: 1.5, failureRisk: 62 },
      },
      {
        id: 'node-4',
        name: 'On-Premises Infrastructure Cluster',
        layer: 'INFRASTRUCTURE',
        description: 'Bare metal datacenter',
        health: 60,
        technicalDebt: 60,
        criticalPath: false,
        costPerRound: 85,
        position: { x: 4, y: -5, z: 0 },
        status: 'DEGRADED',
        dependencies: [],
        telemetry: { latencyMs: 120, throughputRps: 3500, errorRatePercent: 0.8, failureRisk: 45 },
      },
    ];
  }

  private static createFallbackStakeholders(): StakeholderPersona[] {
    return [
      {
        id: 'sh-1',
        name: 'Marcus Sterling',
        title: 'Chief Financial Officer',
        role: 'Corporate Finance',
        avatar: '💼',
        personality: 'Conservative and cost-conscious',
        bias: 'Demands quick ROI and OpEx reduction',
        hiddenAgenda: 'Prevent margin compression before board review',
        negotiationTolerance: 50,
        baseTrust: 55,
        decisionWeights: { financialAcumen: 0.6, deliverySpeed: 0.1, architecturalRigor: 0.2, regulatoryCompliance: 0.1 },
        sampleDialogue: {
          greeting: 'Keep it brief and watch the budget.',
          resistance: 'CapEx is too high with no clear payback.',
          concession: 'Commit to lowering ongoing maintenance and you have my approval.',
        },
      },
      {
        id: 'sh-2',
        name: 'Priya Sharma',
        title: 'VP of Product',
        role: 'Feature Delivery',
        avatar: '🚀',
        personality: 'Fast-paced, growth-oriented',
        bias: 'Cannot tolerate delays to business feature roadmaps',
        hiddenAgenda: 'Deliver key deliverables ahead of competitor releases',
        negotiationTolerance: 45,
        baseTrust: 60,
        decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.65, architecturalRigor: 0.1, regulatoryCompliance: 0.15 },
        sampleDialogue: {
          greeting: 'When can we ship to users?',
          resistance: 'We cannot freeze the roadmap for another refactoring cycle.',
          concession: 'Guarantee parallel feature velocity and I will support it.',
        },
      },
    ];
  }

  private static createFallbackEvents(): RoundEvent[] {
    return [
      {
        roundNumber: 1,
        title: 'Q1: Competitor Feature Surge',
        description: 'A competitor launched a modern interface, pressuring market share.',
        type: 'COMPETITIVE_SURGE',
        severity: 'MEDIUM',
        immediateImpact: { budgetFine: 40, tdiSurge: 5, velocityPenalty: 0 },
        choices: [
          { id: 'c1-1', text: 'Rush frontend patch (Fast, incurs debt)', capExImpact: 50, tdiImpact: 10, velocityImpact: 12, trustImpact: { 'sh-2': 10, 'sh-1': -5 } },
          { id: 'c1-2', text: 'Build clean API integration (Clean, takes time)', capExImpact: 110, tdiImpact: -6, velocityImpact: -4, trustImpact: { 'sh-1': -5 } },
        ],
      },
      {
        roundNumber: 2,
        title: 'Q2: Regulatory Data Privacy Audit',
        description: 'Mandatory compliance review on system security and data lineage.',
        type: 'AUDIT',
        severity: 'HIGH',
        immediateImpact: { budgetFine: 80, tdiSurge: 0, velocityPenalty: -8 },
        choices: [
          { id: 'c2-1', text: 'Full security hardening sprint', capExImpact: 120, tdiImpact: -8, velocityImpact: -10, trustImpact: { 'sh-1': 5 } },
          { id: 'c2-2', text: 'Pay minor fine and patch perimeter only', capExImpact: 60, tdiImpact: 4, velocityImpact: 0, trustImpact: { 'sh-1': -8 } },
        ],
      },
      {
        roundNumber: 3,
        title: 'Q3: Core Database Locking Deadlock',
        description: 'Traffic spike caused database table deadlocks, stalling transactions.',
        type: 'CRISIS',
        severity: 'HIGH',
        immediateImpact: { budgetFine: 150, tdiSurge: 6, velocityPenalty: -15 },
        choices: [
          { id: 'c3-1', text: 'Refactor queries and introduce Redis cache', capExImpact: 140, tdiImpact: -12, velocityImpact: 8, trustImpact: { 'sh-1': -6, 'sh-2': 8 } },
          { id: 'c3-2', text: 'Provision more database hardware (Temporary fix)', capExImpact: 180, tdiImpact: 5, velocityImpact: -2, trustImpact: { 'sh-1': -12 } },
        ],
      },
      {
        roundNumber: 4,
        title: 'Q4: Annual Board Strategy Review',
        description: 'Final review of transformation progress, debt reduction, and budget.',
        type: 'MARKET_SHIFT',
        severity: 'MEDIUM',
        immediateImpact: { budgetFine: 0, tdiSurge: 0, velocityPenalty: 0 },
        choices: [
          { id: 'c4-1', text: 'Present modernization roadmap for next year', capExImpact: 60, tdiImpact: -4, velocityImpact: 6, trustImpact: { 'sh-1': 8, 'sh-2': 8 } },
          { id: 'c4-2', text: 'Freeze all budgets to maximize cash reserve', capExImpact: -60, tdiImpact: 8, velocityImpact: -12, trustImpact: { 'sh-1': 14, 'sh-2': -14 } },
        ],
      },
    ];
  }

  private static createFallbackInitiatives(nodes: TopologyNode[]): InitiativeTemplate[] {
    const nodeIds = nodes.map(n => n.id);
    return [
      {
        id: 'init-1',
        name: 'Strangler Fig Decoupling',
        category: 'MODERNIZATION',
        description: 'Gradually replace monolith capabilities with modern microservices.',
        capExCost: 280,
        opExDelta: -30,
        tdiDelta: -18,
        velocityDelta: 14,
        resilienceDelta: 16,
        complianceDelta: 8,
        trustDelta: { 'sh-1': -4, 'sh-2': 10 },
        affectedNodeIds: nodeIds.slice(0, 2),
        durationRounds: 1,
        riskLevel: 'MEDIUM',
      },
      {
        id: 'init-2',
        name: 'Cloud Elastic Infrastructure Migration',
        category: 'CLOUD_INFRA',
        description: 'Migrate on-prem servers to containerized auto-scaling cloud mesh.',
        capExCost: 320,
        opExDelta: -40,
        tdiDelta: -15,
        velocityDelta: 12,
        resilienceDelta: 20,
        complianceDelta: 10,
        trustDelta: { 'sh-1': 8 },
        affectedNodeIds: nodeIds.slice(2),
        durationRounds: 1,
        riskLevel: 'HIGH',
      },
      {
        id: 'init-3',
        name: 'Automated CI/CD & Testing Pipeline',
        category: 'GOVERNANCE_STRICT',
        description: 'Deploy automated test suites and deployment gates.',
        capExCost: 150,
        opExDelta: -15,
        tdiDelta: -12,
        velocityDelta: 18,
        resilienceDelta: 14,
        complianceDelta: 15,
        trustDelta: { 'sh-2': 12 },
        affectedNodeIds: nodeIds.slice(0, 1),
        durationRounds: 1,
        riskLevel: 'LOW',
      },
      {
        id: 'init-4',
        name: 'Direct Feature Fast-Track',
        category: 'FEATURE_EXPEDITE',
        description: 'Bypass architecture standards to deploy urgent business features.',
        capExCost: 110,
        opExDelta: 35,
        tdiDelta: 16,
        velocityDelta: 22,
        resilienceDelta: -12,
        complianceDelta: -15,
        trustDelta: { 'sh-2': 20, 'sh-1': -8 },
        affectedNodeIds: nodeIds.slice(1, 2),
        durationRounds: 1,
        riskLevel: 'EXTREME',
      },
    ];
  }
}
