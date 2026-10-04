// ============================================================================
// GEMSIM: WEBSOCKET REAL-TIME COMMUNICATIONS & TELEMETRY
// Live sync, timer loop, facilitator overrides, and chat broadcasting
// ============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { WSClientMessage, WSServerMessage } from '../types/index.js';
import { DatabaseRepository } from '../db/index.js';
import { checkDecisions } from '../engine/rules.js';
import { advanceRound } from '../services/round-service.js';
import { isValidFacilitatorPin, stripSecrets, viewerReplacer } from '../auth.js';

interface ClientConnection {
  ws: WebSocket;
  sessionId?: string;
  teamId?: string;
  role?: 'PLAYER' | 'FACILITATOR';
  fullView?: boolean; // facilitator with a valid PIN: sees every team's pending decisions
}

const connections = new Set<ClientConnection>();
let timerInterval: NodeJS.Timeout | null = null;

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const conn: ClientConnection = { ws };
    connections.add(conn);

    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as WSClientMessage;
        handleClientMessage(conn, msg);
      } catch (err) {
        console.error('[WebSocket] Message parse error:', err);
      }
    });

    ws.on('close', () => {
      connections.delete(conn);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Socket error:', err);
      connections.delete(conn);
    });
  });

  // Start global 1-second timer tick loop for running sessions
  startSessionTimerLoop();

  return wss;
}

function handleClientMessage(conn: ClientConnection, msg: WSClientMessage) {
  const db = DatabaseRepository.getInstance();

  switch (msg.type) {
    case 'JOIN_SESSION': {
      conn.sessionId = msg.sessionId;
      conn.teamId = msg.teamId;
      conn.role = msg.role;
      conn.fullView = isValidFacilitatorPin(msg.pin);

      const session = db.getSession(msg.sessionId);
      if (session) {
        sendToClient(conn.ws, {
          type: 'SESSION_STATE',
          session,
        });
      }
      break;
    }

    case 'SUBMIT_DECISIONS': {
      const session = db.getSession(msg.sessionId);
      if (session) {
        const team = session.teams.find(t => t.id === msg.teamId);
        const scenario = db.getScenario(session.scenarioId);
        if (team && scenario && !team.decisionSubmitted && session.state !== 'COMPLETED') {
          const decisions = { ...msg.decisions, customPacts: team.currentRoundDecisions?.customPacts ?? [] };
          const check = checkDecisions(scenario, team, decisions, session.currentRound, session.injectedEvents);
          if (!check.ok) {
            sendToClient(conn.ws, { type: 'ERROR', message: check.errors.join(' ') });
            break;
          }
          team.currentRoundDecisions = decisions;
          team.decisionSubmitted = true;
          session.updatedAt = new Date().toISOString();
          db.saveSession(session);

          broadcastToSession(msg.sessionId, {
            type: 'TEAM_UPDATED',
            team,
          });
        }
      }
      break;
    }

    case 'FACILITATOR_CONTROL': {
      const session = db.getSession(msg.sessionId);
      if (!session) return;
      const soloAdvance = msg.action === 'ADVANCE_ROUND' && session.teams.length === 1;
      if (!soloAdvance && !isValidFacilitatorPin(msg.pin)) {
        sendToClient(conn.ws, { type: 'ERROR', message: 'Facilitator PIN required' });
        return;
      }

      if ((msg.action === 'START' || msg.action === 'RESUME') && session.state !== 'COMPLETED') {
        session.isTimerRunning = true;
        session.state = 'ACTIVE';
      } else if (msg.action === 'PAUSE') {
        session.isTimerRunning = false;
        session.state = 'PAUSED';
      } else if (msg.action === 'ADVANCE_ROUND') {
        // Same path as REST /advance (BullMQ when available); it broadcasts ROUND_RESOLVED itself
        if (session.state !== 'COMPLETED') {
          advanceRound(session.id).catch(err => sendToClient(conn.ws, { type: 'ERROR', message: err.message }));
        }
        return;
      }

      session.updatedAt = new Date().toISOString();
      db.saveSession(session);

      broadcastToSession(session.id, {
        type: 'SESSION_STATE',
        session,
      });
      break;
    }

    case 'BROADCAST_ANNOUNCEMENT': {
      if (!isValidFacilitatorPin(msg.pin)) {
        sendToClient(conn.ws, { type: 'ERROR', message: 'Facilitator PIN required' });
        return;
      }
      broadcastToSession(msg.sessionId, {
        type: 'ANNOUNCEMENT',
        message: `📢 ${msg.message}`,
        code: { code: 'announce.broadcast', params: { message: msg.message } },
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }
}

export function broadcastToSession(sessionId: string, message: WSServerMessage) {
  const full = JSON.stringify(message, stripSecrets);
  const views = new Map<string, string>(); // one serialization per viewing team
  for (const conn of connections) {
    if (conn.sessionId !== sessionId || conn.ws.readyState !== WebSocket.OPEN) continue;
    if (conn.fullView) {
      conn.ws.send(full);
      continue;
    }
    const key = conn.teamId ?? '';
    if (!views.has(key)) views.set(key, JSON.stringify(message, viewerReplacer(conn.teamId)));
    conn.ws.send(views.get(key)!);
  }
}

function sendToClient(ws: WebSocket, message: WSServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const conn = [...connections].find(c => c.ws === ws);
  ws.send(JSON.stringify(message, conn?.fullView ? stripSecrets : viewerReplacer(conn?.teamId)));
}

function startSessionTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    try {
      const db = DatabaseRepository.getInstance();
      const sessions = db.getSessions().filter(s => s.isTimerRunning && s.state === 'ACTIVE');

      for (const session of sessions) {
        if (session.timerSecondsRemaining > 0) {
          session.timerSecondsRemaining -= 1;
          // Ticks stay local; PostgreSQL gets the countdown every 15 seconds
          db.saveSession(session, { mirror: session.timerSecondsRemaining % 15 === 0 });

          broadcastToSession(session.id, {
            type: 'TIMER_TICK',
            secondsRemaining: session.timerSecondsRemaining,
            isRunning: true,
          });
        } else {
          // Timer expired for this round! Automatically pause or advance
          session.isTimerRunning = false;
          session.state = 'PAUSED';
          session.updatedAt = new Date().toISOString();
          db.saveSession(session);

          broadcastToSession(session.id, {
            type: 'TIMER_TICK',
            secondsRemaining: 0,
            isRunning: false,
          });

          broadcastToSession(session.id, {
            type: 'ANNOUNCEMENT',
            message: `⏰ Round ${session.currentRound} timer expired. Facilitator may advance or review final submissions.`,
            code: { code: 'announce.timerExpired', params: { n: session.currentRound } },
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      // Background timer error suppression
    }
  }, 1000);
}
