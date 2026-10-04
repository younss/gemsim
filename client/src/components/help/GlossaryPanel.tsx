// ============================================================================
// GEMSIM: GLOSSARY PANEL
// Metric definitions in the current scenario's vocabulary, then game concepts.
// ============================================================================

import { useDialogFocus } from '../common/useDialogFocus';
import React, { useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { GLOSSARY } from '../../i18n/glossary';
import { useGameText, useLocalizedScenario } from '../../i18n/game';
import { useHelpStore } from '../../stores/useHelpStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import type { MetricKey } from '../../types/index';

const METRIC_ORDER: MetricKey[] = [
  'technicalDebtIndex',
  'deliveryVelocity',
  'stakeholderTrust',
  'resilienceIndex',
  'complianceScore',
  'budgetRemaining',
  'opEx',
  'tco',
  'modernizedNodesCount',
];

export const GlossaryPanel: React.FC = () => {
  const open = useHelpStore(s => s.glossaryOpen);
  const setOpen = useHelpStore(s => s.setGlossaryOpen);
  const scenario = useLocalizedScenario(useSimulationStore(s => s.currentScenario));
  const { t, lang, vocab } = useGameText(scenario);
  const [query, setQuery] = useState('');

  const dialogRef = useDialogFocus(open, () => setOpen(false));

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matches = (term: string, def: string) => !q || term.toLowerCase().includes(q) || def.toLowerCase().includes(q);
  const metrics = METRIC_ORDER.map(k => ({ id: k, ...vocab.metrics[k] })).filter(m => matches(m.label, m.description));
  const concepts = GLOSSARY.filter(g => matches(g.term[lang], g.definition[lang]));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glossary-title"
        className="bg-dark-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 id="glossary-title" className="font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            {t('glossary.title')}
          </h2>
          <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800">
          <label className="flex items-center gap-2 bg-dark-950 border border-slate-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span className="sr-only">{t('glossary.search')}</span>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('glossary.search')}
              className="bg-transparent flex-1 text-sm text-slate-200 focus:outline-none placeholder:text-slate-500"
            />
          </label>
        </div>

        <div tabIndex={0} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 overflow-y-auto p-4 space-y-5">
          <section>
            <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-1">{t('glossary.metrics')}</h3>
            <p className="text-[11px] text-slate-500 mb-3">{t('glossary.metricsNote')}</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metrics.map(m => (
                <div key={m.id} className="bg-dark-850 border border-slate-800 rounded-xl p-3">
                  <dt className="text-sm font-bold text-slate-100">{m.label}</dt>
                  <dd className="text-xs text-slate-400 mt-1 leading-relaxed">{m.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3">{t('glossary.concepts')}</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {concepts.map(g => (
                <div key={g.id} className="bg-dark-850 border border-slate-800 rounded-xl p-3">
                  <dt className="text-sm font-bold text-slate-100">{g.term[lang]}</dt>
                  <dd className="text-xs text-slate-400 mt-1 leading-relaxed">{g.definition[lang]}</dd>
                </div>
              ))}
            </dl>
          </section>

          {metrics.length === 0 && concepts.length === 0 && <p className="text-sm text-slate-500">{t('glossary.empty')}</p>}
        </div>
      </div>
    </div>
  );
};
