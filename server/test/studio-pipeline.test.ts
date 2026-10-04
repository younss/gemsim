import { describe, it, expect, vi, afterEach } from 'vitest';
import { sanitizeDraft, missingParts, type CaseDraft } from '../src/studio/draft.js';
import { authorJudgment, judgeDraft, CONFIDENT } from '../src/studio/judge.js';
import { quantify } from '../src/studio/quantify.js';
import { calibrateDifficulty } from '../src/studio/difficulty.js';
import { runAuthoringPipeline, NoAuthorError } from '../src/studio/pipeline.js';
import { SystemOneClient } from '../src/ai/systemone.js';
import { AIRegistry } from '../src/ai/registry.js';
import { checkScenarioBalance } from '../src/engine/balance.js';

afterEach(() => vi.restoreAllMocks());

/** What a model could write for a retail merger (French). */
const RAW = {
  title: 'Fusion SportPlus & ActiveZone',
  industry: 'Distribution spécialisée',
  description: 'Deux distributeurs d’articles de sport fusionnent.',
  businessContext: 'Deux réseaux de magasins, deux systèmes de caisse, 15 % de synergies promises.',
  language: 'fr',
  currency: 'EUR',
  startingState: { debt: 'HIGH', capacity: 'MODERATE', resilience: 'HIGH', compliance: 'LOW', cash: 'MODERATE' },
  nodes: [
    { id: 'pos-a', name: 'Caisses SportPlus', layer: 'APPLICATION', description: '', condition: 'AGEING', critical: true },
    { id: 'pos-b', name: 'Caisses ActiveZone', layer: 'APPLICATION', description: '', condition: 'FRAGILE', critical: true },
    { id: 'stock', name: 'Stocks', layer: 'DATA', description: '', condition: 'CRITICAL', critical: true },
    { id: 'dc', name: 'Entrepôt', layer: 'INFRASTRUCTURE', description: '', condition: 'AGEING', critical: false },
    { id: 'stores', name: 'Magasins', layer: 'BUSINESS', description: '', condition: 'AGEING', critical: true },
    { id: 'web', name: 'Site web', layer: 'BUSINESS', description: '', condition: 'MODERN', critical: false },
  ],
  edges: [{ from: 'pos-a', to: 'stock', label: 'ventes' }, { from: 'Stock', to: 'dc', label: 'réassort' }],
  stakeholders: [
    { id: 'cfo', name: 'Marc Lefebvre', title: 'DAF', role: 'Synergies', personality: 'Chiffré', bias: 'ROI immédiat', hiddenAgenda: 'Bonus', greeting: '', resistance: '', concession: '' },
    { id: 'sales', name: 'Sophie Morel', title: 'Directrice commerciale', role: 'Clients', personality: 'Énergique', bias: 'Garder les clients', hiddenAgenda: 'Promotion', greeting: '', resistance: '', concession: '' },
    { id: 'hr', name: 'Jean Vallet', title: 'DRH', role: 'Équipes', personality: 'Prudent', bias: 'Pas de départs', hiddenAgenda: 'Paix sociale', greeting: '', resistance: '', concession: '' },
    { id: 'it', name: 'Nadia Benali', title: 'DSI', role: 'Systèmes', personality: 'Rigoureuse', bias: 'Qualité', hiddenAgenda: 'Budget', greeting: '', resistance: '', concession: '' },
  ],
  crises: [1, 2, 3, 4].map(q => ({
    quarter: q,
    title: `T${q} : crise`,
    description: 'Les stocks divergent.',
    severity: q === 3 ? 'BLACK_SWAN' : 'HIGH',
    affectedNodes: ['stock'],
    answers: [
      // The author mislabels the first answer on purpose in some tests
      { id: `q${q}-quick`, text: 'Correction manuelle (rapide)', kind: 'QUICK_FIX', favoredBy: ['sales'], opposedBy: ['it'] },
      { id: `q${q}-lasting`, text: "Script d'unification (lent)", kind: 'LASTING', favoredBy: ['it'], opposedBy: [] },
    ],
  })),
  initiatives: [
    { id: 'pos', name: 'Unifier les caisses', description: '', kind: 'IMPROVEMENT', size: 'LARGE', category: 'OPERATIONS_EXCELLENCE', affectedNodes: ['pos-a', 'pos-b'], championedBy: ['it'], opposedBy: [] },
    { id: 'data', name: 'Migrer les clients', description: '', kind: 'IMPROVEMENT', size: 'MEDIUM', category: 'OPERATIONS_EXCELLENCE', affectedNodes: ['stock'], championedBy: ['sales'], opposedBy: [] },
    { id: 'log', name: 'Logistique unifiée', description: '', kind: 'IMPROVEMENT', size: 'MEDIUM', category: 'SOURCING_PARTNERSHIP', affectedNodes: ['dc'], championedBy: ['cfo'], opposedBy: [] },
    { id: 'people', name: 'Accord social', description: '', kind: 'IMPROVEMENT', size: 'SMALL', category: 'PEOPLE_CHANGE', affectedNodes: ['stores'], championedBy: ['hr'], opposedBy: [] },
    { id: 'rgpd', name: 'Conformité des données', description: '', kind: 'IMPROVEMENT', size: 'SMALL', category: 'RISK_MITIGATION', affectedNodes: ['stock'], championedBy: ['it'], opposedBy: [] },
    { id: 'promo', name: 'Promotion flash anti-web', description: '', kind: 'QUICK_WIN', size: 'MEDIUM', category: 'QUICK_WIN', affectedNodes: ['web'], championedBy: ['sales'], opposedBy: ['cfo'] },
  ],
  market: {
    unitCost: 45,
    segments: [
      { id: 'local', name: 'Sportifs locaux', description: '', demandPerQuarter: 20000, unitPrice: 80, growth: 'LOW', price: 'MEDIUM', quality: 'HIGH', availability: 'MEDIUM', reliability: 'MEDIUM', closedAtStart: false },
      { id: 'web', name: 'Acheteurs web', description: '', demandPerQuarter: 30000, unitPrice: 60, growth: 'HIGH', price: 'HIGH', quality: 'LOW', availability: 'HIGH', reliability: 'LOW', closedAtStart: false },
    ],
    rivals: [{ id: 'esport', name: 'E-Sport Pro', positioning: 'LOW_COST', segments: ['web'] }],
  },
};

