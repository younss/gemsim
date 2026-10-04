// ============================================================================
// GEMSIM: QUARTER COACH PANEL
// The engine's ranked explanation of a quarter and the next steps, with an
// optional rewrite by the active LLM (the facts stay the engine's).
// ============================================================================

import React, { useState } from 'react';
import { Scenario, SimulationSession, Team } from '../../types/index';
import { coachQuarter } from '../../engine';
import { api } from '../../services/api';
import { useGameText } from '../../i18n/game';
import { GraduationCap, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  scenario: Scenario;
  session: SimulationSession;
  team: Team;
  round: number;
}

export const CoachPanel: React.FC<Props> = ({ scenario, session, team, round }) => {
  const { t, lang, code } = useGameText(scenario);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable'>('idle');

  const report = coachQuarter(scenario, team, round, session);
  if (!report || (report.insights.length === 0 && report.advice.length === 0)) return null;
  const insights = report.insights.map(code);
  const advice = report.advice.map(code);

  const askNarrative = async () => {
    setState('loading');
    const text = await api.coachNarrative({ lang, teamName: team.name, round, insights, advice }).catch(() => null);
    setNarrative(text);
    setState(text ? 'idle' : 'unavailable');
  };

  return (
    <section aria-label={t('coach.title', { n: round })} className="bg-indigo-950/30 p-3 rounded-lg border border-indigo-500/30 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-[11px] font-mono font-bold text-indigo-300 flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
          {t('coach.title', { n: round })}
        </h5>
        {!narrative && (
          <button
            onClick={askNarrative}
            disabled={state === 'loading'}
            className="text-[10px] font-mono px-2 py-1 rounded border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/10 flex items-center gap-1 disabled:opacity-50"
          >
            {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Sparkles className="w-3 h-3" aria-hidden="true" />}
            {t('coach.narrative')}
          </button>
        )}
      </div>

      {narrative ? (
        <p className="text-xs text-slate-200 leading-relaxed">{narrative}</p>
      ) : (
        <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
          {insights.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
      {state === 'unavailable' && <p className="text-[10px] text-slate-500">{t('coach.noLlm')}</p>}

      {advice.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-emerald-300 font-bold mb-0.5">{t('coach.next')}</div>
          <ul className="text-xs text-slate-300 space-y-0.5">
            {advice.map((line, i) => (
              <li key={i}>→ {line}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-slate-500">{t('coach.source')}</p>
    </section>
  );
};
