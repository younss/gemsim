// ============================================================================
// GEMSIM: EXECUTIVE CASE STUDY & MISSION BRIEFING DOSSIER
// Boardroom context, corporate burning platform, stakeholder agendas, and victory targets
// ============================================================================

import React, { useState } from 'react';
import { Scenario, Team, SimulationSession } from '../../types/index';
import {
  FileText,
  Shield,
  Target,
  Users,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Compass,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario;
  session: SimulationSession;
  team: Team;
}

export const ExecutiveBriefingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  scenario,
  session,
  team,
}) => {
  const [activeTab, setActiveTab] = useState<'CASE_STUDY' | 'TOPOLOGY' | 'STAKEHOLDERS' | 'RULES'>('CASE_STUDY');

  if (!isOpen) return null;

  const targets = scenario.winLossConditions;
  const baseline = scenario.baselineMetrics;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-dark-900 border border-cyan-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Top Header Banner: Classified Board Directive */}
        <div className="bg-dark-950 border-b border-slate-800 p-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase tracking-wider">
                  CONFIDENTIAL // BOARD DIRECTIVE
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">{scenario.industry}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                <span>{scenario.title}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-mono">
                  {scenario.difficulty}
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Assigned Team Banner */}
        <div className="bg-gradient-to-r from-cyan-950/40 via-dark-850 to-indigo-950/40 px-6 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">DEPLOYED SQUAD:</span>
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>{team.avatar}</span>
              <span>{team.name}</span>
            </span>
          </div>
          <div className="text-slate-400 hidden sm:block">
            EXECUTION TIMELINE: <strong className="text-slate-200">Q1 - Q4 (4 Quarters)</strong>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-dark-900/90 text-xs font-mono">
          <button
            onClick={() => setActiveTab('CASE_STUDY')}
            className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'CASE_STUDY' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>The Burning Platform (Context)</span>
          </button>

          <button
            onClick={() => setActiveTab('TOPOLOGY')}
            className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'TOPOLOGY' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Architecture Landscape</span>
          </button>

          <button
            onClick={() => setActiveTab('STAKEHOLDERS')}
            className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'STAKEHOLDERS' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Executive Boardroom ({scenario.stakeholders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('RULES')}
            className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'RULES' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Rules & Victory Targets</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: THE BURNING PLATFORM & CORPORATE CONTEXT */}
          {activeTab === 'CASE_STUDY' && (
            <div className="space-y-5">
              <div className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                  EXECUTIVE SITUATION SUMMARY
                </span>
                <p className="text-sm text-slate-200 leading-relaxed font-sans font-medium">
                  {scenario.description}
                </p>
              </div>

              <div className="bg-dark-850 p-5 rounded-xl border border-rose-500/30 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs font-mono">
                  <AlertTriangle className="w-4 h-4" />
                  <span>THE CORE BUSINESS CHALLENGE & ARCHITECTURAL BOTTLENECK</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {scenario.businessContext}
                </p>
              </div>

              {/* Baseline Metric Snapshot Cards */}
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
                  STARTING BASELINE (QUARTER 1 OPENING):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-dark-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">TECHNICAL DEBT (TDI)</span>
                    <span className="text-rose-400 font-bold text-base">{baseline.technicalDebtIndex}%</span>
                    <span className="text-[10px] text-slate-500 block">Compounds each round</span>
                  </div>

                  <div className="bg-dark-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">DELIVERY VELOCITY</span>
                    <span className="text-cyan-400 font-bold text-base">{baseline.deliveryVelocity} pts</span>
                    <span className="text-[10px] text-slate-500 block">Suffers debt drag</span>
                  </div>

                  <div className="bg-dark-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">CASH RESERVES</span>
                    <span className="text-emerald-400 font-bold text-base">${baseline.budgetRemaining}K</span>
                    <span className="text-[10px] text-slate-500 block">Discretionary CapEx</span>
                  </div>

                  <div className="bg-dark-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">STAKEHOLDER TRUST</span>
                    <span className="text-amber-400 font-bold text-base">{baseline.stakeholderTrust}%</span>
                    <span className="text-[10px] text-slate-500 block">Board confidence</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ARCHITECTURAL LANDSCAPE */}
          {activeTab === 'TOPOLOGY' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                The enterprise architecture comprises <strong>{scenario.topology.nodes.length} structural components</strong> across 4 logical tiers. Inspect critical bottlenecks and decoupled services:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scenario.topology.nodes.map(node => (
                  <div
                    key={node.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      node.status === 'CRITICAL'
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : node.status === 'DEGRADED'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-dark-850 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{node.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-dark-950 border border-slate-700 text-cyan-400">
                        {node.layer}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{node.description}</p>
                    <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400 pt-1">
                      <span>TDI: <strong className={node.technicalDebt > 60 ? 'text-rose-400' : 'text-slate-200'}>{node.technicalDebt}%</strong></span>
                      <span>Health: <strong className="text-slate-200">{node.health}%</strong></span>
                      <span>Run-rate: <strong className="text-slate-200">${node.costPerRound}K/rnd</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: STAKEHOLDER BOARDROOM */}
          {activeTab === 'STAKEHOLDERS' && (
            <div className="space-y-4">
              <div className="bg-dark-850 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="text-cyan-400 font-bold block mb-1">PRO-TIP: AUTONOMOUS AI NEGOTIATION</span>
                Each executive has distinct incentives and hidden agendas. In the <strong>AI Stakeholder War Room</strong>, engage them in chat before submitting decisions. Gaining their support boosts budget approvals, unlocks governance concessions, and prevents boardroom revolts.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scenario.stakeholders.map(sh => (
                  <div key={sh.id} className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 rounded-lg bg-dark-900 border border-slate-700">{sh.avatar}</span>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{sh.name}</h4>
                        <div className="text-cyan-400 text-[11px] font-mono">{sh.title}</div>
                      </div>
                    </div>
                    <div className="text-slate-300">
                      <span className="text-slate-400 font-bold">Public Bias: </span>
                      {sh.bias}
                    </div>
                    <div className="text-slate-300">
                      <span className="text-amber-400 font-bold">Hidden Agenda: </span>
                      {sh.hiddenAgenda}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RULES & VICTORY TARGETS */}
          {activeTab === 'RULES' && (
            <div className="space-y-4">
              <div className="bg-dark-850 p-5 rounded-xl border border-cyan-500/30 space-y-3">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                  BOARDROOM SUCCESS METRICS (WIN/LOSS CONDITIONS)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  To win the executive contract at the conclusion of Quarter 4, your team must meet or surpass these 4 primary enterprise benchmarks:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-xs">
                  <div className="p-3 bg-dark-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Target Tech Debt Index (TDI):</span>
                    <span className="text-emerald-400 font-bold">&lt; {targets.maxTechnicalDebtIndex}%</span>
                  </div>

                  <div className="p-3 bg-dark-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Minimum Delivery Velocity:</span>
                    <span className="text-cyan-400 font-bold">&ge; {targets.minDeliveryVelocity} pts</span>
                  </div>

                  <div className="p-3 bg-dark-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Minimum Stakeholder Trust:</span>
                    <span className="text-amber-400 font-bold">&ge; {targets.minStakeholderTrustAvg}%</span>
                  </div>

                  <div className="p-3 bg-dark-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Minimum Resilience Index:</span>
                    <span className="text-purple-400 font-bold">&ge; {targets.minResilienceIndex}%</span>
                  </div>
                </div>
              </div>

              {/* Turn Sequence Guide */}
              <div className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  TURN EXECUTION CYCLE (EACH QUARTER):
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                  <li><strong>Inspect 3D Canvas</strong>: Detect high-debt latency bottlenecks and degraded nodes.</li>
                  <li><strong>AI Stakeholder Dialogue</strong>: Negotiate with executives to secure alignment and concessions.</li>
                  <li><strong>Strategic Initiatives</strong>: Allocate capital towards Strangler Fig, Kafka streaming, cloud mesh.</li>
                  <li><strong>Governance Posture</strong>: Choose Bypass (high risk), Agile (balanced), or Strict (low debt).</li>
                  <li><strong>Quarterly Crisis</strong>: Select remediation actions for the scheduled disruption.</li>
                  <li><strong>Lock Decisions</strong>: Click <em>Submit Quarterly Decisions</em> before the timer expires!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="bg-dark-950 border-t border-slate-800 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono">
            Click <strong>"Case Study Dossier"</strong> on your HUD at any time to re-open this briefing.
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all"
          >
            <span>Acknowledge Mission Directives & Enter Arena</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
