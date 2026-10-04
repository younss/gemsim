// ============================================================================
// GEMSIM STUDIO: SYSTEM 2 — THE AUTHOR
// The LLM writes the case and qualifies each element in closed categories; it
// never sets an effect number. Its draft is sanitized here, then judged by
// System 1 and quantified by the engine.
// ============================================================================

import type { EnterpriseLayer, InitiativeCategory, ScenarioCurrency, ScenarioDomain, ScenarioVocabulary } from '../types/index.js';
import { INITIATIVE_CATEGORIES } from '../types/index.js';
import { DOMAIN_GUIDANCE } from '../ai/base.js';
import { CURRENCIES } from '../engine/currency.js';

export type Level = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
export type NodeCondition = 'MODERN' | 'AGEING' | 'FRAGILE' | 'CRITICAL';
export type AnswerKind = 'QUICK_FIX' | 'LASTING' | 'AVOIDANCE';
export type InitiativeKind = 'TRANSFORMATION' | 'IMPROVEMENT' | 'QUICK_WIN' | 'TRAP';
export type Size = 'SMALL' | 'MEDIUM' | 'LARGE';
export type Criterion = 'LOW' | 'MEDIUM' | 'HIGH';
export type Positioning = 'PREMIUM' | 'LOW_COST' | 'LEADER' | 'CHALLENGER';

