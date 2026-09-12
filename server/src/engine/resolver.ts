// ============================================================================
// GEMSIM: TURN RESOLUTION STATE MACHINE
// Deterministic Turn-based Execution Engine
// ============================================================================

import {
  Scenario,
  Team,
  TeamMetrics,
  TeamDecision,
  RoundResult,
  TopologyNode,
  NodeHealthStatus,
  InitiativeTemplate,
  RoundEvent,
} from '../types/index.js';
import {
  calculateCompoundDebtDrift,
  calculateEffectiveVelocity,
  calculateOpEx,
  calculateIncidentProbabilities,
  evaluateStakeholderSentiment,
} from './math.js';

export class SimulationResolver {
  /**
   * Resolves a single round for a given team in the scenario.
   */
  public static resolveRound(
    scenario: Scenario,
    team: Team,
    roundNumber: number
  ): { updatedTeam: Team; roundResult: RoundResult } {
    const decisions = team.currentRoundDecisions || {
      selectedInitiativeIds: [],
      governancePosture: 'BALANCED_AGILE',
      customPacts: [],
    };

    const metricsBefore: TeamMetrics = { ...team.metrics };
    const initiativesMap = new Map(scenario.initiativesCatalog.map(i => [i.id, i]));
    const nodesMap = new Map(scenario.topology.nodes.map(n => [n.id, { ...n }]));

    // Apply previous node health overrides from team
    if (team.nodeHealthOverrides) {
      for (const [nodeId, override] of Object.entries(team.nodeHealthOverrides)) {
        if (nodesMap.has(nodeId)) {
          const n = nodesMap.get(nodeId)!;
          n.health = override.health;
          n.technicalDebt = override.technicalDebt;
          n.status = override.status;
        }
      }
    }

    const selectedInitiatives: InitiativeTemplate[] = decisions.selectedInitiativeIds
      .map(id => initiativesMap.get(id))
      .filter((i): i is InitiativeTemplate => Boolean(i));

    // 1. CapEx and Budget deductions
    let totalCapEx = 0;
    let initiativeTdiDelta = 0;
    let initiativeVelocityDelta = 0;
    let initiativeResilienceDelta = 0;
    let initiativeComplianceDelta = 0;
    let activeOpExDelta = 0;

    for (const init of selectedInitiatives) {
      totalCapEx += init.capExCost;
      initiativeTdiDelta += init.tdiDelta;
      initiativeVelocityDelta += init.velocityDelta;
      initiativeResilienceDelta += init.resilienceDelta;
      initiativeComplianceDelta += init.complianceDelta;
      activeOpExDelta += init.opExDelta;

      // Modernize or fix affected nodes
      for (const nodeId of init.affectedNodeIds) {
        if (nodesMap.has(nodeId)) {
          const node = nodesMap.get(nodeId)!;
          const debtReduction = Math.abs(init.tdiDelta) * 1.5;
          node.technicalDebt = Math.max(5, Math.round(node.technicalDebt - debtReduction));
          node.health = Math.min(100, Math.round(node.health + debtReduction * 1.2));
          if (node.technicalDebt <= 20) {
            node.status = 'MODERNIZED';
          } else if (node.health >= 70) {
            node.status = 'HEALTHY';
          }
          node.telemetry.latencyMs = Math.max(12, Math.round(node.telemetry.latencyMs * 0.7));
          node.telemetry.errorRatePercent = Math.max(0.01, Math.round(node.telemetry.errorRatePercent * 0.5 * 100) / 100);
        }
      }
    }

    // 2. Governance Posture Impacts
    let governanceTdiSurge = 0;
    let governanceComplianceDelta = 0;
    let governanceVelocityBonus = 0;

    switch (decisions.governancePosture) {
      case 'BYPASS_ARCH':
        governanceTdiSurge = 12; // Fast features now, immediate debt penalty
        governanceComplianceDelta = -15;
        governanceVelocityBonus = 18; // Sugar rush
        break;
      case 'BALANCED_AGILE':
        governanceTdiSurge = 0;
        governanceComplianceDelta = 2;
        governanceVelocityBonus = 0;
        break;
      case 'STRICT_GOVERNANCE':
        governanceTdiSurge = -5;
        governanceComplianceDelta = 14;
        governanceVelocityBonus = -10; // Extra review cycles slow down velocity
        break;
      case 'ACCELERATED_MODERN':
        governanceTdiSurge = -8;
        governanceComplianceDelta = 8;
        governanceVelocityBonus = 5;
        break;
    }

    // 3. Technical Debt Compounding
    const { driftAmount } = calculateCompoundDebtDrift(
      metricsBefore.technicalDebtIndex,
      decisions.governancePosture
    );

    const netTdiDelta = driftAmount + initiativeTdiDelta + governanceTdiSurge;
    const newTdi = Math.max(5, Math.min(100, Math.round(metricsBefore.technicalDebtIndex + netTdiDelta)));

    // 4. Delivery Velocity calculation
    const baseVelocity = 65;
    const totalVelocityBonuses = initiativeVelocityDelta + governanceVelocityBonus;
    const { effectiveVelocity } = calculateEffectiveVelocity(baseVelocity, newTdi, totalVelocityBonuses);

    // 5. Resilience and Compliance
    const newResilience = Math.max(
      10,
      Math.min(100, Math.round(metricsBefore.resilienceIndex + initiativeResilienceDelta + (decisions.governancePosture === 'STRICT_GOVERNANCE' ? 6 : -3)))
    );

    const newCompliance = Math.max(
      10,
      Math.min(100, Math.round(metricsBefore.complianceScore + initiativeComplianceDelta + governanceComplianceDelta))
    );

    // 6. OpEx calculation
    const currentNodes = Array.from(nodesMap.values());
    const currentOpEx = calculateOpEx(currentNodes, newTdi, activeOpExDelta);

    // 7. Incident simulation
    const incidentCandidates = calculateIncidentProbabilities(currentNodes, newResilience);
    const incidentsTriggered: RoundResult['incidentsTriggered'] = [];
    let incidentCostTotal = 0;

    for (const candidate of incidentCandidates) {
      // Deterministic threshold + pseudo-random seeded by round and team
      const threshold = (roundNumber * 0.17 + candidate.failureProbability) % 1.0;
      if (candidate.failureProbability > 0.45 && threshold > 0.4) {
        const cost = candidate.severity === 'CRITICAL' ? 350 : candidate.severity === 'HIGH' ? 180 : 75;
        incidentCostTotal += cost;
        incidentsTriggered.push({
          id: `inc-${candidate.node.id}-${roundNumber}`,
          title: `${candidate.severity} Alert: ${candidate.node.name} Degradation`,
          severity: candidate.severity,
          costImpact: cost,
          description: `High debt (${candidate.node.technicalDebt}%) and latency overload caused service disruptions. Required emergency triage and customer remediation.`,
          affectedNodeId: candidate.node.id,
        });

        // Degrade node status
        candidate.node.health = Math.max(10, candidate.node.health - 25);
        candidate.node.status = candidate.severity === 'CRITICAL' ? 'CRITICAL' : 'DEGRADED';
      }
    }

    // 8. Round Event Impact (scheduled crisis / market disruption)
    const currentRoundEvent = scenario.roundEvents.find(e => e.roundNumber === roundNumber);
    let eventCapEx = 0;
    let eventTdi = 0;
    let eventVelocity = 0;
    const eventTrustImpacts: Record<string, number> = {};

    if (currentRoundEvent) {
      if (decisions.eventChoiceId) {
        const choice = currentRoundEvent.choices.find(c => c.id === decisions.eventChoiceId);
        if (choice) {
          eventCapEx = choice.capExImpact;
          eventTdi = choice.tdiImpact;
          eventVelocity = choice.velocityImpact;
          Object.assign(eventTrustImpacts, choice.trustImpact);
        }
      } else {
        // Default penalty if team neglected choice
        eventCapEx = currentRoundEvent.immediateImpact.budgetFine;
        eventTdi = currentRoundEvent.immediateImpact.tdiSurge;
        eventVelocity = currentRoundEvent.immediateImpact.velocityPenalty;
      }
    }

    // 9. Budget and TCO updates
    const totalOutflow = totalCapEx + eventCapEx + incidentCostTotal + currentOpEx;
    const newBudgetRemaining = Math.round(metricsBefore.budgetRemaining - totalOutflow);
    const newCapExSpent = Math.round(metricsBefore.capExSpent + totalCapEx + eventCapEx + incidentCostTotal);
    const newTco = Math.round(metricsBefore.tco + totalOutflow);

    // 10. Stakeholder Sentiment updates
    const stakeholderReactions: RoundResult['stakeholderReactions'] = [];
    const updatedTrustMap: Record<string, number> = { ...team.stakeholderTrustMap };

    const financialDelta = (metricsBefore.budgetRemaining - newBudgetRemaining) < 700 ? 0.8 : -0.6;
    const velocityDeltaNorm = (effectiveVelocity - metricsBefore.deliveryVelocity) / 25;
    const architectureDelta = (metricsBefore.technicalDebtIndex - newTdi) / 15 + (newResilience - metricsBefore.resilienceIndex) / 20;
    const complianceDeltaNorm = (newCompliance - metricsBefore.complianceScore) / 20;

    let aggregateTrustSum = 0;

    for (const stakeholder of scenario.stakeholders) {
      const currentTrust = updatedTrustMap[stakeholder.id] ?? stakeholder.baseTrust ?? 60;
      const { newTrust, trustDelta, reactionNote } = evaluateStakeholderSentiment(
        stakeholder,
        {
          financialDelta,
          velocityDelta: velocityDeltaNorm,
          architectureDelta,
          complianceDelta: complianceDeltaNorm,
        },
        currentTrust
      );

      // Add event choice trust impact
      const extraEventTrust = eventTrustImpacts[stakeholder.id] || 0;
      const finalTrust = Math.max(5, Math.min(100, newTrust + extraEventTrust));

      updatedTrustMap[stakeholder.id] = finalTrust;
      aggregateTrustSum += finalTrust;

      stakeholderReactions.push({
        stakeholderId: stakeholder.id,
        name: stakeholder.name,
        trustDelta: trustDelta + extraEventTrust,
        comment: reactionNote,
      });
    }

    const newAvgTrust = Math.round(aggregateTrustSum / (scenario.stakeholders.length || 1));

    // Count modernized nodes
    const modernizedCount = currentNodes.filter(n => n.status === 'MODERNIZED' || n.technicalDebt <= 25).length;

    // Metrics After
    const metricsAfter: TeamMetrics = {
      tco: newTco,
      budgetRemaining: newBudgetRemaining,
      opEx: currentOpEx,
      capExSpent: newCapExSpent,
      technicalDebtIndex: Math.max(5, Math.min(100, newTdi + eventTdi)),
      deliveryVelocity: Math.max(8, Math.min(100, effectiveVelocity + eventVelocity)),
      stakeholderTrust: newAvgTrust,
      resilienceIndex: newResilience,
      complianceScore: newCompliance,
      modernizedNodesCount: modernizedCount,
    };

    // Construct Facilitator Feedback
    let facilitatorFeedback = `Round ${roundNumber} Completed. `;
    if (metricsAfter.technicalDebtIndex > 75) {
      facilitatorFeedback += `WARNING: Technical debt has reached critical levels (${metricsAfter.technicalDebtIndex}%). Feature delivery will stall unless refactoring is prioritized. `;
    } else if (metricsAfter.technicalDebtIndex < 35) {
      facilitatorFeedback += `EXCELLENT: Architectural health is strong, unlocking high delivery agility. `;
    }

    if (incidentsTriggered.length > 0) {
      facilitatorFeedback += `${incidentsTriggered.length} production incident(s) occurred costing $${incidentCostTotal}K. `;
    }

    if (metricsAfter.budgetRemaining < 200) {
      facilitatorFeedback += `CRITICAL: Cash reserves are nearly depleted ($${metricsAfter.budgetRemaining}K remaining). `;
    }

    // Node Health overrides to save
    const updatedNodeOverrides: Record<string, { health: number; technicalDebt: number; status: NodeHealthStatus }> = {};
    for (const node of currentNodes) {
      updatedNodeOverrides[node.id] = {
        health: node.health,
        technicalDebt: node.technicalDebt,
        status: node.status,
      };
    }

    const roundResult: RoundResult = {
      roundNumber,
      teamId: team.id,
      metricsBefore,
      metricsAfter,
      metricDeltas: {
        tco: metricsAfter.tco - metricsBefore.tco,
        technicalDebtIndex: metricsAfter.technicalDebtIndex - metricsBefore.technicalDebtIndex,
        deliveryVelocity: metricsAfter.deliveryVelocity - metricsBefore.deliveryVelocity,
        stakeholderTrust: metricsAfter.stakeholderTrust - metricsBefore.stakeholderTrust,
        resilienceIndex: metricsAfter.resilienceIndex - metricsBefore.resilienceIndex,
        complianceScore: metricsAfter.complianceScore - metricsBefore.complianceScore,
        budgetRemaining: metricsAfter.budgetRemaining - metricsBefore.budgetRemaining,
      },
      incidentsTriggered,
      debtCompoundedAmount: driftAmount,
      activeInitiativesProgress: selectedInitiatives.map(i => ({
        initiativeId: i.id,
        name: i.name,
        completed: true,
        remainingRounds: 0,
      })),
      facilitatorFeedback,
      stakeholderReactions,
    };

    const updatedTeam: Team = {
      ...team,
      metrics: metricsAfter,
      stakeholderTrustMap: updatedTrustMap,
      decisionSubmitted: false, // Reset for next round
      currentRoundDecisions: {
        selectedInitiativeIds: [],
        governancePosture: decisions.governancePosture,
        customPacts: [],
      },
      history: [...team.history, roundResult],
      nodeHealthOverrides: updatedNodeOverrides,
    };

    return { updatedTeam, roundResult };
  }
}