const draft = (): CaseDraft => sanitizeDraft(RAW, 'fr');
const meta = { domain: 'GENERIC' as const, difficulty: 'EXECUTIVE' as const, withMarket: true, author: 'test' };

describe('Studio draft (System 2)', () => {
  it('sanitizes the model output and resolves loose ids', () => {
    const d = draft();
    expect(d.nodes).toHaveLength(6);
    expect(d.crises[0].answers[0].kind).toBe('QUICK_FIX');
    expect(missingParts(d, true)).toEqual(['one TRANSFORMATION initiative', 'one TRAP initiative']);
    const junk = sanitizeDraft({ nodes: 'x', crises: [{ answers: [{}] }], initiatives: [{ kind: 'NONSENSE', category: 'BAD' }] }, 'en');
    expect(junk.initiatives[0].kind).toBe('IMPROVEMENT');
    expect(junk.initiatives[0].category).toBe('OPERATIONS_EXCELLENCE');
    expect(missingParts(junk, false).length).toBeGreaterThan(3);
  });

  it('merges a completion without losing the first draft', () => {
    const base = draft();
    const merged = sanitizeDraft({ initiatives: [{ id: 'erp', name: 'ERP unique', kind: 'TRANSFORMATION', size: 'LARGE', category: 'OPERATIONS_EXCELLENCE' }] }, 'fr', base);
    expect(merged.initiatives).toHaveLength(7);
    expect(merged.title).toBe(base.title);
    expect(merged.crises).toHaveLength(4);
  });
});

