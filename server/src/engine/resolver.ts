// ============================================================================
// GEMSIM: TURN RESOLUTION STATE MACHINE
// Deterministic Turn-based Execution Engine
// ============================================================================

import {
  MessageCode,
  Scenario,
  Team,
  TeamMetrics,
  RoundResult,
  NodeHealthStatus,
  InitiativeTemplate,
  RoundEvent,
  TopologyNode,
} from '../types/index.js';
import {
  calculateCompoundDebtDrift,
  calculateEffectiveVelocity,
  calculateOpEx,
  calculateIncidentProbabilities,
  evaluateStakeholderSentiment,
  seededRoll,
} from './math.js';
import { BOARD_MANDATE_EFFECTS, activeBoardMandate, getRoundEvent } from './rules.js';

const BASE_VELOCITY = 65;
// Share of a completed initiative's velocity gain that persists in later quarters
const PERSISTENT_VELOCITY_SHARE = 0.5;
const COMPLIANCE_FINE_THRESHOLD = 50;
const OPEX_SAVINGS_RETURNED = 0.5;
const MODERNIZED_DEBT_THRESHOLD = 50;
// Share of an initiative's announced debt reduction actually realized on the global index
const DEBT_REDUCTION_REALIZATION = 0.6;
const FEATURE_DEBT_DIVISOR = 10; // +1 TDI per 10 velocity points per quarter
const RESILIENCE_EROSION = 4; // unmaintained estates lose fault tolerance every quarter

/** Quarterly run budget funded by the business: the OpEx of the scenario's starting estate. */
export function getRunAllocation(scenario: Scenario): number {
  return calculateOpEx(scenario.topology.nodes, scenario.baselineMetrics.technicalDebtIndex, 0);
}

