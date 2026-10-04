import { describe, it, expect } from 'vitest';
import { buildTeachingNote } from '../src/docs/teaching-note.js';
import { SEED_SCENARIOS } from '../src/db/seeds.js';
import { FallbackProvider } from '../src/ai/fallback.js';
import { StudioScenarioGenerator } from '../src/ai/studio-generator.js';

describe('Automatic teaching notes', () => {
  for (const scenario of SEED_SCENARIOS) {
    for (const lang of ['fr', 'en'] as const) {
      it(`${scenario.id} (${lang}): complete note with the winning path`, () => {
        const note = buildTeachingNote(scenario, lang);
        const c = note.content;
        expect(c.startsWith('# ')).toBe(true);
        // Every section is present
        const sections = lang === 'fr'
          ? ['Objectifs pédagogiques', 'Les tensions du cas', 'Agendas cachés', 'Les pièges', 'Les crises', 'Le chemin gagnant', 'stratégies typiques', 'Plan de séance', 'Questions de débriefing']
          : ['Learning objectives', 'Tensions in the case', 'Hidden agendas', 'Traps', 'Crises', 'The winning path', 'typical strategies', 'Session plan', 'debrief questions'];
        for (const section of sections) expect(c).toContain(section);
        // Each executive's hidden agenda, each crisis and one line per quarter of the winning path
        for (const sh of scenario.stakeholders) expect(c).toContain(sh.hiddenAgenda);
        for (const event of scenario.roundEvents) expect(c).toContain(event.title);
        const pathLines = c.split('\n').filter(l => /^- \*\*[TQ]\d\*\* ?:/.test(l));
        expect(pathLines).toHaveLength(scenario.totalRounds || 4);
        // The market section only for market cases
        expect(c.includes(lang === 'fr' ? '## Le marché' : '## The market')).toBe(!!scenario.market);
        // No untranslated engine ids leak into the text
        expect(c).not.toMatch(/BYPASS_ARCH|ACCELERATED_MODERN|riskLevel|undefined|NaN/);
      });
    }
  }

  it('works for a Studio-generated case', () => {
    const prompt = { industry: 'Logistique', businessChallenge: 'Un transporteur régional doit moderniser ses entrepôts face à un concurrent.', domain: 'GENERIC' as const, withMarket: true };
    const scenario = StudioScenarioGenerator.validateAndEnrich(FallbackProvider.createDynamicScenario(prompt), prompt, 'fallback');
    const note = buildTeachingNote(scenario, 'fr');
    expect(note.content).toContain('Le chemin gagnant');
    expect(note.content).toContain('## Le marché');
  });
});
