// ============================================================================
// GEMSIM: AI GAME STUDIO REST API
// Scenario synthesis from text prompt and schema validation
// ============================================================================

import { Router } from 'express';
import { StudioScenarioGenerator } from '../ai/studio-generator.js';
import { ScenarioGenerationPrompt } from '../ai/types.js';
import { DatabaseRepository } from '../db/index.js';
import { Scenario } from '../types/index.js';
import { studioGenerateSchema, validateBody } from '../validation.js';
import { requireFacilitator } from '../auth.js';
import { checkScenarioBalance } from '../engine/balance.js';

export const studioRouter = Router();

// POST /api/studio/generate
studioRouter.post('/generate', requireFacilitator, validateBody(studioGenerateSchema), async (req, res) => {
  try {
    const prompt = req.body as ScenarioGenerationPrompt;
    if (!prompt || !prompt.industry || !prompt.businessChallenge) {
      return res.status(400).json({ error: 'Industry and business challenge description are required' });
    }

    console.log(`[GameStudio] Generating scenario for ${prompt.industry}...`);
    const scenario = await StudioScenarioGenerator.generate(prompt);

    res.json({ scenario });
  } catch (err: any) {
    console.error('[GameStudio] Generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to synthesize scenario' });
  }
});

// POST /api/studio/generate/stream (SSE: raw model tokens, then the validated scenario and its balance report)
studioRouter.post('/generate/stream', requireFacilitator, validateBody(studioGenerateSchema), async (req, res) => {
  const prompt = req.body as ScenarioGenerationPrompt;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    console.log(`[GameStudio] Streaming scenario generation for ${prompt.industry}...`);
    const scenario = await StudioScenarioGenerator.generateStream(prompt, chunk => send({ type: 'chunk', text: chunk }));
    send({ type: 'done', scenario, balance: summarizeBalance(scenario) });
  } catch (err: any) {
    console.error('[GameStudio] Streaming generation error:', err);
    send({ type: 'error', error: err.message || 'Failed to synthesize scenario' });
  }
  res.end();
});

function summarizeBalance(scenario: Scenario) {
  try {
    const report = checkScenarioBalance(scenario);
    return {
      playable: report.playable,
      issues: report.issues,
      bestAchievable: { verdict: report.bestAchievable.verdict, grade: report.bestAchievable.grade, score: report.bestAchievable.score },
      strategies: Object.fromEntries(
        Object.entries(report.results).map(([k, o]) => [k, { verdict: o.verdict, grade: o.grade, score: o.score }])
      ),
    };
  } catch (err: any) {
    return { playable: false, issues: [`Balance simulation failed: ${err.message}`] };
  }
}

// POST /api/studio/validate
studioRouter.post('/validate', (req, res) => {
  try {
    const raw = req.body as Partial<Scenario>;
    if (!raw) {
      return res.status(400).json({ valid: false, errors: ['Empty scenario payload'] });
    }

    const errors: string[] = [];

    if (!raw.title || raw.title.trim().length < 3) errors.push('Title must be at least 3 characters');
    if (!raw.industry) errors.push('Industry must be specified');
    if (!raw.topology?.nodes || raw.topology.nodes.length < 3) errors.push('Topology must have at least 3 nodes');
    if (!raw.stakeholders || raw.stakeholders.length < 2) errors.push('Scenario must define at least 2 stakeholders');
    if (!raw.roundEvents || raw.roundEvents.length < 2) errors.push('Scenario must include at least 2 round events');
    if (!raw.initiativesCatalog || raw.initiativesCatalog.length < 3) errors.push('Scenario must offer at least 3 initiatives');

    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    // Structurally valid: simulate strategies to check it is winnable and punishes bypassing architecture
    const balance = summarizeBalance(raw as Scenario);
    res.json({
      valid: true,
      message: balance.playable
        ? 'Scenario schema passed enterprise validation and the balance check (winnable, bypass loses).'
        : `Schema valid, but balance issues: ${balance.issues.join(' ')}`,
      balance,
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, errors: [err.message] });
  }
});

// POST /api/studio/publish
studioRouter.post('/publish', requireFacilitator, (req, res) => {
  try {
    const scenario = req.body as Scenario;
    if (!scenario || !scenario.title || !scenario.topology?.nodes) {
      return res.status(400).json({ error: 'Invalid scenario payload' });
    }

    if (!scenario.id) {
      scenario.id = `scen-${Date.now().toString(36)}`;
    }
    scenario.isDefault = false;
    scenario.createdAt = new Date().toISOString();

    const db = DatabaseRepository.getInstance();
    db.saveScenario(scenario);

    res.status(201).json({ success: true, scenario });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