describe('Engine quantification', () => {
  it('numbers always agree with the judged kind of each element', () => {
    const d = draft();
    const { scenario, notes } = quantify(d, authorJudgment(d), meta);
    for (const e of scenario.roundEvents) {
      const quick = e.choices.find(c => c.id.endsWith('quick'))!;
      const lasting = e.choices.find(c => c.id.endsWith('lasting'))!;
      expect(quick.capExImpact).toBeLessThan(lasting.capExImpact);
      expect(quick.tdiImpact).toBeGreaterThan(0);
      expect(lasting.tdiImpact).toBeLessThan(0);
    }
    // Structure completed by the engine: a transformation (2 quarters) and a trap
    expect(scenario.initiativesCatalog.some(i => i.durationRounds === 2)).toBe(true);
    expect(scenario.initiativesCatalog.filter(i => i.riskLevel === 'EXTREME')).toHaveLength(1);
    expect(notes.forced.length).toBe(2);
    // Real prices become thousands; the market is calibrated
    expect(scenario.market!.segments[0].referencePrice).toBe(0.08);
    expect(scenario.market!.unitCost).toBe(0.045);
    expect(scenario.market!.fixedCosts).toBeGreaterThanOrEqual(0);
    expect(scenario.currency).toBe('EUR');
    // The starting position comes from the judged severities, not from an example
    expect(scenario.baselineMetrics.technicalDebtIndex).toBe(64);
    expect(scenario.baselineMetrics.resilienceIndex).toBe(47);
    expect(scenario.topology.edges.map(e => e.toId)).toContain('dc'); // "Stock" resolved to "stock"
    // Targets are only set by the calibration: after it, the case is playable
    expect(checkScenarioBalance(calibrateDifficulty(scenario).scenario).playable).toBe(true);
  });
  it('honours a shorter case length chosen in the Studio', () => {
    for (const rounds of [1, 2, 3]) {
      const d = draft();
      const { scenario } = quantify(d, authorJudgment(d), { ...meta, rounds });
      expect(scenario.totalRounds).toBe(rounds);
      expect(scenario.roundEvents.map(e => e.roundNumber)).toEqual(Array.from({ length: rounds }, (_, i) => i + 1));
      expect(checkScenarioBalance(calibrateDifficulty(scenario).scenario).playable).toBe(true);
    }
    // A 2-quarter draft is complete with 2 crises, a 4-quarter one is not
    const short = sanitizeDraft({ ...RAW, crises: RAW.crises.slice(0, 2) }, 'fr');
    expect(missingParts(short, true, 2).some(m => m.includes('cris'))).toBe(false);
    expect(missingParts(short, true, 4).some(m => m.includes('cris'))).toBe(true);
  });
});

