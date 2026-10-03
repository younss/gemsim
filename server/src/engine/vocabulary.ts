// ============================================================================
// GEMSIM: DOMAIN VOCABULARY
// The engine models a generic transformation (debt, throughput, resilience,
// compliance). Each domain names those quantities in its own business terms.
// Pure module with type-only imports: shared by server prompts and the client UI.
// ============================================================================

import type { EnterpriseLayer, GovernancePosture, MetricKey, Scenario, ScenarioDomain, ScenarioVocabulary } from '../types/index.js';

export type Lang = 'fr' | 'en';

type FullVocabulary = Required<Pick<ScenarioVocabulary, 'nodeNoun'>> & {
  metrics: Record<MetricKey, { label: string; description: string }>;
  layers: Record<EnterpriseLayer, string>;
  postures: Record<GovernancePosture, { name: string; description: string }>;
};

const IT_FR: FullVocabulary = {
  nodeNoun: 'système',
  metrics: {
    technicalDebtIndex: { label: 'Dette technique', description: "Part de l'effort absorbée par des systèmes vieillissants ou bricolés. Elle se compose chaque trimestre comme une dette financière." },
    deliveryVelocity: { label: 'Vélocité de livraison', description: 'Capacité à livrer des évolutions métier. La dette la freine de façon non linéaire.' },
    stakeholderTrust: { label: 'Confiance des décideurs', description: 'Confiance moyenne du comité de direction envers votre équipe.' },
    resilienceIndex: { label: 'Résilience', description: 'Tolérance aux pannes. Elle réduit la probabilité des incidents de production.' },
    complianceScore: { label: 'Conformité', description: 'Respect des exigences réglementaires et d’audit. Sous 50 %, des amendes tombent.' },
    budgetRemaining: { label: 'Trésorerie disponible', description: 'Budget de transformation restant. Négatif = insolvabilité.' },
    opEx: { label: 'OpEx (coût de fonctionnement)', description: "Coût récurrent par trimestre. Ce qui dépasse le budget de fonctionnement financé par le métier est prélevé sur votre trésorerie." },
    tco: { label: 'Coût total (TCO)', description: 'Total des dépenses de transformation et des dépassements cumulés.' },
    modernizedNodesCount: { label: 'Capacités modernisées', description: 'Systèmes remis à niveau par une initiative de modernisation achevée.' },
  },
  layers: { BUSINESS: 'Métier', APPLICATION: 'Applications', DATA: 'Données', INFRASTRUCTURE: 'Infrastructure' },
  postures: {
    BYPASS_ARCH: { name: "Contourner l'architecture", description: 'Livrer vite sans revue : forte vélocité immédiate, dette et risques explosifs.' },
    BALANCED_AGILE: { name: 'Agile équilibré', description: 'Rythme standard, hygiène modérée.' },
    STRICT_GOVERNANCE: { name: 'Gouvernance stricte', description: 'Revues obligatoires : dette maîtrisée, conformité haute, livraisons plus lentes.' },
    ACCELERATED_MODERN: { name: 'Modernisation accélérée', description: 'Capacité réservée au refactoring : la dette baisse sans sacrifier la livraison.' },
  },
};

const IT_EN: FullVocabulary = {
  nodeNoun: 'system',
  metrics: {
    technicalDebtIndex: { label: 'Technical debt', description: 'Share of effort absorbed by ageing or patched systems. It compounds every quarter like financial debt.' },
    deliveryVelocity: { label: 'Delivery velocity', description: 'Ability to ship business changes. Debt slows it non-linearly.' },
    stakeholderTrust: { label: 'Stakeholder trust', description: "The executive committee's average trust in your team." },
    resilienceIndex: { label: 'Resilience', description: 'Fault tolerance. It lowers the probability of production incidents.' },
    complianceScore: { label: 'Compliance', description: 'Regulatory and audit adherence. Below 50%, fines apply.' },
    budgetRemaining: { label: 'Cash available', description: 'Remaining change budget. Negative = insolvent.' },
    opEx: { label: 'OpEx (run cost)', description: 'Recurring cost per quarter. What exceeds the run budget funded by the business is taken from your cash.' },
    tco: { label: 'Total cost (TCO)', description: 'Cumulated change spending and run overruns.' },
    modernizedNodesCount: { label: 'Capabilities modernized', description: 'Systems brought up to standard by a completed modernization initiative.' },
  },
  layers: { BUSINESS: 'Business', APPLICATION: 'Application', DATA: 'Data', INFRASTRUCTURE: 'Infrastructure' },
  postures: {
    BYPASS_ARCH: { name: 'Bypass architecture', description: 'Ship fast without review: immediate velocity, exploding debt and risk.' },
    BALANCED_AGILE: { name: 'Balanced agile', description: 'Standard pace, moderate hygiene.' },
    STRICT_GOVERNANCE: { name: 'Strict governance', description: 'Mandatory reviews: contained debt, high compliance, slower delivery.' },
    ACCELERATED_MODERN: { name: 'Accelerated modernization', description: 'Capacity reserved for refactoring: debt falls without stopping delivery.' },
  },
};

