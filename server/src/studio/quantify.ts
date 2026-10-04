// ============================================================================
// GEMSIM STUDIO: THE ENGINE — FROM QUALIFICATIONS TO NUMBERS
// Calibrated templates turn the judged categories into effects, so every number
// agrees with its text: a quick fix is cheap and adds debt, a lasting answer
// costs more and removes it, a trap pays now and backfires. The structure is
// completed when the author fell short (one transformation, one trap...).
// ============================================================================

import type {
  EnterpriseLayer,
  InitiativeTemplate,
  MarketModel,
  RoundEvent,
  Scenario,
  ScenarioDomain,
  StakeholderPersona,
  TopologyEdge,
  TopologyNode,
} from '../types/index.js';
import { calculateOpEx } from '../engine/math.js';
import { calibrateMarket } from '../engine/market.js';
import { sanitizeVocabulary } from '../ai/studio-generator.js';
import type { AnswerKind, CaseDraft, InitiativeKind, Level, NodeCondition, Size } from './draft.js';
import type { Judgment } from './judge.js';

const LV: Record<Level, number> = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };
const SZ: Record<Size, number> = { SMALL: 0, MEDIUM: 1, LARGE: 2 };

// Starting state: severity of each problem -> metric
const START = {
  debt: [38, 52, 64, 74],
  velocity: [60, 52, 45, 38],
  resilience: [66, 56, 47, 39],
  compliance: [78, 65, 55, 47],
  cash: [2000, 1700, 1450, 1250],
};

const NODE: Record<NodeCondition, { debt: number; health: number; status: TopologyNode['status'] }> = {
  MODERN: { debt: 18, health: 86, status: 'MODERNIZED' },
  AGEING: { debt: 52, health: 64, status: 'DEGRADED' },
  FRAGILE: { debt: 66, health: 50, status: 'DEGRADED' },
  CRITICAL: { debt: 82, health: 34, status: 'CRITICAL' },
};
const LAYER_COST: Record<EnterpriseLayer, number> = { BUSINESS: 30, APPLICATION: 110, DATA: 70, INFRASTRUCTURE: 80 };
const LAYER_Y: Record<EnterpriseLayer, number> = { BUSINESS: 5, APPLICATION: 2, DATA: -2, INFRASTRUCTURE: -5 };

// Initiatives: kind x size -> effects
const INIT: Record<InitiativeKind, {
  cost: number[]; tdi: number[]; vel: number[]; res: number[]; comp: number[]; opex: number[]; duration: number; risk: InitiativeTemplate['riskLevel'][];
}> = {
  TRANSFORMATION: { cost: [280, 360, 440], tdi: [-16, -20, -24], vel: [10, 14, 18], res: [10, 14, 18], comp: [4, 6, 8], opex: [-20, -30, -45], duration: 2, risk: ['HIGH', 'HIGH', 'HIGH'] },
  IMPROVEMENT: { cost: [140, 190, 240], tdi: [-8, -11, -14], vel: [6, 9, 12], res: [6, 9, 12], comp: [4, 6, 8], opex: [-5, -10, -20], duration: 1, risk: ['LOW', 'MEDIUM', 'MEDIUM'] },
  QUICK_WIN: { cost: [70, 100, 130], tdi: [3, 4, 6], vel: [8, 11, 14], res: [-2, -3, -4], comp: [0, -2, -4], opex: [5, 10, 15], duration: 1, risk: ['MEDIUM', 'MEDIUM', 'HIGH'] },
  TRAP: { cost: [80, 90, 100], tdi: [18, 22, 24], vel: [20, 24, 26], res: [-14, -16, -18], comp: [-20, -24, -26], opex: [35, 40, 45], duration: 1, risk: ['EXTREME', 'EXTREME', 'EXTREME'] },
};

