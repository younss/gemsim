// ============================================================================
// GEMSIM: AUTOMATIC TEACHING NOTES
// A case teaching note (Harvard-style) generated from the scenario itself and
// from what the engine finds when it plays it: objectives, tensions between
// executives, traps, crisis dilemmas, the winning path, typical mistakes, a
// session plan and case-specific debrief questions. Works for Studio cases too.
// ============================================================================

import type { Scenario, StakeholderPersona, Team } from '../types/index.js';
import { resolveVocabulary, type Lang } from '../engine/vocabulary.js';
import { evaluateOutcome } from '../engine/outcome.js';
import { playTournament, searchBestTeam, simulateStrategy, type BotStrategy } from '../engine/balance.js';
import { priceIndex } from '../engine/coach.js';
import { getRunAllocation } from '../engine/resolver.js';
import { DEFAULT_MAX_INITIATIVES_PER_ROUND } from '../engine/rules.js';
import { currencySuffix, withCurrency } from '../engine/currency.js';

type Weight = keyof StakeholderPersona['decisionWeights'];

const TEXT = {
  fr: {
    title: (t: string) => `Note pédagogique — ${t}`,
    colon: ' : ',
    quote: (x: string) => `« ${x} »`,
    summary: 'Note pour l’animateur : objectifs, tensions, pièges, chemin gagnant et questions de débriefing, générés à partir du cas et du moteur.',
    confidential: '> Document réservé à l’animateur : il révèle les agendas cachés et le chemin gagnant.',
    synopsis: 'Synopsis',
    meta: (industry: string, difficulty: string, rounds: number, teams: string) => `**Secteur** : ${industry} · **Difficulté** : ${difficulty} · **Durée** : ${rounds} trimestres · **Format conseillé** : ${teams}`,
    teams: '1 à 5 équipes de 3 à 5 personnes',
    objectivesTitle: 'Objectifs pédagogiques',
    objectives: (v: Vocab, people: string, market: boolean) => [
      `Comprendre comment l’indicateur « ${v.debt} » se compose d’un trimestre à l’autre et freine l’indicateur « ${v.velocity} ».`,
      'Arbitrer entre budget de transformation et coûts récurrents (fonctionnement contre transformation).',
      `Négocier avec des décideurs aux intérêts divergents (${people}) et obtenir un mandat du conseil.`,
      'Décider sous incertitude face à une crise par trimestre, entre réponse rapide et réponse durable.',
      `Choisir une posture de gouvernance : vitesse immédiate contre ${v.resilience.toLowerCase()} et ${v.compliance.toLowerCase()}.`,
      ...(market ? ['Relier les capacités de l’organisation à sa compétitivité : prix, qualité, capacité et fiabilité face aux concurrents, et l’effet du prix sur la marge.'] : []),
    ],
    targetsTitle: 'Ce que les équipes doivent atteindre',
    targetsHead: '| Objectif | Cible | Départ |\n| --- | --- | --- |',
    rulesTitle: 'Paramètres clés',
    rules: (cash: number, capacity: number, run: number) =>
      `Trésorerie de départ **${cash}K$**, **${capacity}** initiatives par trimestre au maximum, budget de fonctionnement financé par le métier **${run}K$** par trimestre.`,
    tensionsTitle: 'Les tensions du cas',
    tension: (a: string, wa: string, b: string, wb: string) => `**${a}** (priorité : ${wa}) et **${b}** (priorité : ${wb}) tirent dans des directions opposées : une proposition qui plaît à l’un déplaît souvent à l’autre.`,
    agendasTitle: 'Agendas cachés (à ne pas révéler)',
    trapsTitle: 'Les pièges',
    trap: (name: string, risk: string, d: string) => `**${name}** (risque ${risk}) : ${d}. Séduisant au premier trimestre, coûteux ensuite.`,
    risk: { LOW: 'faible', MEDIUM: 'moyen', HIGH: 'élevé', EXTREME: 'extrême' } as Record<string, string>,
    trapEffects: (v: Vocab, tdi: number, vel: number, comp: number, res: number) =>
      `${v.debt} ${sign(tdi)}, ${v.velocity} ${sign(vel)}, ${v.compliance} ${sign(comp)}, ${v.resilience} ${sign(res)}`,
    postureTrap: (name: string) => `La posture **${name}** donne un gain immédiat mais fait exploser la dette, la non-conformité et les incidents.`,
    crisesTitle: 'Les crises, trimestre par trimestre',
    choiceLine: (text: string, capex: number, tdi: number, vel: number, v: Vocab) => `« ${text} » : ${capex}K$, ${v.debt} ${sign(tdi)}, ${v.velocity} ${sign(vel)}`,
    durable: 'la plus durable',
    cheap: 'la moins chère',
    noAnswer: (fine: number) => `Sans réponse : ${fine}K$ d’impact par défaut.`,
    pathTitle: 'Le chemin gagnant trouvé par le moteur',
    pathIntro: (verdict: string) => `Le moteur explore les combinaisons de décisions trimestre par trimestre. Meilleur résultat trouvé : **${verdict}**. Ce n’est pas la seule voie, mais il montre ce qui est atteignable.`,
    quarter: (n: number) => `**T${n}**`,
    posture: 'posture',
    initiatives: 'initiatives',
    none: 'aucune',
    crisis: 'crise',
    price: (i: number) => `prix à ${i} % de la référence`,
    enter: (list: string) => `entrée sur ${list}`,
    strategiesTitle: 'Ce que donnent les stratégies typiques',
    strategiesHead: '| Stratégie | Jouée seule | Sur un marché partagé |\n| --- | --- | --- |',
    strategy: { ARCHITECT: 'Disciplinée (modernise d’abord)', PRUDENT: 'Prudente (une petite initiative par trimestre)', COWBOY: 'Raccourcis (vitesse et prix bas)' } as Record<BotStrategy, string>,
    mistakesTitle: 'Erreurs fréquentes',
    mistakes: (v: Vocab, market: boolean) => [
      `Tout miser sur la vitesse au premier trimestre : « ${v.debt} » et les incidents rattrapent l’équipe au trimestre 3.`,
      'Investir trop peu par prudence : la dette se compose et les objectifs restent hors d’atteinte.',
      'Présenter au conseil sans avoir préparé les décideurs en individuel.',
      'Ne garder aucune marge de trésorerie pour la crise du trimestre.',
      ...(market ? ['Baisser les prix pour gagner de la part sans regarder la marge, ou ouvrir des marchés sans la capacité de les servir.'] : []),
    ],
    marketTitle: 'Le marché',
    segment: (name: string, demand: string, price: string, criteria: string, closed: string) => `**${name}** : ${demand} unités/trimestre au prix de référence ${price}K$ ; les clients regardent surtout ${criteria}${closed}.`,
    closed: (cost: number) => ` (fermé au départ, entrée ${cost}K$)`,
    rivals: (list: string) => `Concurrents simulés : ${list}.`,
    criteria: { priceSensitivity: 'le prix', qualitySensitivity: 'la qualité', speedSensitivity: 'la disponibilité', reliabilitySensitivity: 'la fiabilité' } as Record<string, string>,
    planTitle: 'Plan de séance',
    plan: (rounds: number) => [
      '**Ouverture (20 min)** : dossier de cas, tutoriel ou démo commentée, constitution des équipes.',
      `**${rounds} trimestres (30 min chacun)** : 10 min de négociation, 15 min de décision, 5 min de lecture du compte rendu et du coach.`,
      '**Débriefing (40 min)** : débriefing automatique du cockpit, « Et si… ? » sur un trimestre clé, questions ci-dessous.',
    ],
    questionsTitle: 'Questions de débriefing propres au cas',
    qTrap: (name: string) => `Qui a choisi « ${name} » ? Qu’a-t-il rapporté au premier trimestre, et qu’a-t-il coûté ensuite ?`,
    qCrisis: (title: string) => `Face à « ${title} », avez-vous choisi la réponse rapide ou la réponse durable, et pourquoi ?`,
    qConflict: (a: string, b: string) => `Comment avez-vous concilié ${a} et ${b} ? Qui avez-vous dû décevoir ?`,
    qPath: (list: string) => `Le moteur gagne en commençant par ${list}. Pourquoi ce premier choix est-il si efficace ?`,
    qMarket: 'Votre part de marché a-t-elle été gagnée par le prix ou par la qualité, la capacité et la fiabilité ? Qu’est-ce que cela a fait à votre marge ?',
    weights: { financialAcumen: 'finance', deliverySpeed: 'vitesse', architecturalRigor: 'rigueur', regulatoryCompliance: 'conformité' } as Record<Weight, string>,
    verdicts: { VICTORY: 'Victoire', PARTIAL: 'Victoire partielle', DEFEAT: 'Défaite' } as Record<string, string>,
    difficulty: { ENTRY: 'Découverte', INTERMEDIATE: 'Intermédiaire', EXECUTIVE: 'Dirigeant', CRISIS_CHIEF: 'Cellule de crise' } as Record<string, string>,
  },
  en: {
    title: (t: string) => `Teaching note — ${t}`,
    colon: ': ',
    quote: (x: string) => `"${x}"`,
    summary: 'For the facilitator: objectives, tensions, traps, winning path and debrief questions, generated from the case and the engine.',
    confidential: '> Facilitator only: this document reveals the hidden agendas and the winning path.',
    synopsis: 'Synopsis',
    meta: (industry: string, difficulty: string, rounds: number, teams: string) => `**Industry**: ${industry} · **Difficulty**: ${difficulty} · **Length**: ${rounds} quarters · **Suggested format**: ${teams}`,
    teams: '1 to 5 teams of 3 to 5 people',
    objectivesTitle: 'Learning objectives',
    objectives: (v: Vocab, people: string, market: boolean) => [
      `Understand how "${v.debt}" compounds from quarter to quarter and slows "${v.velocity}".`,
      'Trade off the change budget against recurring costs (run versus change).',
      `Negotiate with executives whose interests diverge (${people}) and win a board mandate.`,
      'Decide under uncertainty when a crisis hits every quarter: quick fix or lasting answer.',
      `Choose a governance posture: immediate speed versus ${v.resilience.toLowerCase()} and ${v.compliance.toLowerCase()}.`,
      ...(market ? ['Link organisational capabilities to competitiveness: price, quality, capacity and reliability against competitors, and what price does to margin.'] : []),
    ],
    targetsTitle: 'What teams must reach',
    targetsHead: '| Objective | Target | Start |\n| --- | --- | --- |',
    rulesTitle: 'Key parameters',
    rules: (cash: number, capacity: number, run: number) =>
      `Starting cash **${cash}K$**, at most **${capacity}** initiatives per quarter, run budget funded by the business **${run}K$** per quarter.`,
    tensionsTitle: 'Tensions in the case',
    tension: (a: string, wa: string, b: string, wb: string) => `**${a}** (priority: ${wa}) and **${b}** (priority: ${wb}) pull in opposite directions: a proposal that pleases one often displeases the other.`,
    agendasTitle: 'Hidden agendas (do not reveal)',
    trapsTitle: 'Traps',
    trap: (name: string, risk: string, d: string) => `**${name}** (${risk} risk): ${d}. Tempting in the first quarter, costly afterwards.`,
    risk: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', EXTREME: 'extreme' } as Record<string, string>,
    trapEffects: (v: Vocab, tdi: number, vel: number, comp: number, res: number) =>
      `${v.debt} ${sign(tdi)}, ${v.velocity} ${sign(vel)}, ${v.compliance} ${sign(comp)}, ${v.resilience} ${sign(res)}`,
    postureTrap: (name: string) => `The **${name}** posture gives an immediate gain but makes debt, non-compliance and incidents explode.`,
    crisesTitle: 'Crises, quarter by quarter',
    choiceLine: (text: string, capex: number, tdi: number, vel: number, v: Vocab) => `"${text}": ${capex}K$, ${v.debt} ${sign(tdi)}, ${v.velocity} ${sign(vel)}`,
    durable: 'the most lasting',
    cheap: 'the cheapest',
    noAnswer: (fine: number) => `No answer: ${fine}K$ default impact.`,
    pathTitle: 'The winning path found by the engine',
    pathIntro: (verdict: string) => `The engine explores decision combinations quarter by quarter. Best result found: **${verdict}**. It is not the only way, but it shows what is achievable.`,
    quarter: (n: number) => `**Q${n}**`,
    posture: 'posture',
    initiatives: 'initiatives',
    none: 'none',
    crisis: 'crisis',
    price: (i: number) => `prices at ${i}% of the reference`,
    enter: (list: string) => `entered ${list}`,
    strategiesTitle: 'What typical strategies achieve',
    strategiesHead: '| Strategy | Alone | In a shared market |\n| --- | --- | --- |',
    strategy: { ARCHITECT: 'Disciplined (modernises first)', PRUDENT: 'Prudent (one small initiative per quarter)', COWBOY: 'Shortcuts (speed and low prices)' } as Record<BotStrategy, string>,
    mistakesTitle: 'Common mistakes',
    mistakes: (v: Vocab, market: boolean) => [
      `Betting everything on speed in the first quarter: "${v.debt}" and incidents catch up with the team by quarter 3.`,
      'Investing too little out of caution: debt compounds and the objectives stay out of reach.',
      'Pitching the board without preparing the executives one-on-one.',
      'Keeping no cash margin for the quarter’s crisis.',
      ...(market ? ['Cutting prices to win share without watching the margin, or opening markets without the capacity to serve them.'] : []),
    ],
    marketTitle: 'The market',
    segment: (name: string, demand: string, price: string, criteria: string, closed: string) => `**${name}**: ${demand} units/quarter at a reference price of ${price}K$; customers mostly weigh ${criteria}${closed}.`,
    closed: (cost: number) => ` (closed at the start, entry ${cost}K$)`,
    rivals: (list: string) => `Simulated rivals: ${list}.`,
    criteria: { priceSensitivity: 'price', qualitySensitivity: 'quality', speedSensitivity: 'availability', reliabilitySensitivity: 'reliability' } as Record<string, string>,
    planTitle: 'Session plan',
    plan: (rounds: number) => [
      '**Opening (20 min)**: case file, tutorial or commented demo, team set-up.',
      `**${rounds} quarters (30 min each)**: 10 min negotiation, 15 min decision, 5 min reading the report and the coach.`,
      '**Debrief (40 min)**: the cockpit’s automatic debrief, "What if…?" on a key quarter, the questions below.',
    ],
    questionsTitle: 'Case-specific debrief questions',
    qTrap: (name: string) => `Who chose "${name}"? What did it bring in the first quarter, and what did it cost afterwards?`,
    qCrisis: (title: string) => `Facing "${title}", did you choose the quick or the lasting answer, and why?`,
    qConflict: (a: string, b: string) => `How did you reconcile ${a} and ${b}? Whom did you have to disappoint?`,
    qPath: (list: string) => `The engine wins by starting with ${list}. Why is that first choice so effective?`,
    qMarket: 'Was your market share won through price, or through quality, capacity and reliability? What did it do to your margin?',
    weights: { financialAcumen: 'finance', deliverySpeed: 'speed', architecturalRigor: 'rigour', regulatoryCompliance: 'compliance' } as Record<Weight, string>,
    verdicts: { VICTORY: 'Victory', PARTIAL: 'Partial success', DEFEAT: 'Defeat' } as Record<string, string>,
    difficulty: { ENTRY: 'Entry', INTERMEDIATE: 'Intermediate', EXECUTIVE: 'Executive', CRISIS_CHIEF: 'Crisis chief' } as Record<string, string>,
  },
};