const INDUSTRIAL_FR: FullVocabulary = {
  nodeNoun: 'site',
  metrics: {
    technicalDebtIndex: { label: 'Vétusté industrielle', description: "Usure des équipements et retard de maintenance. Elle s'aggrave chaque trimestre si rien n'est fait." },
    deliveryVelocity: { label: 'Capacité de production', description: 'Volume livrable aux clients. La vétusté la freine.' },
    stakeholderTrust: { label: 'Confiance des parties prenantes', description: 'Confiance moyenne de la direction, des partenaires sociaux et des actionnaires.' },
    resilienceIndex: { label: "Résilience de la chaîne d'approvisionnement", description: 'Capacité à absorber pannes, ruptures et aléas. Elle réduit les arrêts de production.' },
    complianceScore: { label: 'Conformité HSE / ESG', description: 'Sécurité, environnement et exigences réglementaires. Sous 50 %, des sanctions tombent.' },
    budgetRemaining: { label: "Trésorerie du programme", description: "Budget d'investissement restant. Négatif = insolvabilité." },
    opEx: { label: "Coûts d'exploitation", description: "Coût récurrent des sites par trimestre. Le dépassement du budget d'exploitation est prélevé sur la trésorerie." },
    tco: { label: 'Coût total du programme', description: "Investissements et dépassements d'exploitation cumulés." },
    modernizedNodesCount: { label: 'Sites modernisés', description: 'Sites ou lignes remis à niveau par un projet achevé.' },
  },
  layers: { BUSINESS: 'Marché & clients', APPLICATION: 'Production', DATA: 'Pilotage & données', INFRASTRUCTURE: 'Sites & logistique' },
  postures: {
    BYPASS_ARCH: { name: 'Cadence forcée', description: 'Contrôles qualité et maintenance allégés : volume immédiat, usure et risques accrus.' },
    BALANCED_AGILE: { name: 'Exploitation standard', description: 'Rythme normal, maintenance courante.' },
    STRICT_GOVERNANCE: { name: 'Qualité & sécurité renforcées', description: 'Contrôles systématiques : moins de volume, conformité et fiabilité élevées.' },
    ACCELERATED_MODERN: { name: 'Plan de transformation industrielle', description: 'Capacité réservée à la remise à niveau sans arrêter la production.' },
  },
};

