// ============================================================================
// GEMSIM: FACILITATOR WAR ROOM & OPERATIONS TELEMETRY COCKPIT
// Multi-Team Oversight, Master Round Controls, Event Injection, and Post-Mortem Debrief
// ============================================================================

import React, { useState } from 'react';
import {
  SimulationSession,
  Scenario,
  Team,
  RoundEvent,
} from '../../types/index';
import { api } from '../../services/api';
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
  const [broadcastText, setBroadcastText] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'CONTROLS' | 'INJECTION' | 'DEBRIEF'>('TELEMETRY');
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);

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

  // Master Session Reset
  const handleResetSession = async () => {
    if (!confirm('Are you sure you want to reset this simulation back to Quarter 1? All team history will be cleared.')) return;
    try {
      const updated = await api.resetSession(session.id);
      onSessionUpdated(updated);
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
  const handleInjectCrisis = async (title: string, description: string, severity: RoundEvent['severity']) => {
    const crisisEvent: RoundEvent = {
      roundNumber: session.currentRound,
      title,
      description,
      type: 'CRISIS',
      severity,
      immediateImpact: { budgetFine: 150, tdiSurge: 8, velocityPenalty: -12 },
      choices: [
        { id: 'inj-c1', text: 'Deploy emergency zero-day patch across all tiers', capExImpact: 140, tdiImpact: -8, velocityImpact: -10, trustImpact: {} },
        { id: 'inj-c2', text: 'Isolate affected cluster and pay SLA penalty', capExImpact: 80, tdiImpact: 6, velocityImpact: 0, trustImpact: {} },
      ],
    };

    try {
      await api.injectEvent(session.id, crisisEvent);
    } catch (err) {
      console.error('Injection error:', err);
    }
  };

  // Debrief Winner Calculation
  const sortedTeams = [...session.teams].sort((a, b) => {
    // Score based on low TDI, high velocity, high trust
    const scoreA = (100 - a.metrics.technicalDebtIndex) * 1.5 + a.metrics.deliveryVelocity + a.metrics.stakeholderTrust * 1.2;
    const scoreB = (100 - b.metrics.technicalDebtIndex) * 1.5 + b.metrics.deliveryVelocity + b.metrics.stakeholderTrust * 1.2;
    return scoreB - scoreA;
  });

  const allTeamsSubmitted = session.teams.every(t => t.decisionSubmitted);

  // Export Executive Summary
  const handleExportSummary = () => {
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
            <h2 className="text-base font-bold text-slate-100 font-mono">Facilitator Master Operations War Room</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
              Q{session.currentRound} OF Q{session.totalRounds}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time telemetry and state orchestration for {session.teams.length} competing organizations.
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
            <span>{session.isTimerRunning ? 'Pause Round Timer' : 'Start Round Timer'}</span>
          </button>

          <button
            onClick={handleResetTimer}
            className="p-2 rounded-lg bg-dark-750 hover:bg-dark-700 text-slate-300 border border-slate-700 text-xs"
            title="Reset Round Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          <button
            onClick={handleAdvanceRound}
            disabled={isAdvancing}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
              allTeamsSubmitted
                ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{session.currentRound >= session.totalRounds ? 'Finalize Simulation' : `Advance to Q${session.currentRound + 1}`}</span>
          </button>

          <button
            onClick={handleResetSession}
            className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono"
            title="Reset Session to Q1"
          >
            Reset
          </button>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          <button
            onClick={() => setIsInvitesOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            title="Manage & Share Team Access Links"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Share Team Invites</span>
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
          <span>Multi-Team Leaderboard</span>
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
          <span>Crisis & Black Swan Injector</span>
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
          <span>Executive Debrief & Rankings</span>
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
          placeholder="Broadcast high-priority announcement to all player cockpits..."
          className="flex-1 bg-dark-900 text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
        />
        <button
          onClick={handleSendBroadcast}
          disabled={!broadcastText.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black text-xs font-bold flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Broadcast</span>
        </button>
      </div>

      {/* TAB 1: Multi-Team Comparative Telemetry */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {session.teams.map((t, idx) => {
              const tdi = t.metrics.technicalDebtIndex;
              const isReady = t.decisionSubmitted;

              return (
                <div
                  key={t.id}
                  className="bg-dark-850 p-5 rounded-xl border border-slate-800 shadow-xl space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner"
                        style={{ backgroundColor: `${t.color}20`, border: `1px solid ${t.color}60` }}
                      >
                        {t.avatar}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{t.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">Team #{idx + 1}</span>
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
                      {isReady ? 'DECISIONS READY' : 'PLANNING'}
                    </span>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-dark-900 p-3 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 text-[10px] block">TECH DEBT (TDI)</span>
                      <span className={`font-bold ${tdi > 65 ? 'text-rose-400' : tdi > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {tdi}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">DELIVERY VELOCITY</span>
                      <span className="font-bold text-cyan-400">{t.metrics.deliveryVelocity} pts</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">CASH RESERVES</span>
                      <span className="font-bold text-slate-200">${t.metrics.budgetRemaining}K</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">STAKEHOLDER TRUST</span>
                      <span className="font-bold text-indigo-400">{t.metrics.stakeholderTrust}%</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">RESILIENCE</span>
                      <span className="font-bold text-emerald-400">{t.metrics.resilienceIndex}/100</span>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] block">COMPLIANCE</span>
                      <span className="font-bold text-violet-400">{t.metrics.complianceScore}%</span>
                    </div>
                  </div>

                  {/* Governance Strategy Chosen */}
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-500">Governance:</span>
                    <span className="text-slate-200 font-semibold">{t.currentRoundDecisions?.governancePosture || 'BALANCED_AGILE'}</span>
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
            <h3 className="text-base font-bold text-slate-100">Live Crisis & Black Swan Injector</h3>
            <p className="text-xs text-slate-400">Trigger unexpected market shifts or infrastructure failures across all active teams.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: 'Critical Zero-Day Vulnerability Exploit',
                description: 'A remote code execution zero-day is discovered in open-source logging libraries. All teams must allocate emergency remediation CapEx.',
                severity: 'BLACK_SWAN' as const,
                cost: '$150K',
                badge: 'CYBER RESILIENCE',
              },
              {
                title: 'Primary Cloud Provider Regional Blackout',
                description: 'Major cloud region suffers power and fiber optic failure. Services without multi-zone failover go offline immediately.',
                severity: 'HIGH' as const,
                cost: '$200K',
                badge: 'INFRASTRUCTURE OUTAGE',
              },
              {
                title: 'Hostile Acquisition & Strategic Tech Freeze',
                description: 'An aggressive institutional activist investor demands an immediate freeze on all CapEx modernization tranches.',
                severity: 'HIGH' as const,
                cost: '$120K',
                badge: 'CORPORATE GOVERNANCE',
              },
              {
                title: 'Unannounced Federal Regulatory Data Audit',
                description: 'Enforcement authorities inspect all legacy database retention logs and issue immediate compliance summons.',
                severity: 'MEDIUM' as const,
                cost: '$90K',
                badge: 'COMPLIANCE AUDIT',
              },
            ].map(crisis => (
              <div
                key={crisis.title}
                className="bg-dark-850 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      {crisis.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{crisis.badge}</span>
                  </div>
                  <h4 className="font-bold text-slate-100 text-sm mb-1">{crisis.title}</h4>
                  <p className="text-xs text-slate-400 mb-4">{crisis.description}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <span className="text-xs font-mono text-slate-500">Est. Impact: {crisis.cost}</span>
                  <button
                    onClick={() => handleInjectCrisis(crisis.title, crisis.description, crisis.severity)}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Inject Crisis</span>
                  </button>
                </div>
              </div>
            ))}
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
                <span>Executive Post-Mortem & Team Scorecard</span>
              </h3>
              <p className="text-xs text-slate-400">Comprehensive comparative analysis of architectural outcomes, debt reduction, and business agility.</p>
            </div>

            <button
              onClick={handleExportSummary}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Export Executive Briefing (.JSON)</span>
            </button>
          </div>

          {/* Winner Showcase */}
          {sortedTeams[0] && (
            <div className="p-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-dark-800 to-cyan-500/10 border border-amber-500/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-3xl shadow-lg">
                  🏆
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                    TOP PERFORMING STRATEGY
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-100">{sortedTeams[0].name}</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Achieved optimal balance of Technical Debt Remediation ({sortedTeams[0].metrics.technicalDebtIndex}%) and Delivery Velocity ({sortedTeams[0].metrics.deliveryVelocity} pts).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono text-center">
                <div className="bg-dark-900/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-500 block">FINAL TDI</span>
                  <span className="text-emerald-400 font-bold text-sm">{sortedTeams[0].metrics.technicalDebtIndex}%</span>
                </div>
                <div className="bg-dark-900/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-500 block">VELOCITY</span>
                  <span className="text-cyan-400 font-bold text-sm">{sortedTeams[0].metrics.deliveryVelocity}</span>
                </div>
                <div className="bg-dark-900/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-500 block">TRUST</span>
                  <span className="text-indigo-400 font-bold text-sm">{sortedTeams[0].metrics.stakeholderTrust}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Comparative Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-dark-850">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-dark-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Organization</th>
                  <th className="p-3">Tech Debt (TDI)</th>
                  <th className="p-3">Delivery Velocity</th>
                  <th className="p-3">Stakeholder Trust</th>
                  <th className="p-3">Resilience</th>
                  <th className="p-3">Cash Reserves</th>
                  <th className="p-3">Total TCO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {sortedTeams.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="p-3 font-bold text-cyan-400">#{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                      <span>{t.avatar}</span>
                      <span>{t.name}</span>
                    </td>
                    <td className={`p-3 font-bold ${t.metrics.technicalDebtIndex > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {t.metrics.technicalDebtIndex}%
                    </td>
                    <td className="p-3 font-bold text-cyan-400">{t.metrics.deliveryVelocity} pts</td>
                    <td className="p-3">{t.metrics.stakeholderTrust}%</td>
                    <td className="p-3 text-emerald-400">{t.metrics.resilienceIndex}/100</td>
                    <td className="p-3">${t.metrics.budgetRemaining.toLocaleString()}K</td>
                    <td className="p-3 text-slate-400">${t.metrics.tco.toLocaleString()}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
