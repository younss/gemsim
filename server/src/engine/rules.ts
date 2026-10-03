// ============================================================================
// GEMSIM: QUARTER DECISION RULES
// Budget envelope, delivery capacity and one-time initiatives. Pure function
// with type-only imports so the client can show the same constraints live.
// ============================================================================

import type { BoardMandate, MessageCode, RiskLevel, RoundEvent, Scenario, Team, TeamDecision } from '../types/index.js';

export const DEFAULT_MAX_INITIATIVES_PER_ROUND = 2;

/** What the board's latest resolution changes for its quarter. */
export const BOARD_MANDATE_EFFECTS: Record<BoardMandate['verdict'], { capacityDelta: number; blockedRisk: RiskLevel[]; velocityBonus: number }> = {
  APPROVED: { capacityDelta: 1, blockedRisk: [], velocityBonus: 5 },
  CONDITIONAL_QUORUM: { capacityDelta: 0, blockedRisk: ['EXTREME'], velocityBonus: 0 },
  REJECTED: { capacityDelta: -1, blockedRisk: ['HIGH', 'EXTREME'], velocityBonus: 0 },
};

export function activeBoardMandate(team: Pick<Team, 'boardMandate'>, roundNumber: number): BoardMandate | undefined {
  return team.boardMandate?.round === roundNumber ? team.boardMandate : undefined;
}

export function describeBoardMandate(verdict: BoardMandate['verdict'], isFrench: boolean): string {
  const e = BOARD_MANDATE_EFFECTS[verdict];
  const parts: string[] = [];
  if (e.capacityDelta > 0) parts.push(isFrench ? `+${e.capacityDelta} initiative autorisée ce trimestre` : `+${e.capacityDelta} initiative allowed this quarter`);
  if (e.capacityDelta < 0) parts.push(isFrench ? `${e.capacityDelta} initiative autorisée ce trimestre` : `${e.capacityDelta} initiative allowed this quarter`);
  if (e.velocityBonus) parts.push(isFrench ? `+${e.velocityBonus} de vélocité à la résolution` : `+${e.velocityBonus} velocity at resolution`);
  if (e.blockedRisk.length) parts.push(isFrench ? `initiatives à risque ${e.blockedRisk.join('/')} interdites` : `${e.blockedRisk.join('/')}-risk initiatives blocked`);
  return parts.join(' · ');
}

export interface DecisionCheck {
  ok: boolean;
  errors: string[];
  issues: MessageCode[]; // same problems as `errors`, as translatable codes
  committedCost: number; // CapEx + crisis response + pacts ($K)
  budgetAvailable: number;
  capacity: number;
}

export function getRoundEvent(scenario: Scenario, roundNumber: number, injectedEvents?: RoundEvent[]): RoundEvent | undefined {
  return injectedEvents?.find(e => e.roundNumber === roundNumber) || scenario.roundEvents.find(e => e.roundNumber === roundNumber);
}

/** Initiative ids the team can no longer start (completed or still in progress). */
export function lockedInitiativeIds(team: Pick<Team, 'completedInitiativeIds' | 'activeInitiatives'>): Set<string> {
  return new Set([...(team.completedInitiativeIds ?? []), ...(team.activeInitiatives ?? []).map(a => a.initiativeId)]);
}

export function checkDecisions(
  scenario: Scenario,
  team: Pick<Team, 'metrics' | 'completedInitiativeIds' | 'activeInitiatives' | 'boardMandate'>,
  decisions: TeamDecision,
  roundNumber: number,
  injectedEvents?: RoundEvent[]
): DecisionCheck {
  const errors: string[] = [];
  const issues: MessageCode[] = [];
  const fail = (message: string, code: string, params?: MessageCode['params']) => {
    errors.push(message);
    issues.push({ code, params });
  };
  const mandate = activeBoardMandate(team, roundNumber);
  const effects = mandate ? BOARD_MANDATE_EFFECTS[mandate.verdict] : undefined;
  const capacity = Math.max(1, (scenario.maxInitiativesPerRound ?? DEFAULT_MAX_INITIATIVES_PER_ROUND) + (effects?.capacityDelta ?? 0));
  const locked = lockedInitiativeIds(team);
  const catalog = new Map(scenario.initiativesCatalog.map(i => [i.id, i]));

  let committedCost = 0;
  const seen = new Set<string>();
  for (const id of decisions.selectedInitiativeIds) {
    const init = catalog.get(id);
    if (!init) {
      fail(`Unknown initiative '${id}'.`, 'rules.unknownInitiative', { id });
      continue;
    }
    if (seen.has(id)) fail(`"${init.name}" is selected twice.`, 'rules.duplicate', { name: init.name });
    seen.add(id);
    if (locked.has(id)) fail(`"${init.name}" is already completed or in progress.`, 'rules.locked', { name: init.name });
    if (init.unlockedRound && init.unlockedRound > roundNumber) {
      fail(`"${init.name}" unlocks in Q${init.unlockedRound}.`, 'rules.notUnlocked', { name: init.name, round: init.unlockedRound });
    }
    if (effects?.blockedRisk.includes(init.riskLevel)) {
      fail(
        `"${init.name}" (${init.riskLevel} risk) is blocked by the board's ${mandate!.verdict.replace('_', ' ').toLowerCase()} resolution this quarter.`,
        'rules.boardBlocked',
        { name: init.name, risk: init.riskLevel, verdict: mandate!.verdict }
      );
    }
    committedCost += init.capExCost;
  }

  if (seen.size > capacity) {
    fail(`Delivery capacity exceeded: ${seen.size} initiatives selected, maximum ${capacity} per quarter.`, 'rules.capacity', { count: seen.size, capacity });
  }

  if (decisions.eventChoiceId) {
    const event = getRoundEvent(scenario, roundNumber, injectedEvents);
    const choice = event?.choices.find(c => c.id === decisions.eventChoiceId);
    if (!choice) fail('The selected crisis response does not belong to this quarter.', 'rules.eventChoice');
    else committedCost += Math.max(0, choice.capExImpact);
  }

  for (const pact of decisions.customPacts ?? []) {
    committedCost += Math.max(0, pact.committedBudget);
  }

  const budgetAvailable = team.metrics.budgetRemaining;
  if (committedCost > 0 && committedCost > budgetAvailable) {
    fail(`Budget exceeded: $${committedCost}K committed for $${Math.max(0, budgetAvailable)}K available.`, 'rules.budget', {
      cost: committedCost,
      cash: Math.max(0, budgetAvailable),
    });
  }

  return { ok: errors.length === 0, errors, issues, committedCost, budgetAvailable, capacity };
}
