// ============================================================================
// GEMSIM: STUDIO CASE LIBRARY
// Every case with its language and translation status; the Studio translates a
// case into the other language with the active model (text only, checked).
// ============================================================================

import React, { useState } from 'react';
import { Scenario } from '../../types/index';
import { api } from '../../services/api';
import { translationStatus } from '../../engine';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useI18n, TranslationKey } from '../../i18n';
import { Languages, Loader2, Library } from 'lucide-react';

type Progress = { done: number; total: number } | 'starting';

export const CaseLibrary: React.FC = () => {
  const { t } = useI18n();
  const scenarios = useSimulationStore(s => s.scenarios);
  const setScenarios = useSimulationStore(s => s.setScenarios);
  const currentScenario = useSimulationStore(s => s.currentScenario);
  const setCurrentScenario = useSimulationStore(s => s.setCurrentScenario);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const target = (s: Scenario): 'fr' | 'en' => (s.language === 'en' ? 'fr' : 'en');

  const translate = async (s: Scenario) => {
    const lang = target(s);
    setErrors(e => ({ ...e, [s.id]: '' }));
    setProgress(p => ({ ...p, [s.id]: 'starting' }));
    try {
      const updated = await api.translateScenario(s.id, lang, (done, total) => setProgress(p => ({ ...p, [s.id]: { done, total } })));
      setScenarios(useSimulationStore.getState().scenarios.map(x => (x.id === updated.id ? updated : x)));
      if (currentScenario?.id === updated.id) setCurrentScenario(updated);
    } catch (err: any) {
      setErrors(e => ({ ...e, [s.id]: err.code === 'NO_LLM' ? t('studio.library.noLlm') : err.message }));
    } finally {
      setProgress(p => {
        const { [s.id]: _done, ...rest } = p;
        return rest;
      });
    }
  };

  return (
    <section aria-label={t('studio.library.title')} className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Library className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          {t('studio.library.title')}
        </h3>
        <p className="text-xs text-slate-400">{t('studio.library.subtitle')}</p>
      </div>
      <ul className="divide-y divide-slate-800">
        {scenarios.map(s => {
          const lang = target(s);
          const status = s.language ? translationStatus(s, lang) : 'MISSING';
          const running = progress[s.id];
          return (
            <li key={s.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-slate-200 truncate">{s.title}</div>
                <div className="text-[10px] font-mono text-slate-500 flex flex-wrap gap-2">
                  <span>{t('studio.library.language', { lang: s.language ? s.language.toUpperCase() : '?' })}</span>
                  <span className={status === 'TRANSLATED' ? 'text-emerald-400' : status === 'STALE' ? 'text-amber-400' : 'text-slate-500'}>
                    {t(`studio.library.status.${status}` as TranslationKey, { lang: lang.toUpperCase() })}
                  </span>
                  {s.isDefault && <span>{t('studio.library.seed')}</span>}
                </div>
                {errors[s.id] && <div role="alert" className="text-[11px] text-rose-300 mt-0.5">{errors[s.id]}</div>}
              </div>
              <button
                onClick={() => translate(s)}
                disabled={!!running || !s.language}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 font-mono text-[11px] flex items-center gap-1.5 disabled:opacity-50"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Languages className="w-3.5 h-3.5" aria-hidden="true" />}
                {running
                  ? running === 'starting'
                    ? t('studio.library.starting')
                    : t('studio.library.progress', { done: running.done, total: running.total })
                  : t(status === 'TRANSLATED' ? 'studio.library.retranslate' : 'studio.library.translate', { lang: lang.toUpperCase() })}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