export class SimulationResolver {
  /**
   * Resolves a single round for a given team in the scenario.
   */
  public static resolveRound(
    scenario: Scenario,
    team: Team,
    roundNumber: number,
    injectedEvents?: RoundEvent[]
  ): { updatedTeam: Team; roundResult: RoundResult } {
    const decisions = team.currentRoundDecisions || {
      selectedInitiativeIds: [],
      governancePosture: 'BALANCED_AGILE',
      customPacts: [],
    };
    const seed = `${team.sessionId}|${team.id}|${roundNumber}`;

    const metricsBefore: TeamMetrics = { ...team.metrics };
    const initiativesMap = new Map(scenario.initiativesCatalog.map(i => [i.id, i]));
    const nodesMap = new Map<string, TopologyNode>(
      scenario.topology.nodes.map(n => [n.id, { ...n, telemetry: { ...n.telemetry } }])
    );

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

    // 1. Initiative lifecycle: CapEx is paid when an initiative starts, its
    //    effects land when it completes (immediately for 1-quarter initiatives).
    const completedBefore = new Set(team.completedInitiativeIds ?? []);
    const started: InitiativeTemplate[] = decisions.selectedInitiativeIds
      .map(id => initiativesMap.get(id))
      .filter((i): i is InitiativeTemplate => Boolean(i) && !completedBefore.has(i!.id));

    const stillActive: Team['activeInitiatives'] = [];
    const completing: InitiativeTemplate[] = [];
    for (const active of team.activeInitiatives ?? []) {
      const init = initiativesMap.get(active.initiativeId);
      if (!init) continue;
      const remaining = active.roundsRemaining - 1;
      if (remaining <= 0) completing.push(init);
      else stillActive.push({ initiativeId: init.id, roundsRemaining: remaining });
    }
    for (const init of started) {
      const duration = Math.max(1, init.durationRounds || 1);
      if (duration <= 1) completing.push(init);
      else stillActive.push({ initiativeId: init.id, roundsRemaining: duration - 1 });
    }

    const totalCapEx = started.reduce((sum, i) => sum + i.capExCost, 0);
    const debtReductionFactor = Math.max(0.3, Math.min(1, metricsBefore.technicalDebtIndex / 70));
    const resilienceGainFactor = Math.max(0.3, Math.min(1, (100 - metricsBefore.resilienceIndex) / 50));
    let initiativeTdiDelta = 0; // rounded below
    let initiativeVelocityDelta = 0;
    let initiativeResilienceDelta = 0;
    let initiativeComplianceDelta = 0;
    const initiativeTrust: Record<string, number> = {};

    for (const init of completing) {
      // Diminishing returns: the last points of debt and resilience are the hardest to win
      initiativeTdiDelta += init.tdiDelta < 0 ? init.tdiDelta * DEBT_REDUCTION_REALIZATION * debtReductionFactor : init.tdiDelta;
      initiativeVelocityDelta += init.velocityDelta;
      initiativeResilienceDelta += init.resilienceDelta > 0 ? init.resilienceDelta * resilienceGainFactor : init.resilienceDelta;
      initiativeComplianceDelta += init.complianceDelta;
      for (const [shId, delta] of Object.entries(init.trustDelta || {})) {
        initiativeTrust[shId] = (initiativeTrust[shId] || 0) + delta;
      }

      // Modernize or fix affected nodes (debt-adding initiatives degrade them instead)
      for (const nodeId of init.affectedNodeIds) {
        const node = nodesMap.get(nodeId);
        if (!node) continue;
        if (init.tdiDelta <= 0) {
          const debtReduction = Math.abs(init.tdiDelta) * 1.5;
          node.technicalDebt = Math.max(5, Math.round(node.technicalDebt - debtReduction));
          node.health = Math.min(100, Math.round(node.health + debtReduction * 1.2));
          // A modernization initiative re-platforms the node once its debt is back under control
          if (node.technicalDebt <= MODERNIZED_DEBT_THRESHOLD) node.status = 'MODERNIZED';
          else if (node.health >= 70) node.status = 'HEALTHY';
          node.telemetry.latencyMs = Math.max(12, Math.round(node.telemetry.latencyMs * 0.7));
          node.telemetry.errorRatePercent = Math.max(0.01, Math.round(node.telemetry.errorRatePercent * 0.5 * 100) / 100);
        } else {
          node.technicalDebt = Math.min(100, Math.round(node.technicalDebt + init.tdiDelta));
          node.health = Math.max(10, Math.round(node.health - init.tdiDelta * 0.8));
          node.status = node.health < 35 ? 'CRITICAL' : 'DEGRADED';
        }
      }
    }

    const completedInitiativeIds = [...completedBefore, ...completing.map(i => i.id)];
    // OpEx deltas are run-rate changes: they apply for every completed initiative
    const activeOpExDelta = completedInitiativeIds.reduce((sum, id) => sum + (initiativesMap.get(id)?.opExDelta ?? 0), 0);
    const persistentVelocityBonus = Math.round(
      completedInitiativeIds.reduce((sum, id) => sum + (initiativesMap.get(id)?.velocityDelta ?? 0), 0) * PERSISTENT_VELOCITY_SHARE
    );

    // 2. Governance Posture Impacts
    let governanceTdiSurge = 0;
    let governanceComplianceDelta = 0;
    let governanceVelocityBonus = 0;
    let governanceResilienceDelta = 0;

    switch (decisions.governancePosture) {
      case 'BYPASS_ARCH':
        governanceTdiSurge = 12; // Fast features now, immediate debt penalty
        governanceComplianceDelta = -15;
        governanceVelocityBonus = 18; // Sugar rush
        governanceResilienceDelta = -8; // Untested shortcuts erode fault tolerance
        break;
      case 'BALANCED_AGILE':
        governanceTdiSurge = 0;
        governanceComplianceDelta = 2;
        governanceVelocityBonus = 0;
        governanceResilienceDelta = -3;
        break;
      case 'STRICT_GOVERNANCE':
        governanceTdiSurge = -3;
        governanceComplianceDelta = 14;
        governanceVelocityBonus = -10; // Extra review cycles slow down velocity
        governanceResilienceDelta = 6;
        break;
      case 'ACCELERATED_MODERN':
        governanceTdiSurge = -5;
        governanceComplianceDelta = 8;
        governanceVelocityBonus = 5;
        governanceResilienceDelta = 2;
        break;
    }

    // 3. Technical Debt Compounding
    const { driftAmount } = calculateCompoundDebtDrift(metricsBefore.technicalDebtIndex, decisions.governancePosture);
    // Delivering features always creates new debt: the faster the team ships, the more it accrues
    const featureDebt = Math.round(metricsBefore.deliveryVelocity / FEATURE_DEBT_DIVISOR);
    const netTdiDelta = driftAmount + initiativeTdiDelta + governanceTdiSurge + featureDebt;
    const newTdi = Math.max(5, Math.min(100, Math.round(metricsBefore.technicalDebtIndex + netTdiDelta)));

    // 4. Delivery Velocity: one-off bonuses this quarter + persistent capability gains
    const mandate = activeBoardMandate(team, roundNumber);
    const boardVelocityBonus = mandate ? BOARD_MANDATE_EFFECTS[mandate.verdict].velocityBonus : 0;
    const oneOffVelocity = Math.round(initiativeVelocityDelta * (1 - PERSISTENT_VELOCITY_SHARE)) + boardVelocityBonus;
    const { effectiveVelocity } = calculateEffectiveVelocity(
      BASE_VELOCITY,
      newTdi,
      persistentVelocityBonus + oneOffVelocity + governanceVelocityBonus
    );

    // 5. Resilience and Compliance
    const newResilience = Math.max(10, Math.min(100, Math.round(metricsBefore.resilienceIndex + initiativeResilienceDelta + governanceResilienceDelta - RESILIENCE_EROSION)));
    const newCompliance = Math.max(10, Math.min(100, Math.round(metricsBefore.complianceScore + initiativeComplianceDelta + governanceComplianceDelta)));

    // 6. Round Event (injected black swan or scheduled disruption)
    const currentRoundEvent = getRoundEvent(scenario, roundNumber, injectedEvents);
    let eventCapEx = 0;
    let eventTdi = 0;
    let eventVelocity = 0;
    const eventTrustImpacts: Record<string, number> = {};
    const choice = currentRoundEvent?.choices.find(c => c.id === decisions.eventChoiceId);

    if (currentRoundEvent) {
      if (choice) {
        eventCapEx = choice.capExImpact;
        eventTdi = choice.tdiImpact;
        eventVelocity = choice.velocityImpact;
        Object.assign(eventTrustImpacts, choice.trustImpact);

        for (const [nodeId, delta] of Object.entries(choice.nodeHealthImpacts ?? {})) {
          const node = nodesMap.get(nodeId);
          if (node) {
            node.health = Math.max(10, Math.min(100, node.health + delta));
            if (node.health >= 70 && node.status === 'CRITICAL') node.status = 'HEALTHY';
          }
        }
      } else if (!currentRoundEvent.impactAppliedAtInjection) {
        // Default penalty if team neglected the dilemma
        eventCapEx = currentRoundEvent.immediateImpact.budgetFine;
        eventTdi = currentRoundEvent.immediateImpact.tdiSurge;
        eventVelocity = -Math.abs(currentRoundEvent.immediateImpact.velocityPenalty);
        for (const nodeId of currentRoundEvent.immediateImpact.downedNodeIds ?? []) {
          const node = nodesMap.get(nodeId);
          if (node) {
            node.health = Math.min(node.health, 20);
            node.status = 'CRITICAL';
          }
        }
      }
    }

    // 7. OpEx run-rate vs the run budget funded by the business
    const currentNodes = Array.from(nodesMap.values());
    const currentOpEx = calculateOpEx(currentNodes, newTdi, activeOpExDelta);
    const runAllocation = getRunAllocation(scenario);
    // Overruns are charged in full; the business keeps half of any savings
    const opExOverrun = currentOpEx > runAllocation ? currentOpEx - runAllocation : Math.round((currentOpEx - runAllocation) * OPEX_SAVINGS_RETURNED);

    // 8. Incident simulation: at-risk nodes (P > 0.45) fail on a seeded roll
    const incidentCandidates = calculateIncidentProbabilities(currentNodes, newResilience);
    const incidentsTriggered: RoundResult['incidentsTriggered'] = [];
    let incidentCostTotal = 0;
    let incidentVelocityPenalty = 0;

    for (const candidate of incidentCandidates) {
      if (candidate.failureProbability <= 0.45) continue;
      if (seededRoll(`${seed}|${candidate.node.id}`) >= candidate.failureProbability) continue;

      const cost = candidate.severity === 'CRITICAL' ? 350 : candidate.severity === 'HIGH' ? 180 : 75;
      incidentCostTotal += cost;
      incidentVelocityPenalty += candidate.severity === 'CRITICAL' ? 8 : 4;
      incidentsTriggered.push({
        id: `inc-${candidate.node.id}-${roundNumber}`,
        title: `${candidate.severity} Alert: ${candidate.node.name} Degradation`,
        severity: candidate.severity,
        costImpact: cost,
        description: `High debt (${candidate.node.technicalDebt}%) and latency overload caused service disruptions (failure probability ${Math.round(candidate.failureProbability * 100)}%). Required emergency triage, SLA credits and customer remediation.`,
        affectedNodeId: candidate.node.id,
        nodeName: candidate.node.name,
        nodeDebt: candidate.node.technicalDebt,
        failureProbability: Math.round(candidate.failureProbability * 100),
      });

      candidate.node.health = Math.max(10, candidate.node.health - 25);
      candidate.node.status = candidate.severity === 'CRITICAL' ? 'CRITICAL' : 'DEGRADED';
    }

    // 9. Regulatory fine when compliance falls under the audit threshold
    const regulatoryFine = newCompliance < COMPLIANCE_FINE_THRESHOLD ? (COMPLIANCE_FINE_THRESHOLD - newCompliance) * 6 : 0;

    // 10. Stakeholder pacts negotiated this quarter are honored now
    const pacts = decisions.customPacts ?? [];
    const pactCost = pacts.reduce((sum, p) => sum + Math.max(0, p.committedBudget), 0);

    // 11. Budget and TCO: change spending plus run overruns (the funded run baseline is excluded)
    const changeOutflow = totalCapEx + eventCapEx + incidentCostTotal + regulatoryFine + pactCost + opExOverrun;
    const newBudgetRemaining = Math.round(metricsBefore.budgetRemaining - changeOutflow);
    const newCapExSpent = Math.round(metricsBefore.capExSpent + totalCapEx + Math.max(0, eventCapEx) + incidentCostTotal);
    const newTco = Math.round(metricsBefore.tco + changeOutflow);
    const insolvent = newBudgetRemaining < 0;

    // 12. Stakeholder Sentiment updates
    const stakeholderReactions: RoundResult['stakeholderReactions'] = [];
    const updatedTrustMap: Record<string, number> = { ...team.stakeholderTrustMap };

    const spendRatio = changeOutflow / Math.max(1, metricsBefore.budgetRemaining);
    const financialDelta = insolvent ? -1 : Math.max(-1, Math.min(1, 0.8 - 1.6 * spendRatio));
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

      let extra = (eventTrustImpacts[stakeholder.id] || 0) + (initiativeTrust[stakeholder.id] || 0);
      const notes: string[] = [reactionNote];
      const reactionCodes: MessageCode[] = [
        {
          code: trustDelta >= 10 ? 'reaction.impressed' : trustDelta > 0 ? 'reaction.favorable' : trustDelta > -8 ? 'reaction.cautious' : 'reaction.critical',
          params: { name: stakeholder.name },
        },
      ];

      for (const pact of pacts.filter(p => p.stakeholderId === stakeholder.id)) {
        const bonus = Math.max(5, Math.min(15, Math.round(5 + pact.committedBudget / 20)));
        extra += bonus;
        notes.push(`Pact honored: "${pact.concession}" (+${bonus}).`);
        reactionCodes.push({ code: 'reaction.pact', params: { concession: pact.concession, bonus } });
      }
      if (insolvent) {
        const penalty = Math.round(3 + 12 * stakeholder.decisionWeights.financialAcumen);
        extra -= penalty;
        notes.push(`Cash reserves are negative (-${penalty}).`);
        reactionCodes.push({ code: 'reaction.insolvent', params: { penalty } });
      }
      if (regulatoryFine > 0) {
        const penalty = Math.round(10 * stakeholder.decisionWeights.regulatoryCompliance);
        extra -= penalty;
        if (penalty > 0) {
          notes.push(`Regulatory fine of $${regulatoryFine}K (-${penalty}).`);
          reactionCodes.push({ code: 'reaction.fine', params: { fine: regulatoryFine, penalty } });
        }
      }

      const finalTrust = Math.max(5, Math.min(100, newTrust + extra));
      updatedTrustMap[stakeholder.id] = finalTrust;
      aggregateTrustSum += finalTrust;

      stakeholderReactions.push({
        stakeholderId: stakeholder.id,
        name: stakeholder.name,
        trustDelta: finalTrust - currentTrust,
        comment: notes.join(' '),
        notes: reactionCodes,
      });
    }

