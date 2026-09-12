// ============================================================================
// GEMSIM: SIMULATION SESSIONS REST API
// Multi-team state management, turn resolution, facilitator cockpit controls
// ============================================================================

import { Router } from 'express';
import { DatabaseRepository } from '../db/index.js';
import { SimulationResolver } from '../engine/resolver.js';
import {
  SimulationSession,
  Team,
  TeamDecision,
  RoundResult,
  RoundEvent,
} from '../types/index.js';
import { broadcastToSession } from '../socket/handler.js';

export const sessionsRouter = Router();

// GET /api/sessions
sessionsRouter.get('/', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const sessions = db.getSessions();
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
sessionsRouter.get('/:id', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const scenario = db.getScenario(session.scenarioId);
    res.json({ session, scenario });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions
sessionsRouter.post('/', (req, res) => {
  try {
    const { name, scenarioId, teamNames, roundDurationSeconds } = req.body as {
      name: string;
      scenarioId: string;
      teamNames?: string[];
      roundDurationSeconds?: number;
    };

    const db = DatabaseRepository.getInstance();
    const scenario = db.getScenario(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const assignedTeamNames = teamNames && teamNames.length > 0
      ? teamNames
      : ['Alpha Enterprise', 'Beta Solutions', 'Gamma Systems'];

    const colors = ['#00f0ff', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const avatars = ['⚡', '🛡️', '🚀', '🔮', '💎'];

    const teams: Team[] = assignedTeamNames.map((tName, idx) => {
      const initialTrustMap: Record<string, number> = {};
      for (const sh of scenario.stakeholders) {
        initialTrustMap[sh.id] = sh.baseTrust ?? 60;
      }

      return {
        id: `team-${sessionId}-${idx + 1}`,
        sessionId,
        name: tName,
        color: colors[idx % colors.length],
        avatar: avatars[idx % avatars.length],
        metrics: { ...scenario.baselineMetrics },
        stakeholderTrustMap: initialTrustMap,
        currentRoundDecisions: {
          selectedInitiativeIds: [],
          governancePosture: 'BALANCED_AGILE',
          customPacts: [],
        },
        decisionSubmitted: false,
        history: [],
        activeInitiatives: [],
        nodeHealthOverrides: {},
      };
    });

    const session: SimulationSession = {
      id: sessionId,
      name: name || `${scenario.title} Run`,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      state: 'WAITING',
      currentRound: 1,
      totalRounds: scenario.totalRounds || 4,
      timerSecondsRemaining: roundDurationSeconds || 300,
      roundDurationSeconds: roundDurationSeconds || 300,
      isTimerRunning: false,
      teams,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveSession(session);
    res.status(201).json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/decisions
sessionsRouter.post('/:id/decisions', (req, res) => {
  try {
    const { teamId, decisions } = req.body as {
      teamId: string;
      decisions: TeamDecision;
    };

    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const team = session.teams.find(t => t.id === teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found in session' });
    }

    team.currentRoundDecisions = decisions;
    team.decisionSubmitted = true;
    session.updatedAt = new Date().toISOString();

    db.saveSession(session);

    broadcastToSession(session.id, {
      type: 'TEAM_UPDATED',
      team,
    });

    // Check if all teams submitted, facilitator gets notified
    const allSubmitted = session.teams.every(t => t.decisionSubmitted);
    if (allSubmitted) {
      broadcastToSession(session.id, {
        type: 'ANNOUNCEMENT',
        message: 'All teams have submitted decisions for this round! Ready for resolution.',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true, team });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/advance (Resolves current round for all teams)
sessionsRouter.post('/:id/advance', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const scenario = db.getScenario(session.scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Associated scenario missing' });
    }

    const roundResults: Record<string, RoundResult> = {};
    const updatedTeams: Team[] = [];

    // Resolve round for each team
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

    // Check if simulation completed or advances
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

    // Notify all players and facilitator via WebSockets
    broadcastToSession(session.id, {
      type: 'ROUND_RESOLVED',
      session,
      results: roundResults,
    });

    res.json({ session, results: roundResults });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/timer
sessionsRouter.post('/:id/timer', (req, res) => {
  try {
    const { isRunning, secondsRemaining } = req.body as {
      isRunning?: boolean;
      secondsRemaining?: number;
    };

    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (isRunning !== undefined) {
      session.isTimerRunning = isRunning;
      if (isRunning && session.state === 'WAITING') {
        session.state = 'ACTIVE';
      } else if (!isRunning && session.state === 'ACTIVE') {
        session.state = 'PAUSED';
      } else if (isRunning && session.state === 'PAUSED') {
        session.state = 'ACTIVE';
      }
    }

    if (secondsRemaining !== undefined) {
      session.timerSecondsRemaining = secondsRemaining;
    }

    session.updatedAt = new Date().toISOString();
    db.saveSession(session);

    broadcastToSession(session.id, {
      type: 'TIMER_TICK',
      secondsRemaining: session.timerSecondsRemaining,
      isRunning: session.isTimerRunning,
    });

    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/inject-event (Facilitator Crisis Injection)
sessionsRouter.post('/:id/inject-event', (req, res) => {
  try {
    const { event } = req.body as { event: RoundEvent };
    if (!event || !event.title) {
      return res.status(400).json({ error: 'Invalid event data' });
    }

    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    broadcastToSession(session.id, {
      type: 'ANNOUNCEMENT',
      message: `🚨 FACILITATOR INJECTION: ${event.title} - ${event.description}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/broadcast
sessionsRouter.post('/:id/broadcast', (req, res) => {
  try {
    const { message } = req.body as { message: string };
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    broadcastToSession(req.params.id, {
      type: 'ANNOUNCEMENT',
      message: `📢 FACILITATOR BROADCAST: ${message}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/reset
sessionsRouter.post('/:id/reset', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const scenario = db.getScenario(session.scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    session.currentRound = 1;
    session.state = 'WAITING';
    session.isTimerRunning = false;
    session.timerSecondsRemaining = session.roundDurationSeconds;

    for (const team of session.teams) {
      team.metrics = { ...scenario.baselineMetrics };
      team.history = [];
      team.decisionSubmitted = false;
      team.activeInitiatives = [];
      team.nodeHealthOverrides = {};
      const trustMap: Record<string, number> = {};
      for (const sh of scenario.stakeholders) {
        trustMap[sh.id] = sh.baseTrust ?? 60;
      }
      team.stakeholderTrustMap = trustMap;
    }

    session.updatedAt = new Date().toISOString();
    db.saveSession(session);

    broadcastToSession(session.id, {
      type: 'SESSION_STATE',
      session,
    });

    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
sessionsRouter.delete('/:id', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const deleted = db.deleteSession(req.params.id);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
