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
