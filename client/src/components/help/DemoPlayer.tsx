// ============================================================================
// GEMSIM: COMMENTED DEMO
// Replays a scenario with two opposite strategies, quarter by quarter, through
// the real engine, with commentary. Runs entirely in the browser.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { PlayCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { replayStrategy, BotStrategy, StrategyReplay } from '../../../../server/src/engine/balance';
import { useGameText } from '../../i18n/game';
import { useHelpStore } from '../../stores/useHelpStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import type { Scenario, TeamMetrics } from '../../types/index';
import type { TranslationKey } from '../../i18n';

const STRATEGIES: BotStrategy[] = ['ARCHITECT', 'COWBOY'];

function delta(before: number, after: number, suffix = '') {
  const d = after - before;
  return `${before}${suffix} → ${after}${suffix} (${d >= 0 ? '+' : ''}${d})`;
}

export const DemoPlayer: React.FC = () => {
  const open = useHelpStore(s => s.demoOpen);
  const setOpen = useHelpStore(s => s.setDemoOpen);
  const scenarios = useSimulationStore(s => s.scenarios);
  const current = useSimulationStore(s => s.currentScenario);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const scenario: Scenario | undefined = scenarios.find(s => s.id === scenarioId) ?? current ?? scenarios[0];
  const { t, vocab, code, category, objective } = useGameText(scenario);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const replays = useMemo<Record<BotStrategy, StrategyReplay> | null>(() => {
    if (!open || !scenario) return null;
    return Object.fromEntries(STRATEGIES.map(s => [s, replayStrategy(scenario, s)])) as Record<BotStrategy, StrategyReplay>;
  }, [open, scenario]);

  if (!open || !scenario || !replays) return null;

  const rounds = scenario.totalRounds || 4;
  const lastStep = rounds + 1;
  const initiativeName = (id: string) => scenario.initiativesCatalog.find(i => i.id === id)?.name ?? id;
  const eventChoiceText = (round: number, id?: string) =>
    id ? scenario.roundEvents.find(e => e.roundNumber === round)?.choices.find(c => c.id === id)?.text : undefined;

  const metricRows = (before: TeamMetrics, after: TeamMetrics) => [
    [vocab.metrics.technicalDebtIndex.label, delta(before.technicalDebtIndex, after.technicalDebtIndex)],
    [vocab.metrics.deliveryVelocity.label, delta(before.deliveryVelocity, after.deliveryVelocity)],
    [vocab.metrics.budgetRemaining.label, delta(before.budgetRemaining, after.budgetRemaining, 'K$')],
    [vocab.metrics.stakeholderTrust.label, delta(before.stakeholderTrust, after.stakeholderTrust)],
    [vocab.metrics.resilienceIndex.label, delta(before.resilienceIndex, after.resilienceIndex)],
    ...(after.marketShare !== undefined
      ? [
          [vocab.metrics.marketShare.label, `${after.marketShare} %`],
          [vocab.metrics.operatingProfit.label, `${(after.operatingProfit ?? 0).toLocaleString()}K$`],
        ]
      : []),
  ];

  const a = replays.ARCHITECT;
  const c = replays.COWBOY;

  // Commentary follows the actual numbers: the shortcut does not always buy speed, even in Q1
  const commentary = (quarter: number) => {
    const ra = a.quarters[quarter - 1].result.metricsAfter;
    const rc = c.quarters[quarter - 1].result.metricsAfter;
    const velocityGap = rc.deliveryVelocity - ra.deliveryVelocity;
    const debtGap = rc.technicalDebtIndex - ra.technicalDebtIndex;
    const cashGap = ra.budgetRemaining - rc.budgetRemaining;
    const labels = {
      velocity: vocab.metrics.deliveryVelocity.label.toLowerCase(),
      debt: vocab.metrics.technicalDebtIndex.label.toLowerCase(),
    };
    const lesson =
      quarter === 1
        ? velocityGap > 0
          ? t('demo.lesson.1')
          : t('demo.lesson.1b')
        : t(`demo.lesson.${Math.min(quarter, 4)}` as TranslationKey);
    const parts = [
      velocityGap === 0
        ? t('demo.gap.velocitySame', labels)
        : t(velocityGap > 0 ? 'demo.gap.velocityMore' : 'demo.gap.velocityLess', { n: Math.abs(velocityGap), ...labels }),
      debtGap === 0 ? t('demo.gap.debtSame', labels) : t(debtGap > 0 ? 'demo.gap.debtMore' : 'demo.gap.debtLess', { n: Math.abs(debtGap), ...labels }),
      cashGap >= 0 ? t('demo.gap.cashArchitect', { n: cashGap }) : t('demo.gap.cashShortcut', { n: -cashGap }),
    ];
    const market =
      ra.marketShare !== undefined && rc.marketShare !== undefined
        ? ' ' + t('demo.gap.market', { shareA: ra.marketShare, shareC: rc.marketShare, profitA: ra.operatingProfit ?? 0, profitC: rc.operatingProfit ?? 0 })
        : '';
    return `${lesson} ${t('demo.gap.intro')} ${parts.join(', ')}.${market}`;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-title"
        className="bg-dark-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800">
          <h2 id="demo-title" className="font-bold text-slate-100 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-cyan-400" aria-hidden="true" />
            {t('demo.title')}
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 flex items-center gap-2">
              {t('demo.scenario')}
              <select
                value={scenario.id}
                onChange={e => {
                  setScenarioId(e.target.value);
                  setStep(0);
                }}
                className="bg-dark-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 max-w-[16rem]"
              >
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <nav aria-label={t('demo.steps')} className="flex items-center gap-1 px-4 pt-3 text-[11px] font-mono">
          {Array.from({ length: lastStep + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-current={step === i ? 'step' : undefined}
              className={`px-2.5 py-1 rounded-lg border ${step === i ? 'bg-cyan-500 text-black border-cyan-500 font-bold' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              {i === 0 ? t('demo.step.intro') : i === lastStep ? t('demo.step.verdict') : t('common.quarterShort', { n: i })}
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto p-4 space-y-4" aria-live="polite">
          {step === 0 && (
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>{t('demo.intro', { title: scenario.title })}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STRATEGIES.map(s => (
                  <div key={s} className={`p-3 rounded-xl border ${s === 'ARCHITECT' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'}`}>
                    <div className="font-bold text-slate-100">{t(`demo.strategy.${s}` as TranslationKey)}</div>
                    <p className="text-xs text-slate-400 mt-1">{t(`demo.strategy.${s}.desc` as TranslationKey, { posture: vocab.postures[s === 'ARCHITECT' ? 'ACCELERATED_MODERN' : 'BYPASS_ARCH'].name })}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">{t('demo.engineNote')}</p>
            </div>
          )}

          {step >= 1 && step <= rounds && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STRATEGIES.map(s => {
                  const q = replays[s].quarters[step - 1];
                  const response = eventChoiceText(step, q.decision.eventChoiceId);
                  return (
                    <section key={s} className={`p-3 rounded-xl border space-y-2 ${s === 'ARCHITECT' ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
                      <h3 className="font-bold text-slate-100 text-sm">{t(`demo.strategy.${s}` as TranslationKey)}</h3>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div>
                          <span className="text-slate-500">{t('demo.initiatives')} </span>
                          {q.decision.selectedInitiativeIds.length
                            ? q.decision.selectedInitiativeIds
                                .map(id => `${initiativeName(id)} (${category(scenario.initiativesCatalog.find(i => i.id === id)?.category ?? '')})`)
                                .join(', ')
                            : t('demo.none')}
                        </div>
                        <div>
                          <span className="text-slate-500">{t('demo.posture')} </span>
                          {vocab.postures[q.decision.governancePosture].name}
                        </div>
                        <div>
                          <span className="text-slate-500">{t('demo.crisis')} </span>
                          {response ?? t('demo.noCrisisResponse')}
                        </div>
                      </div>
                      <table className="w-full text-[11px] font-mono">
                        <tbody>
                          {metricRows(q.before, q.result.metricsAfter).map(([label, value]) => (
                            <tr key={label} className="border-t border-slate-800">
                              <td className="py-1 text-slate-400 pr-2">{label}</td>
                              <td className="py-1 text-slate-200 text-right">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {q.result.incidentsTriggered.length > 0 && (
                        <p className="text-[11px] text-rose-300">{t('demo.incidents', { n: q.result.incidentsTriggered.length })}</p>
                      )}
                      <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5">
                        {(q.result.notes ?? []).map((n, i) => (
                          <li key={i}>{code(n)}</li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-sm text-indigo-100 leading-relaxed">
                <strong>{t('demo.commentary')} </strong>
                {commentary(step)}
              </div>
            </>
          )}

          {step === lastStep && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STRATEGIES.map(s => {
                  const o = replays[s].outcome;
                  return (
                    <section key={s} className={`p-3 rounded-xl border ${o.verdict === 'VICTORY' ? 'border-emerald-500/50' : o.verdict === 'PARTIAL' ? 'border-amber-500/50' : 'border-rose-500/50'}`}>
                      <h3 className="font-bold text-slate-100 text-sm">
                        {t(`demo.strategy.${s}` as TranslationKey)} — {t(`outcome.verdict.${o.verdict}` as TranslationKey)} ({o.grade}, {o.score}/100)
                      </h3>
                      <ul className="mt-2 text-xs space-y-0.5">
                        {o.objectives.map(ob => (
                          <li key={ob.key} className={ob.met ? 'text-emerald-300' : 'text-rose-300'}>
                            {ob.met ? '✓' : '✗'} {objective(ob.key)} : {ob.actual} ({ob.comparator} {ob.target})
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
              <p className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-sm text-indigo-100 leading-relaxed">{t('demo.takeaway')}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-800">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> {t('common.previous')}
          </button>
          {step < lastStep ? (
            <button onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-black flex items-center gap-1">
              {t('common.next')} <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-black">
              {t('common.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
