// ============================================================================
// GEMSIM: FACILITATOR WAR ROOM & OPERATIONS TELEMETRY COCKPIT
// Multi-Team Oversight, Master Round Controls, Event Injection, and Post-Mortem Debrief
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  SimulationSession,
  Scenario,
  Team,
  RoundEvent,
  ArchivedSimulationRun,
} from '../../types/index';
import { api } from '../../services/api';
import { evaluateOutcome } from '../../engine';
import { TeamRadarChart } from './TeamRadarChart';
import { buildCrisisTemplates, CrisisTemplate } from './crisisTemplates';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Radio,
  Send,
  Flame,
  Download,
  Trophy,
  CheckCircle2,
  Clock,
  Users,
  ShieldAlert,
  BarChart3,
  Sliders,
  Share2,
  Archive,
  History,
  Calendar,
} from 'lucide-react';
import { WorkshopInvitesModal } from './WorkshopInvitesModal';

interface Props {
  session: SimulationSession;
  scenario: Scenario;
  onSessionUpdated: (updatedSession: SimulationSession) => void;
}

export const FacilitatorCockpit: React.FC<Props> = ({
  session,
  scenario,
  onSessionUpdated,
}) => {
  const { t, vocab, objective, severity, code } = useGameText(scenario);
  const crisisTemplates = buildCrisisTemplates(scenario, t);
  const [broadcastText, setBroadcastText] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'CONTROLS' | 'INJECTION' | 'DEBRIEF'>('TELEMETRY');
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);
  const [archivedRuns, setArchivedRuns] = useState<ArchivedSimulationRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<'CURRENT' | string>('CURRENT');

  // Load archived runs for this session
  useEffect(() => {
    api.getSessionRuns(session.id).then(runs => {
      setArchivedRuns(runs);
    }).catch(err => console.error('Failed to fetch runs:', err));
  }, [session.id, session.updatedAt]);

  // Master Timer actions
  const handleToggleTimer = async () => {
    try {
      const updated = await api.updateTimer(session.id, {
        isRunning: !session.isTimerRunning,
      });
      onSessionUpdated(updated);
    } catch (err) {
      console.error('Timer error:', err);
    }
  };

  const handleResetTimer = async () => {
    try {
      const updated = await api.updateTimer(session.id, {
        secondsRemaining: session.roundDurationSeconds,
        isRunning: false,
      });
      onSessionUpdated(updated);
    } catch (err) {
      console.error('Timer reset error:', err);
    }
  };

  // Master Round Advance
  const handleAdvanceRound = async () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      const { session: updated } = await api.advanceRound(session.id);
      onSessionUpdated(updated);
    } catch (err) {
      console.error('Advance error:', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  // Master Session Reset (Preserves Previous Simulation Results in Run Archives)
  const handleResetSession = async () => {
    if (!confirm(t('cockpit.resetConfirm'))) return;
    try {
      const { session: updated, archivedRun } = await api.resetSession(session.id);
      onSessionUpdated(updated);
      if (archivedRun) {
        setArchivedRuns(prev => [archivedRun, ...prev]);
        setSelectedRunId(archivedRun.id);
      }
    } catch (err) {
      console.error('Reset session error:', err);
    }
  };

  // Send Broadcast
  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    try {
      await api.broadcastAnnouncement(session.id, broadcastText.trim());
      setBroadcastText('');
    } catch (err) {
      console.error('Broadcast error:', err);
    }
  };

  // Inject Event
  const handleInjectCrisis = async (template: CrisisTemplate) => {
    const crisisEvent: RoundEvent = {
      roundNumber: session.currentRound,
      title: template.title,
      description: template.description,
      type: template.type,
      severity: template.severity,
      immediateImpact: template.immediateImpact,
      choices: template.choices,
    };

    try {
      const res = await api.injectEvent(session.id, crisisEvent);
      if (res.session) {
        onSessionUpdated(res.session);
      }
    } catch (err) {
      console.error('Injection error:', err);
    }
  };

  // Debrief Winner Calculation
  // Ranked on the scenario's win conditions (final verdict once completed, projection before)
  const outcomes = new Map(session.teams.map(t => [t.id, t.outcome ?? evaluateOutcome(scenario, t.metrics, session.teams.length)]));
  const hasMarket = !!scenario.market;
  const sortedTeams = [...session.teams].sort((a, b) => outcomes.get(b.id)!.score - outcomes.get(a.id)!.score);

  const allTeamsSubmitted = session.teams.every(t => t.decisionSubmitted);

  const handleExportMarkdown = () => {
    const m = vocab.metrics;
    const verdict = (v: string) => t(`outcome.verdict.${v}` as TranslationKey);
    const lines: string[] = [
      `# ${t('cockpit.md.title', { name: session.name })}`,
      '',
      `- ${t('cockpit.md.scenario', { title: scenario.title })}`,
      `- ${t('cockpit.md.quarters', { played: session.state === 'COMPLETED' ? session.totalRounds : session.currentRound - 1, total: session.totalRounds })}`,
      `- ${t('cockpit.md.exported', { date: new Date().toISOString() })}`,
      '',
      `## ${t('cockpit.md.rankings')}`,
      '',
      `| # | ${t('cockpit.col.team')} | ${t('cockpit.col.verdict')} | ${t('cockpit.col.grade')} | Score | ${m.technicalDebtIndex.label} | ${m.deliveryVelocity.label} | ${m.stakeholderTrust.label} | ${m.resilienceIndex.label} | ${m.budgetRemaining.label} | ${m.tco.label} |`,
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...sortedTeams.map((tm, i) => {
        const o = outcomes.get(tm.id)!;
        const mt = tm.metrics;
        return `| ${i + 1} | ${tm.name} | ${verdict(o.verdict)} | ${o.grade} | ${o.score} | ${mt.technicalDebtIndex} | ${mt.deliveryVelocity} | ${mt.stakeholderTrust} | ${mt.resilienceIndex} | ${mt.budgetRemaining}K$ | ${mt.tco}K$ |`;
      }),
    ];
    for (const tm of sortedTeams) {
      const o = outcomes.get(tm.id)!;
      lines.push('', `## ${tm.name} — ${verdict(o.verdict)} (${o.grade})`, '', `| ${t('outcome.col.objective')} | ${t('outcome.col.target')} | ${t('outcome.col.final')} | ✓ |`, '| --- | --- | --- | --- |');
      for (const ob of o.objectives) lines.push(`| ${objective(ob.key)} | ${ob.comparator} ${ob.target} | ${ob.actual} | ${ob.met ? '✅' : '❌'} |`);
      const marketRows = tm.history.filter(h => h.market);
      if (marketRows.length) {
        lines.push('', `### ${t('cockpit.market.title')}`, '', `| ${t('common.quarter')} | ${m.marketShare.label} | ${m.revenue.label} | ${m.operatingProfit.label} |`, '| --- | --- | --- | --- |');
        for (const h of marketRows) lines.push(`| ${h.roundNumber} | ${h.market!.marketShare} % | ${h.market!.revenue}K$ | ${h.market!.operatingProfit}K$ |`);
      }
      lines.push('', `### ${t('cockpit.md.log')}`, '');
      for (const h of tm.history) {
        const notes = h.notes?.length ? h.notes.map(n => code(n)).join(' ') : h.facilitatorFeedback;
        const inits = h.activeInitiativesProgress.map(p => `${p.name}${p.completed ? '' : ` (${t('cockpit.md.left', { n: p.remainingRounds })})`}`).join(', ') || t('demo.none');
        lines.push(`- **${t('common.quarterShort', { n: h.roundNumber })}** : ${notes} ${t('cockpit.md.incidents', { n: h.incidentsTriggered.length })} ${t('cockpit.md.initiatives', { list: inits })}`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/\s+/g, '_')}_Executive_Debrief.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedArchivedRun = archivedRuns.find(r => r.id === selectedRunId);

  // Export Executive Summary (Current or Selected Archived Run)
  const handleExportSummary = () => {
    if (selectedArchivedRun) {
      const blob = new Blob([JSON.stringify(selectedArchivedRun, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.name.replace(/\s+/g, '_')}_Run${selectedArchivedRun.runNumber}_Debrief.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const summary = {
      simulationName: session.name,
      scenarioTitle: scenario.title,
      completedAt: new Date().toISOString(),
      rounds: session.totalRounds,
      winner: sortedTeams[0]?.name,
      teamRankings: sortedTeams.map((t, idx) => ({
        rank: idx + 1,
        teamName: t.name,
        technicalDebtIndex: `${t.metrics.technicalDebtIndex}%`,
        deliveryVelocity: `${t.metrics.deliveryVelocity} pts`,
        stakeholderTrust: `${t.metrics.stakeholderTrust}%`,
        budgetRemaining: `$${t.metrics.budgetRemaining}K`,
        totalTCO: `$${t.metrics.tco}K`,
        resilienceIndex: `${t.metrics.resilienceIndex}/100`,
        complianceScore: `${t.metrics.complianceScore}%`,
        verdict: outcomes.get(t.id)!.verdict,
        grade: outcomes.get(t.id)!.grade,
        score: outcomes.get(t.id)!.score,
        objectives: outcomes.get(t.id)!.objectives,
      })),
    };

    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/\s+/g, '_')}_Executive_Debrief.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Facilitator Master Control Banner */}
      <div className="p-4 bg-gradient-to-r from-dark-850 via-dark-800 to-indigo-950/40 rounded-xl border border-indigo-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h2 className="text-base font-bold text-slate-100 font-mono">{t('cockpit.title')}</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
              {t('arena.quarterOf', { n: session.currentRound, total: session.totalRounds })}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {t('cockpit.subtitle', { n: session.teams.length })}
          </p>
        </div>

        {/* Master Controls & Timers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleToggleTimer}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
              session.isTimerRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
            }`}
          >
            {session.isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{session.isTimerRunning ? t('cockpit.timer.pause') : t('cockpit.timer.start')}</span>
          </button>

          <button
            onClick={handleResetTimer}
            className="p-2 rounded-lg bg-dark-750 hover:bg-dark-700 text-slate-300 border border-slate-700 text-xs"
            title={t('cockpit.timer.reset')}
            aria-label={t('cockpit.timer.reset')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          <button
            onClick={handleAdvanceRound}
            disabled={isAdvancing || session.state === 'COMPLETED'}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
              allTeamsSubmitted
                ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>
              {session.state === 'COMPLETED'
                ? t('arena.complete')
                : session.currentRound >= session.totalRounds
                ? t('cockpit.finalize')
                : t('cockpit.advance', { n: session.currentRound + 1 })}
            </span>
          </button>

          <button
            onClick={handleResetSession}
            className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono"
            title={t('cockpit.reset.title')}
          >
            {t('cockpit.reset')}
          </button>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          <button
            onClick={() => setIsInvitesOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            title={t('cockpit.invites.title')}
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('cockpit.invites')}</span>
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-colors ${
            activeTab === 'TELEMETRY'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{t('cockpit.tab.teams')}</span>
        </button>

        <button
          onClick={() => setActiveTab('INJECTION')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-colors ${
            activeTab === 'INJECTION'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-400" />
          <span>{t('cockpit.tab.crisis')}</span>
        </button>

        <button
          onClick={() => setActiveTab('DEBRIEF')}
          className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-colors ${
            activeTab === 'DEBRIEF'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>{t('cockpit.tab.debrief')}</span>
        </button>
      </div>

      {/* Broadcast Announcement Bar */}
      <div className="p-3 bg-dark-850 rounded-xl border border-slate-800 flex items-center gap-3">
        <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
          type="text"
          value={broadcastText}
          onChange={e => setBroadcastText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendBroadcast()}
          placeholder={t('cockpit.broadcast.placeholder')}
          aria-label={t('cockpit.broadcast.placeholder')}
          className="flex-1 bg-dark-900 text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
        />
        <button
          onClick={handleSendBroadcast}
          disabled={!broadcastText.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black text-xs font-bold flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{t('cockpit.broadcast.send')}</span>
        </button>
      </div>

      {/* TAB 1: Multi-Team Comparative Telemetry */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {session.teams.map((tm, idx) => {
              const tdi = tm.metrics.technicalDebtIndex;
              const isReady = tm.decisionSubmitted;

              return (
                <div
                  key={tm.id}
                  className="bg-dark-850 p-5 rounded-xl border border-slate-800 shadow-xl space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner"
                        style={{ backgroundColor: `${tm.color}20`, border: `1px solid ${tm.color}60` }}
                      >
                        {tm.avatar}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{tm.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{t('cockpit.team', { n: idx + 1 })}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                        isReady
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                      }`}
                    >
                      {isReady ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {isReady ? t('cockpit.ready') : t('cockpit.planning')}
                    </span>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-dark-900 p-3 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.technicalDebtIndex.label}</span>
                      <span className={`font-bold ${tdi > 65 ? 'text-rose-400' : tdi > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {tdi}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.deliveryVelocity.label}</span>
                      <span className="font-bold text-cyan-400">{tm.metrics.deliveryVelocity}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.budgetRemaining.label}</span>
                      <span className="font-bold text-slate-200">{tm.metrics.budgetRemaining}K$</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.stakeholderTrust.label}</span>
                      <span className="font-bold text-indigo-400">{tm.metrics.stakeholderTrust} %</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.resilienceIndex.label}</span>
                      <span className="font-bold text-emerald-400">{tm.metrics.resilienceIndex}/100</span>
                    </div>

                    {hasMarket && (
                      <>
                        <div>
                          <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.marketShare.label}</span>
                          <span className="font-bold text-cyan-300">{tm.metrics.marketShare !== undefined ? `${tm.metrics.marketShare} %` : '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.cumulativeProfit.label}</span>
                          <span className={`font-bold ${(tm.metrics.cumulativeProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(tm.metrics.cumulativeProfit ?? 0).toLocaleString()}K$
                          </span>
                        </div>
                      </>
                    )}

                    <div>
                      <span className="text-slate-500 text-[10px] block truncate">{vocab.metrics.complianceScore.label}</span>
                      <span className="font-bold text-violet-400">{tm.metrics.complianceScore} %</span>
                    </div>
                  </div>

                  {/* Governance Strategy Chosen */}
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-500">{t('cockpit.posture')}</span>
                    <span className="text-slate-200 font-semibold">{vocab.postures[tm.currentRoundDecisions?.governancePosture || 'BALANCED_AGILE'].name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Crisis & Event Injector */}
      {activeTab === 'INJECTION' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">{t('cockpit.crisis.title')}</h3>
            <p className="text-xs text-slate-400">{t('cockpit.crisis.subtitle')}</p>
          </div>

          {session.activeCrisis && session.activeCrisis.roundNumber === session.currentRound && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/80 via-dark-850 to-dark-800 border border-rose-500/50 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Flame className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500 text-black">
                      {t('cockpit.crisis.activeIn', { n: session.currentRound })}
                    </span>
                    <span className="text-sm text-slate-100 font-bold">{session.activeCrisis.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('cockpit.crisis.activeBody', {
                      n: session.teams.length,
                      fine: session.activeCrisis.immediateImpact?.budgetFine || 0,
                      debt: session.activeCrisis.immediateImpact?.tdiSurge || 0,
                      debtLabel: vocab.metrics.technicalDebtIndex.label,
                    })}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 shrink-0 self-start sm:self-auto">
                {t('arena.crisis.badge', { severity: severity(session.activeCrisis.severity), type: '' }).replace(/[:：]\s*$/, '')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {crisisTemplates.map(crisis => {
              const isCurrentlyActive = session.activeCrisis?.title === crisis.title && session.activeCrisis?.roundNumber === session.currentRound;

              return (
                <div
                  key={crisis.key}
                  className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                    isCurrentlyActive
                      ? 'bg-rose-950/20 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                      : 'bg-dark-850 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        {severity(crisis.severity)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{crisis.badge}</span>
                    </div>
                    <h4 className="font-bold text-slate-100 text-sm mb-1">{crisis.title}</h4>
                    <p className="text-xs text-slate-400 mb-3">{crisis.description}</p>

                    <div className="text-[11px] font-mono bg-dark-900/60 p-2.5 rounded-lg border border-slate-800/80 mb-4 space-y-1">
                      <div className="text-slate-400 flex items-center justify-between">
                        <span>{t('cockpit.crisis.fine')}</span>
                        <span className="text-rose-400 font-bold">-{crisis.immediateImpact.budgetFine}K$</span>
                      </div>
                      <div className="text-slate-400 flex items-center justify-between">
                        <span>{vocab.metrics.technicalDebtIndex.label} / {vocab.metrics.deliveryVelocity.label} :</span>
                        <span className="text-rose-400 font-bold">
                          +{crisis.immediateImpact.tdiSurge} / -{Math.abs(crisis.immediateImpact.velocityPenalty)}
                        </span>
                      </div>
                      {crisis.immediateImpact.downedNodeIds && crisis.immediateImpact.downedNodeIds.length > 0 && (
                        <div className="text-slate-400 flex items-center justify-between">
                          <span>{t('cockpit.crisis.target')}</span>
                          <span className="text-amber-400 font-bold">
                            {crisis.immediateImpact.downedNodeIds.map(id => scenario.topology.nodes.find(n => n.id === id)?.name ?? id).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-xs font-mono text-slate-500">{t('cockpit.crisis.choices', { n: crisis.choices.length })}</span>
                    <button
                      onClick={() => handleInjectCrisis(crisis)}
                      disabled={isCurrentlyActive}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        isCurrentlyActive
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 cursor-not-allowed opacity-60'
                          : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{isCurrentlyActive ? t('cockpit.crisis.active') : t('cockpit.crisis.inject')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Post-Simulation Debrief & Rankings */}
      {activeTab === 'DEBRIEF' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>{t('cockpit.debrief.title')}</span>
              </h3>
              <p className="text-xs text-slate-400">{t('cockpit.debrief.subtitle')}</p>
              <p className="text-xs text-cyan-300 mt-1">📘 {t('cockpit.debrief.guideHint')}</p>
            </div>

            <button
              onClick={handleExportSummary}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>{selectedArchivedRun ? t('cockpit.export.run', { n: selectedArchivedRun.runNumber }) : t('cockpit.export.json')}</span>
            </button>
            {!selectedArchivedRun && (
              <button
                onClick={handleExportMarkdown}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>{t('cockpit.export.md')}</span>
              </button>
            )}
          </div>

          {/* Run Version Selector: Current Live Run vs Past Archived Runs */}
          <div className="flex items-center gap-2 bg-dark-900 p-2 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto">
            <span className="text-slate-500 text-[10px] pl-1 flex items-center gap-1 font-bold shrink-0">
              <Archive className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('cockpit.run.label')}</span>
            </span>
            <button
              onClick={() => setSelectedRunId('CURRENT')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                selectedRunId === 'CURRENT'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {t('cockpit.run.live', { n: session.currentRound })}
            </button>

            {archivedRuns.map(run => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  selectedRunId === run.id
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-3 h-3" />
                <span>{t('cockpit.run.archived', { n: run.runNumber, winner: run.winnerTeamName || '—' })}</span>
              </button>
            ))}
          </div>

          {/* Archived Run View */}
          {selectedArchivedRun ? (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-dark-800 to-indigo-500/10 border border-amber-500/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-3xl shadow-lg">
                    🏆
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                        {t('cockpit.run.archivedTitle', { n: selectedArchivedRun.runNumber })}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {new Date(selectedArchivedRun.completedAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-100">{selectedArchivedRun.winnerTeamName || '—'}</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      {t('cockpit.run.archivedBody', { teams: selectedArchivedRun.teams.length, quarters: selectedArchivedRun.totalRounds })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparative Table for Archived Run */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-dark-850">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-dark-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">{t('cockpit.col.team')}</th>
                      <th className="p-3">{t('cockpit.col.grade')}</th>
                      <th className="p-3">{vocab.metrics.technicalDebtIndex.label}</th>
                      <th className="p-3">{vocab.metrics.deliveryVelocity.label}</th>
                      <th className="p-3">{vocab.metrics.stakeholderTrust.label}</th>
                      <th className="p-3">{vocab.metrics.resilienceIndex.label}</th>
                      <th className="p-3">{vocab.metrics.budgetRemaining.label}</th>
                      <th className="p-3">{vocab.metrics.tco.label}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {selectedArchivedRun.executiveDebriefSummary.rankings.map(rank => (
                      <tr key={rank.rank} className="hover:bg-dark-800/50 transition-colors">
                        <td className="p-3 font-bold text-cyan-400">#{rank.rank}</td>
                        <td className="p-3 font-bold text-slate-100">{rank.teamName}</td>
                        <td className="p-3 font-bold">{rank.grade ? `${rank.grade} · ${t(`outcome.verdict.${rank.verdict}` as TranslationKey)}` : '—'}</td>
                        <td className="p-3 font-bold text-emerald-400">{rank.technicalDebtIndex}</td>
                        <td className="p-3 font-bold text-cyan-400">{rank.deliveryVelocity}</td>
                        <td className="p-3">{rank.stakeholderTrust}</td>
                        <td className="p-3 text-emerald-400">{rank.resilienceIndex}</td>
                        <td className="p-3">{rank.budgetRemaining}</td>
                        <td className="p-3 text-slate-400">{rank.tco}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Winner Showcase for Live Session */}
              {sortedTeams[0] && (
                <div className="p-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-dark-800 to-cyan-500/10 border border-amber-500/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-3xl shadow-lg">
                      🏆
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">{t('cockpit.winner.label')}</span>
                      <h3 className="text-xl font-extrabold text-slate-100">{sortedTeams[0].name}</h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {t('cockpit.winner.body', {
                          verdict: t(`outcome.verdict.${outcomes.get(sortedTeams[0].id)!.verdict}` as TranslationKey),
                          grade: outcomes.get(sortedTeams[0].id)!.grade,
                          score: outcomes.get(sortedTeams[0].id)!.score,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 font-mono text-center">
                    <div className="bg-dark-900/80 p-2.5 rounded-lg border border-slate-700">
                      <span className="text-[10px] text-slate-500 block truncate">{vocab.metrics.technicalDebtIndex.label}</span>
                      <span className="text-emerald-400 font-bold text-sm">{sortedTeams[0].metrics.technicalDebtIndex}%</span>
                    </div>
                    <div className="bg-dark-900/80 p-2.5 rounded-lg border border-slate-700">
                      <span className="text-[10px] text-slate-500 block truncate">{vocab.metrics.deliveryVelocity.label}</span>
                      <span className="text-cyan-400 font-bold text-sm">{sortedTeams[0].metrics.deliveryVelocity}</span>
                    </div>
                    <div className="bg-dark-900/80 p-2.5 rounded-lg border border-slate-700">
                      <span className="text-[10px] text-slate-500 block truncate">{vocab.metrics.stakeholderTrust.label}</span>
                      <span className="text-indigo-400 font-bold text-sm">{sortedTeams[0].metrics.stakeholderTrust}%</span>
                    </div>
                  </div>
                </div>
              )}

              <TeamRadarChart teams={session.teams} scenario={scenario} />

              {/* Comparative Table for Live Session */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-dark-850">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-dark-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">{t('cockpit.col.team')}</th>
                      <th className="p-3">{t('cockpit.col.verdict')}</th>
                      <th className="p-3">{vocab.metrics.technicalDebtIndex.label}</th>
                      <th className="p-3">{vocab.metrics.deliveryVelocity.label}</th>
                      <th className="p-3">{vocab.metrics.stakeholderTrust.label}</th>
                      <th className="p-3">{vocab.metrics.resilienceIndex.label}</th>
                      <th className="p-3">{vocab.metrics.budgetRemaining.label}</th>
                      <th className="p-3">{vocab.metrics.tco.label}</th>
                      {hasMarket && <th className="p-3">{vocab.metrics.marketShare.label}</th>}
                      {hasMarket && <th className="p-3">{vocab.metrics.cumulativeProfit.label}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {sortedTeams.map((tm, idx) => (
                      <tr key={tm.id} className="hover:bg-dark-800/50 transition-colors">
                        <td className="p-3 font-bold text-cyan-400">#{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                          <span>{tm.avatar}</span>
                          <span>{tm.name}</span>
                        </td>
                        <td className="p-3 font-bold">
                          <span className={outcomes.get(tm.id)!.verdict === 'VICTORY' ? 'text-emerald-400' : outcomes.get(tm.id)!.verdict === 'PARTIAL' ? 'text-amber-400' : 'text-rose-400'}>
                            {outcomes.get(tm.id)!.grade} · {t(`outcome.verdict.${outcomes.get(tm.id)!.verdict}` as TranslationKey)}
                          </span>
                          <span className="text-slate-500 font-normal"> ({outcomes.get(tm.id)!.score}{session.state === 'COMPLETED' ? '' : `, ${t('cockpit.projected')}`})</span>
                        </td>
                        <td className={`p-3 font-bold ${tm.metrics.technicalDebtIndex > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {tm.metrics.technicalDebtIndex}%
                        </td>
                        <td className="p-3 font-bold text-cyan-400">{tm.metrics.deliveryVelocity} pts</td>
                        <td className="p-3">{tm.metrics.stakeholderTrust}%</td>
                        <td className="p-3 text-emerald-400">{tm.metrics.resilienceIndex}/100</td>
                        <td className="p-3">${tm.metrics.budgetRemaining.toLocaleString()}K</td>
                        <td className="p-3 text-slate-400">${tm.metrics.tco.toLocaleString()}K</td>
                        {hasMarket && <td className="p-3 text-cyan-300">{tm.metrics.marketShare !== undefined ? `${tm.metrics.marketShare} %` : '—'}</td>}
                        {hasMarket && (
                          <td className={`p-3 ${(tm.metrics.cumulativeProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(tm.metrics.cumulativeProfit ?? 0).toLocaleString()}K$
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMarket && (
                <section className="bg-dark-850 rounded-xl border border-slate-800 overflow-x-auto" aria-label={t('cockpit.market.title')}>
                  <h4 className="p-3 text-xs font-mono font-bold text-cyan-300 border-b border-slate-800">{t('cockpit.market.title')}</h4>
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-dark-900 text-slate-400 text-[10px]">
                      <tr>
                        <th className="p-2">{t('cockpit.col.team')}</th>
                        {Array.from({ length: session.totalRounds }, (_, i) => (
                          <th key={i} className="p-2">{t('common.quarterShort', { n: i + 1 })}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {sortedTeams.map(tm => (
                        <tr key={tm.id}>
                          <td className="p-2">{tm.avatar} {tm.name}</td>
                          {Array.from({ length: session.totalRounds }, (_, i) => {
                            const mk = tm.history.find(h => h.roundNumber === i + 1)?.market;
                            return (
                              <td key={i} className="p-2">
                                {mk ? (
                                  <>
                                    <span className="text-cyan-300">{mk.marketShare} %</span>{' '}
                                    <span className={mk.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>({mk.operatingProfit.toLocaleString()}K$)</span>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="p-3 text-[10px] text-slate-500">{t('cockpit.market.hint')}</p>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* Workshop Team Links Modal */}
      <WorkshopInvitesModal
        isOpen={isInvitesOpen}
        onClose={() => setIsInvitesOpen(false)}
        session={session}
      />
    </div>
  );
};
