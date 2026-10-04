// ============================================================================
// GEMSIM STUDIO: AUTHORING PIPELINE REPORT
// Who wrote the case, who judged it, where they disagreed, what the engine had
// to complete and how the difficulty was calibrated: what the author reviews.
// ============================================================================

import React from 'react';
import type { PipelineReport } from '../../services/api';
import { useI18n, TranslationKey } from '../../i18n';
import { Workflow, CheckCircle2, AlertTriangle } from 'lucide-react';

export const PipelineReportCard: React.FC<{ report: PipelineReport }> = ({ report }) => {
  const { t } = useI18n();
  const c = report.calibration;
  const verdict = (v: string) => t(`outcome.verdict.${v}` as TranslationKey);
  const judged = report.judge !== 'author-tags';
  return (
    <section aria-label={t('studio.pipeline.title')} className="p-3.5 rounded-xl bg-dark-900 border border-indigo-500/30 space-y-2 text-[11px]">
      <h4 className="font-mono font-bold text-indigo-300 flex items-center gap-1.5">
        <Workflow className="w-3.5 h-3.5" aria-hidden="true" />
        {t('studio.pipeline.title')}
      </h4>
      <ul className="space-y-0.5 text-slate-300">
        <li>✍️ {t('studio.pipeline.author', { engine: report.author })}</li>
        <li>⚖️ {judged ? t('studio.pipeline.judge', { engine: report.judge }) : t('studio.pipeline.noJudge')}</li>
        <li>🧮 {t('studio.pipeline.engine')}</li>
      </ul>

      <div className={c.met ? 'text-emerald-300' : 'text-amber-300'}>
        <div className="font-bold flex items-center gap-1">
          {c.met ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
          {c.met ? t('studio.pipeline.calibrated') : t('studio.pipeline.notCalibrated')}
        </div>
        <div className="text-slate-400">
          {t('studio.pipeline.results', {
            best: `${verdict(c.best.verdict)} ${c.best.grade}`,
            architect: `${verdict(c.architect.verdict)} ${c.architect.grade}`,
            cowboy: `${verdict(c.cowboy.verdict)} ${c.cowboy.grade}`,
          })}
        </div>
        {c.adjustments.length > 0 && (
          <details className="text-slate-500">
            <summary className="cursor-pointer">{t('studio.pipeline.adjustments', { n: c.adjustments.length })}</summary>
            <ul className="font-mono text-[10px] mt-1 space-y-0.5">
              {c.adjustments.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {report.completions.length > 0 && (
        <div className="text-slate-400">
          {t('studio.pipeline.completions')} <span className="text-slate-300">{report.completions.flat().join(' ; ')}</span>
        </div>
      )}
      {report.forced.length > 0 && (
        <div className="text-slate-400">
          {t('studio.pipeline.forced')}
          <ul className="list-disc list-inside text-slate-300">
            {report.forced.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {report.review.length > 0 && (
        <div>
          <div className="text-amber-300 font-bold">{t('studio.pipeline.review', { n: report.review.length })}</div>
          <ul className="space-y-1 mt-1">
            {report.review.map((r, i) => (
              <li key={i} className="text-slate-300">
                <span className="text-slate-100">{r.element}</span>
                <div className="text-[10px] text-slate-500 font-mono">
                  {t('studio.pipeline.reviewLine', { author: r.author, judge: r.judge, confidence: Math.round(r.confidence * 100) })} →{' '}
                  {r.kept === 'judge' ? t('studio.pipeline.keptJudge') : t('studio.pipeline.keptAuthor')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
