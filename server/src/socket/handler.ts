// ============================================================================
// GEMSIM: WEBSOCKET REAL-TIME COMMUNICATIONS & TELEMETRY
// Live sync, timer loop, facilitator overrides, and chat broadcasting
// ============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { WSClientMessage, WSServerMessage } from '../types/index.js';
import { DatabaseRepository } from '../db/index.js';
import { SimulationResolver } from '../engine/resolver.js';

interface ClientConnection {
  ws: WebSocket;
  sessionId?: string;
  teamId?: string;
  role?: 'PLAYER' | 'FACILITATOR';
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
        if (team) {
          team.currentRoundDecisions = msg.decisions;
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

      if (msg.action === 'START' || msg.action === 'RESUME') {
        session.isTimerRunning = true;
        session.state = 'ACTIVE';
      } else if (msg.action === 'PAUSE') {
        session.isTimerRunning = false;
        session.state = 'PAUSED';
      } else if (msg.action === 'ADVANCE_ROUND') {
        const scenario = db.getScenario(session.scenarioId);
        if (scenario) {
          const roundResults: any = {};
          const updatedTeams = [];
          for (const team of session.teams) {
            const { updatedTeam, roundResult } = SimulationResolver.resolveRound(
              scenario,
              team,
              session.currentRound
            );
            updatedTeams.push(updatedTeam);
            roundResults[team.id] = roundResult;
          }

          session.teams = updatedTeams;
          if (session.currentRound >= session.totalRounds) {
            session.state = 'COMPLETED';
            session.isTimerRunning = false;
          } else {
            session.currentRound += 1;
            session.timerSecondsRemaining = session.roundDurationSeconds;
            session.state = 'ACTIVE';
          }

          session.updatedAt = new Date().toISOString();
          db.saveSession(session);

          broadcastToSession(session.id, {
            type: 'ROUND_RESOLVED',
            session,
            results: roundResults,
          });
          return;
        }
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
      broadcastToSession(msg.sessionId, {
        type: 'ANNOUNCEMENT',
        message: `📢 ${msg.message}`,
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }
}

export function broadcastToSession(sessionId: string, message: WSServerMessage) {
  const json = JSON.stringify(message);
  for (const conn of connections) {
    if (conn.sessionId === sessionId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(json);
    }
  }
}

function sendToClient(ws: WebSocket, message: WSServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
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
          db.saveSession(session);

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
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      // Background timer error suppression
    }
  }, 1000);
}
