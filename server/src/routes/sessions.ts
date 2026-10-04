// ============================================================================
// GEMSIM: SIMULATION SESSIONS REST API
// Multi-team state management, turn resolution, facilitator cockpit controls
// ============================================================================

import { Router } from 'express';
import { DatabaseRepository } from '../db/index.js';
import { checkDecisions } from '../engine/rules.js';
import { evaluateOutcome } from '../engine/outcome.js';
import { advanceRound } from '../services/round-service.js';
import {
  SimulationSession,
  Team,
  TeamDecision,
  RoundResult,
  RoundEvent,
  ArchivedSimulationRun,
} from '../types/index.js';
import { broadcastToSession } from '../socket/handler.js';
import { broadcastSchema, timerSchema, createSessionSchema, injectEventSchema, pactSchema, submitDecisionsSchema, validateBody, whatIfSchema } from '../validation.js';
import { whatIf } from '../engine/whatif.js';
import { isValidFacilitatorPin, playerView, requireFacilitator, requireFacilitatorUnlessSolo } from '../auth.js';

export const sessionsRouter = Router();

// GET /api/sessions
// Players never see other teams' pending decisions; the facilitator (PIN) sees everything
sessionsRouter.use(playerView);

sessionsRouter.get('/', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    res.json({ sessions: db.getSessions() });
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

// POST /api/sessions/:id/verify-facilitator
sessionsRouter.post('/:id/verify-facilitator', (req, res) => {
  try {
    const { pin } = req.body as { pin?: string };
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (isValidFacilitatorPin(pin)) {
      return res.json({ valid: true });
    }
    return res.status(401).json({ valid: false, error: 'Incorrect Facilitator PIN' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions
sessionsRouter.post('/', validateBody(createSessionSchema), (req, res) => {
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
        metrics: { ...scenario.baselineMetrics, modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length },
        stakeholderTrustMap: initialTrustMap,
        currentRoundDecisions: {
          selectedInitiativeIds: [],
          governancePosture: 'BALANCED_AGILE',
          customPacts: [],
        },
        decisionSubmitted: false,
        history: [],
        activeInitiatives: [],
        completedInitiativeIds: [],
        stakeholderPatience: Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, 100])),
        honoredPacts: [],
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
sessionsRouter.post('/:id/decisions', validateBody(submitDecisionsSchema), (req, res) => {
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
    if (session.state === 'COMPLETED') {
      return res.status(409).json({ error: 'Simulation already completed' });
    }
    if (team.decisionSubmitted) {
      return res.status(409).json({ error: 'Decisions already submitted for this quarter' });
    }

    const scenario = db.getScenario(session.scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    // Pacts are negotiated with stakeholders server-side; the client cannot forge them
    const finalDecisions: TeamDecision = {
      ...decisions,
      customPacts: team.currentRoundDecisions?.customPacts ?? [],
    };
    const check = checkDecisions(scenario, team, finalDecisions, session.currentRound, session.injectedEvents);
    if (!check.ok) {
      return res.status(422).json({ error: check.errors.join(' '), errors: check.errors, check });
    }

    team.currentRoundDecisions = finalDecisions;
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
        code: { code: 'announce.allSubmitted' },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true, team });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/advance (Resolves current round for all teams)
sessionsRouter.post('/:id/advance', requireFacilitatorUnlessSolo, async (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.state === 'COMPLETED') {
      return res.status(409).json({ error: 'Simulation already completed' });
    }

    const { session: updated, results } = await advanceRound(session.id);
    res.json({ session: updated, results });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/pacts (Records a concession accepted in negotiation as a binding pact)
sessionsRouter.post('/:id/pacts', validateBody(pactSchema), (req, res) => {
  try {
    const { teamId, stakeholderId, concession, committedBudget } = req.body as {
      teamId: string;
      stakeholderId: string;
      concession: string;
      committedBudget: number;
    };

    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const scenario = db.getScenario(session.scenarioId);
    const team = session.teams.find(t => t.id === teamId);
    if (!scenario || !team) {
      return res.status(404).json({ error: 'Team or scenario not found' });
    }
    if (!scenario.stakeholders.some(sh => sh.id === stakeholderId)) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }
    if (team.decisionSubmitted || session.state === 'COMPLETED') {
      return res.status(409).json({ error: 'Pacts can only be signed before the quarter decisions are submitted' });
    }

    const pacts = (team.currentRoundDecisions.customPacts ?? []).filter(p => p.stakeholderId !== stakeholderId);
    pacts.push({ stakeholderId, concession, committedBudget: Math.max(0, Math.round(committedBudget)) });
    const draft = { ...team.currentRoundDecisions, customPacts: pacts };

    // Pacts consume the same budget envelope as initiatives
    const check = checkDecisions(scenario, team, { ...draft, selectedInitiativeIds: [], eventChoiceId: undefined }, session.currentRound, session.injectedEvents);
    if (!check.ok) {
      return res.status(422).json({ error: check.errors.join(' '), errors: check.errors });
    }

    team.currentRoundDecisions = draft;
    session.updatedAt = new Date().toISOString();
    db.saveSession(session);
    broadcastToSession(session.id, { type: 'TEAM_UPDATED', team });
    res.json({ success: true, team });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id/pacts/:teamId/:stakeholderId (Withdraws a pact before submission)
sessionsRouter.delete('/:id/pacts/:teamId/:stakeholderId', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    const team = session?.teams.find(t => t.id === req.params.teamId);
    if (!session || !team) {
      return res.status(404).json({ error: 'Session or team not found' });
    }
    if (team.decisionSubmitted) {
      return res.status(409).json({ error: 'Decisions already submitted' });
    }
    team.currentRoundDecisions.customPacts = (team.currentRoundDecisions.customPacts ?? []).filter(
      p => p.stakeholderId !== req.params.stakeholderId
    );
    db.saveSession(session);
    broadcastToSession(session.id, { type: 'TEAM_UPDATED', team });
    res.json({ success: true, team });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/timer
sessionsRouter.post('/:id/timer', requireFacilitator, validateBody(timerSchema), (req, res) => {
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

    if (session.state === 'COMPLETED' && isRunning) {
      return res.status(409).json({ error: 'Simulation already completed' });
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
sessionsRouter.post('/:id/inject-event', requireFacilitator, validateBody(injectEventSchema), (req, res) => {
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

    // Ensure roundNumber matches currentRound
    const enrichedEvent: RoundEvent = {
      ...event,
      roundNumber: session.currentRound,
      immediateImpact: event.immediateImpact || { budgetFine: 0, tdiSurge: 0, velocityPenalty: 0 },
      impactAppliedAtInjection: true,
      choices: event.choices || [],
    };

    if (!session.injectedEvents) {
      session.injectedEvents = [];
    }
    // Replace any existing injected event for this round
    session.injectedEvents = session.injectedEvents.filter(e => e.roundNumber !== session.currentRound);
    session.injectedEvents.push(enrichedEvent);
    session.activeCrisis = enrichedEvent;

    // Apply immediate financial, tech debt, and node outage impacts across all teams
    const { budgetFine = 0, tdiSurge = 0, velocityPenalty = 0, downedNodeIds = [] } = enrichedEvent.immediateImpact;
    for (const team of session.teams) {
      team.metrics.budgetRemaining = team.metrics.budgetRemaining - budgetFine;
      // The crisis replaces this quarter's dilemma: a response to the old one no longer applies
      if (team.currentRoundDecisions?.eventChoiceId) {
        team.currentRoundDecisions.eventChoiceId = undefined;
        team.decisionSubmitted = false;
      }
      team.metrics.technicalDebtIndex = Math.min(100, team.metrics.technicalDebtIndex + tdiSurge);
      team.metrics.deliveryVelocity = Math.max(5, team.metrics.deliveryVelocity - Math.abs(velocityPenalty));

      if (downedNodeIds && downedNodeIds.length > 0) {
        if (!team.nodeHealthOverrides) {
          team.nodeHealthOverrides = {};
        }
        for (const nodeId of downedNodeIds) {
          team.nodeHealthOverrides[nodeId] = {
            health: 15,
            technicalDebt: 90,
            status: 'CRITICAL',
          };
        }
      }
    }

    session.updatedAt = new Date().toISOString();
    db.saveSession(session);

    // Broadcast crisis injection to all connected clients (players & facilitator)
    broadcastToSession(session.id, {
      type: 'CRISIS_INJECTED',
      sessionId: session.id,
      event: enrichedEvent,
      session,
    });

    broadcastToSession(session.id, {
      type: 'ANNOUNCEMENT',
      message: `🚨 BLACK SWAN CRISIS INJECTED: ${enrichedEvent.title} - ${enrichedEvent.description}`,
      code: { code: 'announce.crisis', params: { title: enrichedEvent.title } },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, event: enrichedEvent, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/broadcast
sessionsRouter.post('/:id/broadcast', requireFacilitator, validateBody(broadcastSchema), (req, res) => {
  try {
    const { message } = req.body as { message: string };
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    broadcastToSession(req.params.id, {
      type: 'ANNOUNCEMENT',
      message: `📢 FACILITATOR BROADCAST: ${message}`,
      code: { code: 'announce.broadcast', params: { message } },
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/runs
// POST /api/sessions/:id/whatif — replay a team's game, optionally with one quarter decided differently
sessionsRouter.post('/:id/whatif', validateBody(whatIfSchema), (req, res) => {
  try {
    const { teamId, round, decision } = req.body as { teamId: string; round?: number; decision?: TeamDecision };
    const db = DatabaseRepository.getInstance();
    const session = db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const scenario = db.getScenario(session.scenarioId);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    const override = round && decision ? { round, decision: { ...decision, customPacts: [] } } : undefined;
    res.json(whatIf(scenario, session, teamId, override));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sessionsRouter.get('/:id/runs', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const runs = db.getSimulationRuns(req.params.id);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/reset
sessionsRouter.post('/:id/reset', requireFacilitator, (req, res) => {
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

    // 1. Check if the session has played rounds and archive simulation run
    let archivedRun: ArchivedSimulationRun | null = null;
    const hasPlayedRounds = session.currentRound > 1 || session.teams.some(t => t.history.length > 0);

    if (hasPlayedRounds) {
      const existingRuns = db.getSimulationRuns(session.id);
      const runNumber = existingRuns.length + 1;

      // Sort teams to determine winner and rankings
      const outcomes = new Map(session.teams.map(t => [t.id, t.outcome ?? evaluateOutcome(scenario, t.metrics, session.teams.length)]));
      const sortedTeams = [...session.teams].sort((a, b) => outcomes.get(b.id)!.score - outcomes.get(a.id)!.score);

      archivedRun = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: session.id,
        scenarioId: scenario.id,
        sessionName: session.name,
        scenarioTitle: scenario.title,
        runNumber,
        completedAt: new Date().toISOString(),
        totalRounds: session.currentRound,
        winnerTeamName: sortedTeams[0]?.name,
        teams: session.teams.map(t => ({
          id: t.id,
          name: t.name,
          avatar: t.avatar,
          finalMetrics: { ...t.metrics },
          history: [...t.history],
        })),
        executiveDebriefSummary: {
          rankings: sortedTeams.map((t, idx) => ({
            rank: idx + 1,
            teamName: t.name,
            technicalDebtIndex: `${t.metrics.technicalDebtIndex}%`,
            deliveryVelocity: `${t.metrics.deliveryVelocity} pts`,
            stakeholderTrust: `${t.metrics.stakeholderTrust}%`,
            budgetRemaining: `$${t.metrics.budgetRemaining}K`,
            tco: `$${t.metrics.tco}K`,
            resilienceIndex: `${t.metrics.resilienceIndex}/100`,
            complianceScore: `${t.metrics.complianceScore}%`,
            grade: outcomes.get(t.id)!.grade,
            verdict: outcomes.get(t.id)!.verdict,
            score: outcomes.get(t.id)!.score,
          })),
        },
        chatTranscriptCount: db.getChatMessageCountForSession(session.id),
      };

      db.saveSimulationRun(archivedRun);
      console.log(`[SessionReset] Archived simulation run ${archivedRun.id} (Run #${runNumber}) before reset`);
    }

    // 2. Clear active AI stakeholder chat messages for this session
    db.deleteChatMessagesForSession(session.id);

    // 3. Reset session state, timers, and round back to Q1
    session.currentRound = 1;
    session.state = 'WAITING';
    session.isTimerRunning = false;
    session.timerSecondsRemaining = session.roundDurationSeconds;
    session.injectedEvents = [];
    session.activeCrisis = null;

    // 4. Reset each team's score, metrics, decisions, and stakeholder trust back to scenario baseline
    for (const team of session.teams) {
      team.metrics = { ...scenario.baselineMetrics, modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length };
      team.history = [];
      team.decisionSubmitted = false;
      team.activeInitiatives = [];
      team.completedInitiativeIds = [];
      team.stakeholderPatience = Object.fromEntries(scenario.stakeholders.map(sh => [sh.id, 100]));
      team.honoredPacts = [];
      team.outcome = undefined;
      team.boardMandate = undefined;
      team.nodeHealthOverrides = {};
      team.marketPresence = undefined;
      team.promises = [];
      team.lastMarketDecision = undefined;
      team.currentRoundDecisions = {
        selectedInitiativeIds: [],
        governancePosture: 'BALANCED_AGILE',
        customPacts: [],
      };
      const trustMap: Record<string, number> = {};
      for (const sh of scenario.stakeholders) {
        trustMap[sh.id] = sh.baseTrust ?? 60;
      }
      team.stakeholderTrustMap = trustMap;
    }

    session.updatedAt = new Date().toISOString();
    db.saveSession(session);

    // 5. Broadcast reset event & updated session state via WebSockets
    broadcastToSession(session.id, {
      type: 'SESSION_RESET',
      sessionId: session.id,
      session,
      archivedRun: archivedRun || undefined,
    });

    broadcastToSession(session.id, {
      type: 'SESSION_STATE',
      session,
    });

    res.json({ session, archivedRun });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
sessionsRouter.delete('/:id', requireFacilitator, (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const deleted = db.deleteSession(req.params.id);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
