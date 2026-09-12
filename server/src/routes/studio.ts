// ============================================================================
// GEMSIM: AI GAME STUDIO REST API
// Scenario synthesis from text prompt and schema validation
// ============================================================================

import { Router } from 'express';
import { StudioScenarioGenerator } from '../ai/studio-generator.js';
import { ScenarioGenerationPrompt } from '../ai/types.js';
import { DatabaseRepository } from '../db/index.js';
import { Scenario } from '../types/index.js';

export const studioRouter = Router();

// POST /api/studio/generate
studioRouter.post('/generate', async (req, res) => {
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

    res.json({ valid: true, message: 'Scenario schema passed enterprise validation.' });
  } catch (err: any) {
    res.status(500).json({ valid: false, errors: [err.message] });
  }
});

// POST /api/studio/publish
studioRouter.post('/publish', (req, res) => {
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
