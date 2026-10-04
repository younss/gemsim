// ============================================================================
// GEMSIM: "WHAT IF" PANEL
// Change one past quarter's decision and replay the whole game with everything
// else kept as it happened (other teams, crises, negotiations, promises).
// ============================================================================

import React, { useEffect, useState } from 'react';
import { GovernancePosture, Scenario, SimulationSession, Team, TeamDecision } from '../../types/index';
import { api, WhatIfResult } from '../../services/api';
import { getRoundEvent } from '../../engine';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { RotateCcw, Loader2 } from 'lucide-react';

interface Props {
  scenario: Scenario;
  session: SimulationSession;
  team: Team;
}

const POSTURES: GovernancePosture[] = ['BYPASS_ARCH', 'BALANCED_AGILE', 'STRICT_GOVERNANCE', 'ACCELERATED_MODERN'];

export const WhatIfPanel: React.FC<Props> = ({ scenario, session, team }) => {
  const { t, vocab, code, objective, money } = useGameText(scenario);
  const rounds = team.history.filter(h => h.decision).map(h => h.roundNumber);
  const [round, setRound] = useState<number>(rounds[0] ?? 1);
  const [decision, setDecision] = useState<Omit<TeamDecision, 'customPacts'> | null>(null);
  const [priceIndex, setPriceIndex] = useState(100);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from what the team really decided that quarter
  useEffect(() => {
    const recorded = team.history.find(h => h.roundNumber === round)?.decision;
    if (!recorded) return;
    const { customPacts: _pacts, ...rest } = recorded;
    setDecision(rest);
    const seg = scenario.market?.segments[0];
    setPriceIndex(seg && recorded.market ? Math.round(((recorded.market.prices[seg.id] ?? seg.referencePrice) / seg.referencePrice) * 100) : 100);
    setResult(null);
  }, [round, team.id, team.history.length]);

  if (rounds.length === 0) {
    return <p className="text-xs text-slate-500">{t('whatif.unavailable')}</p>;
  }
  if (!decision) return null;

  const event = getRoundEvent(scenario, round, session.injectedEvents);
  const toggle = (id: string) =>
    setDecision(d => d && { ...d, selectedInitiativeIds: d.selectedInitiativeIds.includes(id) ? d.selectedInitiativeIds.filter(x => x !== id) : [...d.selectedInitiativeIds, id] });

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const market =
        scenario.market && decision.market
          ? {
              ...decision.market,
              prices: Object.fromEntries(scenario.market.segments.map(s => [s.id, Math.round(s.referencePrice * priceIndex * 100) / 10000])),
            }
          : decision.market;
      setResult(await api.whatIf(session.id, team.id, round, { ...decision, market }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const base = result?.baseline.outcome;
  const alt = result?.alternative?.outcome;

  return (
    <section aria-label={t('whatif.title')} className="bg-dark-850 p-4 rounded-xl border border-amber-500/30 space-y-3">
      <div>
        <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t('whatif.title')}
        </h4>
        <p className="text-xs text-slate-400">{t('whatif.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <label className="space-y-1 block">
          <span className="text-slate-400">{t('whatif.quarter')}</span>
          <select value={round} onChange={e => setRound(Number(e.target.value))} className="w-full bg-dark-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100">
            {rounds.map(r => (
              <option key={r} value={r}>
                {t('common.quarterShort', { n: r })}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 block">
          <span className="text-slate-400">{t('whatif.posture')}</span>
          <select
            value={decision.governancePosture}
            onChange={e => setDecision({ ...decision, governancePosture: e.target.value as GovernancePosture })}
            className="w-full bg-dark-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
          >
            {POSTURES.map(p => (
              <option key={p} value={p}>
                {vocab.postures[p].name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="text-xs">
        <legend className="text-slate-400 mb-1">{t('whatif.initiatives')}</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {scenario.initiativesCatalog.map(init => (
            <label key={init.id} className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={decision.selectedInitiativeIds.includes(init.id)} onChange={() => toggle(init.id)} className="accent-amber-500" />
              <span>{init.name}</span>
              <span className="text-slate-500 font-mono">{money(init.capExCost)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {event?.choices.length ? (
        <label className="text-xs space-y-1 block">
          <span className="text-slate-400">{t('whatif.crisis', { title: event.title })}</span>
          <select
            value={decision.eventChoiceId ?? ''}
            onChange={e => setDecision({ ...decision, eventChoiceId: e.target.value || undefined })}
            className="w-full bg-dark-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
          >
            <option value="">{t('whatif.noAnswer')}</option>
            {event.choices.map(c => (
              <option key={c.id} value={c.id}>
                {c.text}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {scenario.market && (
        <label className="text-xs space-y-1 block">
          <span className="text-slate-400">{t('whatif.price', { index: priceIndex })}</span>
          <input type="range" min={50} max={200} step={1} value={priceIndex} onChange={e => setPriceIndex(Number(e.target.value))} className="w-full accent-amber-500" />
        </label>
      )}

      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        {t('whatif.run')}
      </button>

      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      {result && result.issues.length > 0 && (
        <div role="alert" className="text-xs text-rose-300 space-y-0.5">
          {result.issues.map((issue, i) => (
            <div key={i}>⛔ {code(issue)}</div>
          ))}
        </div>
      )}

      {base && alt && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-100">
            {t('whatif.summary', {
              before: `${t(`outcome.verdict.${base.verdict}` as TranslationKey)} ${base.grade} (${base.score})`,
              after: `${t(`outcome.verdict.${alt.verdict}` as TranslationKey)} ${alt.grade} (${alt.score})`,
            })}
          </p>
          <table className="w-full text-xs font-mono">
            <thead className="text-slate-500 text-[10px]">
              <tr>
                <th className="text-left py-1">{t('outcome.col.objective')}</th>
                <th className="text-right py-1">{t('whatif.played')}</th>
                <th className="text-right py-1">{t('whatif.alternative')}</th>
              </tr>
            </thead>
            <tbody>
              {base.objectives.map(o => {
                const a = alt.objectives.find(x => x.key === o.key)!;
                return (
                  <tr key={o.key} className="border-t border-slate-800">
                    <td className="py-1 text-slate-400">{objective(o.key)}</td>
                    <td className={`py-1 text-right ${o.met ? 'text-emerald-400' : 'text-rose-400'}`}>{o.actual}</td>
                    <td className={`py-1 text-right ${a.met ? 'text-emerald-400' : 'text-rose-400'}`}>{a.actual}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500">{t('whatif.method')}</p>
        </div>
      )}
    </section>
  );
};