// Crises: severity -> default impact; answer kind -> response
const CRISIS: Record<'MEDIUM' | 'HIGH' | 'BLACK_SWAN', { fine: number; tdi: number; vel: number }> = {
  MEDIUM: { fine: 90, tdi: 4, vel: -8 },
  HIGH: { fine: 150, tdi: 6, vel: -10 },
  BLACK_SWAN: { fine: 220, tdi: 8, vel: -16 },
};
const ANSWER: Record<AnswerKind, { cost: (fine: number) => number; tdi: number; vel: number; heal: number }> = {
  LASTING: { cost: fine => Math.round(fine * 0.9 + 40), tdi: -5, vel: 4, heal: 35 },
  QUICK_FIX: { cost: fine => Math.round(fine * 0.4), tdi: 8, vel: 6, heal: 12 },
  AVOIDANCE: { cost: fine => Math.round(fine * 0.15), tdi: 4, vel: -6, heal: 0 },
};

const GENERIC_TRAP: Record<'fr' | 'en', { name: string; description: string }> = {
  fr: { name: 'Passer en force sans préparation', description: 'Tout accélérer en sautant les contrôles et la préparation : résultats visibles tout de suite, risques et non-conformités ensuite.' },
  en: { name: 'Force it through without preparation', description: 'Speed everything up by skipping controls and preparation: visible results now, risks and non-compliance later.' },
};

export interface QuantifyNotes {
  forced: string[]; // structural fixes made by the engine
}

const resolveId = (ids: Set<string>, raw: string) => {
  const s = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  return ids.has(raw) ? raw : ids.has(s) ? s : undefined;
};

