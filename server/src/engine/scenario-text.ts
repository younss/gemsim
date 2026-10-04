// ============================================================================
// GEMSIM: SCENARIO TEXT & TRANSLATIONS
// A scenario's readable text as a flat map of paths (title, nodes.<id>.name,
// events.<i>.choices.<id>.text...), so a model can translate it piece by piece
// and the result can be checked: same paths, text only, nothing else changes.
// Translations are stored on the scenario with a fingerprint of the source text;
// a stale translation (the source changed) is ignored. Pure module (shared).
// ============================================================================

import type { Scenario, ScenarioTranslation } from '../types/index.js';

export type TextPack = Record<string, string>;
type Lang = 'fr' | 'en';

const put = (pack: TextPack, path: string, value: unknown) => {
  if (typeof value === 'string' && value.trim()) pack[path] = value;
};

/** Every readable text of the scenario, by path. Ids, numbers and people's names are not text. */
export function extractText(scenario: Scenario): TextPack {
  const p: TextPack = {};
  put(p, 'title', scenario.title);
  put(p, 'industry', scenario.industry);
  put(p, 'description', scenario.description);
  put(p, 'businessContext', scenario.businessContext);

  const v = scenario.vocabulary;
  if (v) {
    put(p, 'vocabulary.nodeNoun', v.nodeNoun);
    for (const [k, m] of Object.entries(v.metrics ?? {})) {
      put(p, `vocabulary.metrics.${k}.label`, m?.label);
      put(p, `vocabulary.metrics.${k}.description`, m?.description);
    }
    for (const [k, label] of Object.entries(v.layers ?? {})) put(p, `vocabulary.layers.${k}`, label);
    for (const [k, posture] of Object.entries(v.postures ?? {})) {
      put(p, `vocabulary.postures.${k}.name`, posture?.name);
      put(p, `vocabulary.postures.${k}.description`, posture?.description);
    }
  }

  for (const n of scenario.topology.nodes) {
    put(p, `nodes.${n.id}.name`, n.name);
    put(p, `nodes.${n.id}.description`, n.description);
  }
  for (const e of scenario.topology.edges) put(p, `edges.${e.id}.protocol`, e.protocol);

  for (const s of scenario.stakeholders) {
    for (const f of ['title', 'role', 'personality', 'bias', 'hiddenAgenda'] as const) put(p, `stakeholders.${s.id}.${f}`, s[f]);
    for (const f of ['greeting', 'resistance', 'concession'] as const) put(p, `stakeholders.${s.id}.sampleDialogue.${f}`, s.sampleDialogue?.[f]);
  }

  scenario.roundEvents.forEach((e, i) => {
    put(p, `events.${i}.title`, e.title);
    put(p, `events.${i}.description`, e.description);
    for (const c of e.choices) put(p, `events.${i}.choices.${c.id}.text`, c.text);
  });

  for (const init of scenario.initiativesCatalog) {
    put(p, `initiatives.${init.id}.name`, init.name);
    put(p, `initiatives.${init.id}.description`, init.description);
  }

  if (scenario.market) {
    for (const seg of scenario.market.segments) {
      put(p, `market.segments.${seg.id}.name`, seg.name);
      put(p, `market.segments.${seg.id}.description`, seg.description);
    }
    for (const r of scenario.market.rivals) put(p, `market.rivals.${r.id}.name`, r.name);
  }
  return p;
}

