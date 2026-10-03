import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fr } from './fr';
import { en } from './en';
import { GLOSSARY } from './glossary';
import { DOMAIN_VOCABULARY, resolveVocabulary } from '../../../server/src/engine/vocabulary';
import { SEED_SCENARIOS } from '../../../server/src/db/seeds';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

describe('Interface translations', () => {
  it('French and English define the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('every translation uses the same {placeholders} in both languages', () => {
    const mismatches = (Object.keys(fr) as Array<keyof typeof fr>).filter(
      key => placeholders(fr[key]).join(',') !== placeholders(en[key]).join(',')
    );
    expect(mismatches).toEqual([]);
  });

  it('no translation is empty', () => {
    expect(Object.entries(fr).filter(([, v]) => !v.trim())).toEqual([]);
    expect(Object.entries(en).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it('every message code emitted by the engine and server has a translation', () => {
    const serverSrc = path.resolve(__dirname, '../../../server/src');
    const codes = new Set<string>();
    for (const file of listFiles(serverSrc)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/code:\s*'([a-z]+\.[A-Za-z.]+)'/g)) codes.add(m[1]);
      for (const m of text.matchAll(/fail\([^,]+,\s*'([a-z]+\.[A-Za-z]+)'/g)) codes.add(m[1]);
    }
    for (const c of ['reaction.impressed', 'reaction.favorable', 'reaction.cautious', 'reaction.critical']) codes.add(c);
    expect(codes.size).toBeGreaterThan(15);
    expect([...codes].filter(c => !(c in fr))).toEqual([]);
  });

  it('the glossary is complete in both languages', () => {
    for (const entry of GLOSSARY) {
      expect(entry.term.fr && entry.term.en && entry.definition.fr && entry.definition.en).toBeTruthy();
    }
  });
});

describe('Domain vocabulary', () => {
  it('every domain names every metric, layer and posture in both languages', () => {
    for (const domain of Object.values(DOMAIN_VOCABULARY)) {
      for (const vocab of [domain.fr, domain.en]) {
        expect(Object.values(vocab.metrics).every(m => m.label && m.description)).toBe(true);
        expect(Object.values(vocab.layers).every(Boolean)).toBe(true);
        expect(Object.values(vocab.postures).every(p => p.name && p.description)).toBe(true);
      }
    }
  });

  it('uses the scenario wording in its own language and the domain defaults otherwise', () => {
    const plant = SEED_SCENARIOS.find(s => s.id === 'scen-industrial-lyon')!;
    expect(resolveVocabulary(plant, 'fr').metrics.technicalDebtIndex.label).toBe('Vétusté industrielle');
    expect(resolveVocabulary(plant, 'en').metrics.technicalDebtIndex.label).toBe('Asset ageing');
    expect(resolveVocabulary(plant, 'fr').postures.BYPASS_ARCH.name).toMatch(/Cadence forcée/);
    const bank = SEED_SCENARIOS.find(s => s.id === 'scen-fintech-neotitan')!;
    expect(resolveVocabulary(bank, 'fr').metrics.technicalDebtIndex.label).toBe('Dette technique');
  });
});