interface Vocab {
  debt: string;
  velocity: string;
  resilience: string;
  compliance: string;
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function topWeight(sh: StakeholderPersona): Weight {
  return (Object.entries(sh.decisionWeights) as Array<[Weight, number]>).sort((a, b) => b[1] - a[1])[0][0];
}

/** The two executives whose priorities differ the most. */
function mostOpposed(stakeholders: StakeholderPersona[]): [StakeholderPersona, StakeholderPersona] | undefined {
  let best: [StakeholderPersona, StakeholderPersona] | undefined;
  let gap = -1;
  for (let i = 0; i < stakeholders.length; i++) {
    for (let j = i + 1; j < stakeholders.length; j++) {
      const a = stakeholders[i].decisionWeights;
      const b = stakeholders[j].decisionWeights;
      const d = (Object.keys(a) as Weight[]).reduce((sum, k) => sum + Math.abs(a[k] - b[k]), 0);
      if (d > gap) {
        gap = d;
        best = [stakeholders[i], stakeholders[j]];
      }
    }
  }
  return best;
}

export interface TeachingNote {
  title: string;
  summary: string;
  content: string; // Markdown
}

export function buildTeachingNote(scenario: Scenario, lang: Lang): TeachingNote {
  const L = TEXT[lang];
  const vocab = resolveVocabulary(scenario, lang);
  const v: Vocab = {
    debt: vocab.metrics.technicalDebtIndex.label,
    velocity: vocab.metrics.deliveryVelocity.label,
    resilience: vocab.metrics.resilienceIndex.label,
    compliance: vocab.metrics.complianceScore.label,
  };
  const rounds = scenario.totalRounds || 4;
  const initName = (id: string) => scenario.initiativesCatalog.find(i => i.id === id)?.name ?? id;
  const out: string[] = [`# ${L.title(scenario.title)}`, '', L.confidential, ''];

  // Synopsis
  out.push(`## ${L.synopsis}`, '', L.meta(scenario.industry, L.difficulty[scenario.difficulty] ?? scenario.difficulty, rounds, L.teams), '', scenario.description, '', scenario.businessContext, '');

  // Learning objectives
  out.push(`## ${L.objectivesTitle}`, '');
  L.objectives(v, scenario.stakeholders.map(s => s.name).join(', '), !!scenario.market).forEach((o, i) => out.push(`${i + 1}. ${o}`));
  out.push('');

  // Targets and parameters
  const baseline = { ...scenario.baselineMetrics, modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length };
  const start = evaluateOutcome(scenario, baseline);
  const objectiveLabel = (key: string) =>
    key === 'solvency' ? vocab.metrics.budgetRemaining.label : vocab.metrics[key as keyof typeof vocab.metrics]?.label ?? key;
  const fmt = (key: string, value: number) => (key === 'tco' || key === 'solvency' || key === 'cumulativeProfit' ? `${value}K$` : key === 'marketShare' ? `${value} %` : `${value}`);
  out.push(`## ${L.targetsTitle}`, '', L.targetsHead);
  for (const o of start.objectives) {
    const market = o.key === 'marketShare' || o.key === 'cumulativeProfit';
    out.push(`| ${objectiveLabel(o.key)} | ${o.comparator} ${fmt(o.key, o.target)} | ${market ? '—' : fmt(o.key, o.actual)} |`);
  }
  out.push(
    '',
    L.rules(scenario.baselineMetrics.budgetRemaining, scenario.maxInitiativesPerRound ?? DEFAULT_MAX_INITIATIVES_PER_ROUND, getRunAllocation(scenario)),
    ''
  );

  // Tensions and hidden agendas
  const opposed = mostOpposed(scenario.stakeholders);
  out.push(`## ${L.tensionsTitle}`, '');
  if (opposed) out.push(L.tension(opposed[0].name, L.weights[topWeight(opposed[0])], opposed[1].name, L.weights[topWeight(opposed[1])]), '');
  for (const sh of scenario.stakeholders) out.push(`- **${sh.name}** (${sh.title})${L.colon}${sh.bias}`);
  out.push('', `### ${L.agendasTitle}`, '');
  for (const sh of scenario.stakeholders) out.push(`- **${sh.name}**${L.colon}${sh.hiddenAgenda}`);
  out.push('');

  // Traps
  const traps = scenario.initiativesCatalog.filter(i => i.riskLevel === 'EXTREME' || i.tdiDelta > 0);
  out.push(`## ${L.trapsTitle}`, '');
  for (const trap of traps) out.push(`- ${L.trap(trap.name, L.risk[trap.riskLevel] ?? trap.riskLevel, L.trapEffects(v, trap.tdiDelta, trap.velocityDelta, trap.complianceDelta, trap.resilienceDelta))}`);
  out.push(`- ${L.postureTrap(vocab.postures.BYPASS_ARCH.name)}`, '');

  // Crises
  out.push(`## ${L.crisesTitle}`, '');
  for (const event of [...scenario.roundEvents].sort((a, b) => a.roundNumber - b.roundNumber)) {
    out.push(`### ${event.title}`, '', event.description, '');
    if (event.choices.length) {
      const durable = [...event.choices].sort((a, b) => a.tdiImpact - b.tdiImpact)[0];
      const cheap = [...event.choices].sort((a, b) => a.capExImpact - b.capExImpact)[0];
      for (const c of event.choices) {
        const tags = [c.id === durable.id ? L.durable : '', c.id === cheap.id ? L.cheap : ''].filter(Boolean);
        out.push(`- ${L.choiceLine(c.text, c.capExImpact, c.tdiImpact, c.velocityImpact, v)}${tags.length ? ` — *${tags.join(', ')}*` : ''}`);
      }
    }
    out.push(`- ${L.noAnswer(event.immediateImpact.budgetFine)}`, '');
  }

  // Winning path
  const best: Team = searchBestTeam(scenario);
  const bestOutcome = evaluateOutcome(scenario, best.metrics);
  out.push(`## ${L.pathTitle}`, '', L.pathIntro(`${L.verdicts[bestOutcome.verdict]} ${bestOutcome.grade} (${bestOutcome.score}/100)`), '');
  for (const h of best.history) {
    const d = h.decision;
    if (!d) continue;
    const parts = [
      `${L.posture} ${L.quote(vocab.postures[d.governancePosture].name)}`,
      `${L.initiatives}${L.colon}${d.selectedInitiativeIds.length ? d.selectedInitiativeIds.map(initName).join(', ') : L.none}`,
    ];
    const choice = scenario.roundEvents.find(e => e.roundNumber === h.roundNumber)?.choices.find(c => c.id === d.eventChoiceId);
    if (choice) parts.push(`${L.crisis}${L.colon}${L.quote(choice.text)}`);
    const index = priceIndex(scenario, h);
    if (index !== undefined) parts.push(L.price(Math.round(index * 100)));
    if (d.market?.enter?.length) parts.push(L.enter(d.market.enter.map(id => scenario.market?.segments.find(s => s.id === id)?.name ?? id).join(', ')));
    out.push(`- ${L.quarter(h.roundNumber)}${L.colon}${parts.join(' · ')}`);
  }
  out.push('');

  // Typical strategies
  const strategies: BotStrategy[] = ['ARCHITECT', 'PRUDENT', 'COWBOY'];
  const tournament = scenario.market ? playTournament(scenario) : undefined;
  out.push(`## ${L.strategiesTitle}`, '', L.strategiesHead);
  for (const s of strategies) {
    const solo = simulateStrategy(scenario, s);
    const shared = tournament?.[s];
    out.push(`| ${L.strategy[s]} | ${L.verdicts[solo.verdict]} ${solo.grade} | ${shared ? `${L.verdicts[shared.verdict]} ${shared.grade}` : '—'} |`);
  }
  out.push('', `### ${L.mistakesTitle}`, '');
  for (const m of L.mistakes(v, !!scenario.market)) out.push(`- ${m}`);
  out.push('');

  // Market
  if (scenario.market) {
    out.push(`## ${L.marketTitle}`, '');
    for (const seg of scenario.market.segments) {
      const keys = ['priceSensitivity', 'qualitySensitivity', 'speedSensitivity', 'reliabilitySensitivity'] as const;
      const top = [...keys].sort((a, b) => seg[b] - seg[a]).slice(0, 2).map(k => L.criteria[k]).join(lang === 'fr' ? ' et ' : ' and ');
      out.push(`- ${L.segment(seg.name, seg.baseDemand.toLocaleString(lang), seg.referencePrice.toLocaleString(lang), top, seg.openAtStart === false ? L.closed(seg.entryCost ?? 0) : '')}`);
    }
    out.push('', L.rivals(scenario.market.rivals.map(r => r.name).join(', ')), '');
  }

  // Session plan
  out.push(`## ${L.planTitle}`, '');
  for (const p of L.plan(rounds)) out.push(`- ${p}`);
  out.push('');

  // Debrief questions
  out.push(`## ${L.questionsTitle}`, '');
  const questions: string[] = [];
  if (traps[0]) questions.push(L.qTrap(traps[0].name));
  const blackSwan = scenario.roundEvents.find(e => e.severity === 'BLACK_SWAN') ?? scenario.roundEvents.find(e => e.choices.length > 1);
  if (blackSwan) questions.push(L.qCrisis(blackSwan.title));
  if (opposed) questions.push(L.qConflict(opposed[0].name, opposed[1].name));
  const first = best.history[0]?.decision?.selectedInitiativeIds ?? [];
  if (first.length) questions.push(L.qPath(first.map(id => L.quote(initName(id))).join(lang === 'fr' ? ' et ' : ' and ')));
  if (scenario.market) questions.push(L.qMarket);
  questions.forEach((q, i) => out.push(`${i + 1}. ${q}`));
  out.push('');

  // Amounts in the case's currency
  return { title: L.title(scenario.title), summary: L.summary, content: withCurrency(out.join('\n'), currencySuffix(scenario)) };
}