describe('System 1 judge', () => {
  it('uses the author tags when System 1 is unavailable', async () => {
    vi.spyOn(SystemOneClient.getInstance(), 'isAvailable').mockReturnValue(false);
    const j = await judgeDraft(draft());
    expect(j.engine).toBe('author-tags');
    expect(j.answerKinds['q1-quick']).toBe('QUICK_FIX');
  });

  it('overrides a mislabelled element when confident, keeps the author when it hesitates', async () => {
    const d = draft();
    d.crises[0].answers[1].kind = 'QUICK_FIX'; // author mislabels the lasting answer
    d.crises[1].answers[0].kind = 'LASTING'; // and mislabels a quick fix
    vi.spyOn(SystemOneClient.getInstance(), 'isAvailable').mockReturnValue(true);
    vi.spyOn(SystemOneClient.getInstance(), 'decide').mockImplementation(async (_state: any, questions: any) => {
      const answers: Record<string, any> = {};
      for (const [key, q] of Object.entries<any>(questions)) {
        if (q.type === 'choice' && key.startsWith('a_')) {
          const lasting = /unification/.test(q.instructions);
          // Confident on lasting answers, hesitant on quick fixes
          answers[key] = { type: 'choice', choice: lasting ? 'LASTING' : 'QUICK_FIX', confidence: lasting ? 0.9 : CONFIDENT - 0.2, probabilities: {} };
        } else if (q.type === 'noul') {
          // Initiatives: "Promotion flash" is judged a trap, the rest plain improvements
          answers[key] = { type: 'noul', noul: key.endsWith('_trap') && /Promotion flash/.test(q.instructions) ? 0.95 : 0.1 };
        } else {
          const n = q.criteria.length;
          const finance = /financial/.test(q.instructions) && /DAF/.test(q.instructions);
          answers[key] = { type: 'score', score: finance ? n - 1 : 1, confidence: 0.6, legend: Object.fromEntries(q.criteria.map((c: string, i: number) => [i, c])), probabilities: {} };
        }
      }
      return { answers, model: 'clef-test', latencyMs: 1 };
    });
    const j = await judgeDraft(d);
    expect(j.engine).toBe('clef-test');
    expect(j.answerKinds['q1-lasting']).toBe('LASTING'); // confident judge wins
    expect(j.answerKinds['q2-quick']).toBe('LASTING'); // hesitant judge: the author's tag stays
    expect(j.review.find(r => r.element.includes("Script"))?.kept).toBe('judge');
    expect(j.review.find(r => r.element.includes('Correction'))?.kept).toBe('author');
    expect(j.priorities.cfo.financialAcumen).toBe(1);
    expect(j.initiativeKinds.promo).toBe('TRAP'); // confident judge: the author's quick win is a trap
    expect(j.initiativeKinds.pos).toBe('IMPROVEMENT');
    expect(j.startingState.debt).toBe('LOW');
  });
});

describe('Difficulty calibration', () => {
  for (const difficulty of ['ENTRY', 'EXECUTIVE'] as const) {
    it(`${difficulty}: the calibrated case meets its profile`, () => {
      const d = draft();
      const { scenario } = quantify(d, authorJudgment(d), { ...meta, difficulty });
      const { scenario: calibrated, report } = calibrateDifficulty(scenario);
      expect(report.best.verdict).toBe('VICTORY');
      expect(report.cowboy.verdict).not.toBe('VICTORY');
      if (difficulty === 'ENTRY') expect(report.architect.verdict).toBe('VICTORY');
      else expect(report.architect.verdict).not.toBe('VICTORY');
      expect(report.met).toBe(true);
      expect(checkScenarioBalance(calibrated).bestAchievable.verdict).toBe('VICTORY');
    });
  }
});

describe('Authoring pipeline', () => {
  it('writes, completes, judges, quantifies and calibrates', async () => {
    vi.spyOn(SystemOneClient.getInstance(), 'isAvailable').mockReturnValue(false);
    const registry = AIRegistry.getInstance();
    let calls = 0;
    vi.spyOn(registry, 'executeWithFallback').mockImplementation(async (op: any) => {
      calls++;
      const provider = {
        generateStream: async (_m: any, onChunk: (c: string) => void) => {
          const text = JSON.stringify(RAW);
          onChunk(text.slice(0, 20));
          return text;
        },
        // Completion: the author adds the transformation and the trap
        generateJSON: async () => ({
          initiatives: [
            { id: 'erp', name: 'Système unique', kind: 'TRANSFORMATION', size: 'LARGE', category: 'OPERATIONS_EXCELLENCE', affectedNodes: ['stock'] },
            { id: 'force', name: 'Fermer 12 magasins en un mois', kind: 'TRAP', size: 'MEDIUM', category: 'QUICK_WIN', affectedNodes: ['stores'] },
          ],
        }),
      };
      return { result: await op(provider), usedProvider: 'ollama' };
    });
    const stages: string[] = [];
    const { scenario, report } = await runAuthoringPipeline(
      { industry: 'Distribution', businessChallenge: 'Une fusion de distributeurs pour les clients', difficulty: 'EXECUTIVE', domain: 'GENERIC', withMarket: true },
      { onStage: s => stages.push(s) }
    );
    expect(stages).toEqual(['writing', 'completing', 'judging', 'quantifying', 'calibrating']);
    expect(calls).toBe(2);
    expect(report.completions[0]).toEqual(['one TRANSFORMATION initiative', 'one TRAP initiative']);
    expect(report.forced).toEqual([]);
    expect(report.judge).toBe('author-tags');
    expect(report.calibration.met).toBe(true);
    expect(scenario.initiativesCatalog.find(i => i.id === 'force')!.riskLevel).toBe('EXTREME');
  });

  it('reports when no LLM can write', async () => {
    vi.spyOn(AIRegistry.getInstance(), 'executeWithFallback').mockResolvedValue({ result: '{}', usedProvider: 'fallback' } as any);
    await expect(runAuthoringPipeline({ industry: 'x', businessChallenge: 'y' })).rejects.toBeInstanceOf(NoAuthorError);
  });
});

