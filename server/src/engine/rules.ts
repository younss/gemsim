// ============================================================================
// GEMSIM: QUARTER DECISION RULES
// Budget envelope, delivery capacity and one-time initiatives. Pure function
// with type-only imports so the client can show the same constraints live.
// ============================================================================

import type { RoundEvent, Scenario, Team, TeamDecision } from '../types/index.js';

export const DEFAULT_MAX_INITIATIVES_PER_ROUND = 2;

export interface DecisionCheck {
  ok: boolean;
  errors: string[];
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
  team: Pick<Team, 'metrics' | 'completedInitiativeIds' | 'activeInitiatives'>,
  decisions: TeamDecision,
  roundNumber: number,
  injectedEvents?: RoundEvent[]
): DecisionCheck {
  const errors: string[] = [];
  const capacity = scenario.maxInitiativesPerRound ?? DEFAULT_MAX_INITIATIVES_PER_ROUND;
  const locked = lockedInitiativeIds(team);
  const catalog = new Map(scenario.initiativesCatalog.map(i => [i.id, i]));

  let committedCost = 0;
  const seen = new Set<string>();
  for (const id of decisions.selectedInitiativeIds) {
    const init = catalog.get(id);
    if (!init) {
      errors.push(`Unknown initiative '${id}'.`);
      continue;
    }
    if (seen.has(id)) errors.push(`"${init.name}" is selected twice.`);
    seen.add(id);
    if (locked.has(id)) errors.push(`"${init.name}" is already completed or in progress.`);
    if (init.unlockedRound && init.unlockedRound > roundNumber) errors.push(`"${init.name}" unlocks in Q${init.unlockedRound}.`);
    committedCost += init.capExCost;
  }

  if (seen.size > capacity) {
    errors.push(`Delivery capacity exceeded: ${seen.size} initiatives selected, maximum ${capacity} per quarter.`);
  }

  if (decisions.eventChoiceId) {
    const event = getRoundEvent(scenario, roundNumber, injectedEvents);
    const choice = event?.choices.find(c => c.id === decisions.eventChoiceId);
    if (!choice) errors.push('The selected crisis response does not belong to this quarter.');
    else committedCost += Math.max(0, choice.capExImpact);
  }

  for (const pact of decisions.customPacts ?? []) {
    committedCost += Math.max(0, pact.committedBudget);
  }

  const budgetAvailable = team.metrics.budgetRemaining;
  if (committedCost > 0 && committedCost > budgetAvailable) {
    errors.push(`Budget exceeded: $${committedCost}K committed for $${Math.max(0, budgetAvailable)}K available.`);
  }

  return { ok: errors.length === 0, errors, committedCost, budgetAvailable, capacity };
}
