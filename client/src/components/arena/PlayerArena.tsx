// ============================================================================
// GEMSIM: PLAYER SIMULATION ARENA
// Quarter decisions, live constraints, objectives, crisis, war room and history.
// All text goes through i18n; metric names come from the scenario vocabulary.
// ============================================================================

import React, { useState } from 'react';
import { SimulationSession, Team, Scenario, TeamDecision, GovernancePosture } from '../../types/index';
import { EnterpriseCanvas } from '../3d/EnterpriseCanvas';
import { StakeholderWarRoom } from '../stakeholder/StakeholderWarRoom';
import { api } from '../../services/api';
import {
  Layers,
  Shield,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Zap,
  CheckCircle,
  Compass,
  FileText,
  Lock,
  ChevronRight,
  Flame,
  BookOpen,
} from 'lucide-react';
import { ExecutiveBriefingModal } from '../briefing/ExecutiveBriefingModal';
import { ObjectivesTracker, FinalVerdict } from './OutcomePanels';
import { activeBoardMandate, checkDecisions, evaluateOutcome, lockedInitiativeIds } from '../../engine';
import { BOARD_MANDATE_EFFECTS } from '../../../../server/src/engine/rules';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useHelpStore } from '../../stores/useHelpStore';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { InfoTip } from '../help/InfoTip';
import { TutorialTour, ArenaTab } from '../help/TutorialTour';

interface Props {
  session: SimulationSession;
  team: Team;
  scenario: Scenario;
  onTeamUpdated: (updatedTeam: Team) => void;
}

const POSTURES: Array<{ id: GovernancePosture; color: string }> = [
  { id: 'BYPASS_ARCH', color: 'border-rose-500/40 bg-rose-500/5' },
  { id: 'BALANCED_AGILE', color: 'border-cyan-500/40 bg-cyan-500/5' },
  { id: 'STRICT_GOVERNANCE', color: 'border-indigo-500/40 bg-indigo-500/5' },
  { id: 'ACCELERATED_MODERN', color: 'border-emerald-500/40 bg-emerald-500/5' },
];

