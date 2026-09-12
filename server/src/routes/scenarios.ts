// ============================================================================
// GEMSIM: SCENARIOS REST API
// ============================================================================

import { Router } from 'express';
import { DatabaseRepository } from '../db/index.js';
import { Scenario } from '../types/index.js';

export const scenariosRouter = Router();

// GET /api/scenarios
scenariosRouter.get('/', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const scenarios = db.getScenarios();
    res.json({ scenarios });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scenarios/:id
scenariosRouter.get('/:id', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const scenario = db.getScenario(req.params.id);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json({ scenario });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scenarios
scenariosRouter.post('/', (req, res) => {
  try {
    const scenario = req.body as Scenario;
    if (!scenario || !scenario.title || !scenario.topology) {
      return res.status(400).json({ error: 'Invalid scenario payload' });
    }
    if (!scenario.id) {
      scenario.id = `scen-${Date.now().toString(36)}`;
    }
    scenario.createdAt = scenario.createdAt || new Date().toISOString();
    scenario.isDefault = false;

    const db = DatabaseRepository.getInstance();
    db.saveScenario(scenario);
    res.status(201).json({ scenario });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scenarios/:id
scenariosRouter.delete('/:id', (req, res) => {
  try {
    const db = DatabaseRepository.getInstance();
    const deleted = db.deleteScenario(req.params.id);
    if (!deleted) {
      return res.status(400).json({ error: 'Cannot delete default seed scenario or not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
