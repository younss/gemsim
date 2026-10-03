// ============================================================================
// GEMSIM: GLOSSARY
// Game concepts in plain language. Metric definitions come from the scenario
// vocabulary (they change with the business domain), the rest is listed here.
// ============================================================================

import type { Lang } from './index';

export interface GlossaryEntry {
  id: string;
  term: Record<Lang, string>;
  definition: Record<Lang, string>;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'quarter',
    term: { fr: 'Trimestre', en: 'Quarter' },
    definition: {
      fr: 'Un tour de jeu. La partie en compte 4. Chaque trimestre : négocier, décider, soumettre, puis découvrir les résultats.',
      en: 'One game turn. A game has 4. Each quarter: negotiate, decide, submit, then see the results.',
    },
  },
  {
    id: 'capex',
    term: { fr: 'CapEx (investissement)', en: 'CapEx (investment)' },
    definition: {
      fr: "Dépense ponctuelle pour lancer une initiative. Elle est payée au démarrage, sur la trésorerie.",
      en: 'One-off spending to start an initiative. It is paid upfront, from cash.',
    },
  },
  {
    id: 'opex',
    term: { fr: 'OpEx (coût de fonctionnement)', en: 'OpEx (run cost)' },
    definition: {
      fr: "Coût récurrent, chaque trimestre. Il augmente avec la dette. Une initiative peut le réduire durablement.",
      en: 'Recurring cost, every quarter. It grows with debt. An initiative can lower it permanently.',
    },
  },
  {
    id: 'runBudget',
    term: { fr: 'Budget de fonctionnement vs budget de transformation', en: 'Run budget vs change budget' },
    definition: {
      fr: "Le métier finance vos coûts récurrents à leur niveau de départ. Ce qui dépasse est pris sur votre trésorerie de transformation ; si vous baissez les coûts, la moitié des économies vous revient.",
      en: 'The business funds recurring costs at their starting level. Anything above comes out of your change cash; if you cut costs, half of the savings comes back to you.',
    },
  },
  {
    id: 'compounding',
    term: { fr: 'Dette qui se compose', en: 'Compounding debt' },
    definition: {
      fr: "Comme une dette financière, la dette non remboursée produit des intérêts chaque trimestre. Plus la gouvernance est laxiste et plus vous livrez vite, plus elle grossit.",
      en: 'Like financial debt, unpaid debt accrues interest every quarter. The laxer the governance and the faster you ship, the faster it grows.',
    },
  },
  {
    id: 'initiative',
    term: { fr: 'Initiative', en: 'Initiative' },
    definition: {
      fr: "Un investissement (projet, programme). Elle a un coût, des effets, un risque et une durée de 1 ou 2 trimestres. Chaque initiative ne s'achète qu'une fois.",
      en: 'An investment (project, programme). It has a cost, effects, a risk level and a duration of 1 or 2 quarters. Each initiative can be bought only once.',
    },
  },
  {
    id: 'capacity',
    term: { fr: 'Capacité', en: 'Capacity' },
    definition: {
      fr: "Nombre d'initiatives lancées par trimestre : 2 par défaut, 3 si le conseil a approuvé votre stratégie, 1 s'il l'a rejetée.",
      en: 'Number of initiatives you can start per quarter: 2 by default, 3 if the board approved your strategy, 1 if it rejected it.',
    },
  },
  {
    id: 'posture',
    term: { fr: 'Posture de gouvernance', en: 'Governance posture' },
    definition: {
      fr: "Votre façon de piloter le trimestre, du raccourci risqué à la rigueur stricte. Elle change la vitesse à laquelle la dette se compose, la vélocité, la conformité et la résilience.",
      en: 'How you run the quarter, from risky shortcut to strict rigour. It changes how fast debt compounds, velocity, compliance and resilience.',
    },
  },
  {
    id: 'crisis',
    term: { fr: 'Crise du trimestre', en: "Quarter's crisis" },
    definition: {
      fr: "Un choc à chaque trimestre (audit, panne, rupture…). Si vous ne choisissez pas de réponse, l'impact par défaut s'applique.",
      en: 'A shock every quarter (audit, outage, shortage…). If you choose no response, the default impact applies.',
    },
  },
  {
    id: 'blackSwan',
    term: { fr: 'Cygne noir', en: 'Black swan' },
    definition: {
      fr: "Crise rare et très sévère. Le facilitateur peut aussi en injecter une : elle frappe immédiatement et remplace le dilemme du trimestre.",
      en: 'A rare, severe crisis. The facilitator can also inject one: it hits immediately and replaces the quarter’s dilemma.',
    },
  },
  {
    id: 'incident',
    term: { fr: 'Incident', en: 'Incident' },
    definition: {
      fr: "Panne d'un élément très fragile (forte dette, peu de résilience). Il coûte de l'argent et de la vélocité, et dégrade l'élément.",
      en: 'Failure of a very fragile element (high debt, low resilience). It costs money and velocity and degrades the element.',
    },
  },
  {
    id: 'riskLevel',
    term: { fr: 'Niveau de risque', en: 'Risk level' },
    definition: {
      fr: "FAIBLE à EXTRÊME. Les initiatives EXTRÊMES sont des raccourcis tentants qui ajoutent de la dette. Le conseil peut interdire les niveaux élevés.",
      en: 'LOW to EXTREME. EXTREME initiatives are tempting shortcuts that add debt. The board can block high levels.',
    },
  },
  {
    id: 'stakeholder',
    term: { fr: 'Décideur', en: 'Executive' },
    definition: {
      fr: "Membre du comité de direction joué par l'IA. Il a une personnalité, un biais, des priorités et un agenda caché, et juge vos propositions selon ses intérêts.",
      en: 'An executive committee member played by AI. They have a personality, a bias, priorities and a hidden agenda, and judge your proposals by their interests.',
    },
  },
  {
    id: 'hiddenAgenda',
    term: { fr: 'Agenda caché', en: 'Hidden agenda' },
    definition: {
      fr: "Objectif personnel qu'un décideur ne dit pas ouvertement. Une proposition qui le sert (même implicitement) est mieux reçue.",
      en: 'A personal goal an executive does not state openly. A proposal that serves it (even implicitly) lands better.',
    },
  },
  {
    id: 'patience',
    term: { fr: 'Patience', en: 'Patience' },
    definition: {
      fr: "Jauge de 0 à 100 par décideur et par trimestre. Les propositions rejetées, creuses ou répétées l'usent. À 0, il refuse de vous recevoir et vote contre. +50 chaque trimestre.",
      en: 'A 0–100 gauge per executive and quarter. Rejected, empty or repeated proposals use it up. At 0 they refuse to meet and vote against. +50 each quarter.',
    },
  },
  {
    id: 'pact',
    term: { fr: 'Pacte', en: 'Pact' },
    definition: {
      fr: "Engagement signé sur une concession demandée par un décideur, avec un budget. Il est honoré en fin de trimestre : coût prélevé, confiance en hausse.",
      en: 'A signed commitment on a concession an executive asked for, with a budget. It is honoured at quarter end: cost charged, trust up.',
    },
  },
  {
    id: 'board',
    term: { fr: "Conseil d'administration", en: 'Board' },
    definition: {
      fr: "Tous les décideurs votent en même temps sur votre stratégie, puis débattent. Le résultat fixe le mandat du trimestre.",
      en: 'All executives vote on your strategy at once, then debate. The result sets the quarter’s mandate.',
    },
  },
  {
    id: 'mandate',
    term: { fr: 'Mandat du conseil', en: 'Board mandate' },
    definition: {
      fr: "Approuvé : +1 initiative et +5 de vélocité. Quorum sous conditions : risque EXTRÊME interdit. Rejeté : -1 initiative, risques ÉLEVÉ et EXTRÊME interdits.",
      en: 'Approved: +1 initiative and +5 velocity. Conditional quorum: EXTREME risk blocked. Rejected: -1 initiative, HIGH and EXTREME risk blocked.',
    },
  },
  {
    id: 'consensus',
    term: { fr: 'Consensus', en: 'Consensus' },
    definition: {
      fr: "Score de 0 à 100 % du vote du conseil : un vote pour compte 100, sous réserve 60, contre 20.",
      en: 'A 0–100% score of the board vote: for counts 100, conditional 60, against 20.',
    },
  },
  {
    id: 'insolvency',
    term: { fr: 'Insolvabilité', en: 'Insolvency' },
    definition: {
      fr: "Trésorerie négative. Tous les décideurs perdent confiance et la victoire devient impossible tant que la trésorerie reste négative.",
      en: 'Negative cash. Every executive loses trust and victory is impossible while cash stays negative.',
    },
  },
  {
    id: 'verdict',
    term: { fr: 'Verdict et note', en: 'Verdict and grade' },
    definition: {
      fr: "Victoire (7 objectifs tenus, A+ ou A), victoire partielle (trésorerie positive et au moins 4 objectifs, B ou C), défaite (D ou F).",
      en: 'Victory (all 7 objectives, A+ or A), partial success (positive cash and at least 4 objectives, B or C), defeat (D or F).',
    },
  },
  {
    id: 'systemOne',
    term: { fr: 'System 1 (Clef)', en: 'System 1 (Clef)' },
    definition: {
      fr: "Modèle de décision rapide qui fixe le verdict, la confiance et les scores des décideurs. Le LLM (System 2) rédige ensuite leur réponse.",
      en: 'A fast decision model that sets the executives’ verdict, trust and scores. The LLM (System 2) then writes their reply.',
    },
  },
];