const INDUSTRIAL_EN: FullVocabulary = {
  nodeNoun: 'site',
  metrics: {
    technicalDebtIndex: { label: 'Asset ageing', description: 'Equipment wear and maintenance backlog. It worsens every quarter if left alone.' },
    deliveryVelocity: { label: 'Production capacity', description: 'Volume deliverable to customers. Ageing slows it down.' },
    stakeholderTrust: { label: 'Stakeholder trust', description: "Average trust of management, unions and shareholders." },
    resilienceIndex: { label: 'Supply chain resilience', description: 'Ability to absorb breakdowns, shortages and shocks. It reduces production stoppages.' },
    complianceScore: { label: 'HSE / ESG compliance', description: 'Safety, environmental and regulatory requirements. Below 50%, penalties apply.' },
    budgetRemaining: { label: 'Programme cash', description: 'Remaining investment budget. Negative = insolvent.' },
    opEx: { label: 'Operating costs', description: 'Recurring site costs per quarter. Overruns beyond the operating budget are taken from cash.' },
    tco: { label: 'Total programme cost', description: 'Cumulated investment and operating overruns.' },
    modernizedNodesCount: { label: 'Sites modernized', description: 'Sites or lines brought up to standard by a completed project.' },
  },
  layers: { BUSINESS: 'Market & customers', APPLICATION: 'Production', DATA: 'Steering & data', INFRASTRUCTURE: 'Sites & logistics' },
  postures: {
    BYPASS_ARCH: { name: 'Forced throughput', description: 'Lighter quality checks and maintenance: immediate volume, more wear and risk.' },
    BALANCED_AGILE: { name: 'Standard operations', description: 'Normal pace, routine maintenance.' },
    STRICT_GOVERNANCE: { name: 'Reinforced quality & safety', description: 'Systematic checks: less volume, high compliance and reliability.' },
    ACCELERATED_MODERN: { name: 'Industrial transformation plan', description: 'Capacity reserved for upgrades without stopping production.' },
  },
};

const EXPANSION_FR: FullVocabulary = {
  ...INDUSTRIAL_FR,
  nodeNoun: 'implantation',
  metrics: {
    ...INDUSTRIAL_FR.metrics,
    technicalDebtIndex: { label: "Dette d'intégration", description: "Écart entre les nouvelles implantations et le modèle opératoire cible. Il s'accumule si l'expansion va plus vite que l'intégration." },
    deliveryVelocity: { label: 'Rythme de croissance', description: 'Vitesse de conquête (ouvertures, clients, revenus). La dette d’intégration la freine.' },
    resilienceIndex: { label: 'Robustesse opérationnelle', description: 'Capacité des implantations à tenir sous la charge et les aléas locaux.' },
    complianceScore: { label: 'Conformité locale', description: 'Droit local, fiscalité, licences et normes. Sous 50 %, des sanctions tombent.' },
    modernizedNodesCount: { label: 'Implantations intégrées', description: 'Implantations alignées sur le modèle opératoire cible.' },
  },
  layers: { BUSINESS: 'Marchés', APPLICATION: 'Opérations', DATA: 'Pilotage', INFRASTRUCTURE: 'Implantations' },
};

const EXPANSION_EN: FullVocabulary = {
  ...INDUSTRIAL_EN,
  nodeNoun: 'location',
  metrics: {
    ...INDUSTRIAL_EN.metrics,
    technicalDebtIndex: { label: 'Integration debt', description: 'Gap between new locations and the target operating model. It builds up when expansion outruns integration.' },
    deliveryVelocity: { label: 'Growth pace', description: 'Speed of expansion (openings, customers, revenue). Integration debt slows it.' },
    resilienceIndex: { label: 'Operational robustness', description: 'Ability of locations to hold under load and local shocks.' },
    complianceScore: { label: 'Local compliance', description: 'Local law, tax, licences and standards. Below 50%, penalties apply.' },
    modernizedNodesCount: { label: 'Locations integrated', description: 'Locations aligned with the target operating model.' },
  },
  layers: { BUSINESS: 'Markets', APPLICATION: 'Operations', DATA: 'Steering', INFRASTRUCTURE: 'Locations' },
};

const SOURCING_FR: FullVocabulary = {
  ...IT_FR,
  nodeNoun: 'centre de service',
  metrics: {
    ...IT_FR.metrics,
    technicalDebtIndex: { label: 'Dette de dépendance', description: 'Savoir-faire perdu et dépendance au prestataire. Elle grandit si le transfert de connaissances est négligé.' },
    deliveryVelocity: { label: 'Débit de livraison', description: 'Volume livré par les équipes internes et externalisées.' },
    resilienceIndex: { label: 'Résilience du modèle de sourcing', description: 'Capacité à absorber départs, ruptures de contrat et incidents.' },
    complianceScore: { label: 'Conformité & souveraineté', description: 'Protection des données, contrats, sous-traitance. Sous 50 %, des sanctions tombent.' },
    modernizedNodesCount: { label: 'Centres maîtrisés', description: 'Centres de service remis sous contrôle (gouvernance, connaissance, qualité).' },
  },
};

