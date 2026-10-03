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
  | 'AI_AUTOMATION';

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
  maxInitiativesPerRound?: number; // delivery capacity per quarter (default 2)
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
}

export interface RoundResult {
  roundNumber: number;
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
  };
  incidentsTriggered: Array<{
    id: string;
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    costImpact: number;
    description: string;
    affectedNodeId?: string;
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
  }>;
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
  stakeholderPatience?: Record<string, number>; // stakeholderId -> patience (0-100); 0 = door closed this quarter
  honoredPacts?: TeamDecision['customPacts'];
  outcome?: SimulationOutcome;
  nodeHealthOverrides: Record<string, { health: number; technicalDebt: number; status: NodeHealthStatus }>;
}

export interface OutcomeObjective {
  key: 'technicalDebtIndex' | 'stakeholderTrust' | 'deliveryVelocity' | 'resilienceIndex' | 'tco' | 'modernizedNodesCount' | 'solvency';
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
  activeCrisis?: RoundEvent | null;
  createdAt: string;
  updatedAt: string;
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
  | { type: 'JOIN_SESSION'; sessionId: string; teamId?: string; role: 'PLAYER' | 'FACILITATOR' }
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
  | { type: 'ANNOUNCEMENT'; message: string; timestamp: string }
  | { type: 'TELEMETRY_PULSE'; activeTeams: number; round: number; avgTdi: number; avgTrust: number }
  | { type: 'ERROR'; message: string };