describe('Judge robustness', () => {
  it('keeps the trap the author meant when several initiatives look like traps', () => {
    const d = sanitizeDraft({ ...RAW, initiatives: [...RAW.initiatives, { id: 'shortcut', name: 'Contourner les contrôles', kind: 'TRAP', size: 'MEDIUM', category: 'QUICK_WIN' }] }, 'fr');
    const j = authorJudgment(d);
    j.initiativeKinds.pos = 'TRAP'; // the judge also sees a trap in the first initiative
    j.trapScores = { pos: 0.8, shortcut: 0.6 };
    const { scenario, notes } = quantify(d, j, meta);
    expect(scenario.initiativesCatalog.find(i => i.id === 'shortcut')!.riskLevel).toBe('EXTREME');
    expect(scenario.initiativesCatalog.find(i => i.id === 'pos')!.riskLevel).not.toBe('EXTREME');
    expect(notes.forced.some(f => f.includes('Unifier les caisses'))).toBe(true);
  });

  it("uses the author's view of priorities without System 1", () => {
    const d = sanitizeDraft({ ...RAW, stakeholders: RAW.stakeholders.map((s, i) => (i === 1 ? { ...s, priorities: { finance: 'LOW', speed: 'HIGH', rigour: 'LOW', compliance: 'MEDIUM' } } : s)) }, 'fr');
    const j = authorJudgment(d);
    expect(j.priorities.sales).toEqual({ financialAcumen: 0.2, deliverySpeed: 0.9, architecturalRigor: 0.2, regulatoryCompliance: 0.5 });
  });

  it('a failing System 1 batch only leaves its own elements to the author', async () => {
    vi.spyOn(SystemOneClient.getInstance(), 'isAvailable').mockReturnValue(true);
    let call = 0;
    vi.spyOn(SystemOneClient.getInstance(), 'decide').mockImplementation(async (_s: any, questions: any) => {
      call++;
      if (call <= 2) throw new Error('timeout'); // first batch fails twice
      const answers: Record<string, any> = {};
      for (const [key, q] of Object.entries<any>(questions)) {
        answers[key] =
          q.type === 'choice' ? { type: 'choice', choice: 'LASTING', confidence: 0.9, probabilities: {} }
          : q.type === 'noul' ? { type: 'noul', noul: 0.1 }
          : { type: 'score', score: 2, confidence: 0.5, legend: Object.fromEntries(q.criteria.map((c: string, i: number) => [i, c])), probabilities: {} };
      }
      return { answers, model: 'clef-test', latencyMs: 1 };
    });
    const j = await judgeDraft(draft());
    expect(j.engine).toBe('clef-test (partial)');
    expect(j.answerKinds['q1-quick']).toBe('QUICK_FIX'); // first batch lost: author's tag
    expect(j.answerKinds['q4-quick']).toBe('QUICK_FIX'); // same batch
    expect(j.priorities.cfo.financialAcumen).toBe(0.5); // later batches judged (score 2 of 0..4)
  });
});