export const LEVELS: Level[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
export const ANSWER_KINDS: AnswerKind[] = ['QUICK_FIX', 'LASTING', 'AVOIDANCE'];
export const INITIATIVE_KINDS: InitiativeKind[] = ['TRANSFORMATION', 'IMPROVEMENT', 'QUICK_WIN', 'TRAP'];
export const SIZES: Size[] = ['SMALL', 'MEDIUM', 'LARGE'];

export interface CaseDraft {
  title: string;
  industry: string;
  description: string;
  businessContext: string;
  language: 'fr' | 'en';
  currency: ScenarioCurrency;
  vocabulary?: ScenarioVocabulary;
  startingState: { debt: Level; capacity: Level; resilience: Level; compliance: Level; cash: Level }; // severity of each problem
  nodes: Array<{ id: string; name: string; layer: EnterpriseLayer; description: string; condition: NodeCondition; critical: boolean }>;
  edges: Array<{ from: string; to: string; label: string }>;
  stakeholders: Array<{
    id: string;
    name: string;
    title: string;
    role: string;
    personality: string;
    bias: string;
    hiddenAgenda: string;
    greeting: string;
    resistance: string;
    concession: string;
    priorities?: { finance: Criterion; speed: Criterion; rigour: Criterion; compliance: Criterion }; // the author's view
  }>;
  crises: Array<{
    quarter: number;
    title: string;
    description: string;
    severity: 'MEDIUM' | 'HIGH' | 'BLACK_SWAN';
    affectedNodes: string[];
    answers: Array<{ id: string; text: string; kind: AnswerKind; favoredBy: string[]; opposedBy: string[] }>;
  }>;
  initiatives: Array<{
    id: string;
    name: string;
    description: string;
    kind: InitiativeKind;
    size: Size;
    category: InitiativeCategory;
    affectedNodes: string[];
    championedBy: string[];
    opposedBy: string[];
  }>;
  market?: {
    unitCost: number; // currency units per unit sold
    segments: Array<{
      id: string;
      name: string;
      description: string;
      demandPerQuarter: number;
      unitPrice: number; // currency units
      growth: Level;
      price: Criterion;
      quality: Criterion;
      availability: Criterion;
      reliability: Criterion;
      closedAtStart: boolean;
    }>;
    rivals: Array<{ id: string; name: string; positioning: Positioning; segments: string[] }>;
  };
}

export const MINIMUM = { nodes: 6, stakeholders: 4, initiatives: 6, crises: 4, answers: 2 };
const MAX_NODES = 10; // a readable map, and run costs in proportion to the case

export function authorSystemPrompt(domain: ScenarioDomain, withMarket: boolean): string {
  return `You are the author of business-school case studies and executive simulations.
Write a complete, realistic case from the user's brief. You write the STORY and you QUALIFY each element in fixed categories; you never invent effect numbers (a calculation engine sets them from your qualifications).

Rules:
- Write every text in the language of the brief (French brief → French text). Fictional people and fictional companies only; never real brands.
- Domain: ${domain}. ${DOMAIN_GUIDANCE[domain] ?? ''}
- At least ${MINIMUM.nodes} nodes, ${MINIMUM.stakeholders} stakeholders with clearly different priorities (finance, speed, rigour, compliance), exactly ${MINIMUM.crises} crises (one per quarter, quarter 3 is a black swan) with 2 or 3 answers each, and at least ${MINIMUM.initiatives} initiatives.
- Initiatives: at least one TRANSFORMATION (deep, slow, lasting), two or more IMPROVEMENT, at most one QUICK_WIN, and exactly one TRAP (tempting shortcut that backfires). Category must be one of: ${INITIATIVE_CATEGORIES.join(', ')}.
- Crisis answers: each crisis offers a QUICK_FIX (fast, cheap, leaves the root cause) and a LASTING answer (slower, costlier, fixes the cause); a third answer may be AVOIDANCE (ignore, postpone, deny). Say who favours or opposes each answer (stakeholder ids).
- startingState: the SEVERITY of each problem today (LOW, MODERATE, HIGH, SEVERE): debt = how heavily accumulated debt/ageing weighs, capacity = how short the organisation is of delivery capacity, resilience = how fragile it is to shocks, compliance = how serious its compliance/safety problems are, cash = how tight the programme's money is.
- node condition: MODERN, AGEING, FRAGILE or CRITICAL.${withMarket ? `
- Market: 2 to 4 customer segments with demandPerQuarter (units) and unitPrice in plain currency units (e.g. 85 for an 85 € product, not thousands), what customers weigh (price, quality, availability, reliability: LOW, MEDIUM or HIGH), growth level, closedAtStart for a market the company must still enter; 1 to 3 fictional rivals with a positioning (PREMIUM, LOW_COST, LEADER or CHALLENGER) and the segment ids they sell in; unitCost in plain currency units (below every unitPrice).` : ''}
- currency: USD, EUR, GBP, CHF or CAD (the country of the case).
- vocabulary: name the engine metrics in this business's words (keys technicalDebtIndex, deliveryVelocity, stakeholderTrust, resilienceIndex, complianceScore, budgetRemaining, opEx, tco, modernizedNodesCount, each {label, description}), the four layers (BUSINESS, APPLICATION, DATA, INFRASTRUCTURE), the four postures (BYPASS_ARCH = risky shortcut, BALANCED_AGILE = standard, STRICT_GOVERNANCE = strict control, ACCELERATED_MODERN = transformation while delivering, each {name, description}) and nodeNoun.

Output ONLY this JSON (ids are short lowercase slugs):
{
  "title": "", "industry": "", "description": "<2 paragraphs>", "businessContext": "<detailed situation>",
  "language": "fr|en", "currency": "EUR",
  "vocabulary": { "nodeNoun": "", "metrics": {}, "layers": {}, "postures": {} },
  "startingState": { "debt": "HIGH", "capacity": "MODERATE", "resilience": "LOW", "compliance": "MODERATE", "cash": "MODERATE" },
  "nodes": [{ "id": "", "name": "", "layer": "BUSINESS|APPLICATION|DATA|INFRASTRUCTURE", "description": "", "condition": "FRAGILE", "critical": true }],
  "edges": [{ "from": "<node id>", "to": "<node id>", "label": "<what flows>" }],
  "stakeholders": [{ "id": "", "name": "", "title": "", "role": "", "personality": "", "bias": "", "hiddenAgenda": "", "greeting": "", "resistance": "", "concession": "",
     "priorities": { "finance": "LOW|MEDIUM|HIGH", "speed": "", "rigour": "", "compliance": "" } }],
  "crises": [{ "quarter": 1, "title": "", "description": "", "severity": "MEDIUM|HIGH|BLACK_SWAN", "affectedNodes": ["<node id>"],
     "answers": [{ "id": "", "text": "", "kind": "QUICK_FIX|LASTING|AVOIDANCE", "favoredBy": ["<stakeholder id>"], "opposedBy": [] }] }],
  "initiatives": [{ "id": "", "name": "", "description": "", "kind": "TRANSFORMATION|IMPROVEMENT|QUICK_WIN|TRAP", "size": "SMALL|MEDIUM|LARGE",
     "category": "", "affectedNodes": ["<node id>"], "championedBy": ["<stakeholder id>"], "opposedBy": [] }]${withMarket ? `,
  "market": { "unitCost": 0, "segments": [{ "id": "", "name": "", "description": "", "demandPerQuarter": 0, "unitPrice": 0, "growth": "MODERATE",
     "price": "HIGH", "quality": "MEDIUM", "availability": "MEDIUM", "reliability": "LOW", "closedAtStart": false }],
     "rivals": [{ "id": "", "name": "", "positioning": "LOW_COST", "segments": ["<segment id>"] }] }` : ''}
}`;
}

export function authorUserPrompt(prompt: { industry: string; businessChallenge: string; difficulty?: string; customDirectives?: string }): string {
  return `Industry: ${prompt.industry}
Difficulty: ${prompt.difficulty ?? 'INTERMEDIATE'}
Brief:
${prompt.businessChallenge}
${prompt.customDirectives ? `\nAuthor's directives: ${prompt.customDirectives}` : ''}`;
}

/** What the draft still lacks, as instructions for a completion request. */
export function missingParts(draft: CaseDraft, withMarket: boolean): string[] {
  const missing: string[] = [];
  if (draft.nodes.length < MINIMUM.nodes) missing.push(`${MINIMUM.nodes - draft.nodes.length} more nodes`);
  if (draft.stakeholders.length < MINIMUM.stakeholders) missing.push(`${MINIMUM.stakeholders - draft.stakeholders.length} more stakeholders with different priorities`);
  const quarters = new Set(draft.crises.map(c => c.quarter));
  for (let q = 1; q <= MINIMUM.crises; q++) if (!quarters.has(q)) missing.push(`the crisis of quarter ${q}`);
  for (const c of draft.crises) if (c.answers.length < MINIMUM.answers) missing.push(`answers for the crisis "${c.title}" (a QUICK_FIX and a LASTING one)`);
  const kinds = draft.initiatives.map(i => i.kind);
  if (!kinds.includes('TRANSFORMATION')) missing.push('one TRANSFORMATION initiative');
  if (!kinds.includes('TRAP')) missing.push('one TRAP initiative');
  if (draft.initiatives.length < MINIMUM.initiatives) missing.push(`${MINIMUM.initiatives - draft.initiatives.length} more initiatives (IMPROVEMENT)`);
  if (withMarket && (!draft.market || draft.market.segments.length < 2)) missing.push('a market with 2 to 4 segments and 1 to 3 rivals');
  return missing;
}

export function completionPrompt(draft: CaseDraft, missing: string[]): string {
  return `Here is the case so far (JSON). Add ONLY what is missing: ${missing.join('; ')}.
Return a JSON object with only the arrays you add to (nodes, stakeholders, crises, initiatives, market), each containing only the NEW items, in the same format and language. Reuse existing ids when you refer to nodes or stakeholders.

${JSON.stringify({ title: draft.title, language: draft.language, nodes: draft.nodes.map(n => ({ id: n.id, name: n.name })), stakeholders: draft.stakeholders.map(s => ({ id: s.id, name: s.name, title: s.title })), crises: draft.crises.map(c => ({ quarter: c.quarter, title: c.title, answers: c.answers.length })), initiatives: draft.initiatives.map(i => ({ id: i.id, name: i.name, kind: i.kind })) }, null, 1)}`;
}

// ---------------------------------------------------------------------------
// Sanitizing the model's output: keep what is usable, coerce enums, drop junk
// ---------------------------------------------------------------------------

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v.toUpperCase()) ? v.toUpperCase() : fallback) as T;
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const slug = (v: unknown, fallback: string) => (str(v, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || fallback);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : typeof v === 'string' && Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;

function unique<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map(item => {
    let id = item.id;
    for (let n = 2; seen.has(id); n++) id = `${item.id}-${n}`;
    seen.add(id);
    return { ...item, id };
  });
}

