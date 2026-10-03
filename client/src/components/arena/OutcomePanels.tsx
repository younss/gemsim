// ============================================================================
// GEMSIM: OBJECTIVES TRACKER & FINAL VERDICT
// Live progress against the scenario's win conditions and the end-of-game screen.
// ============================================================================

import React from 'react';
import { OutcomeObjective, Scenario, SimulationOutcome, SimulationSession, Team } from '../../types/index';
import { Award, CheckCircle, Flag, XCircle } from 'lucide-react';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { InfoTip } from '../help/InfoTip';

const VERDICT_STYLE: Record<SimulationOutcome['verdict'], string> = {
  VICTORY: 'text-emerald-300 border-emerald-500/60 bg-emerald-500/10',
  PARTIAL: 'text-amber-300 border-amber-500/60 bg-amber-500/10',
  DEFEAT: 'text-rose-300 border-rose-500/60 bg-rose-500/10',
};

function formatValue(o: OutcomeObjective, value: number): string {
  if (o.key === 'tco' || o.key === 'solvency') return `${value.toLocaleString()}K$`;
  return `${value}`;
}

export const ObjectivesTracker: React.FC<{ outcome: SimulationOutcome; scenario: Scenario; roundsLeft: number }> = ({ outcome, scenario, roundsLeft }) => {
  const { t, objective, vocab } = useGameText(scenario);
  const description = (key: OutcomeObjective['key']) =>
    key === 'solvency' ? vocab.metrics.budgetRemaining.description : vocab.metrics[key as Exclude<OutcomeObjective['key'], 'solvency'>].description;

  return (
    <section aria-label={t('outcome.winConditions', { met: outcome.objectivesMet, total: outcome.objectives.length })} className="bg-dark-850 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
          {t('outcome.winConditions', { met: outcome.objectivesMet, total: outcome.objectives.length })}
          {roundsLeft > 0 && <span className="text-slate-500">{t('outcome.quartersLeft', { n: roundsLeft })}</span>}
        </span>
        <span className={`px-2 py-0.5 rounded border ${VERDICT_STYLE[outcome.verdict]}`}>
          {t('outcome.projected', { verdict: t(`outcome.verdict.${outcome.verdict}` as TranslationKey), grade: outcome.grade })}
        </span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {outcome.objectives.map(o => (
          <li
            key={o.key}
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-mono ${o.met ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}
          >
            <div className="text-slate-400 flex items-center">
              <span className="truncate">{objective(o.key)}</span>
              <InfoTip text={description(o.key)} label={objective(o.key)} />
            </div>
            <div className={o.met ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
              {formatValue(o, o.actual)}{' '}
              <span className="text-slate-500 font-normal">
                {o.comparator} {formatValue(o, o.target)}
              </span>
              <span className="sr-only">{o.met ? '✓' : '✗'}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const FinalVerdict: React.FC<{ session: SimulationSession; team: Team; outcome: SimulationOutcome; scenario: Scenario }> = ({
  session,
  team,
  outcome,
  scenario,
}) => {
  const { t, objective } = useGameText(scenario);
  const ranking = [...session.teams].map(tm => ({ team: tm, score: tm.outcome?.score ?? 0 })).sort((a, b) => b.score - a.score);
  const rank = ranking.findIndex(r => r.team.id === team.id) + 1;

  return (
    <section aria-label={t(`outcome.verdict.${outcome.verdict}` as TranslationKey)} className={`p-5 rounded-2xl border-2 ${VERDICT_STYLE[outcome.verdict]} flex flex-col gap-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-current flex items-center justify-center text-4xl font-black font-mono">{outcome.grade}</div>
          <div>
            <div className="text-xs font-mono text-slate-400">{t('outcome.complete', { n: session.totalRounds })}</div>
            <div className="text-2xl font-black tracking-wide">{t(`outcome.verdict.${outcome.verdict}` as TranslationKey)}</div>
            <div className="text-sm text-slate-300 font-mono">
              {t('outcome.summary', { score: outcome.score, met: outcome.objectivesMet, total: outcome.objectives.length })}
              {session.teams.length > 1 && t('outcome.rank', { rank, total: session.teams.length })}
            </div>
          </div>
        </div>
        <Award className="w-12 h-12 opacity-60 hidden sm:block" aria-hidden="true" />
      </div>

      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-400 text-left border-b border-slate-700">
            <th className="py-1.5">{t('outcome.col.objective')}</th>
            <th className="py-1.5">{t('outcome.col.target')}</th>
            <th className="py-1.5">{t('outcome.col.final')}</th>
            <th className="py-1.5 text-right">{t('outcome.col.result')}</th>
          </tr>
        </thead>
        <tbody>
          {outcome.objectives.map(o => (
            <tr key={o.key} className="border-b border-slate-800/60">
              <td className="py-1.5 text-slate-200">{objective(o.key)}</td>
              <td className="py-1.5 text-slate-400">
                {o.comparator} {formatValue(o, o.target)}
              </td>
              <td className="py-1.5 text-slate-100 font-bold">{formatValue(o, o.actual)}</td>
              <td className="py-1.5 text-right">
                {o.met ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 inline" aria-label="✓" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 inline" aria-label="✗" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {session.teams.length > 1 && (
        <div className="text-xs font-mono text-slate-400 flex flex-wrap gap-3">
          {ranking.map((r, i) => (
            <span key={r.team.id}>
              #{i + 1} {r.team.avatar} {r.team.name} : {r.team.outcome?.grade ?? '—'} ({r.score})
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
