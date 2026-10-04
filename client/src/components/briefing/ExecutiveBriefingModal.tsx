// ============================================================================
// GEMSIM: CASE FILE (MISSION BRIEFING)
// Context, organisation map, executives, and every rule with the 7 win conditions.
// Rules are computed from the scenario so they always match what the engine applies.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Scenario, Team, SimulationSession, TeamMetrics } from '../../types/index';
import { FileText, Target, Users, AlertTriangle, X, Layers, ArrowRight, BookOpen, ListChecks } from 'lucide-react';
import { evaluateOutcome, DEFAULT_MAX_INITIATIVES_PER_ROUND } from '../../engine';
import { getRunAllocation } from '../../../../server/src/engine/resolver';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { useHelpStore } from '../../stores/useHelpStore';
import { InfoTip } from '../help/InfoTip';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario;
  session: SimulationSession;
  team: Team;
}

type Tab = 'CASE' | 'MAP' | 'PEOPLE' | 'RULES';

export const ExecutiveBriefingModal: React.FC<Props> = ({ isOpen, onClose, scenario, session, team }) => {
  const { t, vocab, objective, risk } = useGameText(scenario);
  const setGlossaryOpen = useHelpStore(s => s.setGlossaryOpen);
  const [activeTab, setActiveTab] = useState<Tab>('CASE');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const m = vocab.metrics;
  const baseline: TeamMetrics = {
    ...scenario.baselineMetrics,
    modernizedNodesCount: scenario.topology.nodes.filter(n => n.status === 'MODERNIZED').length,
  };
  const startOutcome = evaluateOutcome(scenario, baseline, session?.teams.length ?? 1);
  const isMarketKey = (key: string) => key === 'marketShare' || key === 'cumulativeProfit';
  const capacity = scenario.maxInitiativesPerRound ?? DEFAULT_MAX_INITIATIVES_PER_ROUND;
  const runAllocation = getRunAllocation(scenario);
  const multiQuarter = scenario.initiativesCatalog.filter(i => (i.durationRounds ?? 1) > 1).map(i => i.name);
  const examples = [...scenario.initiativesCatalog]
    .filter(i => i.tdiDelta < 0)
    .sort((a, b) => a.tdiDelta - b.tdiDelta)
    .slice(0, 3)
    .map(i => i.name);
  const fmt = (key: string, value: number) =>
    key === 'tco' || key === 'solvency' || key === 'cumulativeProfit' ? `${value.toLocaleString()}K$` : key === 'marketShare' ? `${value} %` : `${value}`;

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'CASE', label: t('brief.tab.case'), icon: FileText },
    { id: 'MAP', label: t('brief.tab.map'), icon: Layers },
    { id: 'PEOPLE', label: t('brief.tab.people', { n: scenario.stakeholders.length }), icon: Users },
    { id: 'RULES', label: t('brief.tab.rules'), icon: Target },
  ];

  const rules: Array<{ title: string; body: string }> = [
    { title: t('brief.rule.budget.title'), body: t('brief.rule.budget.body') },
    { title: t('brief.rule.capacity.title'), body: t('brief.rule.capacity.body', { n: capacity }) },
    {
      title: t('brief.rule.initiatives.title'),
      body: t('brief.rule.initiatives.body') + (multiQuarter.length ? ' ' + t('brief.rule.initiatives.multi', { list: multiQuarter.join(', ') }) : ''),
    },
    { title: t('brief.rule.run.title'), body: t('brief.rule.run.body', { amount: runAllocation }) },
    { title: t('brief.rule.debt.title', { debt: m.technicalDebtIndex.label }), body: t('brief.rule.debt.body', { debt: m.technicalDebtIndex.label.toLowerCase(), velocity: m.deliveryVelocity.label.toLowerCase() }) },
    { title: t('brief.rule.posture.title'), body: t('brief.rule.posture.body', { shortcut: vocab.postures.BYPASS_ARCH.name, strict: vocab.postures.STRICT_GOVERNANCE.name }) },
    { title: t('brief.rule.compliance.title', { compliance: m.complianceScore.label }), body: t('brief.rule.compliance.body') },
    { title: t('brief.rule.insolvency.title'), body: t('brief.rule.insolvency.body') },
    { title: t('brief.rule.incidents.title'), body: t('brief.rule.incidents.body', { noun: vocab.nodeNoun, resilience: m.resilienceIndex.label.toLowerCase() }) },
    { title: t('brief.rule.crisis.title'), body: t('brief.rule.crisis.body') },
    { title: t('brief.rule.patience.title'), body: t('brief.rule.patience.body') },
    { title: t('brief.rule.pacts.title'), body: t('brief.rule.pacts.body') },
    { title: t('brief.rule.board.title'), body: t('brief.rule.board.body', { extreme: risk('EXTREME'), high: risk('HIGH'), velocity: m.deliveryVelocity.label.toLowerCase() }) },
    ...(scenario.market
      ? [
          {
            title: t('brief.rule.market.title'),
            body: t('brief.rule.market.body', {
              segments: scenario.market.segments.length,
              rivals: scenario.market.rivals.map(r => r.name).join(', '),
              debt: m.technicalDebtIndex.label.toLowerCase(),
              velocity: m.deliveryVelocity.label.toLowerCase(),
              resilience: m.resilienceIndex.label.toLowerCase(),
              retention: Math.round(scenario.market.cashRetention * 100),
            }),
          },
        ]
      : []),
  ];

  const weightLabels: Array<[keyof Scenario['stakeholders'][number]['decisionWeights'], string]> = [
    ['financialAcumen', t('brief.weight.finance')],
    ['deliverySpeed', t('brief.weight.speed')],
    ['architecturalRigor', t('brief.weight.rigor')],
    ['regulatoryCompliance', t('brief.weight.compliance')],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brief-title"
        className="bg-dark-900 border border-cyan-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-dark-950 border-b border-slate-800 p-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase tracking-wider">
                  {t('brief.badge')}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline truncate">{scenario.industry}</span>
              </div>
              <h2 id="brief-title" className="text-lg font-bold text-slate-100 flex flex-wrap items-center gap-2 mt-0.5">
                <span>{scenario.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-mono">
                  {t(`brief.difficulty.${scenario.difficulty}` as TranslationKey)}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-white border border-slate-700 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team banner */}
        <div className="bg-gradient-to-r from-cyan-950/40 via-dark-850 to-indigo-950/40 px-6 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{t('brief.team')}</span>
            <span className="font-bold text-cyan-300">
              {team.avatar} {team.name}
            </span>
          </div>
          <div className="text-slate-400 hidden sm:block">{t('brief.timeline', { n: session.totalRounds })}</div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label={t('brief.badge')} className="flex flex-wrap items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-dark-900/90 text-xs font-mono">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 ${
                activeTab === tab.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'CASE' && (
            <div className="space-y-5">
              <section className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">{t('brief.case.summary')}</h3>
                <p className="text-sm text-slate-200 leading-relaxed">{scenario.description}</p>
              </section>
              <section className="bg-dark-850 p-5 rounded-xl border border-rose-500/30 space-y-3">
                <h3 className="flex items-center gap-2 text-rose-400 font-bold text-xs font-mono">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  {t('brief.case.challenge')}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">{scenario.businessContext}</p>
              </section>
              <section>
                <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">{t('brief.case.baseline')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  {(
                    [
                      ['technicalDebtIndex', `${baseline.technicalDebtIndex}`],
                      ['deliveryVelocity', `${baseline.deliveryVelocity}`],
                      ['budgetRemaining', `${baseline.budgetRemaining}K$`],
                      ['stakeholderTrust', `${baseline.stakeholderTrust} %`],
                      ['resilienceIndex', `${baseline.resilienceIndex}`],
                      ['complianceScore', `${baseline.complianceScore} %`],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key} className="bg-dark-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 text-[10px] flex items-center">
                        <span className="truncate">{m[key].label}</span>
                        <InfoTip text={m[key].description} label={m[key].label} />
                      </span>
                      <span className="text-slate-100 font-bold text-base">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'MAP' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">{t('brief.map.intro', { n: scenario.topology.nodes.length, noun: vocab.nodeNoun })}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scenario.topology.nodes.map(node => (
                  <div
                    key={node.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      node.status === 'CRITICAL' ? 'bg-rose-950/20 border-rose-500/40' : node.status === 'DEGRADED' ? 'bg-amber-950/20 border-amber-500/40' : 'bg-dark-850 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">{node.name}</span>
                      <span className="text-[10px] font-mono px-1.5 rounded bg-dark-950 border border-slate-700 text-cyan-400 shrink-0">{vocab.layers[node.layer]}</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{node.description}</p>
                    <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-400 pt-1">
                      <span>
                        {m.technicalDebtIndex.label} : <strong className={node.technicalDebt > 60 ? 'text-rose-400' : 'text-slate-200'}>{node.technicalDebt}</strong>
                      </span>
                      <span>
                        {t('brief.map.health')} : <strong className="text-slate-200">{node.health}</strong>
                      </span>
                      <span>
                        {t('brief.map.cost')} : <strong className="text-slate-200">{node.costPerRound}K$</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'PEOPLE' && (
            <div className="space-y-4">
              <div className="bg-dark-850 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="text-cyan-400 font-bold block mb-1">{t('brief.people.tipTitle')}</span>
                {t('brief.people.tip')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scenario.stakeholders.map(sh => (
                  <article key={sh.id} className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 rounded-lg bg-dark-900 border border-slate-700" aria-hidden="true">
                        {sh.avatar}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{sh.name}</h4>
                        <div className="text-cyan-400 text-[11px] font-mono">{sh.title}</div>
                      </div>
                    </div>
                    <p className="text-slate-300">
                      <span className="text-slate-400 font-bold">{t('brief.people.bias')} </span>
                      {sh.bias}
                    </p>
                    <p className="text-slate-300">
                      <span className="text-amber-400 font-bold">{t('brief.people.agenda')} </span>
                      {sh.hiddenAgenda}
                    </p>
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{t('brief.people.priorities')}</span>
                      {weightLabels.map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                          <span className="w-28 shrink-0">{label}</span>
                          <div className="flex-1 bg-dark-950 h-1.5 rounded-full overflow-hidden" role="meter" aria-label={label} aria-valuenow={Math.round(sh.decisionWeights[key] * 100)} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full bg-cyan-500" style={{ width: `${Math.round(sh.decisionWeights[key] * 100)}%` }} />
                          </div>
                          <span className="w-8 text-right">{Math.round(sh.decisionWeights[key] * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'RULES' && (
            <div className="space-y-4">
              <section className="bg-dark-850 p-5 rounded-xl border border-cyan-500/30 space-y-3">
                <h3 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">{t('brief.rules.objectivesTitle', { n: startOutcome.objectives.length })}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{t('brief.rules.objectivesIntro')}</p>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-slate-400 text-left border-b border-slate-700">
                      <th className="py-1.5">{t('outcome.col.objective')}</th>
                      <th className="py-1.5">{t('outcome.col.target')}</th>
                      <th className="py-1.5">{t('brief.rules.start')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {startOutcome.objectives.map(o => (
                      <tr key={o.key} className="border-b border-slate-800/60">
                        <td className="py-1.5 text-slate-200">{objective(o.key)}</td>
                        <td className="py-1.5 text-cyan-300 font-bold">
                          {o.comparator} {fmt(o.key, o.target)}
                        </td>
                        <td className={`py-1.5 ${o.met ? 'text-emerald-400' : 'text-rose-400'}`}>{isMarketKey(o.key) ? '—' : fmt(o.key, o.actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="text-xs text-slate-300 space-y-1">
                  <li>🏆 {t('brief.rules.victory', { n: startOutcome.objectives.length })}</li>
                  <li>🥈 {t('brief.rules.partial', { half: Math.ceil(startOutcome.objectives.length / 2) })}</li>
                  <li>❌ {t('brief.rules.defeat')}</li>
                </ul>
              </section>

              <section className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('brief.rules.title')}
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {rules.map(rule => (
                    <div key={rule.title} className="bg-dark-950 p-3 rounded-lg border border-slate-800">
                      <dt className="font-bold text-slate-100">{rule.title}</dt>
                      <dd className="text-slate-400 mt-1 leading-relaxed">{rule.body}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{t('brief.cycle.title')}</h3>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                  <li>{t('brief.cycle.1', { noun: vocab.nodeNoun })}</li>
                  <li>{t('brief.cycle.2')}</li>
                  <li>{t('brief.cycle.3')}</li>
                  <li>{t('brief.cycle.4', { examples: examples.join(', ') })}</li>
                  <li>{t('brief.cycle.5')}</li>
                  <li>{t('brief.cycle.6')}</li>
                  <li>{t('brief.cycle.7')}</li>
                </ol>
              </section>
            </div>
          )}
        </div>

        <div className="bg-dark-950 border-t border-slate-800 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button onClick={() => setGlossaryOpen(true)} className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline text-left">
            {t('brief.openGlossary')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-bold text-xs font-mono flex items-center justify-center gap-2"
          >
            <span>{t('brief.enter')}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