export function sanitizeDraft(raw: any, fallbackLanguage: 'fr' | 'en', base?: CaseDraft): CaseDraft {
  const r = raw && typeof raw === 'object' ? raw : {};
  const layers: EnterpriseLayer[] = ['BUSINESS', 'APPLICATION', 'DATA', 'INFRASTRUCTURE'];
  const nodes = unique<CaseDraft['nodes'][number]>(
    (Array.isArray(r.nodes) ? r.nodes : []).slice(0, MAX_NODES).map((n: any, i: number) => ({
      id: slug(n?.id, `node-${i + 1}`),
      name: str(n?.name, 120) || `Node ${i + 1}`,
      layer: pick(n?.layer, layers, layers[i % 4]),
      description: str(n?.description, 400),
      condition: pick(n?.condition, ['MODERN', 'AGEING', 'FRAGILE', 'CRITICAL'] as const, 'AGEING'),
      critical: n?.critical === true,
    }))
  );
  const stakeholders = unique<CaseDraft['stakeholders'][number]>(
    (Array.isArray(r.stakeholders) ? r.stakeholders : []).map((s: any, i: number) => ({
      id: slug(s?.id, `sh-${i + 1}`),
      name: str(s?.name, 80) || `Executive ${i + 1}`,
      title: str(s?.title, 120),
      role: str(s?.role, 160),
      personality: str(s?.personality, 400),
      bias: str(s?.bias, 400),
      hiddenAgenda: str(s?.hiddenAgenda, 400),
      greeting: str(s?.greeting, 300),
      resistance: str(s?.resistance, 300),
      concession: str(s?.concession, 300),
      ...(s?.priorities && typeof s.priorities === 'object'
        ? {
            priorities: {
              finance: pick(s.priorities.finance, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              speed: pick(s.priorities.speed, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              rigour: pick(s.priorities.rigour, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              compliance: pick(s.priorities.compliance, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
            },
          }
        : {}),
    }))
  );
  const crises: CaseDraft['crises'] = (Array.isArray(r.crises) ? r.crises : []).map((c: any, i: number) => ({
    quarter: Math.round(num(c?.quarter, 1, 4, i + 1)),
    title: str(c?.title, 160) || `Crisis ${i + 1}`,
    description: str(c?.description, 600),
    severity: pick(c?.severity, ['MEDIUM', 'HIGH', 'BLACK_SWAN'] as const, 'HIGH'),
    affectedNodes: ids(c?.affectedNodes),
    answers: unique<CaseDraft['crises'][number]['answers'][number]>(
      (Array.isArray(c?.answers) ? c.answers : []).slice(0, 3).map((a: any, j: number) => ({
        id: slug(a?.id, `q${i + 1}-a${j + 1}`),
        text: str(a?.text, 300) || `Option ${j + 1}`,
        kind: pick(a?.kind, ANSWER_KINDS, j === 0 ? 'LASTING' : 'QUICK_FIX'),
        favoredBy: ids(a?.favoredBy),
        opposedBy: ids(a?.opposedBy),
      }))
    ),
  }));
  const initiatives = unique<CaseDraft['initiatives'][number]>(
    (Array.isArray(r.initiatives) ? r.initiatives : []).map((it: any, i: number) => ({
      id: slug(it?.id, `init-${i + 1}`),
      name: str(it?.name, 120) || `Initiative ${i + 1}`,
      description: str(it?.description, 400),
      kind: pick(it?.kind, INITIATIVE_KINDS, 'IMPROVEMENT'),
      size: pick(it?.size, SIZES, 'MEDIUM'),
      category: pick(it?.category, INITIATIVE_CATEGORIES, 'OPERATIONS_EXCELLENCE') as InitiativeCategory,
      affectedNodes: ids(it?.affectedNodes),
      championedBy: ids(it?.championedBy),
      opposedBy: ids(it?.opposedBy),
    }))
  );
  const m = r.market;
  const market =
    m && Array.isArray(m.segments) && m.segments.length
      ? {
          unitCost: num(m.unitCost, 0.01, 10_000_000, 0),
          segments: unique<NonNullable<CaseDraft['market']>['segments'][number]>(
            m.segments.slice(0, 4).map((g: any, i: number) => ({
              id: slug(g?.id, `seg-${i + 1}`),
              name: str(g?.name, 120) || `Segment ${i + 1}`,
              description: str(g?.description, 300),
              demandPerQuarter: num(g?.demandPerQuarter, 10, 10_000_000, 1000),
              unitPrice: num(g?.unitPrice, 0.01, 100_000_000, 100),
              growth: pick(g?.growth, LEVELS, 'MODERATE'),
              price: pick(g?.price, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              quality: pick(g?.quality, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              availability: pick(g?.availability, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              reliability: pick(g?.reliability, ['LOW', 'MEDIUM', 'HIGH'] as const, 'MEDIUM'),
              closedAtStart: g?.closedAtStart === true,
            }))
          ),
          rivals: unique<NonNullable<CaseDraft['market']>['rivals'][number]>(
            (Array.isArray(m.rivals) ? m.rivals : []).slice(0, 3).map((v: any, i: number) => ({
              id: slug(v?.id, `riv-${i + 1}`),
              name: str(v?.name, 120) || `Rival ${i + 1}`,
              positioning: pick(v?.positioning, ['PREMIUM', 'LOW_COST', 'LEADER', 'CHALLENGER'] as const, 'CHALLENGER'),
              segments: ids(v?.segments),
            }))
          ),
        }
      : undefined;

  const merged: CaseDraft = {
    title: str(r.title, 200) || base?.title || '',
    industry: str(r.industry, 200) || base?.industry || '',
    description: str(r.description, 3000) || base?.description || '',
    businessContext: str(r.businessContext, 4000) || base?.businessContext || '',
    language: r.language === 'fr' || r.language === 'en' ? r.language : base?.language ?? fallbackLanguage,
    currency: CURRENCIES.includes(r.currency) ? r.currency : base?.currency ?? (fallbackLanguage === 'fr' ? 'EUR' : 'USD'),
    vocabulary: r.vocabulary && typeof r.vocabulary === 'object' ? r.vocabulary : base?.vocabulary,
    startingState: {
      debt: pick(r.startingState?.debt, LEVELS, base?.startingState.debt ?? 'HIGH'),
      capacity: pick(r.startingState?.capacity, LEVELS, base?.startingState.capacity ?? 'MODERATE'),
      resilience: pick(r.startingState?.resilience, LEVELS, base?.startingState.resilience ?? 'MODERATE'),
      compliance: pick(r.startingState?.compliance, LEVELS, base?.startingState.compliance ?? 'MODERATE'),
      cash: pick(r.startingState?.cash, LEVELS, base?.startingState.cash ?? 'MODERATE'),
    },
    nodes: base ? unique([...base.nodes, ...nodes]).slice(0, MAX_NODES) : nodes,
    edges: [
      ...(base?.edges ?? []),
      ...(Array.isArray(r.edges) ? r.edges : []).map((e: any) => ({ from: str(e?.from, 60), to: str(e?.to, 60), label: str(e?.label, 80) })),
    ],
    stakeholders: base ? unique([...base.stakeholders, ...stakeholders]) : stakeholders,
    crises: base ? [...base.crises, ...crises.filter((c: CaseDraft['crises'][number]) => !base.crises.some(b => b.quarter === c.quarter))] : crises,
    initiatives: base ? unique([...base.initiatives, ...initiatives]) : initiatives,
    market: market ?? base?.market,
  };
  return merged;
}
