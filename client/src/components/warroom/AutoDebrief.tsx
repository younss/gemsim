// ============================================================================
// GEMSIM: AUTOMATIC DEBRIEF (FACILITATOR)
// Built from the session's real decisions: score trajectories, each team's
// decisive quarters with their causes, patterns, leaders and questions to ask.
// ============================================================================

import React from 'react';
import { MessageCode, Scenario, SimulationSession } from '../../types/index';
import { buildDebrief } from '../../engine';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { MessageCircleQuestion, Milestone, Trophy } from 'lucide-react';

/** Turns posture ids into the scenario's posture names before translation. */
export function useDebriefText(scenario: Scenario) {
  const { t, vocab, code, objective } = useGameText(scenario);
  const text = (m: MessageCode) =>
    code(
      typeof m.params?.posture === 'string' && m.params.posture in vocab.postures
        ? { ...m, params: { ...m.params, posture: vocab.postures[m.params.posture as keyof typeof vocab.postures].name } }
        : m
    );
  return { t, text, objective };
}

export const AutoDebrief: React.FC<{ scenario: Scenario; session: SimulationSession }> = ({ scenario, session }) => {
  const { t, text, objective } = useDebriefText(scenario);
  if (!session.teams.some(tm => tm.history.length)) return null;
  const debrief = buildDebrief(scenario, session);

  return (
    <section aria-label={t('debrief.auto.title')} className="bg-dark-850 rounded-xl border border-indigo-500/30 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
          <Milestone className="w-4 h-4" aria-hidden="true" />
          {t('debrief.auto.title')}
        </h4>
        <p className="text-xs text-slate-400">{t('debrief.auto.subtitle')}</p>
      </div>

      <div className="space-y-2">
        <h5 className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
          <MessageCircleQuestion className="w-3.5 h-3.5" aria-hidden="true" />
          {t('debrief.auto.questions')}
        </h5>
        <ol className="text-xs text-slate-200 space-y-1 list-decimal list-inside">
          {debrief.questions.map((q, i) => (
            <li key={i}>{text(q)}</li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {debrief.teams.map(td => (
          <article key={td.teamId} className="bg-dark-900 p-3 rounded-lg border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-100">{td.teamName}</h5>
              <span className="text-[10px] font-mono text-slate-400">
                {t('debrief.auto.trajectory')} {td.scores.join(' → ')}
              </span>
            </div>
            {td.patterns.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {td.patterns.map(p => (
                  <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
                    {t(`debrief.pattern.${p}` as TranslationKey)}
                  </span>
                ))}
              </div>
            )}
            <ul className="space-y-1.5">
              {td.moments.map(mo => (
                <li key={mo.round} className="text-[11px]">
                  <span className={`font-mono font-bold ${mo.scoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t('debrief.auto.moment', { n: mo.round, delta: mo.scoreDelta > 0 ? `+${mo.scoreDelta}` : `${mo.scoreDelta}` })}
                  </span>{' '}
                  <span className="text-slate-300">{mo.decision.map(text).join(' · ')}</span>
                  {mo.causes.length > 0 && <div className="text-slate-500">↳ {mo.causes.map(text).join(' ')}</div>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {debrief.leaders.length > 0 && (
        <div>
          <h5 className="text-[11px] font-mono font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            {t('debrief.auto.leaders')}
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {debrief.leaders.map(l => (
              <span key={l.key} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">
                {objective(l.key)} : {l.teamName}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
