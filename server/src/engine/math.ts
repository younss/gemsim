// ============================================================================
// GEMSIM: MATHEMATICAL SIMULATION ENGINE FORMULAS
// Deterministic Formulas for Enterprise Architecture & Strategic Operations
// ============================================================================

import { TeamMetrics, TopologyNode, InitiativeTemplate, StakeholderPersona } from '../types/index.js';

export interface CalculationContext {
  previousMetrics: TeamMetrics;
  governancePosture: 'BYPASS_ARCH' | 'BALANCED_AGILE' | 'STRICT_GOVERNANCE' | 'ACCELERATED_MODERN';
  selectedInitiatives: InitiativeTemplate[];
  nodes: TopologyNode[];
  stakeholders: StakeholderPersona[];
}

/**
 * Calculates compound technical debt drift.
 * In enterprise software, unaddressed debt compounds non-linearly.
 * Formula: TDI_drift = TDI_prev * compoundRate
 */
export function calculateCompoundDebtDrift(
  previousTdi: number,
  governancePosture: 'BYPASS_ARCH' | 'BALANCED_AGILE' | 'STRICT_GOVERNANCE' | 'ACCELERATED_MODERN'
): { driftAmount: number; compoundRate: number } {
  let compoundRate = 0.07; // Base 7% compounding per round

  switch (governancePosture) {
    case 'BYPASS_ARCH':
      compoundRate = 0.18; // 18% severe compounding when bypassing standards
      break;
    case 'BALANCED_AGILE':
      compoundRate = 0.08; // 8% balanced rate
      break;
    case 'STRICT_GOVERNANCE':
      compoundRate = 0.025; // 2.5% strictly controlled drift
      break;
    case 'ACCELERATED_MODERN':
      compoundRate = 0.04; // 4% controlled modernization
      break;
  }

  const driftAmount = Math.round(previousTdi * compoundRate * 10) / 10;
  return { driftAmount, compoundRate };
}

/**
 * Calculates delivery velocity factoring in architectural drag and active initiatives.
 * Velocity Drag Equation:
 * V_drag = (TDI / 100)^1.4
 * Effective_Velocity = clamp(Base_Velocity * (1 - 0.70 * V_drag) + Bonuses, 5, 100)
 */
export function calculateEffectiveVelocity(
  baseVelocity: number,
  currentTdi: number,
  velocityBonuses: number
): { effectiveVelocity: number; dragPercentage: number } {
  const normalizedTdi = Math.min(100, Math.max(0, currentTdi)) / 100;
  // Non-linear drag curve
  const dragFactor = Math.pow(normalizedTdi, 1.4);
  const dragPercentage = Math.round(dragFactor * 70 * 10) / 10; // Up to 70% drag

  const calculated = baseVelocity * (1 - (dragPercentage / 100)) + velocityBonuses;
  const effectiveVelocity = Math.max(8, Math.min(100, Math.round(calculated)));

  return { effectiveVelocity, dragPercentage };
}

/**
 * Calculates Operating Expenditure (OpEx) for a round.
 * OpEx includes baseline operations + node upkeep + technical debt maintenance penalty.
 * Equation: OpEx = Base_OpEx + Sum(Node_Cost) * (1 + 0.45 * (TDI / 100))
 */
export function calculateOpEx(
  nodes: TopologyNode[],
  currentTdi: number,
  activeOpExDelta: number
): number {
  const baseNodeCost = nodes.reduce((sum, n) => sum + (n.costPerRound || 20), 0);
  const debtMaintenanceMultiplier = 1 + (0.45 * (currentTdi / 100));
  const calculated = (baseNodeCost * debtMaintenanceMultiplier) + activeOpExDelta;
  return Math.round(Math.max(10, calculated));
}

/**
 * Calculates probability of production incidents and system failures based on node debt.
 * Critical path nodes with > 65% debt carry exponential failure risk.
 */
export function calculateIncidentProbabilities(
  nodes: TopologyNode[],
  resilienceIndex: number
): Array<{ node: TopologyNode; failureProbability: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> {
  const resilienceDamping = Math.max(0.3, 1 - (resilienceIndex / 160));

  return nodes.map(node => {
    const debtRatio = node.technicalDebt / 100;
    const criticalMultiplier = node.criticalPath ? 1.6 : 0.9;
    
    // Non-linear failure probability
    const baseProb = Math.pow(debtRatio, 2.2) * criticalMultiplier * resilienceDamping;
    const failureProbability = Math.min(0.95, Math.max(0.01, baseProb));

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (failureProbability > 0.65 || (node.criticalPath && failureProbability > 0.4)) {
      severity = 'CRITICAL';
    } else if (failureProbability > 0.4) {
      severity = 'HIGH';
    } else if (failureProbability > 0.2) {
      severity = 'MEDIUM';
    }

    return {
      node,
      failureProbability: Math.round(failureProbability * 100) / 100,
      severity,
    };
  });
}

/**
 * Calculates stakeholder sentiment updates based on metric trajectory and alignment.
 */
export function evaluateStakeholderSentiment(
  stakeholder: StakeholderPersona,
  deltas: {
    financialDelta: number; // positive = budget saved / under budget
    velocityDelta: number; // positive = faster feature delivery
    architectureDelta: number; // positive = lower TDI, higher resilience
    complianceDelta: number; // positive = better compliance
  },
  currentTrust: number
): { newTrust: number; trustDelta: number; reactionNote: string } {
  const weights = stakeholder.decisionWeights;

  const score =
    (deltas.financialDelta * weights.financialAcumen) +
    (deltas.velocityDelta * weights.deliverySpeed) +
    (deltas.architectureDelta * weights.architecturalRigor) +
    (deltas.complianceDelta * weights.regulatoryCompliance);

  // Scale score to delta (-25 to +25)
  const rawDelta = Math.round(score * 15);
  const trustDelta = Math.max(-25, Math.min(25, rawDelta));
  const newTrust = Math.max(5, Math.min(100, currentTrust + trustDelta));

  let reactionNote = '';
  if (trustDelta >= 10) {
    reactionNote = `${stakeholder.name} is impressed by your strategic alignment and execution.`;
  } else if (trustDelta > 0) {
    reactionNote = `${stakeholder.name} views the round's outcomes favorably.`;
  } else if (trustDelta > -8) {
    reactionNote = `${stakeholder.name} remains cautious, noting competing priorities.`;
  } else {
    reactionNote = `${stakeholder.name} is openly critical of current tradeoffs and delays.`;
  }

  return { newTrust, trustDelta, reactionNote };
}
