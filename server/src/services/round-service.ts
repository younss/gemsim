// ============================================================================
// GEMSIM: ROUND ADVANCEMENT SERVICE
// Loads, resolves, persists and broadcasts a quarter. Registered as the BullMQ
// simulation handler, so REST and WebSocket triggers share one code path.
// ============================================================================

import { DatabaseRepository } from '../db/index.js';
import { advanceSession } from '../engine/session-service.js';
import { QueueManager, SimulationJobData } from '../queue/index.js';
import { broadcastToSession } from '../socket/handler.js';
import { RoundResult, SimulationSession } from '../types/index.js';

export interface AdvanceResult {
  session: SimulationSession;
  results: Record<string, RoundResult>;
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function performAdvance(sessionId: string): AdvanceResult {
  const db = DatabaseRepository.getInstance();
  const session = db.getSession(sessionId);
  if (!session) throw new HttpError(404, 'Session not found');
  const scenario = db.getScenario(session.scenarioId);
  if (!scenario) throw new HttpError(404, 'Associated scenario missing');
  if (session.state === 'COMPLETED') throw new HttpError(409, 'Simulation already completed');

  const advanced = advanceSession(session, scenario);
  db.saveSession(advanced.session);

  broadcastToSession(sessionId, {
    type: 'ROUND_RESOLVED',
    session: advanced.session,
    results: advanced.results,
  });
  return advanced;
}

export function registerRoundHandler() {
  QueueManager.getInstance().registerSimulationHandler(async (data: SimulationJobData) => {
    if (data.action === 'ADVANCE_ROUND') return performAdvance(data.sessionId);
    throw new Error(`Unsupported simulation action '${data.action}'`);
  });
}

/** Resolves the session's current quarter (via BullMQ when Redis is available). */
export function advanceRound(sessionId: string): Promise<AdvanceResult> {
  return QueueManager.getInstance().runSimulationJob<AdvanceResult>({ sessionId, action: 'ADVANCE_ROUND' });
}
