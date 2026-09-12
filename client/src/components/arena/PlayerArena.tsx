// ============================================================================
// GEMSIM: PLAYER SIMULATION ARENA
// Executive Cockpit, Strategic Portfolio Selection, and Governance Controls
// ============================================================================

import React, { useState } from 'react';
import {
  SimulationSession,
  Team,
  Scenario,
  InitiativeTemplate,
  TeamDecision,
  RoundResult,
} from '../../types/index';
import { EnterpriseCanvas } from '../3d/EnterpriseCanvas';
import { StakeholderWarRoom } from '../stakeholder/StakeholderWarRoom';
import { api } from '../../services/api';
import {
  Activity,
  Layers,
  Shield,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Zap,
  CheckCircle,
  Clock,
  Compass,
  FileText,
  Lock,
  ChevronRight,
  Flame,
  BookOpen,
} from 'lucide-react';
import { ExecutiveBriefingModal } from '../briefing/ExecutiveBriefingModal';

interface Props {
  session: SimulationSession;
  team: Team;
  scenario: Scenario;
  onTeamUpdated: (updatedTeam: Team) => void;
}

export const PlayerArena: React.FC<Props> = ({
  session,
  team,
  scenario,
  onTeamUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'3D' | 'INITIATIVES' | 'GOVERNANCE' | 'STAKEHOLDERS' | 'HISTORY'>('3D');
  const [selectedInitiatives, setSelectedInitiatives] = useState<string[]>(
    team.currentRoundDecisions?.selectedInitiativeIds || []
  );
  const [governancePosture, setGovernancePosture] = useState<TeamDecision['governancePosture']>(
    team.currentRoundDecisions?.governancePosture || 'BALANCED_AGILE'
  );
  const [selectedEventChoice, setSelectedEventChoice] = useState<string | undefined>(
    team.currentRoundDecisions?.eventChoiceId
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  // Sync local decision state when team changes or when session resets back to Q1
  React.useEffect(() => {
    setSelectedInitiatives(team.currentRoundDecisions?.selectedInitiativeIds || []);
    setGovernancePosture(team.currentRoundDecisions?.governancePosture || 'BALANCED_AGILE');
    setSelectedEventChoice(team.currentRoundDecisions?.eventChoiceId);
  }, [team.id, session.currentRound, team.decisionSubmitted, session.updatedAt]);

  // Auto-open executive dossier on first encounter of this scenario/team
  React.useEffect(() => {
    const key = `gemsim_briefing_seen_${scenario.id}_${team.id}`;
    if (!localStorage.getItem(key)) {
      setIsBriefingOpen(true);
      localStorage.setItem(key, 'true');
    }
  }, [scenario.id, team.id]);

  // Current Round Event (Prioritize Facilitator Injected Crisis over baseline scheduled events)
  const activeInjectedCrisis = session.activeCrisis?.roundNumber === session.currentRound
    ? session.activeCrisis
    : session.injectedEvents?.find(e => e.roundNumber === session.currentRound);
  const currentEvent = activeInjectedCrisis || scenario.roundEvents.find(e => e.roundNumber === session.currentRound);
  const isInjectedCrisis = !!activeInjectedCrisis;

  // Calculate projected CapEx spend
  const selectedInitObjects = scenario.initiativesCatalog.filter(i => selectedInitiatives.includes(i.id));
  const totalCapEx = selectedInitObjects.reduce((sum, i) => sum + i.capExCost, 0);
  const projectedNetTdi = selectedInitObjects.reduce((sum, i) => sum + i.tdiDelta, 0);

  // Velocity Drag calculation for display
  const tdi = team.metrics.technicalDebtIndex;
  const velocityDrag = Math.round(Math.pow(tdi / 100, 1.4) * 70);

  const handleToggleInitiative = (id: string) => {
    if (team.decisionSubmitted) return;
    setSelectedInitiatives(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSubmitDecisions = async () => {
    if (team.decisionSubmitted || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const updatedTeam = await api.submitDecisions(session.id, team.id, {
        selectedInitiativeIds: selectedInitiatives,
        governancePosture,
        eventChoiceId: selectedEventChoice,
        customPacts: [],
      });

      onTeamUpdated(updatedTeam);
      setSubmissionSuccess(true);
      setTimeout(() => setSubmissionSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to submit decisions:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Executive Mission Banner & Dossier Quick Action */}
      <div className="bg-gradient-to-r from-dark-850 via-dark-800 to-indigo-950/40 p-4 rounded-xl border border-cyan-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-xl shrink-0">
            {team.avatar}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-cyan-300">
                {team.name}
              </span>
              <span className="text-xs text-slate-400 font-mono">// {scenario.industry}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                QUARTER {session.currentRound} OF {scenario.totalRounds || 4}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate mt-0.5">{scenario.title}</h2>
          </div>
        </div>

        <button
          onClick={() => setIsBriefingOpen(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.15)] transition-all shrink-0"
        >
          <BookOpen className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>📖 Case Study Dossier & Objectives</span>
        </button>
      </div>

      {/* 1. Executive Telemetry Cockpit (HUD) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* TCO & Cash */}
        <div className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>CASH RESERVES</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            ${team.metrics.budgetRemaining.toLocaleString()}K
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            OpEx: ${team.metrics.opEx}K / round
          </div>
        </div>

        {/* Technical Debt Index */}
        <div className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>TECHNICAL DEBT</span>
            <AlertTriangle className={`w-4 h-4 ${tdi > 65 ? 'text-rose-400' : 'text-amber-400'}`} />
          </div>
          <div className={`text-xl font-bold font-mono ${tdi > 65 ? 'text-rose-400' : tdi > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {tdi}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-rose-400">+{governancePosture === 'BYPASS_ARCH' ? '18%' : governancePosture === 'STRICT_GOVERNANCE' ? '2.5%' : '8%'}</span> drift
          </div>
        </div>

        {/* Delivery Velocity & Drag */}
        <div className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>VELOCITY</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {team.metrics.deliveryVelocity} <span className="text-xs font-normal text-slate-500">pts</span>
          </div>
          <div className="text-[11px] text-amber-400/90 mt-1 truncate font-mono">
            -{velocityDrag}% debt drag
          </div>
        </div>

        {/* Stakeholder Trust */}
        <div className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>STAKEHOLDER TRUST</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {team.metrics.stakeholderTrust}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {scenario.stakeholders.length} Board Members
          </div>
        </div>

        {/* System Resilience */}
        <div className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>RESILIENCE INDEX</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {team.metrics.resilienceIndex}/100
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {team.metrics.modernizedNodesCount} Modernized Nodes
          </div>
        </div>

        {/* Compliance Score */}
        <div className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>COMPLIANCE</span>
            <CheckCircle className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {team.metrics.complianceScore}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Audit Ready
          </div>
        </div>
      </div>

      {/* Emergency Crisis Alert Banner (When Injected by Facilitator) */}
      {isInjectedCrisis && currentEvent && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900/60 to-dark-850 border border-rose-500/70 shadow-[0_0_25px_rgba(244,63,94,0.3)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500 text-black">
                  BLACK SWAN CRISIS INJECTED
                </span>
                <span className="text-sm text-rose-200 font-bold">{currentEvent.title}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Immediate penalty applied: -${currentEvent.immediateImpact.budgetFine}K Cash, +{currentEvent.immediateImpact.tdiSurge}% TDI, -{Math.abs(currentEvent.immediateImpact.velocityPenalty)} pts Velocity. Remediation required!
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('GOVERNANCE')}
            className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-black font-bold font-mono text-xs shrink-0 transition-all shadow-md flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Remediate Crisis</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Arena View Navigation Tabs & Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-dark-850 p-2.5 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('3D')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === '3D'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>3D Spatial Enterprise</span>
          </button>

          <button
            onClick={() => setActiveTab('INITIATIVES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 relative ${
              activeTab === 'INITIATIVES'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Initiatives Portfolio</span>
            {selectedInitiatives.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${activeTab === 'INITIATIVES' ? 'bg-black text-cyan-400' : 'bg-cyan-500 text-black'}`}>
                {selectedInitiatives.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('GOVERNANCE')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 relative ${
              activeTab === 'GOVERNANCE'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : isInjectedCrisis
                ? 'text-rose-400 bg-rose-500/10 border border-rose-500/40 hover:bg-rose-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Governance & Crisis</span>
            {currentEvent && (
              <span className={`w-2 h-2 rounded-full ${isInjectedCrisis ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
            )}
          </button>

          <button
            onClick={() => setActiveTab('STAKEHOLDERS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'STAKEHOLDERS'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>AI Stakeholder War Room</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Turn History ({team.history.length})</span>
          </button>
        </div>

        {/* Submit Strategic Decisions Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {team.decisionSubmitted ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
              <CheckCircle className="w-4 h-4" />
              <span>Decisions Locked for Q{session.currentRound}</span>
            </div>
          ) : (
            <button
              onClick={handleSubmitDecisions}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Submit Q{session.currentRound} Decisions ({totalCapEx > 0 ? `$${totalCapEx}K CapEx` : 'No CapEx'})</span>
            </button>
          )}
        </div>
      </div>

      {submissionSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4" />
          <span>Strategic portfolio and governance commitments submitted successfully! Awaiting round resolution.</span>
        </div>
      )}

      {/* 3. Main Dynamic Content Body */}
      {activeTab === '3D' && (
        <div className="flex flex-col gap-4">
          <div className="h-[600px] w-full">
            <EnterpriseCanvas
              topology={scenario.topology}
              nodeHealthOverrides={team.nodeHealthOverrides}
            />
          </div>
        </div>
      )}

      {activeTab === 'INITIATIVES' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100">Modernization & Strategic Portfolio</h3>
              <p className="text-xs text-slate-400">Select initiatives to fund this quarter. Watch CapEx limits and stakeholder preferences.</p>
            </div>
            <div className="text-right font-mono text-xs">
              <span className="text-slate-500">ALLOCATED CAPEX: </span>
              <span className="text-cyan-400 font-bold">${totalCapEx}K</span>
              <span className="text-slate-600"> / ${team.metrics.budgetRemaining}K</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenario.initiativesCatalog.map(init => {
              const isSelected = selectedInitiatives.includes(init.id);

              let riskBadge = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
              if (init.riskLevel === 'EXTREME') riskBadge = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
              else if (init.riskLevel === 'HIGH') riskBadge = 'text-amber-400 bg-amber-500/10 border-amber-500/30';

              return (
                <div
                  key={init.id}
                  onClick={() => handleToggleInitiative(init.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-dark-800 border-cyan-500 ring-1 ring-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                      : 'bg-dark-850 border-slate-800 hover:border-slate-700 hover:bg-dark-800/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {init.category}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${riskBadge}`}>
                        {init.riskLevel} RISK
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-100 text-sm mb-1">{init.name}</h4>
                    <p className="text-xs text-slate-400 mb-4 line-clamp-3">{init.description}</p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-800 text-xs font-mono">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">CAPEX COST</span>
                        <span className="font-bold text-slate-100">${init.capExCost}K</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">OPEX DELTA</span>
                        <span className={init.opExDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {init.opExDelta <= 0 ? `${init.opExDelta}K` : `+${init.opExDelta}K`} / rnd
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">TECH DEBT (TDI)</span>
                        <span className={init.tdiDelta <= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {init.tdiDelta <= 0 ? `${init.tdiDelta}%` : `+${init.tdiDelta}%`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">VELOCITY BONUS</span>
                        <span className={init.velocityDelta >= 0 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                          {init.velocityDelta >= 0 ? `+${init.velocityDelta}%` : `${init.velocityDelta}%`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] text-slate-500">
                        Affects {init.affectedNodeIds.length} enterprise node(s)
                      </span>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-slate-700 bg-dark-900'
                      }`}>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'GOVERNANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Governance Posture Selector */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100">Enterprise Governance Posture</h3>
              <p className="text-xs text-slate-400">Establish how your engineering squads balance architecture rigor against feature pressure.</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: 'BYPASS_ARCH',
                  name: 'Bypass Architecture Review (Fast-Track Features)',
                  description: 'Authorize direct database hooks and bypass review boards to deploy customer features instantly.',
                  impact: '+18% Delivery Velocity sugar-rush, but +18% Compound Debt Surge & -15% Compliance penalty.',
                  color: 'border-rose-500/40 bg-rose-500/5',
                  tag: 'EXTREME AGILITY / HIGH RISK',
                },
                {
                  id: 'BALANCED_AGILE',
                  name: 'Balanced Pragmatic Agile (Standard)',
                  description: 'Continuous integration with pragmatic architecture oversight and manageable debt compounding.',
                  impact: 'Baseline delivery rate with standard 8% debt drift per quarter.',
                  color: 'border-cyan-500/40 bg-cyan-500/5',
                  tag: 'BALANCED TRADE-OFF',
                },
                {
                  id: 'STRICT_GOVERNANCE',
                  name: 'Strict Enterprise Architecture Review Board',
                  description: 'Mandatory schema contracts, security audits, and formal review board sign-offs before any release.',
                  impact: '-10% Delivery Velocity drag, but curbs debt drift to 2.5% and boosts compliance by +14%.',
                  color: 'border-indigo-500/40 bg-indigo-500/5',
                  tag: 'DEFENSIVE / AUDIT-PROOF',
                },
                {
                  id: 'ACCELERATED_MODERN',
                  name: 'Accelerated Modernization Tranche',
                  description: 'Dedicate 35% of engineering capacity exclusively to refactoring and strangler fig migrations.',
                  impact: '-8% TDI immediate drop, boosts resilience and agility for future quarters.',
                  color: 'border-emerald-500/40 bg-emerald-500/5',
                  tag: 'TECH-DEBT REMEDIATION',
                },
              ].map(gov => (
                <div
                  key={gov.id}
                  onClick={() => !team.decisionSubmitted && setGovernancePosture(gov.id as any)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${gov.color} ${
                    governancePosture === gov.id
                      ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 text-sm">{gov.name}</span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400">{gov.tag}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{gov.description}</p>
                  <div className="text-[11px] font-mono text-slate-400 bg-dark-900/60 p-2 rounded border border-slate-800">
                    {gov.impact}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quarterly Crisis & Disruption */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Flame className={`w-4 h-4 ${isInjectedCrisis ? 'text-rose-500 animate-pulse' : 'text-rose-400'}`} />
                <span>
                  {isInjectedCrisis
                    ? `Q${session.currentRound} Black Swan Crisis (Facilitator Injected)`
                    : `Q${session.currentRound} Strategic Disruption`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isInjectedCrisis
                  ? 'High-impact enterprise shock requiring immediate executive remediation choice.'
                  : 'Scheduled market challenge requiring executive remediation choice.'}
              </p>
            </div>

            {currentEvent ? (
              <div className={`p-5 rounded-xl border shadow-xl space-y-4 ${
                isInjectedCrisis
                  ? 'bg-dark-850 border-rose-500/50 ring-1 ring-rose-500/20'
                  : 'bg-dark-850 border-rose-500/30'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    {isInjectedCrisis ? '⚡ INJECTED BLACK SWAN' : `${currentEvent.severity} SEVERITY: ${currentEvent.type}`}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">Quarter {currentEvent.roundNumber}</span>
                </div>

                <h4 className="text-lg font-bold text-slate-100">{currentEvent.title}</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{currentEvent.description}</p>

                {/* Immediate Damage Telemetry Box */}
                {currentEvent.immediateImpact && (
                  <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3 text-xs font-mono space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                      Immediate Damage Applied Upon Detection:
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-dark-900/80 p-2 rounded border border-rose-500/20">
                        <span className="text-[10px] text-slate-400 block">Cash Penalty</span>
                        <span className="text-rose-400 font-bold">-${currentEvent.immediateImpact.budgetFine}K</span>
                      </div>
                      <div className="bg-dark-900/80 p-2 rounded border border-rose-500/20">
                        <span className="text-[10px] text-slate-400 block">TDI Spike</span>
                        <span className="text-rose-400 font-bold">+{currentEvent.immediateImpact.tdiSurge}%</span>
                      </div>
                      <div className="bg-dark-900/80 p-2 rounded border border-rose-500/20">
                        <span className="text-[10px] text-slate-400 block">Velocity Drag</span>
                        <span className="text-rose-400 font-bold">-{Math.abs(currentEvent.immediateImpact.velocityPenalty)} pts</span>
                      </div>
                    </div>
                    {currentEvent.immediateImpact.downedNodeIds && currentEvent.immediateImpact.downedNodeIds.length > 0 && (
                      <div className="pt-1 text-[11px] text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>Compromised Nodes: {currentEvent.immediateImpact.downedNodeIds.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2.5 pt-3 border-t border-slate-800">
                  <span className="text-xs font-mono font-semibold text-slate-400">Select Remediation Strategy:</span>
                  {currentEvent.choices.map(choice => (
                    <div
                      key={choice.id}
                      onClick={() => !team.decisionSubmitted && setSelectedEventChoice(choice.id)}
                      className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedEventChoice === choice.id
                          ? 'bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500 shadow-md'
                          : 'bg-dark-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-slate-200 mb-1.5 flex items-center justify-between gap-2">
                        <span>{choice.text}</span>
                        {selectedEventChoice === choice.id && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500 text-black font-bold shrink-0">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400">
                        <span>Cost: ${choice.capExImpact}K</span>
                        <span className={choice.tdiImpact <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          TDI: {choice.tdiImpact <= 0 ? `${choice.tdiImpact}%` : `+${choice.tdiImpact}%`}
                        </span>
                        <span>Velocity: {choice.velocityImpact >= 0 ? `+${choice.velocityImpact}%` : `${choice.velocityImpact}%`}</span>
                        {choice.nodeHealthImpacts && Object.keys(choice.nodeHealthImpacts).length > 0 && (
                          <span className="text-cyan-400 font-semibold">
                            Recovers: {Object.keys(choice.nodeHealthImpacts).join(', ')}
                          </span>
                        )}
                        {choice.trustImpact && Object.keys(choice.trustImpact).length > 0 && (
                          <span className="text-indigo-300">
                            Trust: {Object.entries(choice.trustImpact).map(([k, v]) => `${k} (${v > 0 ? `+${v}` : v}%)`).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-dark-850 p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
                No active disruptions scheduled for this quarter.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'STAKEHOLDERS' && (
        <StakeholderWarRoom
          session={session}
          team={team}
          stakeholders={scenario.stakeholders}
          onTrustUpdated={onTeamUpdated}
        />
      )}

      {activeTab === 'HISTORY' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">Decision Replay & Turn Results</h3>
            <p className="text-xs text-slate-400">Review outcomes, compounding debt penalties, and triggered production incidents across previous quarters.</p>
          </div>

          {team.history.length === 0 ? (
            <div className="bg-dark-850 p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">
              Simulation is in Q1. No previous round history recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {team.history.map(hist => (
                <div key={hist.roundNumber} className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-cyan-400 font-mono">QUARTER {hist.roundNumber} REPORT</span>
                    <span className="text-xs font-mono text-slate-400">
                      Compounded Drift: +{hist.debtCompoundedAmount}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-dark-900 p-3 rounded-lg border border-slate-800">
                    {hist.facilitatorFeedback}
                  </p>

                  {/* Incidents triggered */}
                  {hist.incidentsTriggered.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Triggered Outages & Incidents ({hist.incidentsTriggered.length}):
                      </span>
                      {hist.incidentsTriggered.map(inc => (
                        <div key={inc.id} className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs">
                          <div className="flex items-center justify-between text-rose-300 font-bold mb-0.5">
                            <span>{inc.title}</span>
                            <span>-${inc.costImpact}K Emergency Cost</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">{inc.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Metric Deltas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-2">
                    <div className="bg-dark-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">TDI DELTA</span>
                      <span className={hist.metricDeltas.technicalDebtIndex <= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {hist.metricDeltas.technicalDebtIndex <= 0 ? `${hist.metricDeltas.technicalDebtIndex}%` : `+${hist.metricDeltas.technicalDebtIndex}%`}
                      </span>
                    </div>
                    <div className="bg-dark-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">VELOCITY DELTA</span>
                      <span className={hist.metricDeltas.deliveryVelocity >= 0 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                        {hist.metricDeltas.deliveryVelocity >= 0 ? `+${hist.metricDeltas.deliveryVelocity} pts` : `${hist.metricDeltas.deliveryVelocity} pts`}
                      </span>
                    </div>
                    <div className="bg-dark-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">TRUST DELTA</span>
                      <span className={hist.metricDeltas.stakeholderTrust >= 0 ? 'text-indigo-400 font-bold' : 'text-amber-400 font-bold'}>
                        {hist.metricDeltas.stakeholderTrust >= 0 ? `+${hist.metricDeltas.stakeholderTrust}%` : `${hist.metricDeltas.stakeholderTrust}%`}
                      </span>
                    </div>
                    <div className="bg-dark-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">NET SPEND</span>
                      <span className="text-slate-200 font-bold">
                        ${Math.abs(hist.metricDeltas.budgetRemaining)}K
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Executive Case Study & Mission Briefing Modal */}
      <ExecutiveBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        scenario={scenario}
        session={session}
        team={team}
      />
    </div>
  );
};
