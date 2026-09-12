// ============================================================================
// GEMSIM: AI SETTINGS & STAKEHOLDER NEGOTIATION REST API
// Runtime provider switching, connection testing, and live persona evaluation
// ============================================================================

import { Router } from 'express';
import { AIRegistry } from '../ai/registry.js';
import { DatabaseRepository } from '../db/index.js';
import { AIProviderType, ChatMessage } from '../types/index.js';
import { broadcastToSession } from '../socket/handler.js';

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
