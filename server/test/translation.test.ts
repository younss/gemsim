import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractText, applyText, textHash, validateTranslation, localizeScenario, translationStatus } from '../src/engine/scenario-text.js';
import { translateScenario, NoTranslatorError } from '../src/ai/scenario-translator.js';
import { AIRegistry } from '../src/ai/registry.js';
import { checkScenarioBalance } from '../src/engine/balance.js';
import { resolveVocabulary } from '../src/engine/vocabulary.js';
import { SEED_SCENARIOS } from '../src/db/seeds.js';
import { Scenario } from '../src/types/index.js';

const plant = SEED_SCENARIOS.find(s => s.id === 'scen-industrial-lyon')!;
const dumas = SEED_SCENARIOS.find(s => s.id === 'scen-expansion-dumas')!;

/** A fake "translation": prefixes every text, keeps figures. */
const fakeTranslate = (pack: Record<string, string>) => Object.fromEntries(Object.entries(pack).map(([k, v]) => [k, `EN ${v}`]));

afterEach(() => vi.restoreAllMocks());

describe('Scenario text', () => {
  it('extracts every readable text and applies it back without changing anything else', () => {
    const pack = extractText(dumas);
    expect(pack.title).toBe(dumas.title);
    expect(pack['initiatives.exp-init-erp.name']).toBe('ERP multi-pays et stocks unifiés');
    expect(pack['market.segments.seg-exp-de.name']).toBe('Allemagne');
    expect(Object.keys(pack).length).toBeGreaterThan(80);
    // People's names, ids and numbers are not text
    expect(Object.values(pack)).not.toContain('Hélène Dumas');
    expect(applyText(dumas, pack)).toEqual(JSON.parse(JSON.stringify(dumas)));
  });

  it('rejects translations that drop paths, add paths or change figures', () => {
    const source = { a: 'Ligne A (1998) à 85 %', b: 'Texte' };
    expect(validateTranslation(source, { a: 'Line A (1998) at 85%', b: 'Text' })).toEqual([]);
    expect(validateTranslation(source, { a: 'Line A (1999) at 85%', b: 'Text' })).toEqual(['figures changed in a']);
    expect(validateTranslation(source, { a: 'Line A (1998) at 85%' })).toEqual(['missing b']);
    expect(validateTranslation(source, { a: 'Line A (1998) at 85%', b: 'Text', c: 'x' })).toEqual(['unexpected c']);
  });

  it('localizes a scenario only with an up-to-date translation, and the game is unchanged', () => {
    const source = extractText(plant);
    const translated: Scenario = {
      ...plant,
      translations: { en: { sourceHash: textHash(source), texts: fakeTranslate(source), translatedAt: '' } },
    };
    expect(translationStatus(translated, 'fr')).toBe('ORIGINAL');
    expect(translationStatus(translated, 'en')).toBe('TRANSLATED');
    const en = localizeScenario(translated, 'en');
    expect(en.title).toBe(`EN ${plant.title}`);
    expect(en.language).toBe('en');
    // The scenario's own vocabulary now applies in English
    expect(resolveVocabulary(en, 'en').metrics.technicalDebtIndex.label).toBe(`EN ${plant.vocabulary!.metrics!.technicalDebtIndex!.label}`);
    // Ids, numbers and the balance are untouched
    expect(en.initiativesCatalog.map(i => [i.id, i.capExCost, i.tdiDelta])).toEqual(plant.initiativesCatalog.map(i => [i.id, i.capExCost, i.tdiDelta]));
    expect(checkScenarioBalance(en).bestAchievable).toEqual(checkScenarioBalance(plant).bestAchievable);
    // Same object for repeated renders
    expect(localizeScenario(translated, 'en')).toBe(en);

    // The source text changed: the translation is stale and ignored
    const edited = { ...translated, title: 'Nouveau titre' };
    expect(translationStatus(edited, 'en')).toBe('STALE');
    expect(localizeScenario(edited, 'en')).toBe(edited);
    expect(translationStatus(plant, 'en')).toBe('MISSING');
  });
});