/** Fingerprint of the source text (FNV-1a over the sorted paths and values). */
export function textHash(pack: TextPack): string {
  let h = 0x811c9dc5;
  for (const key of Object.keys(pack).sort()) {
    const s = `${key}\u0000${pack[key]}\u0001`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Problems with a translation: missing or extra paths, empty values, or digits
 * that changed (a translation must not alter a figure written in the text).
 */
export function validateTranslation(source: TextPack, translated: unknown): string[] {
  if (!translated || typeof translated !== 'object') return ['not an object'];
  const t = translated as Record<string, unknown>;
  const issues: string[] = [];
  for (const key of Object.keys(source)) {
    const value = t[key];
    if (typeof value !== 'string' || !value.trim()) {
      issues.push(`missing ${key}`);
      continue;
    }
    const digits = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');
    if (digits(source[key]) !== digits(value)) issues.push(`figures changed in ${key}`);
  }
  for (const key of Object.keys(t)) if (!(key in source)) issues.push(`unexpected ${key}`);
  return issues;
}

function setText(scenario: Scenario, path: string, value: string) {
  const [head, ...rest] = path.split('.');
  const byId = <T extends { id: string }>(list: T[] | undefined, id: string) => list?.find(x => x.id === id);
  switch (head) {
    case 'title':
    case 'industry':
    case 'description':
    case 'businessContext':
      (scenario as any)[head] = value;
      return;
    case 'vocabulary': {
      const v = (scenario.vocabulary ??= {});
      if (rest[0] === 'nodeNoun') v.nodeNoun = value;
      else if (rest[0] === 'layers') (v.layers ??= {})[rest[1] as keyof NonNullable<typeof v.layers>] = value;
      else if (rest[0] === 'metrics') {
        const metrics = (v.metrics ??= {}) as Record<string, { label: string; description?: string }>;
        const m = (metrics[rest[1]] ??= { label: value });
        (m as any)[rest[2]] = value;
      } else if (rest[0] === 'postures') {
        const postures = (v.postures ??= {}) as Record<string, { name: string; description?: string }>;
        const po = (postures[rest[1]] ??= { name: value });
        (po as any)[rest[2]] = value;
      }
      return;
    }
    case 'nodes': {
      const n = byId(scenario.topology.nodes, rest[0]);
      if (n) (n as any)[rest[1]] = value;
      return;
    }
    case 'edges': {
      const e = byId(scenario.topology.edges, rest[0]);
      if (e) e.protocol = value;
      return;
    }
    case 'stakeholders': {
      const s = byId(scenario.stakeholders, rest[0]);
      if (!s) return;
      if (rest[1] === 'sampleDialogue') (s.sampleDialogue as any)[rest[2]] = value;
      else (s as any)[rest[1]] = value;
      return;
    }
    case 'events': {
      const e = scenario.roundEvents[Number(rest[0])];
      if (!e) return;
      if (rest[1] === 'choices') {
        const c = byId(e.choices, rest[2]);
        if (c) c.text = value;
      } else (e as any)[rest[1]] = value;
      return;
    }
    case 'initiatives': {
      const i = byId(scenario.initiativesCatalog, rest[0]);
      if (i) (i as any)[rest[1]] = value;
      return;
    }
    case 'market': {
      if (!scenario.market) return;
      if (rest[0] === 'segments') {
        const s = byId(scenario.market.segments, rest[1]);
        if (s) (s as any)[rest[2]] = value;
      } else if (rest[0] === 'rivals') {
        const r = byId(scenario.market.rivals, rest[1]);
        if (r) r.name = value;
      }
      return;
    }
  }
}

/** A copy of the scenario with the given texts applied. */
export function applyText(scenario: Scenario, texts: TextPack): Scenario {
  const copy: Scenario = JSON.parse(JSON.stringify(scenario));
  for (const [path, value] of Object.entries(texts)) setText(copy, path, value);
  return copy;
}

/** Whether a stored translation still matches the scenario's current text. */
export function translationStatus(scenario: Scenario, lang: Lang): 'ORIGINAL' | 'TRANSLATED' | 'STALE' | 'MISSING' {
  if (!scenario.language || scenario.language === lang) return 'ORIGINAL';
  const t: ScenarioTranslation | undefined = scenario.translations?.[lang];
  if (!t) return 'MISSING';
  return t.sourceHash === textHash(extractText(scenario)) ? 'TRANSLATED' : 'STALE';
}

const cache = new WeakMap<Scenario, Partial<Record<Lang, Scenario>>>();

/** The scenario in the reader's language when an up-to-date translation exists; ids and numbers never change. */
export function localizeScenario<S extends Scenario | null | undefined>(scenario: S, lang: Lang): S {
  if (!scenario || translationStatus(scenario, lang) !== 'TRANSLATED') return scenario;
  const entry = cache.get(scenario) ?? {};
  if (!entry[lang]) {
    entry[lang] = { ...applyText(scenario, scenario.translations![lang]!.texts), language: lang };
    cache.set(scenario, entry);
  }
  return entry[lang] as S;
}
