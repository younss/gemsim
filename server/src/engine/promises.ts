// ============================================================================
// GEMSIM: PROMISE MEMORY
// When an executive (or the board) accepts a proposal that names initiatives,
// the team has made a promise. The resolver checks it at the end of the quarter:
// kept promises build trust, broken ones cost it, and executives remember both.
// ============================================================================

import type { Scenario, Team, TeamPromise } from '../types/index.js';

const STOPWORDS = new Set([
  'avec', 'dans', 'pour', 'des', 'les', 'une', 'sans', 'plus', 'entre', 'sur', 'par', 'aux', 'nos', 'vos', 'son', 'ses', 'leur',
  'est', 'qui', 'que', 'pas', 'tout', 'tous', 'their', 'with', 'from', 'into', 'and', 'the', 'for', 'our', 'your', 'all', 'new',
]);

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Initiatives a message commits to: the initiative id, its full name, or enough of
 * the significant words of its name (half of them, at least two unless the name has one).
 */
export function detectPromisedInitiatives(scenario: Scenario, message: string): string[] {
  const text = ` ${normalize(message)} `;
  return scenario.initiativesCatalog
    .filter(init => {
      if (text.includes(` ${normalize(init.id)} `) || text.includes(` ${normalize(init.name)} `)) return true;
      const words = [...new Set(normalize(init.name).split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w)))];
      if (words.length === 0) return false;
      const hits = words.filter(w => text.includes(` ${w}`)).length;
      return hits >= Math.min(words.length, Math.max(2, Math.ceil(words.length / 2)));
    })
    .map(init => init.id);
}

/**
 * Records a promise when an accepted proposal names initiatives. Returns it, or
 * undefined when the message commits to nothing measurable.
 */
export function recordPromise(
  scenario: Scenario,
  team: Team,
  stakeholderId: string,
  message: string,
  round: number,
  verdict: string
): TeamPromise | undefined {
  if (verdict !== 'ACCEPTED' && verdict !== 'CONDITIONAL_ACCEPTANCE' && verdict !== 'APPROVED' && verdict !== 'CONDITIONAL_QUORUM') {
    return undefined;
  }
  const initiativeIds = detectPromisedInitiatives(scenario, message);
  if (initiativeIds.length === 0) return undefined;
  const promises = team.promises ?? [];
  // One open promise per executive and quarter: the latest accepted proposal replaces the previous one
  const others = promises.filter(p => !(p.status === 'PENDING' && p.round === round && p.stakeholderId === stakeholderId));
  const promise: TeamPromise = {
    id: `prm-${round}-${stakeholderId}-${Date.now().toString(36)}`,
    stakeholderId,
    round,
    initiativeIds,
    excerpt: message.trim().slice(0, 160),
    status: 'PENDING',
  };
  team.promises = [...others, promise];
  return promise;
}

/** Lines for the executives' prompts: what this team promised them and whether it delivered. */
export function describePromises(scenario: Scenario, team: Team, stakeholderId?: string): string[] {
  const name = (id: string) => scenario.initiativesCatalog.find(i => i.id === id)?.name ?? id;
  return (team.promises ?? [])
    .filter(p => !stakeholderId || p.stakeholderId === stakeholderId || p.stakeholderId === 'BOARD')
    .map(p => {
      const what = p.initiativeIds.map(name).join(', ');
      const to = p.stakeholderId === 'BOARD' ? 'the board' : 'you';
      if (p.status === 'KEPT') return `Q${p.round}: the team promised ${to} "${what}" and DELIVERED it.`;
      if (p.status === 'BROKEN') return `Q${p.round}: the team promised ${to} "${what}" and BROKE that promise.`;
      return `Q${p.round}: the team has promised ${to} "${what}" this quarter (not yet due).`;
    });
}
