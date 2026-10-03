// ============================================================================
// GEMSIM: GAME-AWARE TRANSLATION HELPERS
// Translate engine message codes and label metrics with the scenario vocabulary.
// ============================================================================

import { useMemo } from 'react';
import type { MessageCode, OutcomeObjective, Scenario } from '../types/index';
import { resolveVocabulary } from '../../../server/src/engine/vocabulary';
import { TranslationKey, translate, useI18n } from './index';
import type { Lang } from './index';

const OBJECTIVE_METRIC: Record<OutcomeObjective['key'], keyof ReturnType<typeof resolveVocabulary>['metrics'] | null> = {
  technicalDebtIndex: 'technicalDebtIndex',
  stakeholderTrust: 'stakeholderTrust',
  deliveryVelocity: 'deliveryVelocity',
  resilienceIndex: 'resilienceIndex',
  tco: 'tco',
  modernizedNodesCount: 'modernizedNodesCount',
  solvency: null,
};

/** Translates an engine message code; verdict-like params are translated too. */
export function translateCode(lang: Lang, message: MessageCode): string {
  const params = { ...(message.params ?? {}) };
  if (typeof params.verdict === 'string') params.verdict = translate(lang, `mandate.${params.verdict}` as TranslationKey);
  if (typeof params.risk === 'string') params.risk = translate(lang, `risk.${params.risk}` as TranslationKey);
  return translate(lang, message.code as TranslationKey, params);
}

export function objectiveLabel(lang: Lang, scenario: Scenario | null | undefined, key: OutcomeObjective['key']): string {
  const metric = OBJECTIVE_METRIC[key];
  if (!metric) return translate(lang, 'outcome.objective.solvency');
  return resolveVocabulary(scenario, lang).metrics[metric].label;
}

/** Hook: translator plus the scenario's vocabulary in the current language. */
export function useGameText(scenario: Scenario | null | undefined) {
  const { t, lang, setLang } = useI18n();
  const vocab = useMemo(() => resolveVocabulary(scenario, lang), [scenario, lang]);
  return {
    t,
    lang,
    setLang,
    vocab,
    code: (message: MessageCode) => translateCode(lang, message),
    objective: (key: OutcomeObjective['key']) => objectiveLabel(lang, scenario, key),
    category: (c: string) => translate(lang, `category.${c}` as TranslationKey),
    risk: (r: string) => translate(lang, `risk.${r}` as TranslationKey),
    severity: (s: string) => translate(lang, `severity.${s}` as TranslationKey),
    eventType: (e: string) => translate(lang, `eventType.${e}` as TranslationKey),
  };
}
