// ============================================================================
// GEMSIM: SELF-HOSTED INTERACTIVE DOCUMENTATION PORTAL
// End-to-End User Journeys, Mathematical Formulas, Schemas, and Podman Guide
// ============================================================================

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { useI18n, TranslationKey } from '../../i18n';
import { useHelpStore } from '../../stores/useHelpStore';
import {
  BookOpen,
  Calculator,
  Layers,
  Server,
  Terminal,
  ChevronRight,
  Shield,
  Activity,
  Cpu,
} from 'lucide-react';

export const DocsPortal: React.FC = () => {
  const { t, lang } = useI18n();
  const setGlossaryOpen = useHelpStore(s => s.setGlossaryOpen);
  const [docs, setDocs] = useState<any[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('');

  // Interactive Mathematical Calculator State
  const [calcTdi, setCalcTdi] = useState<number>(65);
  const [calcGovernance, setCalcGovernance] = useState<'BYPASS_ARCH' | 'BALANCED_AGILE' | 'STRICT_GOVERNANCE' | 'ACCELERATED_MODERN'>('BALANCED_AGILE');

  // The pedagogical kit comes in the interface language
  useEffect(() => {
    api.getDocs(lang).then(items => {
      if (items && items.length > 0) {
        setDocs(items);
        setActiveDocId(current => (items.some((d: any) => d.id === current) ? current : items[0].id));
      }
    });
  }, [lang]);

  const activeDoc = docs.find(d => d.id === activeDocId) || docs[0];

  // Live Formula Calculations
  let driftRate = 0.08;
  if (calcGovernance === 'BYPASS_ARCH') driftRate = 0.18;
  else if (calcGovernance === 'STRICT_GOVERNANCE') driftRate = 0.025;
  else if (calcGovernance === 'ACCELERATED_MODERN') driftRate = 0.04;

  const driftAmount = Math.round(calcTdi * driftRate * 10) / 10;
  const velocityDragPercent = Math.round(Math.pow(calcTdi / 100, 1.4) * 70 * 10) / 10;
  const effectiveVelocity = Math.max(8, Math.min(100, Math.round(65 * (1 - (velocityDragPercent / 100)))));
  const failureProb = Math.min(0.95, Math.round(Math.pow(calcTdi / 100, 2.2) * 1.5 * 100) / 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-h-[85vh]">
      {/* Left Column: Documentation Sections Index */}
      <div className="lg:col-span-4 flex flex-col gap-2 overflow-y-auto pr-1">
        <div className="p-4 bg-dark-850 rounded-xl border border-slate-800 mb-2">
          <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm mb-1">
            <BookOpen className="w-4 h-4" />
            <span>{t('docs.title')}</span>
          </div>
          <p className="text-xs text-slate-400">{t('docs.subtitle')}</p>
          <button onClick={() => setGlossaryOpen(true)} className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono">
            {t('brief.openGlossary')}
          </button>
        </div>

        {docs.map(doc => {
          const isSelected = doc.id === activeDocId;
          return (
            <button
              key={doc.id}
              onClick={() => setActiveDocId(doc.id)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-dark-800 border-cyan-500 ring-1 ring-cyan-500/50 shadow-lg'
                  : 'bg-dark-850/80 border-slate-800 hover:border-slate-700 hover:bg-dark-800/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  {t(`docs.category.${doc.category}` as TranslationKey)}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isSelected ? 'translate-x-1 text-cyan-400' : ''}`} />
              </div>
              <h4 className="font-bold text-slate-100 text-xs mt-1">{doc.title}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{doc.summary}</p>
            </button>
          );
        })}
      </div>

      {/* Right Column: Interactive Document Reader & Mathematical Visualizer */}
      <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto pr-2">
        {/* Active Document View */}
        {activeDoc && (
          <div className="bg-dark-850 p-6 rounded-xl border border-slate-800 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                {t(`docs.category.${activeDoc.category}` as TranslationKey)}
              </span>
              <h2 className="text-xl font-bold text-slate-100">{activeDoc.title}</h2>
              <p className="text-xs text-slate-400 mt-1">{activeDoc.summary}</p>
            </div>

            <div className="pt-2">
              <MarkdownViewer content={activeDoc.content} />
            </div>
          </div>
        )}

        {/* Interactive Mathematical Formula Simulator */}
        <div className="bg-dark-850 p-6 rounded-xl border border-indigo-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold font-mono text-sm">
            <Calculator className="w-4 h-4" />
            <span>{t('docs.calc.title')}</span>
          </div>
          <p className="text-xs text-slate-400">{t('docs.calc.subtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <label htmlFor="calc-tdi" className="text-slate-300">{t('docs.calc.debt')}</label>
                <span className="text-cyan-400 font-bold text-sm">{calcTdi}%</span>
              </div>
              <input
                id="calc-tdi"
                type="range"
                min="5"
                max="95"
                value={calcTdi}
                onChange={e => setCalcTdi(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="calc-posture" className="text-xs font-mono mb-1 text-slate-300 block">{t('arena.gov.title')}</label>
              <select
                id="calc-posture"
                value={calcGovernance}
                onChange={e => setCalcGovernance(e.target.value as any)}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500"
              >
                {(['BYPASS_ARCH', 'BALANCED_AGILE', 'STRICT_GOVERNANCE', 'ACCELERATED_MODERN'] as const).map(p => (
                  <option key={p} value={p}>
                    {t(`docs.calc.posture.${p}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-time Calculated Formula Outputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-3 border-t border-slate-800">
            <div className="bg-dark-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">{t('docs.calc.drift')}</span>
              <span className="text-rose-400 font-bold text-sm">+{driftAmount} {t('common.perQuarter')}</span>
              <span className="text-[10px] text-slate-500 block">{t('docs.calc.rate', { n: driftRate * 100 })}</span>
            </div>

            <div className="bg-dark-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">{t('docs.calc.drag')}</span>
              <span className="text-amber-400 font-bold text-sm">-{velocityDragPercent} %</span>
              <span className="text-[10px] text-slate-500 block">{t('docs.calc.dragSub')}</span>
            </div>

            <div className="bg-dark-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">{t('docs.calc.velocity')}</span>
              <span className="text-cyan-400 font-bold text-sm">{effectiveVelocity} {t('metric.pts')}</span>
              <span className="text-[10px] text-slate-500 block">{t('docs.calc.base')}</span>
            </div>

            <div className="bg-dark-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">{t('docs.calc.failure')}</span>
              <span className={`font-bold text-sm ${failureProb > 0.4 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {Math.round(failureProb * 100)}%
              </span>
              <span className="text-[10px] text-slate-500 block">{t('docs.calc.failureSub')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
