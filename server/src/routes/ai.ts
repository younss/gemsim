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
