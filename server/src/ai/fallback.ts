// ============================================================================
// GEMSIM: DETERMINISTIC HEURISTIC FALLBACK AI PROVIDER
// Zero-dependency offline engine ensuring 100% operational resilience out-of-the-box
// ============================================================================

import { BaseAIProvider } from './base.js';
import {
  AIMessage,
  AIGenerateOptions,
  StakeholderNegotiationContext,
  ScenarioGenerationPrompt,
} from './types.js';
import {
  AIProviderType,
  ProposalEvaluation,
  Scenario,
  TopologyNode,
  TopologyEdge,
  InitiativeTemplate,
  RoundEvent,
  StakeholderPersona,
} from '../types/index.js';

export class FallbackProvider extends BaseAIProvider {
  public readonly providerType: AIProviderType = 'fallback';

  public async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    return {
      ok: true,
      message: 'Zero-Dependency Heuristic Engine Active (Guaranteed 100% availability)',
      latencyMs: 1,
    };
  }

  public async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content || '';

    if (options?.responseFormat === 'json') {
      return JSON.stringify({
        status: 'success',
        source: 'Heuristic Simulation Engine',
        analysis: `Evaluated inputs against enterprise architecture heuristics.`,
      });
    }

    return `Autonomous Heuristic Engine: Processed strategy directives for '${lastMsg.substring(0, 40)}...'. All constraints validated against architectural baseline.`;
  }

  public async generateStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIGenerateOptions
  ): Promise<string> {
    const response = await this.generateText(messages, options);
    const tokens = response.split(' ');
    for (const token of tokens) {
      onChunk(token + ' ');
      await new Promise(r => setTimeout(r, 15));
    }
    return response;
  }

  public async evaluateStakeholderProposal(
    context: StakeholderNegotiationContext
  ): Promise<{ responseDialogue: string; evaluation: ProposalEvaluation }> {
    const msg = context.playerMessage.toLowerCase();
    const s = context.stakeholder;

    let empathyScore = 50;
    let financialAcumenScore = 50;
    let strategicAlignmentScore = 50;
    let trustDelta = 0;
    let verdict: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE' = 'CONDITIONAL_ACCEPTANCE';
    let rationale = '';
    let responseDialogue = '';
    let concessionRequired: string | undefined = undefined;

    // Detect tone & content keywords
    const hasFinancialCare = /budget|cost|roi|capex|opex|spend|savings|efficient/i.test(msg);
    const hasSpeedCare = /deliver|deadline|timeline|fast|expedite|mvp|speed|q[1-4]/i.test(msg);
    const hasArchCare = /refactor|debt|resilien|scale|modern|security|standards|clean/i.test(msg);
    const hasCollaboration = /understand|partner|compromise|collaborate|agree|protect|listen/i.test(msg);

    if (hasCollaboration) empathyScore += 25;
    if (hasFinancialCare) financialAcumenScore += 30;
    if (hasArchCare) strategicAlignmentScore += 25;

    // Evaluate based on role
    if (s.role.toLowerCase().includes('finance') || s.title.includes('CFO')) {
      if (hasFinancialCare) {
        trustDelta = +12;
        verdict = 'ACCEPTED';
        rationale = 'Appreciates budget discipline and fiscal accountability.';
        responseDialogue = `I appreciate that you are keeping cash burn front and center. If we can keep CapEx capped this quarter, you have my backing on the modernization tranche.`;
      } else {
        trustDelta = -8;
        verdict = 'CONDITIONAL_ACCEPTANCE';
        rationale = 'Skeptical of unquantified expenditure.';
        responseDialogue = `You are asking for significant architectural investment without showing the bottom-line ROI. Where is the OpEx reduction down the line? I need numbers before I sign off.`;
        concessionRequired = 'Commit to a 15% reduction in ongoing legacy maintenance OpEx.';
      }
    } else if (s.role.toLowerCase().includes('product') || s.title.includes('VP')) {
      if (hasSpeedCare) {
        trustDelta = +14;
        verdict = 'ACCEPTED';
        rationale = 'Supports roadmap velocity and market competitiveness.';
        responseDialogue = `Now we're talking. If this enables us to ship the customer onboarding flows without waiting 6 weeks for architecture review boards, you have my full support.`;
      } else {
        trustDelta = -6;
        verdict = 'REJECTED';
        rationale = 'Perceives proposal as bureaucratic delay to business features.';
        responseDialogue = `Our competitors are releasing weekly while we debate database schemas. I can't support another multi-round freeze unless delivery dates are guaranteed.`;
        concessionRequired = 'Fast-track high-priority user feature releases concurrently.';
      }
    } else if (s.role.toLowerCase().includes('architect') || s.title.includes('CTO')) {
      if (hasArchCare) {
        trustDelta = +15;
        verdict = 'ACCEPTED';
        rationale = 'Strong endorsement of sound engineering and technical debt remediation.';
        responseDialogue = `Spot on. Bypassing standards has cost us dearly in uptime. Tackling the core bottlenecks now will stabilize the telemetry and unlock real agility.`;
      } else {
        trustDelta = -10;
        verdict = 'REJECTED';
        rationale = 'Warns of catastrophic technical debt accumulation.';
        responseDialogue = `Taking shortcuts here will brick our core services under load. We cannot compromise on decouple-and-isolate patterns.`;
        concessionRequired = 'Mandate automated architectural gate checks on pull requests.';
      }
    } else {
      trustDelta = hasCollaboration ? +8 : -4;
      verdict = hasCollaboration ? 'ACCEPTED' : 'CONDITIONAL_ACCEPTANCE';
      rationale = 'General executive consensus review.';
      responseDialogue = `I see where you are heading with this strategy. As long as our operational integrity remains uncompromised, we can move forward.`;
    }

    return {
      responseDialogue,
      evaluation: {
        empathyScore: Math.min(100, empathyScore),
        financialAcumenScore: Math.min(100, financialAcumenScore),
        strategicAlignmentScore: Math.min(100, strategicAlignmentScore),
        trustDelta,
        verdict,
        rationale,
        concessionRequired,
      },
    };
  }

  public async generateScenario(prompt: ScenarioGenerationPrompt): Promise<Partial<Scenario>> {
    const industryKey = (prompt.industry || 'FinTech').toLowerCase();
    const isHealthcare = industryKey.includes('health') || industryKey.includes('med');
    const isRetail = industryKey.includes('retail') || industryKey.includes('commerce');
    const isLogistics = industryKey.includes('supply') || industryKey.includes('logistics');

    const prefix = isHealthcare ? 'HealthNova' : isRetail ? 'OmniMart' : isLogistics ? 'FleetPulse' : 'NeoTitan';
    const sectorName = isHealthcare ? 'Healthcare & Clinical Data' : isRetail ? 'E-Commerce & Omnichannel' : isLogistics ? 'Supply Chain & IoT' : 'Banking & Payments';

    const nodes: TopologyNode[] = [
      {
        id: 'node-biz-1',
        name: isHealthcare ? 'Patient Telehealth Portal' : isRetail ? 'Digital Storefront & App' : isLogistics ? 'Fleet Telematics Portal' : 'Mobile Banking Experience',
        layer: 'BUSINESS',
        description: 'Customer touchpoint for real-time transactions and service delivery.',
        health: 75,
        technicalDebt: 35,
        criticalPath: true,
        costPerRound: 45,
        position: { x: -6, y: 6, z: -2 },
        status: 'HEALTHY',
        dependencies: ['node-app-1', 'node-app-2'],
        telemetry: { latencyMs: 85, throughputRps: 1850, errorRatePercent: 0.2, failureRisk: 22 },
      },
      {
        id: 'node-biz-2',
        name: isHealthcare ? 'Clinical Claims Adjudication' : isRetail ? 'Inventory & Fulfillment Hub' : isLogistics ? 'Route Optimization Engine' : 'Payment Clearing & Settlement',
        layer: 'BUSINESS',
        description: 'High-volume business operations capability driving core corporate revenue.',
        health: 55,
        technicalDebt: 65,
        criticalPath: true,
        costPerRound: 80,
        position: { x: 4, y: 6, z: 2 },
        status: 'DEGRADED',
        dependencies: ['node-app-2', 'node-data-1'],
        telemetry: { latencyMs: 240, throughputRps: 620, errorRatePercent: 1.8, failureRisk: 58 },
      },
      {
        id: 'node-app-1',
        name: 'Omnichannel API Gateway',
        layer: 'APPLICATION',
        description: 'Edge security, rate limiting, and identity token orchestration.',
        health: 80,
        technicalDebt: 25,
        criticalPath: true,
        costPerRound: 35,
        position: { x: -5, y: 2, z: -1 },
        status: 'HEALTHY',
        dependencies: ['node-app-2', 'node-app-3'],
        telemetry: { latencyMs: 18, throughputRps: 3400, errorRatePercent: 0.05, failureRisk: 12 },
      },
      {
        id: 'node-app-2',
        name: isHealthcare ? 'EHR Core Monolith' : isRetail ? 'Legacy ERP & Order Monolith' : isLogistics ? 'Legacy WMS System' : 'Core Banking Mainframe Service',
        layer: 'APPLICATION',
        description: 'Mission-critical 20-year-old monolith. Tightly coupled, fragile, and difficult to change.',
        health: 42,
        technicalDebt: 78,
        criticalPath: true,
        costPerRound: 140,
        position: { x: 0, y: 2, z: 0 },
        status: 'CRITICAL',
        dependencies: ['node-data-1', 'node-infra-1'],
        telemetry: { latencyMs: 640, throughputRps: 450, errorRatePercent: 3.4, failureRisk: 82 },
      },
      {
        id: 'node-app-3',
        name: 'Microservices Mesh (Modern)',
        layer: 'APPLICATION',
        description: 'Containerized event-driven services handling user notifications, fraud, and telemetry.',
        health: 88,
        technicalDebt: 18,
        criticalPath: false,
        costPerRound: 50,
        position: { x: 5, y: 2, z: -2 },
        status: 'HEALTHY',
        dependencies: ['node-data-2', 'node-infra-2'],
        telemetry: { latencyMs: 32, throughputRps: 1900, errorRatePercent: 0.1, failureRisk: 14 },
      },
      {
        id: 'node-data-1',
        name: 'Legacy Relational Database Cluster',
        layer: 'DATA',
        description: 'Single-point-of-failure shared relational database suffering from locking and IOPS saturation.',
        health: 48,
        technicalDebt: 72,
        criticalPath: true,
        costPerRound: 95,
        position: { x: -3, y: -2, z: 1 },
        status: 'DEGRADED',
        dependencies: ['node-infra-1'],
        telemetry: { latencyMs: 380, throughputRps: 920, errorRatePercent: 2.1, failureRisk: 66 },
      },
      {
        id: 'node-data-2',
        name: 'Distributed Kafka Event Stream',
        layer: 'DATA',
        description: 'High-throughput append-only log decoupling event producers from consumers.',
        health: 92,
        technicalDebt: 12,
        criticalPath: false,
        costPerRound: 40,
        position: { x: 4, y: -2, z: -1 },
        status: 'MODERNIZED',
        dependencies: ['node-infra-2'],
        telemetry: { latencyMs: 12, throughputRps: 7500, errorRatePercent: 0.01, failureRisk: 8 },
      },
      {
        id: 'node-infra-1',
        name: 'On-Premise Private Datacenter',
        layer: 'INFRASTRUCTURE',
        description: 'Aging bare-metal infrastructure nearing end-of-life contract renewals and capacity limits.',
        health: 52,
        technicalDebt: 68,
        criticalPath: true,
        costPerRound: 110,
        position: { x: -2, y: -6, z: 2 },
        status: 'DEGRADED',
        dependencies: [],
        telemetry: { latencyMs: 110, throughputRps: 4500, errorRatePercent: 1.2, failureRisk: 55 },
      },
      {
        id: 'node-infra-2',
        name: 'Multi-Region Kubernetes Cloud Mesh',
        layer: 'INFRASTRUCTURE',
        description: 'Elastic cloud footprint with automated autoscaling, blue-green deployments, and multi-zone failover.',
        health: 90,
        technicalDebt: 15,
        criticalPath: false,
        costPerRound: 65,
        position: { x: 3, y: -6, z: -2 },
        status: 'MODERNIZED',
        dependencies: [],
        telemetry: { latencyMs: 24, throughputRps: 8200, errorRatePercent: 0.02, failureRisk: 10 },
      },
    ];

    const edges: TopologyEdge[] = [
      { id: 'edge-1', fromId: 'node-biz-1', toId: 'node-app-1', protocol: 'HTTPS/gRPC', bandwidthMbps: 1000, status: 'NORMAL', latencyMs: 15 },
      { id: 'edge-2', fromId: 'node-biz-2', toId: 'node-app-2', protocol: 'SOAP/REST', bandwidthMbps: 450, status: 'BOTTLENECK', latencyMs: 310 },
      { id: 'edge-3', fromId: 'node-app-1', toId: 'node-app-2', protocol: 'Internal RPC', bandwidthMbps: 300, status: 'BOTTLENECK', latencyMs: 280 },
      { id: 'edge-4', fromId: 'node-app-1', toId: 'node-app-3', protocol: 'mTLS HTTP/2', bandwidthMbps: 2000, status: 'OPTIMIZED', latencyMs: 12 },
      { id: 'edge-5', fromId: 'node-app-2', toId: 'node-data-1', protocol: 'JDBC Direct Pool', bandwidthMbps: 500, status: 'BOTTLENECK', latencyMs: 420 },
      { id: 'edge-6', fromId: 'node-app-3', toId: 'node-data-2', protocol: 'Kafka Protocol', bandwidthMbps: 5000, status: 'OPTIMIZED', latencyMs: 8 },
      { id: 'edge-7', fromId: 'node-data-1', toId: 'node-infra-1', protocol: 'Fibre Channel SAN', bandwidthMbps: 800, status: 'NORMAL', latencyMs: 45 },
      { id: 'edge-8', fromId: 'node-data-2', toId: 'node-infra-2', protocol: 'Cloud VPC Peering', bandwidthMbps: 10000, status: 'OPTIMIZED', latencyMs: 4 },
    ];

    const stakeholders: StakeholderPersona[] = [
      {
        id: 'sh-cfo',
        name: 'Marcus Sterling',
        title: 'Chief Financial Officer',
        role: 'Corporate Finance & Capital Allocation',
        avatar: '💼',
        personality: 'Conservative, data-driven, relentlessly interrogates ROI and ongoing OpEx run-rate.',
        bias: 'Believes technology investments must prove payback within 3 quarters.',
        hiddenAgenda: 'Preparing corporate books for an upcoming credit rating review; cannot tolerate margin erosion.',
        negotiationTolerance: 55,
        baseTrust: 55,
        decisionWeights: { financialAcumen: 0.65, deliverySpeed: 0.1, architecturalRigor: 0.15, regulatoryCompliance: 0.1 },
        sampleDialogue: {
          greeting: 'Keep it brief. Every dollar invested in architecture comes directly out of earnings per share.',
          resistance: 'I see a massive CapEx price tag and zero guaranteed savings. How does this lower our quarterly run-rate?',
          concession: 'If you can demonstrate a $100K/round reduction in maintenance within 2 quarters, I will unlock contingency funds.',
        },
      },
      {
        id: 'sh-cpo',
        name: 'Priya Sharma',
        title: 'VP of Product & Growth',
        role: 'Customer Acquisition & Market Velocity',
        avatar: '🚀',
        personality: 'Charismatic, impatient, obsessed with out-innovating agile competitors.',
        bias: 'Views architectural governance and compliance reviews as velocity-killing bottlenecks.',
        hiddenAgenda: 'Bonus is 80% tied to delivering customer-facing features by Q3 before rival launch.',
        negotiationTolerance: 45,
        baseTrust: 60,
        decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.65, architecturalRigor: 0.1, regulatoryCompliance: 0.15 },
        sampleDialogue: {
          greeting: 'Our users do not care about database normalization. They care about instant execution.',
          resistance: 'Freezing feature development for a refactoring sprint will lose us market share to nimble startups.',
          concession: 'If you can isolate the monolith changes so my product teams can deploy autonomously, I will back your platform initiative.',
        },
      },
      {
        id: 'sh-cto',
        name: 'Dr. Elena Rostova',
        title: 'Chief Enterprise Architect',
        role: 'Architecture Integrity & Technical Governance',
        avatar: '🛡️',
        personality: 'Analytical, visionary, battle-hardened veteran of catastrophic outages.',
        bias: 'Prioritizes systemic resilience, loose coupling, and technical debt remediation over quick fixes.',
        hiddenAgenda: 'Wants to phase out legacy vendor lock-in and establish open cloud-native standards.',
        negotiationTolerance: 65,
        baseTrust: 65,
        decisionWeights: { financialAcumen: 0.15, deliverySpeed: 0.15, architecturalRigor: 0.55, regulatoryCompliance: 0.15 },
        sampleDialogue: {
          greeting: 'Architectural shortcuts taken today compound into insurmountable enterprise debt tomorrow.',
          resistance: 'Bypassing schema migrations will cause cascading data corruption under peak load.',
          concession: 'If you mandate automated contract testing and strangler fig patterns, I will approve the expedited rollout.',
        },
      },
      {
        id: 'sh-cso',
        name: 'Arthur Pendelton',
        title: 'Chief Compliance & Risk Officer',
        role: 'Regulatory Governance & Cyber Resilience',
        avatar: '⚖️',
        personality: 'Strict, audit-conscious, vigilant against regulatory sanctions and security breaches.',
        bias: 'Zero tolerance for unverified third-party dependencies or unaudited shadow IT.',
        hiddenAgenda: 'Under pressure from federal regulators following an industry-wide data leak scandal.',
        negotiationTolerance: 40,
        baseTrust: 50,
        decisionWeights: { financialAcumen: 0.1, deliverySpeed: 0.05, architecturalRigor: 0.25, regulatoryCompliance: 0.6 },
        sampleDialogue: {
          greeting: 'A single regulatory fine can wipe out your entire year of feature gains.',
          resistance: 'This architecture lacks end-to-end data lineage and encryption in transit for legacy protocols.',
          concession: 'Implement zero-trust mTLS and automated audit trails, and I will issue immediate compliance clearance.',
        },
      },
    ];

    const initiativesCatalog: InitiativeTemplate[] = [
      {
        id: 'init-strangler-core',
        name: 'Strangler Fig Migration: Core Monolith Decoupling',
        category: 'MODERNIZATION',
        description: 'Incrementally carve out high-risk workflows from the legacy monolith into domain microservices with an anti-corruption layer.',
        capExCost: 320,
        opExDelta: -35,
        tdiDelta: -22,
        velocityDelta: 16,
        resilienceDelta: 18,
        complianceDelta: 10,
        trustDelta: { 'sh-cto': 15, 'sh-cpo': 8, 'sh-cfo': -5 },
        affectedNodeIds: ['node-app-2', 'node-app-3'],
        durationRounds: 1,
        riskLevel: 'MEDIUM',
      },
      {
        id: 'init-event-driven-mesh',
        name: 'Event-Driven Backbone & Kafka Decoupling',
        category: 'MODERNIZATION',
        description: 'Transition synchronous point-to-point REST/JDBC dependencies to asynchronous event streams, eliminating database bottlenecks.',
        capExCost: 260,
        opExDelta: -20,
        tdiDelta: -16,
        velocityDelta: 12,
        resilienceDelta: 20,
        complianceDelta: 6,
        trustDelta: { 'sh-cto': 12, 'sh-cfo': -4 },
        affectedNodeIds: ['node-data-1', 'node-data-2', 'node-app-2'],
        durationRounds: 1,
        riskLevel: 'LOW',
      },
      {
        id: 'init-fast-track-features',
        name: 'Fast-Track Feature Surge (Architecture Bypass)',
        category: 'FEATURE_EXPEDITE',
        description: 'Hardcode direct database hooks and bypass architectural review to push high-visibility customer features ahead of schedule.',
        capExCost: 140,
        opExDelta: 45,
        tdiDelta: 18,
        velocityDelta: 24,
        resilienceDelta: -15,
        complianceDelta: -18,
        trustDelta: { 'sh-cpo': 22, 'sh-cto': -20, 'sh-cso': -16 },
        affectedNodeIds: ['node-biz-1', 'node-app-2'],
        durationRounds: 1,
        riskLevel: 'EXTREME',
      },
      {
        id: 'init-cloud-native-pivot',
        name: 'Cloud Infrastructure & Kubernetes Mesh Lift',
        category: 'CLOUD_INFRA',
        description: 'Decommission legacy on-prem datacenter racks and migrate critical services to elastic multi-region cloud mesh.',
        capExCost: 380,
        opExDelta: -45,
        tdiDelta: -18,
        velocityDelta: 14,
        resilienceDelta: 24,
        complianceDelta: 12,
        trustDelta: { 'sh-cfo': 10, 'sh-cto': 14 },
        affectedNodeIds: ['node-infra-1', 'node-infra-2'],
        durationRounds: 1,
        riskLevel: 'HIGH',
      },
      {
        id: 'init-zero-trust-sec',
        name: 'Zero-Trust Security & Automated Audit Fabric',
        category: 'SECURITY_COMPLIANCE',
        description: 'Deploy service-mesh mTLS, strict RBAC, automated secret rotation, and immutable compliance telemetry.',
        capExCost: 190,
        opExDelta: -10,
        tdiDelta: -10,
        velocityDelta: -4,
        resilienceDelta: 16,
        complianceDelta: 28,
        trustDelta: { 'sh-cso': 25, 'sh-cto': 10, 'sh-cpo': -6 },
        affectedNodeIds: ['node-app-1', 'node-data-1'],
        durationRounds: 1,
        riskLevel: 'LOW',
      },
      {
        id: 'init-ai-ops-copilot',
        name: 'Autonomous AI-Ops & Synthetic Traffic Sharding',
        category: 'AI_AUTOMATION',
        description: 'Deploy machine learning telemetry probes for predictive anomaly detection, dynamic query caching, and automated self-healing.',
        capExCost: 220,
        opExDelta: -25,
        tdiDelta: -12,
        velocityDelta: 15,
        resilienceDelta: 18,
        complianceDelta: 5,
        trustDelta: { 'sh-cto': 10, 'sh-cfo': 8, 'sh-cpo': 8 },
        affectedNodeIds: ['node-app-1', 'node-app-3'],
        durationRounds: 1,
        riskLevel: 'MEDIUM',
      },
    ];

    const roundEvents: RoundEvent[] = [
      {
        roundNumber: 1,
        title: 'Q1: Market Velocity Shock & Competitor Disruption',
        description: 'A venture-backed challenger has released an instant-onboarding mobile application, pulling away 8% of new signups. Executive committee demands response.',
        type: 'COMPETITIVE_SURGE',
        severity: 'MEDIUM',
        immediateImpact: { budgetFine: 50, tdiSurge: 5, velocityPenalty: 0 },
        choices: [
          {
            id: 'c1-patch',
            text: 'Deploy hasty API wrappers over legacy core (Immediate release, heavy debt surge)',
            capExImpact: 60,
            tdiImpact: 14,
            velocityImpact: 15,
            trustImpact: { 'sh-cpo': 12, 'sh-cto': -12 },
          },
          {
            id: 'c1-clean',
            text: 'Build decoupled microservice via strangler fig (4-week delay, clean foundation)',
            capExImpact: 150,
            tdiImpact: -8,
            velocityImpact: -6,
            trustImpact: { 'sh-cto': 14, 'sh-cpo': -8, 'sh-cfo': -5 },
          },
          {
            id: 'c1-wait',
            text: 'Absorb short-term loss while executing planned roadmap unchanged',
            capExImpact: 0,
            tdiImpact: 0,
            velocityImpact: 0,
            trustImpact: { 'sh-cpo': -15, 'sh-cfo': 5 },
          },
        ],
      },
      {
        roundNumber: 2,
        title: 'Q2: Surprise Federal Compliance & Security Audit',
        description: 'Regulators have triggered an unannounced audit of data retention, encryption in transit, and access controls across legacy clusters.',
        type: 'AUDIT',
        severity: 'HIGH',
        immediateImpact: { budgetFine: 120, tdiSurge: 0, velocityPenalty: -12 },
        choices: [
          {
            id: 'c2-full-audit',
            text: 'Freeze feature pipeline for 2 weeks to perform exhaustive architectural remediation',
            capExImpact: 180,
            tdiImpact: -12,
            velocityImpact: -18,
            trustImpact: { 'sh-cso': 22, 'sh-cpo': -18, 'sh-cto': 8 },
          },
          {
            id: 'c2-selective-patch',
            text: 'Apply perimeter patches to API gateway while submitting a waiver for legacy DB',
            capExImpact: 75,
            tdiImpact: 4,
            velocityImpact: -5,
            trustImpact: { 'sh-cso': -5, 'sh-cfo': 8 },
          },
          {
            id: 'c2-external-counsel',
            text: 'Retain external crisis counsel and pay minor penalty without altering architecture',
            capExImpact: 220,
            tdiImpact: 0,
            velocityImpact: 0,
            trustImpact: { 'sh-cso': -18, 'sh-cfo': -12 },
          },
        ],
      },
      {
        roundNumber: 3,
        title: 'Q3: Black Swan Mainframe Deadlock & Black Friday Peak',
        description: 'Unprecedented transaction volume triggers thread starvation in the monolithic core, freezing database write queues for 38 minutes.',
        type: 'CRISIS',
        severity: 'BLACK_SWAN',
        immediateImpact: { budgetFine: 280, tdiSurge: 8, velocityPenalty: -20, downedNodeIds: ['node-app-2', 'node-data-1'] },
        choices: [
          {
            id: 'c3-circuit-breaker',
            text: 'Emergency sharding: Spin up asynchronous read-replicas with circuit breakers',
            capExImpact: 190,
            tdiImpact: -15,
            velocityImpact: 5,
            trustImpact: { 'sh-cto': 16, 'sh-cfo': -10 },
          },
          {
            id: 'c3-hardware-overprovision',
            text: 'Emergency cloud compute scale-up (Throwing hardware at bad architecture)',
            capExImpact: 260,
            tdiImpact: 6,
            velocityImpact: -5,
            trustImpact: { 'sh-cfo': -16, 'sh-cpo': 8 },
          },
          {
            id: 'c3-rate-limit',
            text: 'Aggressively throttle incoming customer traffic to prevent full system collapse',
            capExImpact: 40,
            tdiImpact: 0,
            velocityImpact: -15,
            trustImpact: { 'sh-cpo': -20, 'sh-cfo': -10, 'sh-cto': 6 },
          },
        ],
      },
      {
        roundNumber: 4,
        title: 'Q4: Board Evaluation & Enterprise Modernization Verdict',
        description: 'Final fiscal review. The Board reviews TCO trajectory, technical debt index, delivery velocity, and operational uptime.',
        type: 'MARKET_SHIFT',
        severity: 'HIGH',
        immediateImpact: { budgetFine: 0, tdiSurge: 0, velocityPenalty: 0 },
        choices: [
          {
            id: 'c4-showcase',
            text: 'Present comprehensive modernization achievements and request expansion capital',
            capExImpact: 100,
            tdiImpact: -5,
            velocityImpact: 10,
            trustImpact: { 'sh-cfo': 12, 'sh-cpo': 12, 'sh-cto': 12 },
          },
          {
            id: 'c4-cost-cut',
            text: 'Implement aggressive austerity measures to present inflated short-term cash reserves',
            capExImpact: -80,
            tdiImpact: 12,
            velocityImpact: -15,
            trustImpact: { 'sh-cfo': 18, 'sh-cto': -18, 'sh-cpo': -15 },
          },
          {
            id: 'c4-steady',
            text: 'Maintain balanced operational pace into the subsequent fiscal cycle',
            capExImpact: 0,
            tdiImpact: 0,
            velocityImpact: 0,
            trustImpact: { 'sh-cfo': 5, 'sh-cto': 5 },
          },
        ],
      },
    ];

    const scenario: Scenario = {
      id: `scen-${Date.now().toString(36)}`,
      title: `${prefix}: Enterprise Core Modernization & Strategy Simulation`,
      industry: sectorName,
      difficulty: prompt.difficulty || 'INTERMEDIATE',
      description: `Executive simulation placing teams at the helm of ${prefix}, a leading enterprise in ${sectorName} undergoing a critical transformation. Balance rapid customer delivery with architectural technical debt reduction, regulatory compliance, and fiscal discipline across 4 discrete quarters.`,
      businessContext: prompt.businessChallenge || `The enterprise is struggling with a monolithic legacy system, rising maintenance OpEx, and growing friction between Product velocity and Architectural rigor.`,
      baselineMetrics: {
        tco: 1850,
        budgetRemaining: 1200,
        opEx: 480,
        capExSpent: 300,
        technicalDebtIndex: 68,
        deliveryVelocity: 48,
        stakeholderTrust: 55,
        resilienceIndex: 52,
        complianceScore: 62,
        modernizedNodesCount: 2,
      },
      winLossConditions: {
        maxTechnicalDebtIndex: 45,
        minStakeholderTrustAvg: 60,
        minDeliveryVelocity: 65,
        minResilienceIndex: 70,
        maxTCOBudget: 3600,
        targetCapabilitiesModernized: 5,
      },
      totalRounds: 4,
      topology: { nodes, edges },
      stakeholders,
      roundEvents,
      initiativesCatalog,
      tags: [prompt.industry, 'Architecture Strategy', 'Monolith Decoupling', 'OpEx Optimization'],
      author: 'GemSim AI Studio Heuristic Engine',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    return scenario;
  }
}