export function quantify(
  draft: CaseDraft,
  judgment: Judgment,
  meta: { domain: ScenarioDomain; difficulty: Scenario['difficulty']; withMarket: boolean; author: string }
): { scenario: Scenario; notes: QuantifyNotes } {
  const forced: string[] = [];
  const st = judgment.startingState;

  // Topology
  const byLayer = new Map<EnterpriseLayer, number>();
  const nodes: TopologyNode[] = draft.nodes.map(n => {
    const c = NODE[n.condition];
    const index = byLayer.get(n.layer) ?? 0;
    byLayer.set(n.layer, index + 1);
    const debt = Math.max(5, Math.min(95, c.debt + (LV[st.debt] - 1) * 4));
    return {
      id: n.id,
      name: n.name,
      layer: n.layer,
      description: n.description,
      health: c.health,
      technicalDebt: debt,
      criticalPath: n.critical,
      costPerRound: LAYER_COST[n.layer],
      position: { x: -6 + index * 4, y: LAYER_Y[n.layer], z: 0 },
      status: c.status,
      dependencies: [],
      telemetry: { latencyMs: 80 + debt * 8, throughputRps: Math.max(100, 1200 - debt * 10), errorRatePercent: Math.round(debt / 25 * 10) / 10, failureRisk: debt },
    };
  });
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges: TopologyEdge[] = [];
  draft.edges.forEach((e, i) => {
    const from = resolveId(nodeIds, e.from);
    const to = resolveId(nodeIds, e.to);
    if (!from || !to || from === to) return;
    const fragile = [from, to].some(id => ['FRAGILE', 'CRITICAL'].includes(draft.nodes.find(n => n.id === id)?.condition ?? ''));
    edges.push({ id: `e${i + 1}`, fromId: from, toId: to, protocol: e.label || '→', bandwidthMbps: 400, status: fragile ? 'BOTTLENECK' : 'NORMAL', latencyMs: fragile ? 500 : 150 });
    nodes.find(n => n.id === to)?.dependencies.push(from);
  });

  // Executives: priorities judged by System 1 (sharpened so that they disagree)
  const avatars: Record<keyof StakeholderPersona['decisionWeights'], string> = { financialAcumen: '💼', deliverySpeed: '🚀', architecturalRigor: '🏗️', regulatoryCompliance: '⚖️' };
  const stakeholders: StakeholderPersona[] = draft.stakeholders.map((s, i) => {
    const p = judgment.priorities[s.id] ?? { financialAcumen: 0.5, deliverySpeed: 0.5, architecturalRigor: 0.5, regulatoryCompliance: 0.5 };
    const raw = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.max(0.05, v * v)])) as typeof p;
    const total = Object.values(raw).reduce((a, b) => a + b, 0);
    const weights = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.round((v / total) * 100) / 100])) as StakeholderPersona['decisionWeights'];
    const top = (Object.entries(weights) as Array<[keyof typeof weights, number]>).sort((a, b) => b[1] - a[1])[0][0];
    return {
      id: s.id,
      name: s.name,
      title: s.title,
      role: s.role,
      avatar: avatars[top],
      personality: s.personality,
      bias: s.bias,
      hiddenAgenda: s.hiddenAgenda,
      negotiationTolerance: 50,
      baseTrust: 52 - (i % 3) * 2,
      decisionWeights: weights,
      sampleDialogue: { greeting: s.greeting, resistance: s.resistance, concession: s.concession },
    };
  });
  const shIds = new Set(stakeholders.map(s => s.id));
  const champion = (key: keyof StakeholderPersona['decisionWeights']) =>
    [...stakeholders].sort((a, b) => b.decisionWeights[key] - a.decisionWeights[key])[0]?.id;
  const trust = (favored: string[], opposed: string[], plus: number, minus: number) => {
    const out: Record<string, number> = {};
    for (const raw of favored) { const id = resolveId(shIds, raw); if (id) out[id] = (out[id] ?? 0) + plus; }
    for (const raw of opposed) { const id = resolveId(shIds, raw); if (id) out[id] = (out[id] ?? 0) - minus; }
    return out;
  };
  const affected = (raw: string[]) => raw.map(r => resolveId(nodeIds, r)).filter((x): x is string => !!x);

  // Initiatives, with the structure the case needs
  let kinds = draft.initiatives.map(i => judgment.initiativeKinds[i.id] ?? i.kind);
  if (!kinds.includes('TRANSFORMATION') && kinds.includes('IMPROVEMENT')) {
    const largest = draft.initiatives
      .map((it, i) => ({ i, size: SZ[judgment.initiativeSizes[it.id] ?? it.size] }))
      .filter(x => kinds[x.i] === 'IMPROVEMENT')
      .sort((a, b) => b.size - a.size)[0];
    kinds[largest.i] = 'TRANSFORMATION';
    forced.push(`"${draft.initiatives[largest.i].name}" becomes the multi-quarter transformation`);
  }
  // One trap per case: the one the author meant, otherwise the one System 1 believes most
  const traps = kinds
    .map((k, i) => (k === 'TRAP' ? i : -1))
    .filter(i => i >= 0)
    .sort((x, y) => {
      const author = (i: number) => (draft.initiatives[i].kind === 'TRAP' ? 1 : 0);
      return author(y) - author(x) || (judgment.trapScores?.[draft.initiatives[y].id] ?? 0) - (judgment.trapScores?.[draft.initiatives[x].id] ?? 0);
    });
  for (const extra of traps.slice(1)) {
    kinds[extra] = 'QUICK_WIN';
    forced.push(`"${draft.initiatives[extra].name}" is treated as a quick win (one trap per case)`);
  }
  const initiativesCatalog: InitiativeTemplate[] = draft.initiatives.map((it, i) => {
    const kind = kinds[i];
    const s = SZ[judgment.initiativeSizes[it.id] ?? it.size];
    const t = INIT[kind];
    let comp = t.comp[s];
    let vel = t.vel[s];
    let res = t.res[s];
    let opex = t.opex[s];
    if (kind === 'IMPROVEMENT' || kind === 'TRANSFORMATION') {
      if (it.category === 'RISK_MITIGATION' || it.category === 'SECURITY_COMPLIANCE' || it.category === 'GOVERNANCE_STRICT') { comp += 18; vel -= 6; }
      if (it.category === 'SOURCING_PARTNERSHIP') { res += 8; opex += 15; }
      if (it.category === 'CAPACITY_EXPANSION' || it.category === 'AI_AUTOMATION') vel += 4;
      if (it.category === 'OPERATIONS_EXCELLENCE' || it.category === 'DEBT_REDUCTION') opex -= 10;
      if (it.category === 'PEOPLE_CHANGE') comp += 4;
    }
    const nodesHit = affected(it.affectedNodes);
    return {
      id: it.id,
      name: it.name,
      category: it.category,
      description: it.description,
      capExCost: t.cost[s],
      opExDelta: opex,
      tdiDelta: t.tdi[s],
      velocityDelta: vel,
      resilienceDelta: res,
      complianceDelta: comp,
      trustDelta: kind === 'TRAP' ? trust(it.championedBy, it.opposedBy, 8, 14) : trust(it.championedBy, it.opposedBy, [8, 12, 16][s], 6),
      affectedNodeIds: nodesHit.length ? nodesHit : [nodes[i % nodes.length].id],
      durationRounds: t.duration,
      riskLevel: t.risk[s],
    };
  });
  if (!kinds.includes('TRAP')) {
    const lang = draft.language;
    const fragile = [...nodes].sort((a, b) => b.technicalDebt - a.technicalDebt)[0];
    initiativesCatalog.push({
      id: 'init-trap',
      ...GENERIC_TRAP[lang],
      category: 'QUICK_WIN',
      capExCost: INIT.TRAP.cost[1],
      opExDelta: INIT.TRAP.opex[1],
      tdiDelta: INIT.TRAP.tdi[1],
      velocityDelta: INIT.TRAP.vel[1],
      resilienceDelta: INIT.TRAP.res[1],
      complianceDelta: INIT.TRAP.comp[1],
      trustDelta: { ...(champion('deliverySpeed') ? { [champion('deliverySpeed')!]: 8 } : {}), ...(champion('regulatoryCompliance') ? { [champion('regulatoryCompliance')!]: -14 } : {}) },
      affectedNodeIds: [fragile.id],
      durationRounds: 1,
      riskLevel: 'EXTREME',
    });
    forced.push('a trap initiative was added (the author wrote none)');
  }

  // Crises: one per quarter, each with a lasting and a quick answer
  const complianceChampion = champion('regulatoryCompliance');
  const roundEvents: RoundEvent[] = [...draft.crises]
    .sort((a, b) => a.quarter - b.quarter)
    .slice(0, 4)
    .map(c => {
      const sev = CRISIS[c.severity];
      const answerKinds = c.answers.map(a => judgment.answerKinds[a.id] ?? a.kind);
      if (!answerKinds.includes('LASTING')) {
        const j = answerKinds.findIndex(k => k !== 'QUICK_FIX');
        answerKinds[j >= 0 ? j : 0] = 'LASTING';
        forced.push(`"${c.title}": one answer is treated as the lasting one`);
      }
      if (!answerKinds.includes('QUICK_FIX') && answerKinds.length > 1) {
        const j = answerKinds.findIndex(k => k !== 'LASTING');
        answerKinds[j >= 0 ? j : answerKinds.length - 1] = 'QUICK_FIX';
        forced.push(`"${c.title}": one answer is treated as the quick fix`);
      }
      const hit = affected(c.affectedNodes);
      return {
        roundNumber: c.quarter,
        title: c.title,
        description: c.description,
        type: c.severity === 'BLACK_SWAN' ? 'CRISIS' : 'DISRUPTION',
        severity: c.severity,
        immediateImpact: { budgetFine: sev.fine, tdiSurge: sev.tdi, velocityPenalty: sev.vel, ...(c.severity === 'BLACK_SWAN' && hit[0] ? { downedNodeIds: [hit[0]] } : {}) },
        choices: c.answers.map((a, j) => {
          const kind = answerKinds[j];
          const t = ANSWER[kind];
          const trustImpact = trust(a.favoredBy, a.opposedBy, 10, 10);
          if (kind === 'AVOIDANCE' && complianceChampion) trustImpact[complianceChampion] = (trustImpact[complianceChampion] ?? 0) - 12;
          return {
            id: a.id,
            text: a.text,
            capExImpact: t.cost(sev.fine),
            tdiImpact: t.tdi,
            velocityImpact: t.vel + (c.severity === 'BLACK_SWAN' && kind === 'LASTING' ? 2 : 0),
            trustImpact,
            ...(t.heal && hit.length ? { nodeHealthImpacts: Object.fromEntries(hit.map(id => [id, t.heal])) } : {}),
          };
        }),
      };
    });

  // Starting position
  const technicalDebtIndex = START.debt[LV[st.debt]];
  const deliveryVelocity = START.velocity[LV[st.capacity]];
  const resilienceIndex = START.resilience[LV[st.resilience]];
  const complianceScore = START.compliance[LV[st.compliance]];
  const budgetRemaining = START.cash[LV[st.cash]];
  const modernized = nodes.filter(n => n.status === 'MODERNIZED').length;
  const baselineMetrics = {
    tco: 2400,
    budgetRemaining,
    opEx: calculateOpEx(nodes, technicalDebtIndex, 0),
    capExSpent: 350,
    technicalDebtIndex,
    deliveryVelocity,
    stakeholderTrust: Math.round(stakeholders.reduce((sum, s) => sum + (s.baseTrust ?? 50), 0) / Math.max(1, stakeholders.length)),
    resilienceIndex,
    complianceScore,
    modernizedNodesCount: modernized,
  };

  // Market: real prices -> thousands; qualitative criteria -> sensitivities
  let market: MarketModel | undefined;
  if (meta.withMarket && draft.market && draft.market.segments.length >= 2) {
    const level = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.8 };
    const growth: Record<Level, number> = { LOW: 0.01, MODERATE: 0.03, HIGH: 0.06, SEVERE: 0.09 };
    const segments = draft.market.segments.map((g, i) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      baseDemand: Math.round(g.demandPerQuarter),
      growth: growth[g.growth],
      referencePrice: Math.round((g.unitPrice / 1000) * 10000) / 10000,
      priceSensitivity: level[g.price],
      qualitySensitivity: level[g.quality],
      speedSensitivity: level[g.availability],
      reliabilitySensitivity: level[g.reliability],
      ...(g.closedAtStart && i > 0 ? { openAtStart: false, entryCost: Math.round(budgetRemaining * 0.12) } : {}),
    }));
    const segIds = new Set(segments.map(s => s.id));
    const positioning = {
      PREMIUM: { priceIndex: 1.1, quality: 78, aggressiveness: 0.1 },
      LOW_COST: { priceIndex: 0.8, quality: 42, aggressiveness: 0.5 },
      LEADER: { priceIndex: 1, quality: 68, aggressiveness: 0.25 },
      CHALLENGER: { priceIndex: 0.92, quality: 55, aggressiveness: 0.4 },
    };
    const rivals = draft.market.rivals.map(r => {
      const where = r.segments.map(s => resolveId(segIds, s)).filter((x): x is string => !!x);
      return { id: r.id, name: r.name, ...positioning[r.positioning], ...(where.length ? { segmentIds: where } : {}) };
    });
    const cheapest = Math.min(...segments.map(s => s.referencePrice));
    const unitCostK = draft.market.unitCost / 1000;
    const openDemand = segments.filter(s => s.openAtStart !== false).reduce((sum, s) => sum + s.baseDemand, 0);
    market = {
      segments,
      rivals: rivals.length ? rivals : [{ id: 'riv-1', name: draft.language === 'fr' ? 'Concurrent bas coût' : 'Low-cost competitor', ...positioning.LOW_COST }],
      unitCost: unitCostK > 0 && unitCostK < cheapest ? Math.round(unitCostK * 10000) / 10000 : Math.round(cheapest * 0.6 * 10000) / 10000,
      fixedCosts: 0,
      unitsPerCapacityPoint: Math.max(0.1, Math.round(((openDemand * 0.4) / deliveryVelocity) * 100) / 100),
      cashRetention: 0.5,
    };
  }

  const scenario: Scenario = {
    id: `scen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: draft.title,
    industry: draft.industry,
    domain: meta.domain,
    language: draft.language,
    currency: draft.currency,
    difficulty: meta.difficulty,
    description: draft.description,
    businessContext: draft.businessContext,
    vocabulary: sanitizeVocabulary(draft.vocabulary),
    baselineMetrics,
    winLossConditions: {
      maxTechnicalDebtIndex: Math.max(30, technicalDebtIndex - 22),
      minStakeholderTrustAvg: 60,
      minDeliveryVelocity: Math.min(75, deliveryVelocity + 12),
      minResilienceIndex: Math.min(80, resilienceIndex + 22),
      maxTCOBudget: Math.round(baselineMetrics.tco + budgetRemaining * 1.7),
      targetCapabilitiesModernized: Math.min(nodes.length, modernized + 3),
    },
    totalRounds: 4,
    maxInitiativesPerRound: 2,
    ...(market ? { market } : {}),
    topology: { nodes, edges },
    stakeholders,
    roundEvents,
    initiativesCatalog,
    tags: [draft.industry, meta.domain],
    author: meta.author,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
  return { scenario: calibrateMarket(scenario), notes: { forced } };
}
