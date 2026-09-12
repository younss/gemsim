// ============================================================================
// GEMSIM: AI SETTINGS & STAKEHOLDER NEGOTIATION REST API
// Runtime provider switching, connection testing, and live persona evaluation
// ============================================================================

import { Router } from 'express';
import { AIRegistry } from '../ai/registry.js';
import { DatabaseRepository } from '../db/index.js';
import { AIProviderType, ChatMessage, ProposalEvaluation, BoardResolution } from '../types/index.js';
import { broadcastToSession } from '../socket/handler.js';

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
aiRouter.post('/negotiate', async (req, res) => {
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
        usedProvider: 'anti-cheat-sentinel',
      });
    }

    // 3. Evaluate proposal via AI Gateway
    const currentTrust = team.stakeholderTrustMap[stakeholderId] ?? stakeholder.baseTrust ?? 60;
    const registry = AIRegistry.getInstance();

    const { result, usedProvider } = await registry.executeWithFallback(async (provider) => {
      return provider.evaluateStakeholderProposal({
        stakeholder,
        currentTrust,
        chatHistory: history.slice(-6),
        playerMessage,
        currentRound: session.currentRound,
        teamMetrics: {
          tco: team.metrics.tco,
          budgetRemaining: team.metrics.budgetRemaining,
          technicalDebtIndex: team.metrics.technicalDebtIndex,
          deliveryVelocity: team.metrics.deliveryVelocity,
        },
      });
    });

    // 4. Update team trust map
    const newTrust = Math.max(5, Math.min(100, currentTrust + (result.evaluation.trustDelta || 0)));
    team.stakeholderTrustMap[stakeholderId] = newTrust;

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
      usedProvider,
    });
  } catch (err: any) {
    console.error('[AINegotiate] Error in negotiation:', err);
    res.status(500).json({ error: err.message || 'Negotiation failed' });
  }
});

// POST /api/ai/boardroom (Executive Board Meeting / Plenary ComEx Deliberation)
aiRouter.post('/boardroom', async (req, res) => {
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

    for (let i = 0; i < stakeholders.length; i++) {
      const sh = stakeholders[i];
      const currentTrust = team.stakeholderTrustMap[sh.id] ?? sh.baseTrust ?? 60;

      const { result, usedProvider } = await registry.executeWithFallback(async (provider) => {
        return provider.evaluateStakeholderProposal({
          stakeholder: sh,
          currentTrust,
          chatHistory: history.slice(-6),
          playerMessage,
          currentRound: session.currentRound,
          teamMetrics: {
            tco: team.metrics.tco,
            budgetRemaining: team.metrics.budgetRemaining,
            technicalDebtIndex: team.metrics.technicalDebtIndex,
            deliveryVelocity: team.metrics.deliveryVelocity,
          },
        });
      });
      usedProviderName = usedProvider;

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
