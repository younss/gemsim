// ============================================================================
// GEMSIM: OBJECTIVES TRACKER & FINAL VERDICT
// Live progress against the scenario's win conditions and the end-of-game screen.
// ============================================================================

import React from 'react';
import { OutcomeObjective, SimulationOutcome, SimulationSession, Team } from '../../types/index';
import { Award, CheckCircle, Flag, XCircle } from 'lucide-react';

const VERDICT_STYLE: Record<SimulationOutcome['verdict'], { label: string; className: string }> = {
  VICTORY: { label: 'VICTORY', className: 'text-emerald-300 border-emerald-500/60 bg-emerald-500/10' },
  PARTIAL: { label: 'PARTIAL SUCCESS', className: 'text-amber-300 border-amber-500/60 bg-amber-500/10' },
  DEFEAT: { label: 'DEFEAT', className: 'text-rose-300 border-rose-500/60 bg-rose-500/10' },
};

function formatValue(o: OutcomeObjective, value: number): string {
  if (o.key === 'tco' || o.key === 'solvency') return `$${value.toLocaleString()}K`;
  if (o.key === 'modernizedNodesCount') return `${value}`;
  return `${value}`;
}

export const ObjectivesTracker: React.FC<{ outcome: SimulationOutcome; roundsLeft: number }> = ({ outcome, roundsLeft }) => (
  <div className="bg-dark-850 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-slate-400 flex items-center gap-1.5">
        <Flag className="w-3.5 h-3.5 text-cyan-400" />
        WIN CONDITIONS — {outcome.objectivesMet}/{outcome.objectives.length} met
        {roundsLeft > 0 && <span className="text-slate-500">({roundsLeft} quarter{roundsLeft > 1 ? 's' : ''} left)</span>}
      </span>
      <span className={`px-2 py-0.5 rounded border ${VERDICT_STYLE[outcome.verdict].className}`}>
        Projected: {VERDICT_STYLE[outcome.verdict].label} ({outcome.grade})
      </span>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {outcome.objectives.map(o => (
        <div
          key={o.key}
          className={`px-2 py-1.5 rounded-lg border text-[11px] font-mono ${o.met ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}
          title={`${o.label}: ${formatValue(o, o.actual)} (target ${o.comparator} ${formatValue(o, o.target)})`}
        >
          <div className="text-slate-400 truncate">{o.label}</div>
          <div className={o.met ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
            {formatValue(o, o.actual)} <span className="text-slate-500 font-normal">{o.comparator} {formatValue(o, o.target)}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const FinalVerdict: React.FC<{ session: SimulationSession; team: Team; outcome: SimulationOutcome }> = ({ session, team, outcome }) => {
  const ranking = [...session.teams]
    .map(t => ({ team: t, score: t.outcome?.score ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const rank = ranking.findIndex(r => r.team.id === team.id) + 1;
  const style = VERDICT_STYLE[outcome.verdict];

  return (
    <div className={`p-5 rounded-2xl border-2 ${style.className} flex flex-col gap-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-current flex items-center justify-center text-4xl font-black font-mono">
            {outcome.grade}
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400">SIMULATION COMPLETE — {session.totalRounds} QUARTERS</div>
            <div className="text-2xl font-black tracking-wide">{style.label}</div>
            <div className="text-sm text-slate-300 font-mono">
              Score {outcome.score}/100 · {outcome.objectivesMet}/{outcome.objectives.length} objectives met
              {session.teams.length > 1 && ` · Rank #${rank} of ${session.teams.length}`}
            </div>
          </div>
        </div>
        <Award className="w-12 h-12 opacity-60 hidden sm:block" />
      </div>

      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-400 text-left border-b border-slate-700">
            <th className="py-1.5">Objective</th>
            <th className="py-1.5">Target</th>
            <th className="py-1.5">Final</th>
            <th className="py-1.5 text-right">Result</th>
          </tr>
        </thead>
        <tbody>
          {outcome.objectives.map(o => (
            <tr key={o.key} className="border-b border-slate-800/60">
              <td className="py-1.5 text-slate-200">{o.label}</td>
              <td className="py-1.5 text-slate-400">{o.comparator} {formatValue(o, o.target)}</td>
              <td className="py-1.5 text-slate-100 font-bold">{formatValue(o, o.actual)}</td>
              <td className="py-1.5 text-right">
                {o.met ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 inline" />
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
              #{i + 1} {r.team.avatar} {r.team.name}: {r.team.outcome?.grade ?? '—'} ({r.score})
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
