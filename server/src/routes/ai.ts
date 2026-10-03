// ============================================================================
// GEMSIM: AI SETTINGS & STAKEHOLDER NEGOTIATION REST API
// Runtime provider switching, connection testing, and live persona evaluation
// ============================================================================

import { Router } from 'express';
import { AIRegistry } from '../ai/registry.js';
import { DatabaseRepository } from '../db/index.js';
import { AIProviderType, ChatMessage, ProposalEvaluation, BoardResolution, Scenario, SimulationSession, StakeholderPersona, Team } from '../types/index.js';
import { broadcastToSession } from '../socket/handler.js';
import { judgeProposal, judgeBoard, mergeDecision } from '../ai/stakeholder-judge.js';
import { SystemOneClient } from '../ai/systemone.js';
import { boardroomSchema, negotiateSchema, validateBody } from '../validation.js';

// Patience spent per exchange (negative = recovered). At 0 the stakeholder closes the door until next quarter.
const PATIENCE_COST = { LOW_EFFORT: 30, REPETITION: 35, REJECTED: 20, CONDITIONAL_ACCEPTANCE: 8, ACCEPTED: -5 } as const;
const CLOSED_DOOR_TRUST_PENALTY = -2;

export function getPatience(team: Team, stakeholderId: string): number {
  return team.stakeholderPatience?.[stakeholderId] ?? 100;
}

function spendPatience(team: Team, stakeholderId: string, cost: number): number {
  const value = Math.max(0, Math.min(100, getPatience(team, stakeholderId) - cost));
  team.stakeholderPatience = { ...(team.stakeholderPatience ?? {}), [stakeholderId]: value };
  return value;
}

function closedDoorReply(name: string, isFrench: boolean): string {
  return isFrench
    ? `${name} a épuisé sa patience pour ce trimestre et refuse de poursuivre la discussion. Revenez au prochain trimestre avec des engagements concrets.`
    : `${name} has run out of patience for this quarter and refuses to continue. Come back next quarter with concrete commitments.`;
}

const VERDICT_STANCE: Record<ProposalEvaluation['verdict'], number> = { ACCEPTED: 1, CONDITIONAL_ACCEPTANCE: 0, REJECTED: -1 };

/**
 * Picks the supporter and the opponent whose stances diverge most and lets the
 * opponent challenge the supporter's statement in character.
 */