const DRIFT_RATE: Record<GovernancePosture, string> = {
  BYPASS_ARCH: '18 %',
  BALANCED_AGILE: '8 %',
  STRICT_GOVERNANCE: '2,5 %',
  ACCELERATED_MODERN: '4 %',
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const PlayerArena: React.FC<Props> = ({ session, team, scenario, onTeamUpdated }) => {
  const { t, lang, vocab, code, category, risk, severity, eventType } = useGameText(scenario);
  const tutorialActive = useHelpStore(s => s.tutorialActive);
  const tutorialSeen = useHelpStore(s => s.tutorialSeen);
  const startTutorial = useHelpStore(s => s.startTutorial);

  const [activeTab, setActiveTab] = useState<ArenaTab>('3D');
  const [selectedInitiatives, setSelectedInitiatives] = useState<string[]>(team.currentRoundDecisions?.selectedInitiativeIds || []);
  const [governancePosture, setGovernancePosture] = useState<TeamDecision['governancePosture']>(
    team.currentRoundDecisions?.governancePosture || 'BALANCED_AGILE'
  );
  const [selectedEventChoice, setSelectedEventChoice] = useState<string | undefined>(team.currentRoundDecisions?.eventChoiceId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [selectedRadarQuarter, setSelectedRadarQuarter] = useState<number>(session.currentRound || 1);

  const updateTeam = useSimulationStore(state => state.updateTeam);
  const setCurrentSession = useSimulationStore(state => state.setCurrentSession);

  React.useEffect(() => {
    setSelectedRadarQuarter(session.currentRound || 1);
  }, [session.currentRound]);

  // Sync local decision state when team changes or when session resets back to Q1
  React.useEffect(() => {
    setSelectedInitiatives(team.currentRoundDecisions?.selectedInitiativeIds || []);
    setGovernancePosture(team.currentRoundDecisions?.governancePosture || 'BALANCED_AGILE');
    setSelectedEventChoice(team.currentRoundDecisions?.eventChoiceId);
  }, [team.id, session.currentRound, team.decisionSubmitted, session.updatedAt]);

  // First visit: guided tutorial if never seen, otherwise the case file of a new scenario/team
  React.useEffect(() => {
    if (!tutorialSeen()) {
      startTutorial();
      return;
    }
    const key = `gemsim_briefing_seen_${scenario.id}_${team.id}`;
    try {
      if (!localStorage.getItem(key)) {
        setIsBriefingOpen(true);
        localStorage.setItem(key, 'true');
      }
    } catch {
      // storage unavailable: skip auto-open
    }
  }, [scenario.id, team.id]);

  // Current Round Event (facilitator-injected crisis takes precedence over the scheduled one)
  const activeInjectedCrisis =
    session.activeCrisis?.roundNumber === session.currentRound
      ? session.activeCrisis
      : session.injectedEvents?.find(e => e.roundNumber === session.currentRound);
  const currentEvent = activeInjectedCrisis || scenario.roundEvents.find(e => e.roundNumber === session.currentRound);
  const isInjectedCrisis = !!activeInjectedCrisis;

  // Same rules the server enforces: budget envelope, delivery capacity, one-time initiatives
  const pacts = team.currentRoundDecisions?.customPacts ?? [];
  const decisionCheck = checkDecisions(
    scenario,
    team,
    { selectedInitiativeIds: selectedInitiatives, governancePosture, eventChoiceId: selectedEventChoice, customPacts: pacts },
    session.currentRound,
    session.injectedEvents
  );
  const lockedIds = lockedInitiativeIds(team);
  const boardMandate = activeBoardMandate(team, session.currentRound);
  const activeById = new Map((team.activeInitiatives ?? []).map(a => [a.initiativeId, a.roundsRemaining]));
  const isCompleted = session.state === 'COMPLETED';
  const outcome = team.outcome ?? evaluateOutcome(scenario, team.metrics);
  const isSolo = session.teams.length === 1;
  const nodeName = (id: string) => scenario.topology.nodes.find(n => n.id === id)?.name ?? id;
  const stakeholderName = (id: string) => scenario.stakeholders.find(s => s.id === id)?.name ?? id;

  const tdi = team.metrics.technicalDebtIndex;
  const velocityDrag = Math.round(Math.pow(tdi / 100, 1.4) * 70);
  const m = vocab.metrics;

  const mandateEffects = () => {
    if (!boardMandate) return '';
    const e = BOARD_MANDATE_EFFECTS[boardMandate.verdict];
    const parts: string[] = [];
    if (e.capacityDelta > 0) parts.push(t('mandate.effect.capacityUp', { n: e.capacityDelta }));
    if (e.capacityDelta < 0) parts.push(t('mandate.effect.capacityDown', { n: e.capacityDelta }));
    if (e.velocityBonus) parts.push(t('mandate.effect.velocity', { n: e.velocityBonus, velocity: vocab.metrics.deliveryVelocity.label.toLowerCase() }));
    if (e.blockedRisk.length) parts.push(t('mandate.effect.blocked', { risks: e.blockedRisk.map(r => risk(r)).join(' / ') }));
    return parts.join(' · ');
  };

  const handleResolveQuarter = async () => {
    setIsResolving(true);
    setSubmitError(null);
    try {
      const { session: updated } = await api.advanceRound(session.id);
      setCurrentSession(updated);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsResolving(false);
    }
  };

  const handleWithdrawPact = async (stakeholderId: string) => {
    try {
      updateTeam(await api.withdrawPact(session.id, team.id, stakeholderId));
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  const handleToggleInitiative = (id: string) => {
    if (team.decisionSubmitted || isCompleted || lockedIds.has(id)) return;
    setSelectedInitiatives(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      if (prev.length >= decisionCheck.capacity) return prev;
      return [...prev, id];
    });
  };

  const handleSubmitDecisions = async () => {
    if (team.decisionSubmitted || isSubmitting || !decisionCheck.ok) return;
    setIsSubmitting(true);
    setSubmitError(null);
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
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: Array<{ id: ArenaTab; label: string; icon: React.ElementType; badge?: number; alert?: boolean }> = [
    { id: '3D', label: t('arena.tab.map'), icon: Compass },
    { id: 'INITIATIVES', label: t('arena.tab.initiatives'), icon: Layers, badge: selectedInitiatives.length || undefined },
    { id: 'GOVERNANCE', label: t('arena.tab.governance'), icon: Shield, alert: !!currentEvent },
    { id: 'STAKEHOLDERS', label: t('arena.tab.warroom'), icon: Zap },
    { id: 'HISTORY', label: t('arena.tab.history', { n: team.history.length }), icon: FileText },
  ];

  const hud: Array<{ key: string; label: string; help: string; value: React.ReactNode; sub: string; icon: React.ElementType; tone?: string }> = [
    {
      key: 'cash',
      label: m.budgetRemaining.label,
      help: m.budgetRemaining.description,
      value: `${team.metrics.budgetRemaining.toLocaleString(lang)}K$`,
      sub: t('metric.cashSub', { opex: team.metrics.opEx }),
      icon: DollarSign,
      tone: team.metrics.budgetRemaining < 0 ? 'text-rose-400' : 'text-slate-100',
    },
    {
      key: 'debt',
      label: m.technicalDebtIndex.label,
      help: m.technicalDebtIndex.description,
      value: `${tdi} %`,
      sub: t('metric.driftSub', { rate: DRIFT_RATE[governancePosture] }),
      icon: AlertTriangle,
      tone: tdi > 65 ? 'text-rose-400' : tdi > 40 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      key: 'velocity',
      label: m.deliveryVelocity.label,
      help: m.deliveryVelocity.description,
      value: (
        <>
          {team.metrics.deliveryVelocity} <span className="text-xs font-normal text-slate-500">{t('metric.pts')}</span>
        </>
      ),
      sub: t('metric.dragSub', { drag: velocityDrag }),
      icon: Zap,
    },
    {
      key: 'trust',
      label: m.stakeholderTrust.label,
      help: m.stakeholderTrust.description,
      value: `${team.metrics.stakeholderTrust} %`,
      sub: t('metric.trustSub', { count: scenario.stakeholders.length }),
      icon: TrendingUp,
    },
    {
      key: 'resilience',
      label: m.resilienceIndex.label,
      help: m.resilienceIndex.description,
      value: `${team.metrics.resilienceIndex}/100`,
      sub: t('metric.modernizedSub', { count: team.metrics.modernizedNodesCount, noun: vocab.nodeNoun }),
      icon: Shield,
      tone: 'text-emerald-400',
    },
    {
      key: 'compliance',
      label: m.complianceScore.label,
      help: m.complianceScore.description,
      value: `${team.metrics.complianceScore} %`,
      sub: team.metrics.complianceScore < 50 ? t('metric.complianceRisk') : t('metric.complianceSub'),
      icon: CheckCircle,
      tone: team.metrics.complianceScore < 50 ? 'text-rose-400' : 'text-slate-100',
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Mission banner */}
      <div className="bg-gradient-to-r from-dark-850 via-dark-800 to-indigo-950/40 p-4 rounded-xl border border-cyan-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-xl shrink-0" aria-hidden="true">
            {team.avatar}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-cyan-300">{team.name}</span>
              <span className="text-xs text-slate-400 font-mono">// {scenario.industry}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {t('arena.quarterOf', { n: session.currentRound, total: scenario.totalRounds || 4 })}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate mt-0.5">{scenario.title}</h2>
          </div>
        </div>
        <button
          data-tour="dossier"
          onClick={() => setIsBriefingOpen(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold flex items-center gap-2 transition-all shrink-0"
        >
          <BookOpen className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span>{t('arena.dossier')}</span>
        </button>
      </div>

      {/* Metrics HUD */}
      <div data-tour="hud" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {hud.map(item => (
          <div key={item.key} className="bg-dark-850 p-3.5 rounded-xl border border-slate-800 shadow-lg relative">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
              <span className="uppercase truncate flex items-center">
                {item.label}
                <InfoTip text={item.help} label={item.label} />
              </span>
              <item.icon className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
            </div>
            <div className={`text-xl font-bold font-mono ${item.tone ?? 'text-slate-100'}`}>{item.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Win conditions: final verdict once the last quarter is resolved, live tracker before */}
      <div data-tour="objectives">
        {isCompleted ? (
          <FinalVerdict session={session} team={team} outcome={outcome} scenario={scenario} />
        ) : (
          <ObjectivesTracker outcome={outcome} scenario={scenario} roundsLeft={session.totalRounds - session.currentRound + 1} />
        )}
      </div>

      {/* Injected crisis banner */}
      {isInjectedCrisis && currentEvent && (
        <div role="alert" className="p-4 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900/60 to-dark-850 border border-rose-500/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <Flame className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500 text-black">{t('arena.crisis.injectedBadge')}</span>
                <span className="text-sm text-rose-200 font-bold">{currentEvent.title}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {t('arena.crisis.injectedImpact', {
                  fine: currentEvent.immediateImpact.budgetFine,
                  debt: currentEvent.immediateImpact.tdiSurge,
                  debtLabel: m.technicalDebtIndex.label,
                  velocity: Math.abs(currentEvent.immediateImpact.velocityPenalty),
                  velocityLabel: m.deliveryVelocity.label,
                })}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('GOVERNANCE')}
            className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-black font-bold font-mono text-xs shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>{t('arena.crisis.respond')}</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Tabs and submit bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-dark-850 p-2.5 rounded-xl border border-slate-800">
        <div role="tablist" aria-label={t('arena.tabs')} className="flex flex-wrap items-center gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              data-tour={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 relative ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : tab.id === 'GOVERNANCE' && isInjectedCrisis
                  ? 'text-rose-400 bg-rose-500/10 border border-rose-500/40 hover:bg-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 rounded-full font-mono font-bold ${activeTab === tab.id ? 'bg-black text-cyan-400' : 'bg-cyan-500 text-black'}`}>
                  {tab.badge}
                </span>
              )}
              {tab.alert && <span className={`w-2 h-2 rounded-full ${isInjectedCrisis ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse'}`} aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div data-tour="submit" className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {isCompleted ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>{t('arena.complete')}</span>
            </div>
          ) : team.decisionSubmitted ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                <span>{t('arena.locked', { n: session.currentRound })}</span>
              </div>
              {isSolo && (
                <button
                  onClick={handleResolveQuarter}
                  disabled={isResolving}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono disabled:opacity-50"
                >
                  {isResolving
                    ? t('arena.resolving')
                    : session.currentRound >= session.totalRounds
                    ? t('arena.resolveFinal')
                    : t('arena.resolve', { n: session.currentRound })}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleSubmitDecisions}
              disabled={isSubmitting || !decisionCheck.ok}
              title={decisionCheck.ok ? undefined : decisionCheck.issues.map(code).join(' ')}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {t('arena.submit', { n: session.currentRound })} (
                {decisionCheck.committedCost > 0 ? t('arena.committed', { cost: decisionCheck.committedCost }) : t('arena.noSpend')})
              </span>
            </button>
          )}
        </div>
      </div>

      {!isCompleted && !team.decisionSubmitted && !decisionCheck.ok && (
        <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/50 text-rose-300 text-xs rounded-lg font-mono">
          {decisionCheck.issues.map((issue, i) => (
            <div key={i}>⛔ {code(issue)}</div>
          ))}
        </div>
      )}

      {submitError && (
        <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/50 text-rose-300 text-xs rounded-lg font-mono">
          ⚠️ {submitError}
        </div>
      )}

      {submissionSuccess && (
        <div role="status" className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          <span>{isSolo ? t('arena.submittedSolo') : t('arena.submitted')}</span>
        </div>
      )}

      {/* 3D map */}
      {activeTab === '3D' && (
        <div className="h-[600px] w-full" data-tour="map">
          <EnterpriseCanvas topology={scenario.topology} nodeHealthOverrides={team.nodeHealthOverrides} layerLabels={vocab.layers} />
        </div>
      )}

      {/* Initiative portfolio */}
      {activeTab === 'INITIATIVES' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100">{t('arena.portfolio.title')}</h3>
              <p className="text-xs text-slate-400">{t('arena.portfolio.subtitle')}</p>
            </div>
            <div data-tour="constraints" className="md:text-right font-mono text-xs space-y-0.5">
              <div>
                <span className="text-slate-500">{t('arena.portfolio.committed')} </span>
                <span className={decisionCheck.committedCost > decisionCheck.budgetAvailable ? 'text-rose-400 font-bold' : 'text-cyan-400 font-bold'}>
                  {decisionCheck.committedCost}K$
                </span>
                <span className="text-slate-600"> {t('arena.portfolio.ofCash', { cash: Math.max(0, team.metrics.budgetRemaining) })}</span>
                <InfoTip text={t('arena.portfolio.committedHelp')} align="right" />
              </div>
              <div>
                <span className="text-slate-500">{t('arena.portfolio.capacity')} </span>
                <span className="text-cyan-400 font-bold">
                  {selectedInitiatives.length}/{decisionCheck.capacity}
                </span>
                <span className="text-slate-600"> {t('arena.portfolio.capacityUnit')}</span>
                <InfoTip text={t('arena.portfolio.capacityHelp')} align="right" />
              </div>
              <div>
                <span className="text-slate-500">{t('mandate.label')} </span>
                {boardMandate ? (
                  <span
                    className={
                      boardMandate.verdict === 'APPROVED' ? 'text-emerald-400 font-bold' : boardMandate.verdict === 'REJECTED' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'
                    }
                  >
                    {t(`mandate.${boardMandate.verdict}` as TranslationKey)} — {mandateEffects()}
                  </span>
                ) : (
                  <span className="text-slate-600">{t('mandate.none')}</span>
                )}
              </div>
            </div>
          </div>

          {pacts.length > 0 && (
            <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-xl p-3 text-xs font-mono space-y-1.5">
              <div className="text-indigo-300 font-bold">🤝 {t('arena.pacts.title')}</div>
              {pacts.map(p => (
                <div key={p.stakeholderId} className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">
                    {stakeholderName(p.stakeholderId)} : « {p.concession} » — {p.committedBudget}K$
                  </span>
                  {!team.decisionSubmitted && (
                    <button onClick={() => handleWithdrawPact(p.stakeholderId)} className="text-rose-400 hover:text-rose-300">
                      {t('arena.pacts.withdraw')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenario.initiativesCatalog.map(init => {
              const isSelected = selectedInitiatives.includes(init.id);
              const isDone = team.completedInitiativeIds?.includes(init.id);
              const roundsLeft = activeById.get(init.id);
              const isLocked = lockedIds.has(init.id);
              const atCapacity = !isSelected && selectedInitiatives.length >= decisionCheck.capacity;
              const disabled = isLocked || atCapacity || team.decisionSubmitted || isCompleted;
              const riskBadge =
                init.riskLevel === 'EXTREME'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : init.riskLevel === 'HIGH'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

              return (
                <button
                  type="button"
                  key={init.id}
                  onClick={() => handleToggleInitiative(init.id)}
                  aria-pressed={isSelected}
                  aria-disabled={disabled && !isSelected}
                  className={`text-left p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                    isLocked || atCapacity ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-dark-800 border-cyan-500 ring-1 ring-cyan-500/40'
                      : 'bg-dark-850 border-slate-800 hover:border-slate-700 hover:bg-dark-800/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{category(init.category)}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${riskBadge}`}>{risk(init.riskLevel)}</span>
                    </div>
                    {(isDone || roundsLeft !== undefined || (init.durationRounds ?? 1) > 1) && (
                      <div className="mb-2 text-[10px] font-mono">
                        {isDone ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✓ {t('arena.init.completed')}</span>
                        ) : roundsLeft !== undefined ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">⏳ {t('arena.init.inDelivery', { n: roundsLeft })}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">⏱ {t('arena.init.duration', { n: init.durationRounds })}</span>
                        )}
                      </div>
                    )}
                    <h4 className="font-bold text-slate-100 text-sm mb-1">{init.name}</h4>
                    <p className="text-xs text-slate-400 mb-4 line-clamp-3">{init.description}</p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-800 text-xs font-mono w-full">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">{t('arena.init.capex')}</span>
                        <span className="font-bold text-slate-100">{init.capExCost}K$</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{t('arena.init.opex')}</span>
                        <span className={init.opExDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {signed(init.opExDelta)}K$ {t('common.perQuarter')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block truncate">{m.technicalDebtIndex.label}</span>
                        <span className={init.tdiDelta <= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{signed(init.tdiDelta)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block truncate">{m.deliveryVelocity.label}</span>
                        <span className={init.velocityDelta >= 0 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>{signed(init.velocityDelta)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block truncate">{m.resilienceIndex.label}</span>
                        <span className={init.resilienceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{signed(init.resilienceDelta)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block truncate">{m.complianceScore.label}</span>
                        <span className={init.complianceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{signed(init.complianceDelta)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] text-slate-500">
                        {t('arena.init.affects', { n: init.affectedNodeIds.length, noun: vocab.nodeNoun })}
                      </span>
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-slate-700 bg-dark-900'}`}
                        aria-hidden="true"
                      >
                        {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Governance and crisis */}
      {activeTab === 'GOVERNANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 flex flex-col gap-4" data-tour="posture">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center">
                {t('arena.gov.title')}
                <InfoTip text={t('arena.gov.help')} />
              </h3>
              <p className="text-xs text-slate-400">{t('arena.gov.subtitle')}</p>
            </div>
            <div role="radiogroup" aria-label={t('arena.gov.title')} className="space-y-3">
              {POSTURES.map(gov => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={governancePosture === gov.id}
                  key={gov.id}
                  onClick={() => !team.decisionSubmitted && setGovernancePosture(gov.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${gov.color} ${
                    governancePosture === gov.id ? 'ring-2 ring-cyan-400' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-100 text-sm">{vocab.postures[gov.id].name}</span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 text-right">{t(`arena.gov.tag.${gov.id}` as TranslationKey)}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{vocab.postures[gov.id].description}</p>
                  <div className="text-[11px] font-mono text-slate-400 bg-dark-900/60 p-2 rounded border border-slate-800">
                    {t(`arena.gov.impact.${gov.id}` as TranslationKey, {
                      debt: m.technicalDebtIndex.label.toLowerCase(),
                      velocity: m.deliveryVelocity.label.toLowerCase(),
                      compliance: m.complianceScore.label.toLowerCase(),
                      resilience: m.resilienceIndex.label.toLowerCase(),
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col gap-4" data-tour="crisis">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Flame className={`w-4 h-4 ${isInjectedCrisis ? 'text-rose-500 animate-pulse' : 'text-rose-400'}`} aria-hidden="true" />
                <span>{isInjectedCrisis ? t('arena.crisis.injectedTitle', { n: session.currentRound }) : t('arena.crisis.title', { n: session.currentRound })}</span>
                <InfoTip text={t('arena.crisis.help')} />
              </h3>
              <p className="text-xs text-slate-400">{isInjectedCrisis ? t('arena.crisis.injectedSubtitle') : t('arena.crisis.subtitle')}</p>
            </div>

            {/* Quarter horizon */}
            <div className="bg-dark-850 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-cyan-400" aria-hidden="true" />
                  <span>{t('arena.horizon.title')}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {selectedRadarQuarter === session.currentRound
                    ? t('arena.horizon.active')
                    : selectedRadarQuarter < session.currentRound
                    ? t('arena.horizon.past')
                    : t('arena.horizon.future')}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: session.totalRounds }, (_, i) => i + 1).map(qNum => {
                  const isPast = qNum < session.currentRound;
                  const isCurrent = qNum === session.currentRound;
                  const isSelected = selectedRadarQuarter === qNum;
                  return (
                    <button
                      key={qNum}
                      onClick={() => setSelectedRadarQuarter(qNum)}
                      aria-pressed={isSelected}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isSelected
                          ? isCurrent
                            ? 'bg-rose-500/20 border-rose-500 ring-1 ring-rose-500'
                            : 'bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500'
                          : isPast
                          ? 'bg-dark-900 border-emerald-500/30 hover:border-emerald-500/60'
                          : isCurrent
                          ? 'bg-rose-950/40 border-rose-500/50 hover:border-rose-400'
                          : 'bg-dark-900/60 border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-xs font-bold text-slate-100">{t('common.quarterShort', { n: qNum })}</span>
                        {isPast && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />}
                        {isCurrent && <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" aria-hidden="true" />}
                        {!isPast && !isCurrent && <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
                      </div>
                      <div className="text-[10px] font-mono truncate">
                        {isPast && <span className="text-emerald-400">{t('arena.horizon.resolved')}</span>}
                        {isCurrent && <span className="text-rose-400 font-bold">{t('arena.horizon.shock')}</span>}
                        {!isPast && !isCurrent && <span className="text-slate-500">{t('arena.horizon.fog')}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedRadarQuarter === session.currentRound ? (
              currentEvent ? (
                <div className={`p-5 rounded-xl border shadow-xl space-y-4 bg-dark-850 ${isInjectedCrisis ? 'border-rose-500/50 ring-1 ring-rose-500/20' : 'border-rose-500/30'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                      {isInjectedCrisis
                        ? t('arena.crisis.injectedBadge')
                        : t('arena.crisis.badge', { severity: severity(currentEvent.severity), type: eventType(currentEvent.type) })}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-100">{currentEvent.title}</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">{currentEvent.description}</p>

                  {currentEvent.immediateImpact && (
                    <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3 text-xs font-mono space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                        {isInjectedCrisis || currentEvent.impactAppliedAtInjection ? t('arena.crisis.impactApplied') : t('arena.crisis.impactIfIgnored')}
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-dark-900/80 p-2 rounded border border-rose-500/20">
                          <span className="text-[10px] text-slate-400 block">{t('arena.crisis.cash')}</span>
                          <span className="text-rose-400 font-bold">-{currentEvent.immediateImpact.budgetFine}K$</span>
                        </div>
                        <div className="bg-dark-900/80 p-2 rounded border border-rose-500/20">
                          <span className="text-[10px] text-slate-400 block truncate">{m.technicalDebtIndex.label}</span>
                          <span className="text-rose-400 font-bold">+{currentEvent.immediateImpact.tdiSurge}</span>
                        </div>
                        <div className="bg-dark-900/80 p-2 rounded border border-rose-500/20">
                          <span className="text-[10px] text-slate-400 block truncate">{m.deliveryVelocity.label}</span>
                          <span className="text-rose-400 font-bold">-{Math.abs(currentEvent.immediateImpact.velocityPenalty)}</span>
                        </div>
                      </div>
                      {!!currentEvent.immediateImpact.downedNodeIds?.length && (
                        <div className="pt-1 text-[11px] text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                          <span>{t('arena.crisis.downed', { nodes: currentEvent.immediateImpact.downedNodeIds.map(nodeName).join(', ') })}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div role="radiogroup" aria-label={t('arena.crisis.choose')} className="space-y-2.5 pt-3 border-t border-slate-800">
                    <span className="text-xs font-mono font-semibold text-slate-400">{t('arena.crisis.choose')}</span>
                    {currentEvent.choices.map(choice => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selectedEventChoice === choice.id}
                        key={choice.id}
                        onClick={() => !team.decisionSubmitted && setSelectedEventChoice(choice.id)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                          selectedEventChoice === choice.id ? 'bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500' : 'bg-dark-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-slate-200 mb-1.5 flex items-center justify-between gap-2">
                          <span>{choice.text}</span>
                          {selectedEventChoice === choice.id && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500 text-black font-bold shrink-0">{t('arena.crisis.selected')}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400">
                          <span>{t('arena.crisis.cost', { cost: choice.capExImpact })}</span>
                          <span className={choice.tdiImpact <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {m.technicalDebtIndex.label} : {signed(choice.tdiImpact)}
                          </span>
                          <span>
                            {m.deliveryVelocity.label} : {signed(choice.velocityImpact)}
                          </span>
                          {!!choice.nodeHealthImpacts && Object.keys(choice.nodeHealthImpacts).length > 0 && (
                            <span className="text-cyan-400 font-semibold">
                              {t('arena.crisis.recovers', { nodes: Object.keys(choice.nodeHealthImpacts).map(nodeName).join(', ') })}
                            </span>
                          )}
                          {!!choice.trustImpact && Object.keys(choice.trustImpact).length > 0 && (
                            <span className="text-indigo-300">
                              {t('arena.crisis.trust')}{' '}
                              {Object.entries(choice.trustImpact)
                                .map(([k, v]) => `${stakeholderName(k)} (${signed(v)})`)
                                .join(', ')}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-dark-850 p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">{t('arena.crisis.none')}</div>
              )
            ) : selectedRadarQuarter < session.currentRound ? (
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-dark-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ✅ {t('arena.past.badge', { n: selectedRadarQuarter })}
                  </span>
                  <button onClick={() => setSelectedRadarQuarter(session.currentRound)} className="text-[11px] text-cyan-400 underline font-mono">
                    {t('arena.backToActive', { n: session.currentRound })}
                  </button>
                </div>
                <h4 className="text-base font-bold text-slate-200">
                  {scenario.roundEvents.find(e => e.roundNumber === selectedRadarQuarter)?.title || t('arena.past.fallbackTitle', { n: selectedRadarQuarter })}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">{t('arena.past.body')}</p>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-indigo-500/40 bg-gradient-to-b from-dark-850 to-indigo-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('arena.future.badge')}</span>
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-200">{t('arena.future.title')}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{t('arena.future.body', { n: selectedRadarQuarter })}</p>
                <div className="bg-dark-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1 text-[11px] text-slate-400">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">{t('arena.future.signals')}</span>
                  <p>• {t('arena.future.signal1', { debt: m.technicalDebtIndex.label })}</p>
                  <p>• {t('arena.future.signal2', { compliance: m.complianceScore.label })}</p>
                  <p>• {t('arena.future.signal3', { noun: vocab.nodeNoun })}</p>
                </div>
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">💡 {t('arena.future.tip')}</div>
                <button
                  onClick={() => setSelectedRadarQuarter(session.currentRound)}
                  className="w-full py-2.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-cyan-400 border border-slate-700 text-xs font-mono font-bold"
                >
                  {t('arena.backToActive', { n: session.currentRound })}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'STAKEHOLDERS' && (
        <StakeholderWarRoom session={session} team={team} stakeholders={scenario.stakeholders} onTrustUpdated={onTeamUpdated} />
      )}

      {/* History */}
      {activeTab === 'HISTORY' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">{t('arena.history.title')}</h3>
            <p className="text-xs text-slate-400">{t('arena.history.subtitle')}</p>
          </div>

          {team.history.length === 0 ? (
            <div className="bg-dark-850 p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-xs">{t('arena.history.empty')}</div>
          ) : (
            <div className="space-y-4">
              {team.history.map(hist => (
                <article key={hist.roundNumber} className="bg-dark-850 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-cyan-400 font-mono">{t('arena.history.report', { n: hist.roundNumber })}</h4>
                    <span className="text-xs font-mono text-slate-400">
                      {t('arena.history.drift', { value: hist.debtCompoundedAmount, debt: m.technicalDebtIndex.label.toLowerCase() })}
                    </span>
                  </div>

                  {hist.notes?.length ? (
                    <ul className="text-xs text-slate-300 bg-dark-900 p-3 rounded-lg border border-slate-800 space-y-1 list-disc list-inside">
                      {hist.notes.map((n, i) => (
                        <li key={i}>{code(n)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-300 bg-dark-900 p-3 rounded-lg border border-slate-800">{hist.facilitatorFeedback}</p>
                  )}

                  {hist.economics && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono">
                      {[
                        [t('arena.history.econ.capex'), hist.economics.capExSpent],
                        [t('arena.history.econ.crisis'), hist.economics.eventCost],
                        [t('arena.history.econ.overrun'), hist.economics.opExOverrun],
                        [t('arena.history.econ.pacts'), hist.economics.pactCost],
                        [t('arena.history.econ.fines'), hist.economics.regulatoryFine],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="bg-dark-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">{label}</span>
                          <span className="text-slate-200 font-bold">{value}K$</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {hist.incidentsTriggered.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {t('arena.history.incidents', { n: hist.incidentsTriggered.length })}
                      </span>
                      {hist.incidentsTriggered.map(inc => (
                        <div key={inc.id} className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs">
                          <div className="flex items-center justify-between text-rose-300 font-bold mb-0.5">
                            <span>{inc.nodeName ? t('incident.title', { severity: severity(inc.severity), node: inc.nodeName }) : inc.title}</span>
                            <span>{t('incident.cost', { cost: inc.costImpact })}</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            {inc.nodeDebt !== undefined
                              ? t('incident.desc', { debt: inc.nodeDebt, probability: inc.failureProbability ?? 0 })
                              : inc.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-2">
                    {[
                      [m.technicalDebtIndex.label, hist.metricDeltas.technicalDebtIndex, true],
                      [m.deliveryVelocity.label, hist.metricDeltas.deliveryVelocity, false],
                      [m.stakeholderTrust.label, hist.metricDeltas.stakeholderTrust, false],
                      [m.budgetRemaining.label, hist.metricDeltas.budgetRemaining, false],
                    ].map(([label, value, lowerIsBetter]) => {
                      const v = value as number;
                      const good = lowerIsBetter ? v <= 0 : v >= 0;
                      return (
                        <div key={String(label)} className="bg-dark-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 text-[10px] block truncate">{label}</span>
                          <span className={good ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{signed(v)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {hist.stakeholderReactions.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-mono text-indigo-300 font-semibold">{t('arena.history.reactions')}</span>
                      {hist.stakeholderReactions.map(r => (
                        <p key={r.stakeholderId} className="text-[11px] text-slate-400">
                          <span className={r.trustDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{signed(r.trustDelta)}</span>{' '}
                          {r.notes?.length ? r.notes.map(code).join(' ') : r.comment}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <ExecutiveBriefingModal isOpen={isBriefingOpen} onClose={() => setIsBriefingOpen(false)} scenario={scenario} session={session} team={team} />

      {tutorialActive && <TutorialTour onTabChange={setActiveTab} isSolo={isSolo} />}
    </div>
  );
};