const SOURCING_EN: FullVocabulary = {
  ...IT_EN,
  nodeNoun: 'delivery centre',
  metrics: {
    ...IT_EN.metrics,
    technicalDebtIndex: { label: 'Dependency debt', description: 'Lost know-how and vendor lock-in. It grows when knowledge transfer is neglected.' },
    deliveryVelocity: { label: 'Delivery throughput', description: 'Volume delivered by internal and outsourced teams.' },
    resilienceIndex: { label: 'Sourcing resilience', description: 'Ability to absorb attrition, contract breaks and incidents.' },
    complianceScore: { label: 'Compliance & sovereignty', description: 'Data protection, contracts, subcontracting. Below 50%, penalties apply.' },
    modernizedNodesCount: { label: 'Centres under control', description: 'Delivery centres brought back under control (governance, knowledge, quality).' },
  },
};

const GENERIC_FR: FullVocabulary = {
  ...IT_FR,
  nodeNoun: 'composant',
  metrics: {
    ...IT_FR.metrics,
    technicalDebtIndex: { label: 'Dette structurelle', description: "Retard d'investissement et fragilités accumulées. Elle se compose chaque trimestre." },
    deliveryVelocity: { label: "Capacité d'exécution", description: 'Vitesse à laquelle l’organisation livre ses objectifs.' },
    modernizedNodesCount: { label: 'Composants transformés', description: 'Composants remis à niveau par une initiative achevée.' },
  },
  layers: { BUSINESS: 'Clients & marché', APPLICATION: 'Opérations', DATA: 'Pilotage', INFRASTRUCTURE: 'Moyens' },
};

const GENERIC_EN: FullVocabulary = {
  ...IT_EN,
  nodeNoun: 'component',
  metrics: {
    ...IT_EN.metrics,
    technicalDebtIndex: { label: 'Structural debt', description: 'Underinvestment and accumulated fragility. It compounds every quarter.' },
    deliveryVelocity: { label: 'Execution capacity', description: 'Speed at which the organisation delivers its goals.' },
    modernizedNodesCount: { label: 'Components transformed', description: 'Components brought up to standard by a completed initiative.' },
  },
  layers: { BUSINESS: 'Customers & market', APPLICATION: 'Operations', DATA: 'Steering', INFRASTRUCTURE: 'Assets' },
};

export const DOMAIN_VOCABULARY: Record<ScenarioDomain, Record<Lang, FullVocabulary>> = {
  IT: { fr: IT_FR, en: IT_EN },
  INDUSTRIAL: { fr: INDUSTRIAL_FR, en: INDUSTRIAL_EN },
  MARKET_EXPANSION: { fr: EXPANSION_FR, en: EXPANSION_EN },
  SOURCING: { fr: SOURCING_FR, en: SOURCING_EN },
  GENERIC: { fr: GENERIC_FR, en: GENERIC_EN },
};

/**
 * Effective vocabulary for a scenario. The scenario's own wording wins when the
 * UI language matches the scenario language; otherwise the domain defaults are
 * used so labels stay in the player's language.
 */
export function resolveVocabulary(scenario: Pick<Scenario, 'domain' | 'vocabulary' | 'language'> | null | undefined, lang: Lang): FullVocabulary {
  const base = DOMAIN_VOCABULARY[scenario?.domain ?? 'IT'][lang];
  const own = scenario?.vocabulary;
  if (!own || (scenario?.language && scenario.language !== lang)) return base;
  return {
    nodeNoun: own.nodeNoun ?? base.nodeNoun,
    metrics: Object.fromEntries(
      (Object.keys(base.metrics) as MetricKey[]).map(k => [k, { ...base.metrics[k], ...(own.metrics?.[k] ?? {}) }])
    ) as FullVocabulary['metrics'],
    layers: { ...base.layers, ...(own.layers ?? {}) },
    postures: Object.fromEntries(
      (Object.keys(base.postures) as GovernancePosture[]).map(k => [k, { ...base.postures[k], ...(own.postures?.[k] ?? {}) }])
    ) as FullVocabulary['postures'],
  };
}