export async function runBoardDebate(
  stakeholders: StakeholderPersona[],
  replies: ChatMessage[],
  breakdown: Record<string, { stakeholderName: string; verdict: ProposalEvaluation['verdict']; trustDelta: number }>,
  playerMessage: string,
  isFrench: boolean
): Promise<ChatMessage | null> {
  const ranked = stakeholders
    .filter(sh => breakdown[sh.id])
    .map(sh => ({ sh, stance: VERDICT_STANCE[breakdown[sh.id].verdict] * 100 + breakdown[sh.id].trustDelta }))
    .sort((a, b) => b.stance - a.stance);
  if (ranked.length < 2) return null;
  const supporter = ranked[0];
  const opponent = ranked[ranked.length - 1];
  if (breakdown[supporter.sh.id].verdict === breakdown[opponent.sh.id].verdict) return null;

  const supporterLine = replies.find(r => r.senderName.startsWith(supporter.sh.name))?.content ?? '';
  const systemPrompt = `You are ${opponent.sh.name}, ${opponent.sh.title}, in a board meeting. Personality: ${opponent.sh.personality}. Bias: ${opponent.sh.bias}. Hidden agenda: ${opponent.sh.hiddenAgenda}.
Your colleague ${supporter.sh.name} (${supporter.sh.title}) just supported the player's proposal. You voted against it.
Reply directly to ${supporter.sh.name.split(' ')[0]} in 2 or 3 sharp sentences, naming the risk they overlook from your own mandate. No preamble, no stage directions.
${isFrench ? 'Answer in elegant professional French.' : 'Answer in English.'}`;

  let content: string;
  try {
    const { result, usedProvider } = await AIRegistry.getInstance().executeWithFallback(provider =>
      provider.generateText(
        [{ role: 'user', content: `Player proposal: "${playerMessage}"\n${supporter.sh.name} said: "${supporterLine}"` }],
        { systemPrompt, temperature: 0.7, responseFormat: 'text' }
      )
    );
    if (usedProvider === 'fallback' || !result.trim()) throw new Error('no LLM available');
    content = result.trim();
  } catch {
    content = isFrench
      ? `${supporter.sh.name.split(' ')[0]}, je ne partage pas votre optimisme. ${opponent.sh.sampleDialogue.resistance}`
      : `${supporter.sh.name.split(' ')[0]}, I don't share your optimism. ${opponent.sh.sampleDialogue.resistance}`;
  }

  return {
    id: `msg-${Date.now()}-debate`,
    sender: 'STAKEHOLDER',
    stakeholderId: 'BOARDROOM',
    senderName: `${opponent.sh.name} → ${supporter.sh.name}`,
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Describes the team's submitted quarter decisions and last round outcome so
 * stakeholders can judge actual actions, not only the chat message.
 */
export function describeTeamDecisions(scenario: Scenario, session: SimulationSession, team: Team): string[] {
  const lines: string[] = [];
  const d = team.currentRoundDecisions;
  if (d) {
    for (const id of d.selectedInitiativeIds) {
      const init = scenario.initiativesCatalog.find(i => i.id === id);
      if (init) {
        lines.push(`Initiative "${init.name}" (${init.category}, CapEx $${init.capExCost}K, OpEx ${init.opExDelta >= 0 ? '+' : ''}${init.opExDelta}K, tech debt ${init.tdiDelta >= 0 ? '+' : ''}${init.tdiDelta}, velocity ${init.velocityDelta >= 0 ? '+' : ''}${init.velocityDelta}, risk ${init.riskLevel})`);
      }
    }
    lines.push(`Governance posture: ${d.governancePosture}`);
    if (d.eventChoiceId) {
      const events = [...(session.injectedEvents ?? []), ...scenario.roundEvents];
      const choice = events.flatMap(e => e.choices).find(c => c.id === d.eventChoiceId);
      if (choice) lines.push(`Crisis response chosen: "${choice.text}"`);
    }
    for (const pact of d.customPacts) {
      lines.push(`Pact with ${pact.stakeholderId}: ${pact.concession} ($${pact.committedBudget}K)`);
    }
    lines.push(team.decisionSubmitted ? 'These decisions are submitted for this quarter.' : 'These decisions are a draft, not yet submitted.');
  }
  const last = team.history[team.history.length - 1];
  if (last) {
    const md = last.metricDeltas;
    lines.push(`Last quarter (Q${last.roundNumber}) results: tech debt ${md.technicalDebtIndex >= 0 ? '+' : ''}${md.technicalDebtIndex}, velocity ${md.deliveryVelocity >= 0 ? '+' : ''}${md.deliveryVelocity}, budget ${md.budgetRemaining}K, ${last.incidentsTriggered.length} incident(s)`);
  }
  return lines;
}

/**
 * Sentinel Anti-Cheat: Checks if player is spamming the exact same message
 * or near-identical pitch repeatedly to farm trust points.
 */
function checkMessageRepetition(
  newMessage: string,
  previousPlayerMessages: ChatMessage[]
): { isRepetition: boolean; repetitionCount: number; maxSimilarity: number } {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const newNorm = clean(newMessage);
  if (!newNorm) return { isRepetition: false, repetitionCount: 0, maxSimilarity: 0 };

  const newWords = new Set(newNorm.split(' ').filter(w => w.length > 2));

  let repetitionCount = 0;
  let maxSimilarity = 0;

  // Compare against last 6 player messages (most recent first)
  const recentPlayerMsgs = previousPlayerMessages.slice(-6).reverse();
  for (const prev of recentPlayerMsgs) {
    const prevNorm = clean(prev.content);
    if (!prevNorm) continue;

    // Exact match
    if (prevNorm === newNorm) {
      repetitionCount++;
      maxSimilarity = 1.0;
      continue;
    }

    // Token Jaccard overlap for messages with substance
    const prevWords = new Set(prevNorm.split(' ').filter(w => w.length > 2));
    if (newWords.size >= 3 && prevWords.size >= 3) {
      let intersection = 0;
      for (const w of newWords) {
        if (prevWords.has(w)) intersection++;
      }
      const union = new Set([...newWords, ...prevWords]).size;
      const sim = intersection / (union || 1);
      if (sim > maxSimilarity) maxSimilarity = sim;

      if (sim >= 0.72) {
        repetitionCount++;
      }
    }
  }

  return {
    isRepetition: repetitionCount > 0 || maxSimilarity >= 0.72,
    repetitionCount,
    maxSimilarity,
  };
}

export const aiRouter = Router();

// GET /api/ai/settings
// GET /api/ai/systemone/health (System One decision model probe)
aiRouter.get('/systemone/health', async (req, res) => {
  res.json(await SystemOneClient.getInstance().checkHealth());
});

aiRouter.get('/settings', (req, res) => {
  try {
    const registry = AIRegistry.getInstance();
    const settings = registry.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/settings
aiRouter.post('/settings', (req, res) => {
  try {
    const { activeProvider, updates } = req.body as {
      activeProvider?: AIProviderType;
      updates?: Array<{ type: AIProviderType; config: any }>;
    };

    const registry = AIRegistry.getInstance();

    if (updates && Array.isArray(updates)) {
      for (const item of updates) {
        registry.updateProviderConfig(item.type, item.config);
      }
    }

    if (activeProvider) {
      registry.setActiveProvider(activeProvider);
    }

    res.json(registry.getSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/test
aiRouter.post('/test', async (req, res) => {
  try {
    const { provider } = req.body as { provider: AIProviderType };
    const registry = AIRegistry.getInstance();
    const result = await registry.testProvider(provider);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message, latencyMs: 0 });
  }
});

// GET /api/ai/chat/:sessionId/:teamId
aiRouter.get('/chat/:sessionId/:teamId', (req, res) => {
  try {
    const { sessionId, teamId } = req.params;
    const stakeholderId = req.query.stakeholderId as string | undefined;

    const db = DatabaseRepository.getInstance();
    const messages = db.getChatMessages(sessionId, teamId, stakeholderId);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/negotiate
aiRouter.post('/negotiate', validateBody(negotiateSchema), async (req, res) => {
  try {
    const { sessionId, teamId, stakeholderId, playerMessage } = req.body as {
      sessionId: string;
      teamId: string;
      stakeholderId: string;
      playerMessage: string;
    };

    if (!sessionId || !teamId || !stakeholderId || !playerMessage) {
      return res.status(400).json({ error: 'Missing required negotiation fields' });
    }

    const db = DatabaseRepository.getInstance();
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const scenario = db.getScenario(session.scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const team = session.teams.find(t => t.id === teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const stakeholder = scenario.stakeholders.find(s => s.id === stakeholderId);
    if (!stakeholder) {
      return res.status(404).json({ error: 'Stakeholder persona not found' });
    }

    // 1. Save player message
    const playerChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-player`,
      sender: 'PLAYER',
      stakeholderId,
      senderName: team.name,
      content: playerMessage,
      timestamp: new Date().toISOString(),
    };
    db.saveChatMessage(sessionId, teamId, playerChatMsg);

    // 2. Fetch recent conversation history
    const history = db.getChatMessages(sessionId, teamId, stakeholderId);
    const previousPlayerMsgs = history.filter(m => m.sender === 'PLAYER' && m.id !== playerChatMsg.id);

    const isFrench = /(?:[éàèùâêîôûëïç]|bonjour|merci|nous|vous|pour|dans|avec|coût|dette|archi|projet|stratégie|budget|marge)/i.test(playerMessage) ||
                     /(?:[éàèùâêîôûëïç]|directeur|responsable|chef)/i.test(stakeholder.title);

    // 1b. Patience exhausted: the stakeholder refuses to negotiate until next quarter
    if (getPatience(team, stakeholderId) <= 0) {
      const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
      const newTrust = Math.max(5, currentTrust + CLOSED_DOOR_TRUST_PENALTY);
      team.stakeholderTrustMap[stakeholderId] = newTrust;
      db.saveSession(session);
      const closedMsg: ChatMessage = {
        id: `msg-${Date.now()}-sh`,
        sender: 'STAKEHOLDER',
        stakeholderId,
        senderName: `${stakeholder.name} (${stakeholder.title})`,
        content: closedDoorReply(stakeholder.name, isFrench),
        timestamp: new Date().toISOString(),
      };
      db.saveChatMessage(sessionId, teamId, closedMsg);
      broadcastToSession(sessionId, { type: 'STAKEHOLDER_RESPONSE', teamId, message: closedMsg });
      return res.json({ reply: closedMsg, updatedTrust: newTrust, patience: 0, usedProvider: 'patience-exhausted' });
    }

    // 2a. Anti-Spam: Low-effort or meaningless chatter check (< 8 chars or common test words)
    const trimmedMsg = playerMessage.trim();
    if (trimmedMsg.length < 8 || /^(asdf|qwerty|test|hello|salut|yo|ok|oui|non|cool|merci)$/i.test(trimmedMsg)) {
      const penalty = -3;
      const lowEffortDialogue = isFrench
        ? `Un échange au niveau exécutif exige une proposition stratégique structurée, pas des messages laconiques ou informels. Veuillez développer vos arguments.`
        : `Executive negotiations require articulated proposals, not monosyllabic chatter. Formulate a real strategic proposal.`;

      const lowEffortEval: ProposalEvaluation = {
        empathyScore: 25,
        financialAcumenScore: 20,
        strategicAlignmentScore: 25,
        trustDelta: penalty,
        verdict: 'REJECTED',
        rationale: isFrench
          ? 'Message trop sommaire ou vide de substance stratégique.'
          : 'Low-effort or empty message lacking executive substance.',
        concessionRequired: isFrench ? 'Formuler une proposition détaillée et chiffrée.' : 'Formulate a detailed, quantified proposal.',
      };

      const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
      const newTrust = Math.max(5, Math.min(100, currentTrust + penalty));
      team.stakeholderTrustMap[stakeholderId] = newTrust;
      spendPatience(team, stakeholderId, penalty <= -6 ? PATIENCE_COST.REPETITION : PATIENCE_COST.LOW_EFFORT);
      const trusts = Object.values(team.stakeholderTrustMap);
      team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
      db.saveSession(session);

      const stakeholderChatMsg: ChatMessage = {
        id: `msg-${Date.now()}-sh`,
        sender: 'STAKEHOLDER',
        stakeholderId,
        senderName: `${stakeholder.name} (${stakeholder.title})`,
        content: lowEffortDialogue,
        timestamp: new Date().toISOString(),
        evaluation: lowEffortEval,
      };
      db.saveChatMessage(sessionId, teamId, stakeholderChatMsg);

      broadcastToSession(sessionId, {
        type: 'STAKEHOLDER_RESPONSE',
        teamId,
        message: stakeholderChatMsg,
      });

      return res.json({
        reply: stakeholderChatMsg,
        evaluation: lowEffortEval,
        updatedTrust: newTrust,
      patience: getPatience(team, stakeholderId),
        usedProvider: 'anti-cheat-sentinel',
      });
    }

    // 2b. Anti-Cheat: Repetition / Radotage Detection (Prevents cheating by spamming same pitch)
    const repetition = checkMessageRepetition(playerMessage, previousPlayerMsgs);
    if (repetition.isRepetition) {
      const penalty = repetition.repetitionCount > 1 ? -12 : -6;
      const repDialogue = isFrench
        ? repetition.repetitionCount > 1
          ? `Vous me répétez exactement la même idée pour la énième fois. Ce radotage stérile fait perdre un temps précieux au comité. Tant que vous n'apportez pas de nouvelles données ou concessions, le sujet est clos.`
          : `Vous vous répétez mot pour mot. Nous avons déjà abordé et enregistré ce point il y a un instant. Qu'avez-vous de neuf ou de concret à mettre sur la table ?`
        : repetition.repetitionCount > 1
          ? `You have repeated the exact same pitch multiple times. This circular badgering is wasting executive time. Unless you bring new data or concessions, this topic is closed.`
          : `You are repeating yourself verbatim. We already covered this exact proposal. What new value, compromise, or metrics are you offering now?`;

      const repEval: ProposalEvaluation = {
        empathyScore: 20,
        financialAcumenScore: 20,
        strategicAlignmentScore: 20,
        trustDelta: penalty,
        verdict: 'REJECTED',
        rationale: isFrench
          ? 'Pénalité pour répétition / radotage d\'une même proposition sans valeur ajoutée.'
          : 'Penalty for repeated identical proposal without new value.',
        concessionRequired: isFrench
          ? 'Présenter une alternative différente ou réviser vos engagements.'
          : 'Present a different alternative or revise your commitments.',
      };

      const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
      const newTrust = Math.max(5, Math.min(100, currentTrust + penalty));
      team.stakeholderTrustMap[stakeholderId] = newTrust;
      spendPatience(team, stakeholderId, penalty <= -6 ? PATIENCE_COST.REPETITION : PATIENCE_COST.LOW_EFFORT);
      const trusts = Object.values(team.stakeholderTrustMap);
      team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
      db.saveSession(session);

      const stakeholderChatMsg: ChatMessage = {
        id: `msg-${Date.now()}-sh`,
        sender: 'STAKEHOLDER',
        stakeholderId,
        senderName: `${stakeholder.name} (${stakeholder.title})`,
        content: repDialogue,
        timestamp: new Date().toISOString(),
        evaluation: repEval,
      };
      db.saveChatMessage(sessionId, teamId, stakeholderChatMsg);

      broadcastToSession(sessionId, {
        type: 'STAKEHOLDER_RESPONSE',
        teamId,
        message: stakeholderChatMsg,
      });

      return res.json({
        reply: stakeholderChatMsg,
        evaluation: repEval,
        updatedTrust: newTrust,
      patience: getPatience(team, stakeholderId),
        usedProvider: 'anti-cheat-sentinel',
      });
    }

    // 3. Evaluate proposal via AI Gateway
    const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
    const registry = AIRegistry.getInstance();

    const teamMetrics = {
      tco: team.metrics.tco,
      budgetRemaining: team.metrics.budgetRemaining,
      technicalDebtIndex: team.metrics.technicalDebtIndex,
      deliveryVelocity: team.metrics.deliveryVelocity,
    };
    const teamDecisions = describeTeamDecisions(scenario, session, team);

    // System 1: fast typed decision. System 2 (LLM) then only voices it.
    const decision = await judgeProposal({
      stakeholder,
      currentTrust,
      chatHistory: history.slice(-6),
      playerMessage,
      currentRound: session.currentRound,
      teamMetrics,
      teamDecisions,
      patience: getPatience(team, stakeholderId),
      isFrench,
    });

    const { result, usedProvider } = await registry.executeWithFallback(async (provider) => {
      return provider.evaluateStakeholderProposal({
        stakeholder,
        currentTrust,
        chatHistory: history.slice(-6),
        playerMessage,
        currentRound: session.currentRound,
        teamMetrics,
        teamDecisions,
        patience: getPatience(team, stakeholderId),
        decision: decision ?? undefined,
      });
    });
    if (decision) {
      result.evaluation = mergeDecision(result.evaluation, decision);
    }

    // 4. Update team trust map
    const newTrust = Math.max(5, Math.min(100, currentTrust + (result.evaluation.trustDelta || 0)));
    team.stakeholderTrustMap[stakeholderId] = newTrust;
    spendPatience(team, stakeholderId, PATIENCE_COST[result.evaluation.verdict] ?? PATIENCE_COST.REJECTED);

    // Recalculate average trust
    const trusts = Object.values(team.stakeholderTrustMap);
    team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
    db.saveSession(session);

    // 5. Save AI stakeholder response
    const stakeholderChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-sh`,
      sender: 'STAKEHOLDER',
      stakeholderId,
      senderName: `${stakeholder.name} (${stakeholder.title})`,
      content: result.responseDialogue,
      timestamp: new Date().toISOString(),
      evaluation: result.evaluation,
    };
    db.saveChatMessage(sessionId, teamId, stakeholderChatMsg);

    // 6. Broadcast to session
    broadcastToSession(sessionId, {
      type: 'STAKEHOLDER_RESPONSE',
      teamId,
      message: stakeholderChatMsg,
    });

    res.json({
      reply: stakeholderChatMsg,
      evaluation: result.evaluation,
      updatedTrust: newTrust,
      patience: getPatience(team, stakeholderId),
      usedProvider,
    });
  } catch (err: any) {
    console.error('[AINegotiate] Error in negotiation:', err);
    res.status(500).json({ error: err.message || 'Negotiation failed' });
  }
});

// POST /api/ai/negotiate/stream (Real-Time Token Streaming Stakeholder Dialogue via SSE)
aiRouter.post('/negotiate/stream', validateBody(negotiateSchema), async (req, res) => {
  const { sessionId, teamId, stakeholderId, playerMessage } = req.body as {
    sessionId: string;
    teamId: string;
    stakeholderId: string;
    playerMessage: string;
  };

  if (!sessionId || !teamId || !stakeholderId || !playerMessage) {
    return res.status(400).json({ error: 'Missing required negotiation fields' });
  }

  const db = DatabaseRepository.getInstance();
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const scenario = db.getScenario(session.scenarioId);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  const team = session.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const stakeholder = scenario.stakeholders.find(s => s.id === stakeholderId);
  if (!stakeholder) {
    return res.status(404).json({ error: 'Stakeholder persona not found' });
  }

  // 1. Save player message
  const playerChatMsg: ChatMessage = {
    id: `msg-${Date.now()}-player`,
    sender: 'PLAYER',
    stakeholderId,
    senderName: team.name,
    content: playerMessage,
    timestamp: new Date().toISOString(),
  };
  db.saveChatMessage(sessionId, teamId, playerChatMsg);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const history = db.getChatMessages(sessionId, teamId, stakeholderId);
  const previousPlayerMsgs = history.filter(m => m.sender === 'PLAYER' && m.id !== playerChatMsg.id);

  const isFrench = /(?:[éàèùâêîôûëïç]|bonjour|merci|nous|vous|pour|dans|avec|coût|dette|archi|projet|stratégie|budget|marge)/i.test(playerMessage) ||
                   /(?:[éàèùâêîôûëïç]|directeur|responsable|chef)/i.test(stakeholder.title);

  // 1b. Patience exhausted: the stakeholder refuses to negotiate until next quarter
  if (getPatience(team, stakeholderId) <= 0) {
    const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
    const newTrust = Math.max(5, currentTrust + CLOSED_DOOR_TRUST_PENALTY);
    team.stakeholderTrustMap[stakeholderId] = newTrust;
    db.saveSession(session);
    const closedMsg: ChatMessage = {
      id: `msg-${Date.now()}-sh`,
      sender: 'STAKEHOLDER',
      stakeholderId,
      senderName: `${stakeholder.name} (${stakeholder.title})`,
      content: closedDoorReply(stakeholder.name, isFrench),
      timestamp: new Date().toISOString(),
    };
    db.saveChatMessage(sessionId, teamId, closedMsg);
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: closedMsg.content })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', reply: closedMsg, updatedTrust: newTrust, patience: 0, usedProvider: 'patience-exhausted' })}\n\n`);
    return res.end();
  }

  // 2a. Anti-Spam Check
  const trimmedMsg = playerMessage.trim();
  if (trimmedMsg.length < 8 || /^(asdf|qwerty|test|hello|salut|yo|ok|oui|non|cool|merci)$/i.test(trimmedMsg)) {
    const penalty = -3;
    const lowEffortDialogue = isFrench
      ? `Un échange au niveau exécutif exige une proposition stratégique structurée, pas des messages laconiques ou informels. Veuillez développer vos arguments.`
      : `Executive negotiations require articulated proposals, not monosyllabic chatter. Formulate a real strategic proposal.`;

    const lowEffortEval: ProposalEvaluation = {
      empathyScore: 25,
      financialAcumenScore: 20,
      strategicAlignmentScore: 25,
      trustDelta: penalty,
      verdict: 'REJECTED',
      rationale: isFrench ? 'Message trop sommaire ou vide de substance stratégique.' : 'Low-effort or empty message lacking executive substance.',
      concessionRequired: isFrench ? 'Formuler une proposition détaillée et chiffrée.' : 'Formulate a detailed, quantified proposal.',
    };

    const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
    const newTrust = Math.max(5, Math.min(100, currentTrust + penalty));
    team.stakeholderTrustMap[stakeholderId] = newTrust;
    spendPatience(team, stakeholderId, penalty <= -6 ? PATIENCE_COST.REPETITION : PATIENCE_COST.LOW_EFFORT);
    const trusts = Object.values(team.stakeholderTrustMap);
    team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
    db.saveSession(session);

    const stakeholderChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-sh`,
      sender: 'STAKEHOLDER',
      stakeholderId,
      senderName: `${stakeholder.name} (${stakeholder.title})`,
      content: lowEffortDialogue,
      timestamp: new Date().toISOString(),
      evaluation: lowEffortEval,
    };
    db.saveChatMessage(sessionId, teamId, stakeholderChatMsg);

    const words = lowEffortDialogue.split(' ');
    for (const w of words) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: w + ' ' })}\n\n`);
      await new Promise(r => setTimeout(r, 15));
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      reply: stakeholderChatMsg,
      evaluation: lowEffortEval,
      updatedTrust: newTrust,
      patience: getPatience(team, stakeholderId),
      usedProvider: 'anti-cheat-sentinel',
    })}\n\n`);
    return res.end();
  }

  // 2b. Anti-Cheat: Repetition / Radotage Check
  const repetition = checkMessageRepetition(playerMessage, previousPlayerMsgs);
  if (repetition.isRepetition) {
    const penalty = repetition.repetitionCount > 1 ? -12 : -6;
    const repDialogue = isFrench
      ? repetition.repetitionCount > 1
        ? `Vous me répétez exactement la même idée pour la énième fois. Ce radotage stérile fait perdre un temps précieux au comité. Tant que vous n'apportez pas de nouvelles données ou concessions, le sujet est clos.`
        : `Vous vous répétez mot pour mot. Nous avons déjà abordé et enregistré ce point il y a un instant. Qu'avez-vous de neuf ou de concret à mettre sur la table ?`
      : repetition.repetitionCount > 1
        ? `You have repeated the exact same pitch multiple times. This circular badgering is wasting executive time. Unless you bring new data or concessions, this topic is closed.`
        : `You are repeating yourself verbatim. We already covered this exact proposal. What new value, compromise, or metrics are you offering now?`;

    const repEval: ProposalEvaluation = {
      empathyScore: 20,
      financialAcumenScore: 20,
      strategicAlignmentScore: 20,
      trustDelta: penalty,
      verdict: 'REJECTED',
      rationale: isFrench
        ? 'Pénalité pour répétition / radotage d\'une même proposition sans valeur ajoutée.'
        : 'Penalty for repeated identical proposal without new value.',
      concessionRequired: isFrench ? 'Présenter une alternative différente ou réviser vos engagements.' : 'Present a different alternative or revise your commitments.',
    };

    const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
    const newTrust = Math.max(5, Math.min(100, currentTrust + penalty));
    team.stakeholderTrustMap[stakeholderId] = newTrust;
    spendPatience(team, stakeholderId, penalty <= -6 ? PATIENCE_COST.REPETITION : PATIENCE_COST.LOW_EFFORT);
    const trusts = Object.values(team.stakeholderTrustMap);
    team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
    db.saveSession(session);

    const stakeholderChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-sh`,
      sender: 'STAKEHOLDER',
      stakeholderId,
      senderName: `${stakeholder.name} (${stakeholder.title})`,
      content: repDialogue,
      timestamp: new Date().toISOString(),
      evaluation: repEval,
    };
    db.saveChatMessage(sessionId, teamId, stakeholderChatMsg);

    const words = repDialogue.split(' ');
    for (const w of words) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: w + ' ' })}\n\n`);
      await new Promise(r => setTimeout(r, 15));
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      reply: stakeholderChatMsg,
      evaluation: repEval,
      updatedTrust: newTrust,
      patience: getPatience(team, stakeholderId),
      usedProvider: 'anti-cheat-sentinel',
    })}\n\n`);
    return res.end();
  }

  // 3. Live Token Streaming Execution via AI Gateway
  try {
    const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
    const registry = AIRegistry.getInstance();

    const teamMetrics = {
      tco: team.metrics.tco,
      budgetRemaining: team.metrics.budgetRemaining,
      technicalDebtIndex: team.metrics.technicalDebtIndex,
      deliveryVelocity: team.metrics.deliveryVelocity,
    };
    const teamDecisions = describeTeamDecisions(scenario, session, team);

    // System 1 decides before the first dialogue token is streamed
    const decision = await judgeProposal({
      stakeholder,
      currentTrust,
      chatHistory: history.slice(-6),
      playerMessage,
      currentRound: session.currentRound,
      teamMetrics,
      teamDecisions,
      patience: getPatience(team, stakeholderId),
      isFrench,
    });
    if (decision) {
      res.write(`data: ${JSON.stringify({ type: 'decision', evaluation: decision })}\n\n`);
    }

    const { result, usedProvider } = await registry.executeStreamWithFallback(
      {
        stakeholder,
        currentTrust,
        chatHistory: history.slice(-6),
        playerMessage,
        currentRound: session.currentRound,
        teamMetrics,
        teamDecisions,
        patience: getPatience(team, stakeholderId),
        decision: decision ?? undefined,
      },
      (chunk: string) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        broadcastToSession(sessionId, {
          type: 'STAKEHOLDER_CHUNK',
          teamId,
          stakeholderId,
          chunk,
        });
      }
    );
    if (decision) {
      result.evaluation = mergeDecision(result.evaluation, decision);
    }

    // 4. Update team trust map
    const newTrust = Math.max(5, Math.min(100, currentTrust + (result.evaluation.trustDelta || 0)));
    team.stakeholderTrustMap[stakeholderId] = newTrust;
    spendPatience(team, stakeholderId, PATIENCE_COST[result.evaluation.verdict] ?? PATIENCE_COST.REJECTED);
    const trusts = Object.values(team.stakeholderTrustMap);
    team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
    db.saveSession(session);

    // 5. Save AI stakeholder response
    const stakeholderChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-sh`,
      sender: 'STAKEHOLDER',
      stakeholderId,
      senderName: `${stakeholder.name} (${stakeholder.title})`,
      content: result.responseDialogue,
      timestamp: new Date().toISOString(),
      evaluation: result.evaluation,
    };
    db.saveChatMessage(sessionId, teamId, stakeholderChatMsg);

    // 6. Broadcast completed message to session
    broadcastToSession(sessionId, {
      type: 'STAKEHOLDER_RESPONSE',
      teamId,
      message: stakeholderChatMsg,
    });

    res.write(`data: ${JSON.stringify({
      type: 'done',
      reply: stakeholderChatMsg,
      evaluation: result.evaluation,
      updatedTrust: newTrust,
      patience: getPatience(team, stakeholderId),
      usedProvider,
    })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('[AINegotiateStream] Error in streaming negotiation:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Stream failed' })}\n\n`);
    res.end();
  }
});

// POST /api/ai/boardroom (Executive Board Meeting / Plenary ComEx Deliberation)
aiRouter.post('/boardroom', validateBody(boardroomSchema), async (req, res) => {
  try {
    const { sessionId, teamId, playerMessage } = req.body as {
      sessionId: string;
      teamId: string;
      playerMessage: string;
    };

    if (!sessionId || !teamId || !playerMessage?.trim()) {
      return res.status(400).json({ error: 'Missing required parameters (sessionId, teamId, playerMessage)' });
    }

    const db = DatabaseRepository.getInstance();
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const scenario = db.getScenario(session.scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const team = session.teams.find(t => t.id === teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const stakeholders = scenario.stakeholders;
    if (!stakeholders || stakeholders.length === 0) {
      return res.status(400).json({ error: 'No stakeholders available for this scenario' });
    }

    // 1. Save Player Message to Boardroom channel
    const playerChatMsg: ChatMessage = {
      id: `msg-${Date.now()}-board-player`,
      sender: 'PLAYER',
      stakeholderId: 'BOARDROOM',
      senderName: `${team.name} (Directeur Architecture)`,
      content: playerMessage,
      timestamp: new Date().toISOString(),
    };
    db.saveChatMessage(sessionId, teamId, playerChatMsg);

    // 2. Fetch Boardroom History
    const history = db.getChatMessages(sessionId, teamId, 'BOARDROOM');
    const previousPlayerMsgs = history.filter(m => m.sender === 'PLAYER' && m.id !== playerChatMsg.id);

    const isFrench = /(?:[éàèùâêîôûëïç]|bonjour|merci|nous|vous|pour|dans|avec|coût|dette|archi|projet|stratégie|budget|marge)/i.test(playerMessage);

    // 2a. Anti-Cheat: Boardroom Repetition / Radotage Check
    const repetition = checkMessageRepetition(playerMessage, previousPlayerMsgs);
    if (repetition.isRepetition) {
      const penalty = repetition.repetitionCount > 1 ? -10 : -5;
      const boardReplies: ChatMessage[] = stakeholders.map(sh => ({
        id: `msg-${Date.now()}-board-${sh.id}`,
        sender: 'STAKEHOLDER',
        stakeholderId: 'BOARDROOM',
        senderName: `${sh.name} (${sh.title})`,
        content: isFrench
          ? `Cette présentation devant le Conseil est une copie de ce que vous avez déjà exposé. Le Conseil exige de nouvelles options stratégiques, pas la répétition des mêmes éléments.`
          : `This boardroom pitch is a duplicate of a previous statement. The Board demands fresh strategic options, not repetition.`,
        timestamp: new Date().toISOString(),
        evaluation: {
          empathyScore: 20,
          financialAcumenScore: 20,
          strategicAlignmentScore: 20,
          trustDelta: penalty,
          verdict: 'REJECTED',
          rationale: isFrench ? 'Répétition stérile devant le Conseil.' : 'Repetitive pitch before the Board.',
        },
      }));

      for (const r of boardReplies) {
        db.saveChatMessage(sessionId, teamId, r);
      }

      // Apply trust penalty to all stakeholders
      for (const sh of stakeholders) {
        const cur = team.stakeholderTrustMap[sh.id] ?? sh.baseTrust ?? 60;
        team.stakeholderTrustMap[sh.id] = Math.max(5, Math.min(100, cur + penalty));
        spendPatience(team, sh.id, Math.round(PATIENCE_COST.REPETITION / 2));
      }
      const trusts = Object.values(team.stakeholderTrustMap);
      const avgTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
      team.metrics.stakeholderTrust = avgTrust;
      db.saveSession(session);

      const rejectedBreakdown: Record<string, {
        stakeholderName: string;
        verdict: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE';
        trustDelta: number;
      }> = {};

      for (const sh of stakeholders) {
        rejectedBreakdown[sh.id] = {
          stakeholderName: sh.name,
          verdict: 'REJECTED',
          trustDelta: penalty,
        };
      }

      const boardResolution: BoardResolution = {
        verdict: 'REJECTED',
        consensusScore: 10,
        rationale: isFrench
          ? 'Motion rejetée à l\'unanimité par le Conseil en raison de la redondance et du manque d\'arbitrages nouveaux.'
          : 'Motion unanimously rejected by the Board due to redundancy and lack of new strategic trade-offs.',
        votes: { accepted: 0, conditional: 0, rejected: stakeholders.length, total: stakeholders.length },
        breakdown: rejectedBreakdown,
      };

      const resolutionMsg: ChatMessage = {
        id: `msg-${Date.now()}-board-resolution`,
        sender: 'STAKEHOLDER',
        stakeholderId: 'BOARDROOM',
        senderName: 'Conseil d\'Administration (Résolution Officielle)',
        content: `RÉSOLUTION DU CONSEIL : ${boardResolution.verdict} (Consensus : ${boardResolution.consensusScore}%) - ${boardResolution.rationale}`,
        timestamp: new Date().toISOString(),
        boardResolution,
      };
      db.saveChatMessage(sessionId, teamId, resolutionMsg);

      broadcastToSession(sessionId, {
        type: 'STAKEHOLDER_RESPONSE',
        teamId,
        message: resolutionMsg,
      });

      return res.json({
        replies: boardReplies,
        boardResolution,
        updatedTrustMap: team.stakeholderTrustMap,
        averageTrust: avgTrust,
        usedProvider: 'anti-cheat-sentinel',
      });
    }

    // 3. Deliberation: Evaluate proposal across all stakeholders
    const registry = AIRegistry.getInstance();
    const replies: ChatMessage[] = [];
    const breakdown: Record<string, {
      stakeholderName: string;
      verdict: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL_ACCEPTANCE';
      trustDelta: number;
    }> = {};
    let totalAccepted = 0;
    let totalConditional = 0;
    let totalRejected = 0;
    let usedProviderName = 'fallback';

    const teamMetrics = {
      tco: team.metrics.tco,
      budgetRemaining: team.metrics.budgetRemaining,
      technicalDebtIndex: team.metrics.technicalDebtIndex,
      deliveryVelocity: team.metrics.deliveryVelocity,
    };
    const teamDecisions = describeTeamDecisions(scenario, session, team);

    // System 1: every board vote in a single forward pass
    const boardDecisions = await judgeBoard(stakeholders, team.stakeholderTrustMap, {
      chatHistory: history.slice(-6),
      playerMessage,
      currentRound: session.currentRound,
      teamMetrics,
      teamDecisions,
      isFrench,
    });

    for (let i = 0; i < stakeholders.length; i++) {
      const sh = stakeholders[i];
      const currentTrust = team.stakeholderTrustMap[sh.id] ?? sh.baseTrust ?? 60;
      const decision = boardDecisions?.[sh.id];

      let result: { responseDialogue: string; evaluation: ProposalEvaluation };
      if (getPatience(team, sh.id) <= 0) {
        // Out of patience: votes against without hearing the pitch again
        result = {
          responseDialogue: closedDoorReply(sh.name, isFrench),
          evaluation: {
            empathyScore: 0,
            financialAcumenScore: 0,
            strategicAlignmentScore: 0,
            trustDelta: CLOSED_DOOR_TRUST_PENALTY,
            verdict: 'REJECTED',
            rationale: isFrench ? 'Patience épuisée pour ce trimestre.' : 'Patience exhausted for this quarter.',
          },
        };
      } else {
        const evaluated = await registry.executeWithFallback(async (provider) => {
          return provider.evaluateStakeholderProposal({
            stakeholder: sh,
            currentTrust,
            chatHistory: history.slice(-6),
            playerMessage,
            currentRound: session.currentRound,
            teamMetrics,
            teamDecisions,
            patience: getPatience(team, sh.id),
            decision,
          });
        });
        result = evaluated.result;
        if (decision) {
          result.evaluation = mergeDecision(result.evaluation, decision);
        }
        usedProviderName = evaluated.usedProvider;
        // A plenary session costs each member half the patience of a 1-on-1
        spendPatience(team, sh.id, Math.round((PATIENCE_COST[result.evaluation.verdict] ?? PATIENCE_COST.REJECTED) / 2));
      }

      // Update trust
      const updatedTrust = Math.max(5, Math.min(100, currentTrust + (result.evaluation.trustDelta || 0)));
      team.stakeholderTrustMap[sh.id] = updatedTrust;

      if (result.evaluation.verdict === 'ACCEPTED') totalAccepted++;
      else if (result.evaluation.verdict === 'CONDITIONAL_ACCEPTANCE') totalConditional++;
      else totalRejected++;

      breakdown[sh.id] = {
        stakeholderName: sh.name,
        verdict: result.evaluation.verdict,
        trustDelta: result.evaluation.trustDelta,
      };

      const replyMsg: ChatMessage = {
        id: `msg-${Date.now()}-board-${sh.id}`,
        sender: 'STAKEHOLDER',
        stakeholderId: 'BOARDROOM',
        senderName: `${sh.name} (${sh.title})`,
        content: result.responseDialogue,
        timestamp: new Date().toISOString(),
        evaluation: result.evaluation,
      };
      db.saveChatMessage(sessionId, teamId, replyMsg);
      replies.push(replyMsg);
    }

    // 3b. Cross-NPC debate: the most opposed member rebuts the most supportive one
    const debate = await runBoardDebate(stakeholders, replies, breakdown, playerMessage, isFrench);
    if (debate) {
      db.saveChatMessage(sessionId, teamId, debate);
      replies.push(debate);
    }

    // 4. Calculate Board Resolution
    const totalVotes = stakeholders.length;
    let boardVerdict: 'APPROVED' | 'REJECTED' | 'CONDITIONAL_QUORUM' = 'CONDITIONAL_QUORUM';
    let rationale = '';

    if (totalAccepted > totalVotes / 2) {
      boardVerdict = 'APPROVED';
      rationale = 'Le Conseil d\'Administration valide la proposition à la majorité absolue. Les engagements de gouvernance et de vélocité sont jugés stratégiquement alignés.';
    } else if (totalAccepted + totalConditional >= Math.ceil(totalVotes / 2)) {
      boardVerdict = 'CONDITIONAL_QUORUM';
      rationale = 'Quorum sous conditions : le Conseil accorde un feu vert provisoire, sous réserve du respect strict des engagements budgétaires et de qualité.';
    } else {
      boardVerdict = 'REJECTED';
      rationale = 'Majorité défavorable : le Conseil d\'Administration rejette la proposition en l\'état. Les risques de dérapage budgétaire ou d\'instabilité sont jugés excessifs.';
    }

    const consensusScore = Math.round(((totalAccepted * 100) + (totalConditional * 60) + (totalRejected * 20)) / (totalVotes || 1));

    // Recalculate team average trust
    const trusts = Object.values(team.stakeholderTrustMap);
    team.metrics.stakeholderTrust = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
    db.saveSession(session);

    const boardResolution = {
      verdict: boardVerdict,
      consensusScore,
      rationale,
      votes: {
        accepted: totalAccepted,
        conditional: totalConditional,
        rejected: totalRejected,
        total: totalVotes,
      },
      breakdown,
    };

    // 5. Save Board Resolution Summary Chat Message
    const resolutionMsg: ChatMessage = {
      id: `msg-${Date.now()}-resolution`,
      sender: 'SYSTEM',
      stakeholderId: 'BOARDROOM',
      senderName: 'Conseil d\'Administration // Secrétariat Général',
      content: `🏛️ VERDICT DU CONSEIL : ${boardVerdict === 'APPROVED' ? 'STRATÉGIE APPROUVÉE' : boardVerdict === 'CONDITIONAL_QUORUM' ? 'QUORUM SOUS CONDITIONS' : 'PROPOSITION REJETÉE'}\n\n• Consensus global : ${consensusScore}%\n• Votes : ${totalAccepted} pour, ${totalConditional} sous réserve, ${totalRejected} contre\n• Décision : ${rationale}`,
      timestamp: new Date().toISOString(),
      boardResolution,
    };
    db.saveChatMessage(sessionId, teamId, resolutionMsg);
    replies.push(resolutionMsg);

    // 6. Broadcast to session
    broadcastToSession(sessionId, {
      type: 'STAKEHOLDER_RESPONSE',
      teamId,
      message: resolutionMsg,
    });

    res.json({
      replies,
      boardResolution,
      updatedTrustMap: team.stakeholderTrustMap,
      averageTrust: team.metrics.stakeholderTrust,
      usedProvider: usedProviderName,
    });
  } catch (err: any) {
    console.error('[AIBoardroom] Error in boardroom deliberation:', err);
    res.status(500).json({ error: err.message || 'Boardroom deliberation failed' });
  }
});
