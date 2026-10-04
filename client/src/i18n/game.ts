// ============================================================================
// GEMSIM: GAME-AWARE TRANSLATION HELPERS
// Translate engine message codes and label metrics with the scenario vocabulary.
// ============================================================================

import { useMemo } from 'react';
import type { MessageCode, OutcomeObjective, Scenario } from '../types/index';
import { resolveVocabulary } from '../../../server/src/engine/vocabulary';
import { localizeScenario } from '../../../server/src/engine/scenario-text';
import { currencySuffix, formatMoney, withCurrency } from '../../../server/src/engine/currency';
import { TranslationKey, translate, useI18n, isTranslationKey } from './index';
import type { Lang } from './index';

const OBJECTIVE_METRIC: Record<OutcomeObjective['key'], keyof ReturnType<typeof resolveVocabulary>['metrics'] | null> = {
  technicalDebtIndex: 'technicalDebtIndex',
  stakeholderTrust: 'stakeholderTrust',
  deliveryVelocity: 'deliveryVelocity',
  resilienceIndex: 'resilienceIndex',
  tco: 'tco',
  modernizedNodesCount: 'modernizedNodesCount',
  solvency: null,
  marketShare: 'marketShare',
  cumulativeProfit: 'cumulativeProfit',
};

/** Translates an engine message code; verdict-like params and params that are themselves keys are translated too. */
export function translateCode(lang: Lang, message: MessageCode): string {
  const params = { ...(message.params ?? {}) };
  if (typeof params.verdict === 'string') params.verdict = translate(lang, `mandate.${params.verdict}` as TranslationKey);
  if (typeof params.risk === 'string') params.risk = translate(lang, `risk.${params.risk}` as TranslationKey);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && isTranslationKey(value)) params[key] = translate(lang, value);
  }
  return translate(lang, message.code as TranslationKey, params);
}

export function objectiveLabel(lang: Lang, scenario: Scenario | null | undefined, key: OutcomeObjective['key']): string {
  const metric = OBJECTIVE_METRIC[key];
  if (!metric) return translate(lang, 'outcome.objective.solvency');
  return resolveVocabulary(scenario, lang).metrics[metric].label;
}

/** Hook: translator plus the scenario's vocabulary and currency in the current language. */
export function useGameText(scenario: Scenario | null | undefined) {
  const { t: plain, lang, setLang } = useI18n();
  const vocab = useMemo(() => resolveVocabulary(scenario, lang), [scenario, lang]);
  const cur = currencySuffix(scenario);
  return {
    t: (key: TranslationKey, vars?: Record<string, string | number>) => withCurrency(plain(key, vars), cur),
    lang,
    setLang,
    vocab,
    cur, // "K$", "K€"... to write after an amount
    money: (value: number) => formatMoney(value, lang, cur),
    code: (message: MessageCode) => withCurrency(translateCode(lang, message), cur),
    objective: (key: OutcomeObjective['key']) => objectiveLabel(lang, scenario, key),
    category: (c: string) => translate(lang, `category.${c}` as TranslationKey),
    risk: (r: string) => translate(lang, `risk.${r}` as TranslationKey),
    severity: (s: string) => translate(lang, `severity.${s}` as TranslationKey),
    eventType: (e: string) => translate(lang, `eventType.${e}` as TranslationKey),
  };
}

/** The scenario in the interface language when the Studio has translated it (ids and numbers never change). */
export function useLocalizedScenario<S extends Scenario | null | undefined>(scenario: S): S {
  const { lang } = useI18n();
  return localizeScenario(scenario, lang);
}

export function useLocalizedScenarios(scenarios: Scenario[]): Scenario[] {
  const { lang } = useI18n();
  return useMemo(() => scenarios.map(s => localizeScenario(s, lang)), [scenarios, lang]);
}
