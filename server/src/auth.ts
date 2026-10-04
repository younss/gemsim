// ============================================================================
// GEMSIM: FACILITATOR AUTHORIZATION
// Facilitator-only endpoints require the PIN in the `x-facilitator-pin` header.
// The PIN itself is never serialized to clients (see FACILITATOR_SECRET_KEYS).
// ============================================================================

import { RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import { DatabaseRepository } from './db/index.js';

export const FACILITATOR_PIN_HEADER = 'x-facilitator-pin';

/** Keys stripped from every JSON payload sent to clients (REST and WebSocket). */
export const FACILITATOR_SECRET_KEYS = new Set(['facilitatorPasscode']);

export function stripSecrets(key: string, value: unknown): unknown {
  return FACILITATOR_SECRET_KEYS.has(key) ? undefined : value;
}

/** Header a player client sends with its team id, so REST answers show it its own decisions. */
export const VIEWER_TEAM_HEADER = 'x-gemsim-team';

const HIDDEN_DECISIONS = { selectedInitiativeIds: [], governancePosture: 'BALANCED_AGILE', customPacts: [] };

/**
 * JSON replacer for a player's view: other teams' decisions for the open quarter
 * (initiatives, prices, marketing...) stay secret until the quarter is resolved.
 * The facilitator (valid PIN) gets the full view.
 */
export function viewerReplacer(viewerTeamId: string | undefined) {
  return function (this: unknown, key: string, value: unknown): unknown {
    if (FACILITATOR_SECRET_KEYS.has(key)) return undefined;
    if (key === 'currentRoundDecisions' && this && typeof this === 'object' && 'decisionSubmitted' in this) {
      return (this as { id?: string }).id === viewerTeamId ? value : HIDDEN_DECISIONS;
    }
    // Players only see whether a pilot questionnaire is open, never the answers
    if (key === 'pilot' && value && typeof value === 'object') {
      const { preOpen, postOpen } = value as { preOpen: boolean; postOpen: boolean };
      return { preOpen, postOpen, responses: [] };
    }
    return value;
  };
}

/** Express middleware: non-facilitator requests get the player view of every JSON answer. */
export const playerView: RequestHandler = (req, res, next) => {
  if (isValidFacilitatorPin(req.header(FACILITATOR_PIN_HEADER))) return next();
  const replacer = viewerReplacer(req.header(VIEWER_TEAM_HEADER) || undefined);
  const json = res.json.bind(res);
  res.json = (body: unknown) => json(JSON.parse(JSON.stringify(body, replacer)));
  next();
};

function expectedPin(): string {
  return (process.env.FACILITATOR_PIN || '1337').trim();
}

export function isValidFacilitatorPin(pin: unknown): boolean {
  if (typeof pin !== 'string') return false;
  const given = Buffer.from(pin.trim());
  const expected = Buffer.from(expectedPin());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const requireFacilitator: RequestHandler<any, any, any, any> = (req, res, next) => {
  if (isValidFacilitatorPin(req.header(FACILITATOR_PIN_HEADER))) return next();
  res.status(401).json({ error: 'Facilitator PIN required', code: 'FACILITATOR_PIN_REQUIRED' });
};

/** Solo sessions (one team) let the player resolve their own quarter. */
export const requireFacilitatorUnlessSolo: RequestHandler<any, any, any, any> = (req, res, next) => {
  const session = DatabaseRepository.getInstance().getSession(req.params.id);
  if (session && session.teams.length === 1) return next();
  return requireFacilitator(req, res, next);
};