describe('Studio translator', () => {
  it('translates chunk by chunk through the active model and validates each chunk', async () => {
    let calls = 0;
    vi.spyOn(AIRegistry.getInstance(), 'executeWithFallback').mockImplementation(async (op: any) => {
      calls++;
      const fakeProvider = {
        generateJSON: async (messages: any[]) => {
          const user: string = messages[1].content;
          return fakeTranslate(JSON.parse(user.slice(0, user.lastIndexOf('}') + 1)));
        },
      };
      return { result: await op(fakeProvider), usedProvider: 'ollama' } as any;
    });
    const progress: number[] = [];
    const t = await translateScenario(dumas, 'en', done => progress.push(done));
    const source = extractText(dumas);
    expect(Object.keys(t.texts).sort()).toEqual(Object.keys(source).sort());
    expect(t.sourceHash).toBe(textHash(source));
    expect(calls).toBe(Math.ceil(Object.keys(source).length / 25));
    expect(progress[progress.length - 1]).toBe(calls);
  });

  it('retries the rejected texts, then rejects a translation that keeps changing figures', async () => {
    let calls = 0;
    vi.spyOn(AIRegistry.getInstance(), 'executeWithFallback').mockImplementation(async (op: any) => {
      calls++;
      const fakeProvider = { generateJSON: async () => ({ title: 'Plant 2024' }) };
      return { result: await op(fakeProvider), usedProvider: 'ollama' } as any;
    });
    await expect(translateScenario(plant, 'en')).rejects.toThrow(/Translation rejected/);
    expect(calls).toBe(3);
  });

  it('keeps the valid texts and asks again only for the missing ones', async () => {
    const asked: number[] = [];
    vi.spyOn(AIRegistry.getInstance(), 'executeWithFallback').mockImplementation(async (op: any) => {
      const fakeProvider = {
        generateJSON: async (messages: any[]) => {
          const user: string = messages[1].content;
          const pack = JSON.parse(user.slice(0, user.lastIndexOf('}') + 1)) as Record<string, string>;
          asked.push(Object.keys(pack).length);
          // First answer drops every other key
          const keys = Object.keys(pack);
          const answer = keys.length === 25 ? keys.filter((_, i) => i % 2 === 0) : keys;
          return Object.fromEntries(answer.map(k => [k, `EN ${pack[k]}`]));
        },
      };
      return { result: await op(fakeProvider), usedProvider: 'ollama' } as any;
    });
    const t = await translateScenario(dumas, 'en');
    expect(Object.keys(t.texts).sort()).toEqual(Object.keys(extractText(dumas)).sort());
    expect(asked).toContain(12); // the second request only carried the missing texts
  });

  it('refuses to "translate" with the heuristic fallback', async () => {
    vi.spyOn(AIRegistry.getInstance(), 'executeWithFallback').mockResolvedValue({ result: {}, usedProvider: 'fallback' } as any);
    await expect(translateScenario(plant, 'en')).rejects.toBeInstanceOf(NoTranslatorError);
  });
});

describe('Quarter labels', () => {
  it('follow the target language', async () => {
    vi.spyOn(AIRegistry.getInstance(), 'executeWithFallback').mockImplementation(async (op: any) => {
      const fakeProvider = {
        generateJSON: async (messages: any[]) => {
          const user: string = messages[1].content;
          const pack = JSON.parse(user.slice(0, user.lastIndexOf('}') + 1));
          return Object.fromEntries(Object.entries(pack).map(([k, v]) => [k, k.startsWith('events.0.title') ? 'Q1: Neobank strikes' : v]));
        },
      };
      return { result: await op(fakeProvider), usedProvider: 'ollama' } as any;
    });
    const bank = SEED_SCENARIOS.find(s => s.id === 'scen-fintech-neotitan')!;
    const t = await translateScenario(bank, 'fr');
    expect(t.texts['events.0.title']).toBe('T1 : Neobank strikes');
  });
});

describe('Currency', () => {
  it('rewrites amounts into the scenario currency', async () => {
    const { withCurrency, currencySuffix, formatMoney } = await import('../src/engine/currency.js');
    expect(currencySuffix(plant)).toBe('K€');
    expect(currencySuffix(SEED_SCENARIOS.find(s => s.id === 'scen-fintech-neotitan')!)).toBe('K$');
    expect(withCurrency('Coût : 350K$ par trimestre', 'K€')).toBe('Coût : 350K€ par trimestre');
    expect(withCurrency('revenue $1,889K, profit $-491K', 'K€')).toBe('revenue 1,889K€, profit -491K€');
    expect(withCurrency('350K$', 'K$')).toBe('350K$');
    expect(formatMoney(1700, 'fr', 'K€').replace(/\s/g, ' ')).toBe('1 700K€');
    expect(formatMoney(1700, 'en', 'K$')).toBe('1,700K$');
  });

  it('teaching notes show the case currency', async () => {
    const { buildTeachingNote } = await import('../src/docs/teaching-note.js');
    const note = buildTeachingNote(plant, 'fr').content;
    expect(note).toContain('K€');
    expect(note).not.toContain('K$');
  });
});