    const newAvgTrust = Math.round(aggregateTrustSum / (scenario.stakeholders.length || 1));
    const modernizedCount = currentNodes.filter(n => n.status === 'MODERNIZED').length;

    const metricsAfter: TeamMetrics = {
      tco: newTco,
      budgetRemaining: newBudgetRemaining,
      opEx: currentOpEx,
      capExSpent: newCapExSpent,
      technicalDebtIndex: Math.max(5, Math.min(100, newTdi + eventTdi)),
      deliveryVelocity: Math.max(8, Math.min(100, effectiveVelocity + eventVelocity - incidentVelocityPenalty)),
      stakeholderTrust: newAvgTrust,
      resilienceIndex: newResilience,
      complianceScore: newCompliance,
      modernizedNodesCount: modernizedCount,
    };

    // Facilitator Feedback
    let facilitatorFeedback = `Round ${roundNumber} Completed. `;
    const notes: MessageCode[] = [];
    if (metricsAfter.technicalDebtIndex > 75) {
      facilitatorFeedback += `WARNING: Technical debt has reached critical levels (${metricsAfter.technicalDebtIndex}%). Feature delivery will stall unless refactoring is prioritized. `;
      notes.push({ code: 'note.debtCritical', params: { value: metricsAfter.technicalDebtIndex } });
    } else if (metricsAfter.technicalDebtIndex < 35) {
      facilitatorFeedback += `EXCELLENT: Architectural health is strong, unlocking high delivery agility. `;
      notes.push({ code: 'note.debtHealthy' });
    }
    if (mandate) {
      facilitatorFeedback += `Board resolution this quarter: ${mandate.verdict} (${mandate.consensusScore}% consensus)${boardVelocityBonus ? `, +${boardVelocityBonus} velocity` : ''}. `;
      notes.push({ code: 'note.board', params: { verdict: mandate.verdict, consensus: mandate.consensusScore, velocity: boardVelocityBonus } });
    }
    if (stillActive.length > 0) {
      facilitatorFeedback += `${stillActive.length} multi-quarter initiative(s) still in delivery. `;
      notes.push({ code: 'note.inDelivery', params: { count: stillActive.length } });
    }
    if (incidentsTriggered.length > 0) {
      facilitatorFeedback += `${incidentsTriggered.length} production incident(s) occurred costing $${incidentCostTotal}K. `;
      notes.push({ code: 'note.incidents', params: { count: incidentsTriggered.length, cost: incidentCostTotal } });
    }
    if (opExOverrun > 0) {
      facilitatorFeedback += `OpEx run-rate exceeds the funded run budget by $${opExOverrun}K, charged to the change budget. `;
      notes.push({ code: 'note.opexOverrun', params: { amount: opExOverrun } });
    } else if (opExOverrun < 0) {
      facilitatorFeedback += `OpEx savings of $${-opExOverrun}K returned to the change budget. `;
      notes.push({ code: 'note.opexSavings', params: { amount: -opExOverrun } });
    }
    if (regulatoryFine > 0) {
      facilitatorFeedback += `REGULATORY FINE: compliance at ${newCompliance}% triggered a $${regulatoryFine}K penalty. `;
      notes.push({ code: 'note.fine', params: { compliance: newCompliance, fine: regulatoryFine } });
    }
    if (insolvent) {
      facilitatorFeedback += `INSOLVENT: cash reserves are negative ($${metricsAfter.budgetRemaining}K). Trust collapses and the program fails if not restored by the final quarter. `;
      notes.push({ code: 'note.insolvent', params: { cash: metricsAfter.budgetRemaining } });
    } else if (metricsAfter.budgetRemaining < 200) {
      facilitatorFeedback += `CRITICAL: Cash reserves are nearly depleted ($${metricsAfter.budgetRemaining}K remaining). `;
      notes.push({ code: 'note.cashLow', params: { cash: metricsAfter.budgetRemaining } });
    }

