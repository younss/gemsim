// ============================================================================
// GEMSIM: INJECTABLE CRISIS TEMPLATES
// Domain-neutral crises bound to the current scenario: they hit its most fragile
// critical element and move the trust of the executives whose mandate they touch.
// ============================================================================

import type { RoundEvent, Scenario, StakeholderPersona } from '../../types/index';
import type { TranslationKey } from '../../i18n';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;
type Weight = keyof StakeholderPersona['decisionWeights'];

export interface CrisisTemplate extends Omit<RoundEvent, 'roundNumber'> {
  key: string;
  badge: string;
}

/** Executive who cares most about a given dimension (e.g. finance, compliance). */
function champion(scenario: Scenario, weight: Weight): string | undefined {
  return [...scenario.stakeholders].sort((a, b) => b.decisionWeights[weight] - a.decisionWeights[weight])[0]?.id;
}

function trust(entries: Array<[string | undefined, number]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, delta] of entries) if (id) out[id] = (out[id] ?? 0) + delta;
  return out;
}

export function buildCrisisTemplates(scenario: Scenario, t: Translate): CrisisTemplate[] {
  const nodes = [...scenario.topology.nodes].sort((a, b) => b.technicalDebt - a.technicalDebt);
  const fragileCritical = nodes.find(n => n.criticalPath) ?? nodes[0];
  const second = nodes.find(n => n.id !== fragileCritical?.id) ?? fragileCritical;
  const target = fragileCritical?.id;
  const finance = champion(scenario, 'financialAcumen');
  const compliance = champion(scenario, 'regulatoryCompliance');
  const speed = champion(scenario, 'deliverySpeed');
  const rigor = champion(scenario, 'architecturalRigor');
  const node = fragileCritical?.name ?? '';

  return [
    {
      key: 'security',
      title: t('crisis.security.title'),
      description: t('crisis.security.desc', { node }),
      type: 'CRISIS',
      severity: 'BLACK_SWAN',
      badge: t('crisis.security.badge'),
      immediateImpact: { budgetFine: 150, tdiSurge: 12, velocityPenalty: -15, downedNodeIds: target ? [target] : [] },
      choices: [
        { id: 'inj-sec-1', text: t('crisis.security.c1'), capExImpact: 140, tdiImpact: -8, velocityImpact: -8, trustImpact: trust([[compliance, 10], [rigor, 5]]), nodeHealthImpacts: target ? { [target]: 40 } : {} },
        { id: 'inj-sec-2', text: t('crisis.security.c2'), capExImpact: 80, tdiImpact: 4, velocityImpact: -20, trustImpact: trust([[compliance, 6], [speed, -8]]), nodeHealthImpacts: target ? { [target]: 20 } : {} },
        { id: 'inj-sec-3', text: t('crisis.security.c3'), capExImpact: 200, tdiImpact: 12, velocityImpact: 0, trustImpact: trust([[finance, -10], [compliance, -8]]) },
      ],
    },
    {
      key: 'outage',
      title: t('crisis.outage.title'),
      description: t('crisis.outage.desc', { node: second?.name ?? node }),
      type: 'DISRUPTION',
      severity: 'HIGH',
      badge: t('crisis.outage.badge'),
      immediateImpact: { budgetFine: 200, tdiSurge: 10, velocityPenalty: -20, downedNodeIds: second ? [second.id] : [] },
      choices: [
        { id: 'inj-out-1', text: t('crisis.outage.c1'), capExImpact: 180, tdiImpact: -8, velocityImpact: -6, trustImpact: trust([[rigor, 10], [finance, -5]]), nodeHealthImpacts: second ? { [second.id]: 45 } : {} },
        { id: 'inj-out-2', text: t('crisis.outage.c2'), capExImpact: 60, tdiImpact: 10, velocityImpact: -15, trustImpact: trust([[speed, -12]]), nodeHealthImpacts: second ? { [second.id]: 15 } : {} },
        { id: 'inj-out-3', text: t('crisis.outage.c3'), capExImpact: 240, tdiImpact: -12, velocityImpact: -10, trustImpact: trust([[rigor, 8], [finance, -12]]), nodeHealthImpacts: second ? { [second.id]: 55 } : {} },
      ],
    },
    {
      key: 'investor',
      title: t('crisis.investor.title'),
      description: t('crisis.investor.desc'),
      type: 'MARKET_SHIFT',
      severity: 'HIGH',
      badge: t('crisis.investor.badge'),
      immediateImpact: { budgetFine: 120, tdiSurge: 6, velocityPenalty: -12, downedNodeIds: [] },
      choices: [
        { id: 'inj-inv-1', text: t('crisis.investor.c1'), capExImpact: 90, tdiImpact: -4, velocityImpact: -4, trustImpact: trust([[finance, 10]]) },
        { id: 'inj-inv-2', text: t('crisis.investor.c2'), capExImpact: 0, tdiImpact: 16, velocityImpact: -10, trustImpact: trust([[finance, 14], [rigor, -18]]) },
        { id: 'inj-inv-3', text: t('crisis.investor.c3'), capExImpact: 150, tdiImpact: -8, velocityImpact: 6, trustImpact: trust([[speed, 8], [finance, 4]]) },
      ],
    },
    {
      key: 'audit',
      title: t('crisis.audit.title'),
      description: t('crisis.audit.desc'),
      type: 'AUDIT',
      severity: 'MEDIUM',
      badge: t('crisis.audit.badge'),
      immediateImpact: { budgetFine: 90, tdiSurge: 6, velocityPenalty: -10, downedNodeIds: [] },
      choices: [
        { id: 'inj-aud-1', text: t('crisis.audit.c1'), capExImpact: 110, tdiImpact: -8, velocityImpact: -6, trustImpact: trust([[compliance, 14]]) },
        { id: 'inj-aud-2', text: t('crisis.audit.c2'), capExImpact: 140, tdiImpact: 2, velocityImpact: -10, trustImpact: trust([[compliance, 5], [finance, -8]]) },
        { id: 'inj-aud-3', text: t('crisis.audit.c3'), capExImpact: 170, tdiImpact: 8, velocityImpact: 0, trustImpact: trust([[compliance, -15], [finance, -4]]) },
      ],
    },
  ];
}
