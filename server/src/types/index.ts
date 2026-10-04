// ============================================================================
// GEMSIM: CORE TYPE DEFINITIONS
// Enterprise Business Strategy, Architecture & Operations Simulation Platform
// ============================================================================

export type EnterpriseLayer = 'BUSINESS' | 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE';
export type NodeHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'MODERNIZED';
export type EdgeFlowStatus = 'NORMAL' | 'BOTTLENECK' | 'SEVERED' | 'OPTIMIZED';

export type NodeArchetype = 'TOWER' | 'DATABASE' | 'SLAB';

export interface TopologyNode {
  id: string;
  name: string;
  layer: EnterpriseLayer;
  archetype?: NodeArchetype; // 3D building shape; inferred from name/layer when absent
  description: string;
  health: number; // 0 - 100
  technicalDebt: number; // 0 - 100
  criticalPath: boolean;
  costPerRound: number; // OpEx cost in thousands $
  position: { x: number; y: number; z: number };
  status: NodeHealthStatus;
  dependencies: string[]; // node IDs
  telemetry: {
    latencyMs: number;
    throughputRps: number;
    errorRatePercent: number;
    failureRisk: number; // 0 - 100
  };
}

export interface TopologyEdge {
  id: string;
  fromId: string;
  toId: string;
  protocol: string;
  bandwidthMbps: number;
  status: EdgeFlowStatus;
  latencyMs: number;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export type InitiativeCategory =
  | 'MODERNIZATION'
  | 'FEATURE_EXPEDITE'
  | 'DEBT_REDUCTION'
  | 'GOVERNANCE_STRICT'
  | 'CLOUD_INFRA'
  | 'SECURITY_COMPLIANCE'
  | 'AI_AUTOMATION'
  // Domain-neutral categories for industrial, expansion and sourcing cases
  | 'CAPACITY_EXPANSION'
  | 'OPERATIONS_EXCELLENCE'
  | 'SOURCING_PARTNERSHIP'
  | 'MARKET_EXPANSION'
  | 'RISK_MITIGATION'
  | 'PEOPLE_CHANGE'
  | 'QUICK_WIN';

export const INITIATIVE_CATEGORIES: InitiativeCategory[] = [
  'MODERNIZATION', 'FEATURE_EXPEDITE', 'DEBT_REDUCTION', 'GOVERNANCE_STRICT', 'CLOUD_INFRA', 'SECURITY_COMPLIANCE',
  'AI_AUTOMATION', 'CAPACITY_EXPANSION', 'OPERATIONS_EXCELLENCE', 'SOURCING_PARTNERSHIP', 'MARKET_EXPANSION',
  'RISK_MITIGATION', 'PEOPLE_CHANGE', 'QUICK_WIN',
];

export type GovernancePosture = 'BYPASS_ARCH' | 'BALANCED_AGILE' | 'STRICT_GOVERNANCE' | 'ACCELERATED_MODERN';

/** Business domain of a scenario: drives default vocabulary and Studio prompting. */
export type ScenarioDomain = 'IT' | 'INDUSTRIAL' | 'MARKET_EXPANSION' | 'SOURCING' | 'GENERIC';

export type MetricKey =
  | 'technicalDebtIndex'
  | 'deliveryVelocity'
  | 'stakeholderTrust'
  | 'resilienceIndex'
  | 'complianceScore'
  | 'budgetRemaining'
  | 'opEx'
  | 'tco'
  | 'modernizedNodesCount'
  | 'revenue'
  | 'marketShare'
  | 'operatingProfit'
  | 'cumulativeProfit';

// ----------------------------------------------------------------------------
// Competitive market (optional per scenario). Teams of a session sell into the
// same segments, against each other and against scripted rivals.
// ----------------------------------------------------------------------------

export interface MarketSegment {
  id: string;
  name: string;
  description?: string;
  baseDemand: number; // units per quarter in Q1
  growth: number; // demand growth per quarter (0.03 = +3%)
  referencePrice: number; // $K per unit, the market's usual price
  // Purchase criteria (each 0-1): how much customers weigh price, quality
  // (low debt + compliance), availability (delivery capacity) and reliability (resilience)
  priceSensitivity: number;
  qualitySensitivity: number;
  speedSensitivity: number;
  reliabilitySensitivity: number;
  openAtStart?: boolean; // default true; false = the team must pay entryCost to sell there
  entryCost?: number; // $K, paid once from the program cash
}

export interface MarketRival {
  id: string;
  name: string;
  priceIndex: number; // price relative to the reference price (0.9 = 10% cheaper)
  quality: number; // 0-100
  aggressiveness: number; // 0-1: how fast it cuts prices quarter after quarter
  segmentIds?: string[]; // where it sells (default: every segment)
}

export interface MarketModel {
  segments: MarketSegment[];
  rivals: MarketRival[];
  unitCost: number; // variable cost per unit ($K)
  fixedCosts: number; // business fixed costs per quarter, outside the transformation run budget ($K)
  unitsPerCapacityPoint: number; // units the team can deliver per point of delivery capacity
  cashRetention: number; // share of the business result (after run budget and marketing) credited to the program (0-1)
  currencyUnit?: string; // display only
}

export interface MarketDecision {
  prices: Record<string, number>; // segmentId -> $K per unit
  marketing: Record<string, number>; // segmentId -> $K this quarter
  enter?: string[]; // closed segments the team opens this quarter
}

export interface MarketSegmentResult {
  segmentId: string;
  demand: number; // total segment demand this quarter (units)
  price: number;
  marketing: number;
  attractiveness: number;
  share: number; // 0-1 of the segment's demand
  unitsDemanded: number;
  unitsSold: number;
  revenue: number; // $K
  drivers: { price: number; quality: number; availability: number; reliability: number; marketing: number }; // logit terms
}

export interface TeamMarketResult {
  segments: MarketSegmentResult[];
  capacityUnits: number;
  unitsSold: number;
  lostSales: number; // demand the team could not serve (capacity)
  revenue: number;
  variableCost: number;
  grossMargin: number;
  marketing: number;
  entryCosts: number;
  fixedCosts: number;
  opEx: number;
  operatingProfit: number; // revenue - variable cost - fixed costs - opEx - marketing
  programCashDelta: number; // cashRetention × (margin - fixed costs - run budget - marketing) - entry costs
  marketShare: number; // percent, demand-weighted over every segment
  rivals: Array<{ id: string; name: string; share: number; price: number }>; // average over segments
}

/**
 * Scenario-specific wording, written in the scenario's language. The engine keeps
 * its generic model (debt, throughput, resilience, compliance); the vocabulary says
 * what those mean in this business (e.g. debt = ageing of the plant).
 */
export interface ScenarioVocabulary {
  metrics?: Partial<Record<MetricKey, { label: string; description?: string }>>;
  layers?: Partial<Record<EnterpriseLayer, string>>;
  postures?: Partial<Record<GovernancePosture, { name: string; description?: string }>>;
  nodeNoun?: string; // what a topology node is: "system", "site", "line"...
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface InitiativeTemplate {
  id: string;
  name: string;
  category: InitiativeCategory;
  description: string;
  capExCost: number; // in $K
  opExDelta: number; // per round delta in $K
  tdiDelta: number; // delta to Technical Debt Index
  velocityDelta: number; // delta to Delivery Velocity %
  resilienceDelta: number; // delta to Resilience Index
  complianceDelta: number; // delta to Governance Compliance
  trustDelta: Record<string, number>; // stakeholderId -> trust delta
  affectedNodeIds: string[];
  durationRounds: number;
  riskLevel: RiskLevel;
  unlockedRound?: number;
}

export interface StakeholderPersona {
  id: string;
  name: string;
  title: string;
  role: string;
  avatar: string;
  personality: string;
  bias: string;
  hiddenAgenda: string;
  negotiationTolerance: number; // 0 - 100
  baseTrust: number; // initial trust 0 - 100
  currentTrust?: number;
  decisionWeights: {
    financialAcumen: number; // 0 - 1
    deliverySpeed: number; // 0 - 1
    architecturalRigor: number; // 0 - 1
    regulatoryCompliance: number; // 0 - 1
  };
  sampleDialogue: {
    greeting: string;
    resistance: string;
    concession: string;
  };
}

export interface EventChoice {
  id: string;
  text: string;
  capExImpact: number;
  tdiImpact: number;
  velocityImpact: number;
  trustImpact: Record<string, number>;
  nodeHealthImpacts?: Record<string, number>;
}

export interface RoundEvent {
  roundNumber: number;
  title: string;
  description: string;
  type: 'DISRUPTION' | 'CRISIS' | 'AUDIT' | 'MARKET_SHIFT' | 'VENDOR_EOL' | 'COMPETITIVE_SURGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLACK_SWAN';
  immediateImpact: {
    budgetFine: number;
    tdiSurge: number;
    velocityPenalty: number;
    downedNodeIds?: string[];
  };
  impactAppliedAtInjection?: boolean; // facilitator-injected crises hit immediately, not again at resolution
  choices: EventChoice[];
}

export interface WinLossConditions {
  maxTechnicalDebtIndex: number;
  minStakeholderTrustAvg: number;
  minDeliveryVelocity: number;
  minResilienceIndex: number;
  maxTCOBudget: number;
  targetCapabilitiesModernized: number;
  minMarketShare?: number; // percent, for a solo team against the rivals (scaled for multi-team sessions)
  minCumulativeProfit?: number; // $K over the game
}

export type ScenarioCurrency = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CAD';

/** A scenario's texts translated into another language, tied to the source text it was made from. */
export interface ScenarioTranslation {
  sourceHash: string; // fingerprint of the source text; a mismatch means the translation is out of date
  texts: Record<string, string>; // path -> translated text (see engine/scenario-text.ts)
  provider?: string;
  translatedAt: string;
}

export interface Scenario {
  id: string;
  title: string;
  industry: string;
  difficulty: 'ENTRY' | 'INTERMEDIATE' | 'EXECUTIVE' | 'CRISIS_CHIEF';
  description: string;
  businessContext: string;
  baselineMetrics: TeamMetrics;
  winLossConditions: WinLossConditions;
  totalRounds: number;
  topology: TopologyGraph;
  stakeholders: StakeholderPersona[];
  roundEvents: RoundEvent[];
  initiativesCatalog: InitiativeTemplate[];
  domain?: ScenarioDomain;
  language?: 'fr' | 'en';
  vocabulary?: ScenarioVocabulary;
  maxInitiativesPerRound?: number; // delivery capacity per quarter (default 2)
  translations?: Partial<Record<'fr' | 'en', ScenarioTranslation>>; // texts in the other language
  currency?: ScenarioCurrency; // display only; amounts are thousands of this currency (default USD)
  market?: MarketModel;
  tags: string[];
  author: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TeamMetrics {
  tco: number; // Total Cost of Ownership ($K)
  budgetRemaining: number; // Cash reserves ($K)
  opEx: number; // Current OpEx run-rate ($K / round)
  capExSpent: number; // Accumulated CapEx ($K)
  technicalDebtIndex: number; // 0 - 100 (compound interest rate applies)
  deliveryVelocity: number; // Story points or velocity index (0 - 100)
  stakeholderTrust: number; // Aggregate trust (0 - 100)
  resilienceIndex: number; // Enterprise uptime & fault tolerance (0 - 100)
  complianceScore: number; // Regulatory audit adherence (0 - 100)
  modernizedNodesCount: number;
  // Competitive market scenarios only
  revenue?: number; // $K this quarter
  operatingProfit?: number; // $K this quarter
  cumulativeProfit?: number; // $K since Q1
  marketShare?: number; // percent
}

export interface TeamDecision {
  selectedInitiativeIds: string[];
  eventChoiceId?: string;
  governancePosture: 'BYPASS_ARCH' | 'BALANCED_AGILE' | 'STRICT_GOVERNANCE' | 'ACCELERATED_MODERN';
  customPacts: Array<{
    stakeholderId: string;
    concession: string;
    committedBudget: number;
  }>;
  market?: MarketDecision;
}

/** Language-neutral message: the client translates `code` with `params`. */
export interface MessageCode {
  code: string;
  params?: Record<string, string | number>;
}

export interface RoundResult {
  roundNumber: number;
  notes?: MessageCode[]; // structured version of facilitatorFeedback
  teamId: string;
  metricsBefore: TeamMetrics;
  metricsAfter: TeamMetrics;
  metricDeltas: {
    tco: number;
    technicalDebtIndex: number;
    deliveryVelocity: number;
    stakeholderTrust: number;
    resilienceIndex: number;
    complianceScore: number;
    budgetRemaining: number;
  };
  economics?: {
    runAllocation: number; // quarterly run budget funded by the business ($K)
    opExOverrun: number; // OpEx above the run allocation, charged to the change budget
    capExSpent: number;
    eventCost: number;
    pactCost: number;
    regulatoryFine: number;
    marketCash?: number; // business result credited to the program, minus market entries
  };
  market?: TeamMarketResult;
  // Replay & coaching data (sessions resolved before they existed do not have them)
  decision?: TeamDecision; // the decision resolved this quarter (market decision with its defaults)
  mandate?: BoardMandate['verdict']; // board resolution in force this quarter
  trustMapBefore?: Record<string, number>;
  trustMapAfter?: Record<string, number>;
  marketPresenceBefore?: string[];
  breakdown?: QuarterBreakdown;
  promises?: Array<{ id: string; stakeholderId: string; status: 'KEPT' | 'BROKEN' }>;
  incidentsTriggered: Array<{
    id: string;
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    costImpact: number;
    description: string;
    affectedNodeId?: string;
    nodeName?: string;
    nodeDebt?: number;
    failureProbability?: number; // percent
  }>;
  debtCompoundedAmount: number;
  activeInitiativesProgress: Array<{
    initiativeId: string;
    name: string;
    completed: boolean;
    remainingRounds: number;
  }>;
  facilitatorFeedback: string;
  stakeholderReactions: Array<{
    stakeholderId: string;
    name: string;
    trustDelta: number;
    comment: string;
    notes?: MessageCode[];
  }>;
}

/** Where each change of the quarter came from, for the coach and the debrief. */
export interface QuarterBreakdown {
  debt: { drift: number; initiatives: number; governance: number; delivery: number; crisis: number };
  velocity: { debtDrag: number; capabilities: number; initiatives: number; board: number; governance: number; crisis: number; incidents: number };
  cash: { investments: number; crisis: number; incidents: number; fines: number; pacts: number; runOverrun: number; market: number };
}

/** A commitment the team made to an executive (or the board) that the executive accepted. */
export interface TeamPromise {
  id: string;
  stakeholderId: string; // 'BOARD' for a board resolution
  round: number;
  initiativeIds: string[];
  excerpt: string;
  status: 'PENDING' | 'KEPT' | 'BROKEN';
}

export interface Team {
  id: string;
  sessionId: string;
  name: string;
  color: string;
  avatar: string;
  metrics: TeamMetrics;
  stakeholderTrustMap: Record<string, number>; // stakeholderId -> trust (0-100)
  currentRoundDecisions: TeamDecision;
  decisionSubmitted: boolean;
  history: RoundResult[];
  activeInitiatives: Array<{
    initiativeId: string;
    roundsRemaining: number;
  }>;
  completedInitiativeIds?: string[];
  boardMandate?: BoardMandate; // latest board resolution; only applies to its own quarter
  stakeholderPatience?: Record<string, number>; // stakeholderId -> patience (0-100); 0 = door closed this quarter
  honoredPacts?: TeamDecision['customPacts'];
  outcome?: SimulationOutcome;
  nodeHealthOverrides: Record<string, { health: number; technicalDebt: number; status: NodeHealthStatus }>;
  marketPresence?: string[]; // segments the team sells in (default: segments open at start)
  promises?: TeamPromise[];
  lastMarketDecision?: MarketDecision; // carried over when a quarter's decision has none
}

export interface OutcomeObjective {
  key: 'technicalDebtIndex' | 'stakeholderTrust' | 'deliveryVelocity' | 'resilienceIndex' | 'tco' | 'modernizedNodesCount' | 'solvency' | 'marketShare' | 'cumulativeProfit';
  label: string;
  comparator: '<=' | '>=';
  target: number;
  actual: number;
  met: boolean;
  attainment: number; // 0-1 partial credit
}

export interface SimulationOutcome {
  verdict: 'VICTORY' | 'PARTIAL' | 'DEFEAT';
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  score: number; // 0-100
  objectivesMet: number;
  objectives: OutcomeObjective[];
}

export type SessionState = 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export type PilotPhase = 'PRE' | 'POST';

/** One anonymous answer to the pilot questionnaire, attached to a team only. */
export interface PilotResponse {
  id: string;
  teamId: string;
  phase: PilotPhase;
  respondentId: string; // random id kept by the browser, to avoid answering twice
  answers: number[]; // chosen option per quiz question (-1 = no answer)
  satisfaction?: number[]; // 1-5 per item (after the workshop)
  hindrance?: string;
  lesson?: string;
  submittedAt: string;
}

export interface SessionPilot {
  preOpen: boolean;
  postOpen: boolean;
  responses: PilotResponse[]; // hidden from players
}

export interface SimulationSession {
  id: string;
  name: string;
  scenarioId: string;
  scenarioTitle: string;
  facilitatorPasscode?: string;
  state: SessionState;
  currentRound: number;
  totalRounds: number;
  timerSecondsRemaining: number;
  roundDurationSeconds: number;
  isTimerRunning: boolean;
  teams: Team[];
  injectedEvents?: RoundEvent[];
  pilot?: SessionPilot;
  activeCrisis?: RoundEvent | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMandate {
  round: number;
  verdict: BoardResolution['verdict'];
  consensusScore: number;
}

export interface BoardResolution {
  verdict: 'APPROVED' | 'REJECTED' | 'CONDITIONAL_QUORUM';
  consensusScore: number; // 0 - 100
  rationale: string;
  concessionRequired?: string;
  votes: {
    accepted: number;
    conditional: number;
    rejected: number;
    total: number;
  };
  breakdown: Record<string, {
    stakeholderName: string;
    verdict: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE';
    trustDelta: number;
  }>;
}

export interface ChatMessage {
  id: string;
  sender: 'PLAYER' | 'STAKEHOLDER' | 'SYSTEM';
  stakeholderId?: string;
  senderName: string;
  content: string;
  timestamp: string;
  evaluation?: ProposalEvaluation;
  boardResolution?: BoardResolution;
}

export interface ProposalEvaluation {
  empathyScore: number; // 0 - 100
  financialAcumenScore: number; // 0 - 100
  strategicAlignmentScore: number; // 0 - 100
  trustDelta: number; // -30 to +30
  verdict: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE';
  rationale: string;
  concessionRequired?: string;
  verdictProbabilities?: Partial<Record<'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE', number>>; // System One distribution
  decisionEngine?: string; // System One model that made the decision, when used
}

export type AIProviderType = 'ollama' | 'gemini' | 'claude' | 'openai' | 'fallback';

export interface AIProviderConfig {
  type: AIProviderType;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  temperature?: number;
  timeoutMs?: number;
}

export interface AISettingsState {
  activeProvider: AIProviderType;
  providers: Record<AIProviderType, AIProviderConfig>;
  fallbackChain: AIProviderType[];
  availableOllamaModels?: string[];
}

export interface ArchivedSimulationRun {
  id: string;
  sessionId: string;
  scenarioId: string;
  sessionName: string;
  scenarioTitle: string;
  runNumber: number;
  completedAt: string;
  totalRounds: number;
  winnerTeamName?: string;
  teams: Array<{
    id: string;
    name: string;
    avatar: string;
    finalMetrics: TeamMetrics;
    history: RoundResult[];
  }>;
  executiveDebriefSummary: {
    rankings: Array<{
      rank: number;
      teamName: string;
      technicalDebtIndex: string;
      deliveryVelocity: string;
      stakeholderTrust: string;
      budgetRemaining: string;
      tco: string;
      resilienceIndex: string;
      complianceScore: string;
      grade?: SimulationOutcome['grade'];
      verdict?: SimulationOutcome['verdict'];
      score?: number;
    }>;
  };
  chatTranscriptCount?: number;
}

// WebSocket Telemetry Protocol Messages
export type WSClientMessage =
  | { type: 'JOIN_SESSION'; sessionId: string; teamId?: string; role: 'PLAYER' | 'FACILITATOR'; pin?: string }
  | { type: 'SUBMIT_DECISIONS'; sessionId: string; teamId: string; decisions: TeamDecision }
  | { type: 'STAKEHOLDER_CHAT'; sessionId: string; teamId: string; stakeholderId: string; message: string }
  | { type: 'FACILITATOR_CONTROL'; sessionId: string; action: 'START' | 'PAUSE' | 'RESUME' | 'ADVANCE_ROUND' | 'RESET'; targetRound?: number; pin?: string }
  | { type: 'INJECT_EVENT'; sessionId: string; event: RoundEvent }
  | { type: 'BROADCAST_ANNOUNCEMENT'; sessionId: string; message: string; pin?: string };

export type WSServerMessage =
  | { type: 'SESSION_STATE'; session: SimulationSession }
  | { type: 'TIMER_TICK'; secondsRemaining: number; isRunning: boolean }
  | { type: 'TEAM_UPDATED'; team: Team }
  | { type: 'ROUND_RESOLVED'; session: SimulationSession; results: Record<string, RoundResult> }
  | { type: 'CRISIS_INJECTED'; sessionId: string; event: RoundEvent; session: SimulationSession }
  | { type: 'SESSION_RESET'; sessionId: string; session: SimulationSession; archivedRun?: ArchivedSimulationRun }
  | { type: 'STAKEHOLDER_CHUNK'; teamId: string; stakeholderId: string; chunk: string }
  | { type: 'STAKEHOLDER_RESPONSE'; teamId: string; message: ChatMessage }
  | { type: 'ANNOUNCEMENT'; message: string; timestamp: string; code?: MessageCode }
  | { type: 'TELEMETRY_PULSE'; activeTeams: number; round: number; avgTdi: number; avgTrust: number }
  | { type: 'ERROR'; message: string };