    const updatedNodeOverrides: Record<string, { health: number; technicalDebt: number; status: NodeHealthStatus }> = {};
    for (const node of currentNodes) {
      updatedNodeOverrides[node.id] = { health: node.health, technicalDebt: node.technicalDebt, status: node.status };
    }

    const roundResult: RoundResult = {
      roundNumber,
      notes,
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
      economics: {
        runAllocation,
        opExOverrun,
        capExSpent: totalCapEx,
        eventCost: eventCapEx,
        pactCost,
        regulatoryFine,
      },
      incidentsTriggered,
      debtCompoundedAmount: driftAmount,
      activeInitiativesProgress: [
        ...completing.map(i => ({ initiativeId: i.id, name: i.name, completed: true, remainingRounds: 0 })),
        ...stillActive.map(a => ({
          initiativeId: a.initiativeId,
          name: initiativesMap.get(a.initiativeId)?.name ?? a.initiativeId,
          completed: false,
          remainingRounds: a.roundsRemaining,
        })),
      ],
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
      activeInitiatives: stillActive,
      completedInitiativeIds,
      honoredPacts: [...(team.honoredPacts ?? []), ...pacts],
      history: [...team.history, roundResult],
      nodeHealthOverrides: updatedNodeOverrides,
    };

    return { updatedTeam, roundResult };
  }
}
