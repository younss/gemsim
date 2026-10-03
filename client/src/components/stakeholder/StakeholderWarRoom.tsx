// ============================================================================
// GEMSIM: AI STAKEHOLDER WAR ROOM & REAL-TIME NEGOTIATION
// Roleplay Personas, Live Dialogue, and Automated Proposal Evaluation
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  StakeholderPersona,
  Team,
  SimulationSession,
  ChatMessage,
  ProposalEvaluation,
} from '../../types/index';
import { api } from '../../services/api';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { InfoTip } from '../help/InfoTip';
import { BOARD_MANDATE_EFFECTS } from '../../../../server/src/engine/rules';
import {
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Shield,
  Briefcase,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Landmark,
  Users2,
  Vote,
} from 'lucide-react';

interface Props {
  session: SimulationSession;
  team: Team;
  stakeholders: StakeholderPersona[];
  onTrustUpdated?: (updatedTeam: Team) => void;
}

export const StakeholderWarRoom: React.FC<Props> = ({
  session,
  team,
  stakeholders,
  onTrustUpdated,
}) => {
  const scenario = useSimulationStore(s => s.currentScenario);
  const { t, vocab, risk } = useGameText(scenario);
  // Can be 'BOARDROOM' for Plenary Executive Meeting, or individual stakeholder ID
  const [activeStakeholderId, setActiveStakeholderId] = useState<string>('BOARDROOM');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<ProposalEvaluation | null>(null);
  const [aiProviderBadge, setAiProviderBadge] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isBoardroom = activeStakeholderId === 'BOARDROOM';
  const activeStakeholder = stakeholders.find(s => s.id === activeStakeholderId) || stakeholders[0];
  const currentTrust = activeStakeholder
    ? team.stakeholderTrustMap[activeStakeholder.id] ?? activeStakeholder.baseTrust ?? 60
    : 60;

  // Average trust across all board members
  const averageBoardTrust = team.metrics.stakeholderTrust || Math.round(
    stakeholders.reduce((acc, s) => acc + (team.stakeholderTrustMap[s.id] ?? s.baseTrust ?? 60), 0) / (stakeholders.length || 1)
  );

  // Load chat history when active tab changes (Boardroom vs 1-on-1)
  useEffect(() => {
    if (isBoardroom) {
      api.getChatHistory(session.id, team.id, 'BOARDROOM').then(history => {
        if (history.length === 0) {
          const initialBoardroomGreeting: ChatMessage = {
            id: `greet-boardroom`,
            sender: 'SYSTEM',
            stakeholderId: 'BOARDROOM',
            senderName: t('war.board.secretariat'),
            content: t('war.board.greeting', {
              n: session.currentRound,
              members: stakeholders.map(s => `${s.name} (${s.title})`).join(', '),
            }),
            timestamp: new Date().toISOString(),
          };
          setMessages([initialBoardroomGreeting]);
        } else {
          setMessages(history);
        }
      });
    } else if (activeStakeholder) {
      api.getChatHistory(session.id, team.id, activeStakeholder.id).then(history => {
        if (history.length === 0 && activeStakeholder.sampleDialogue) {
          const initialGreeting: ChatMessage = {
            id: `greet-${activeStakeholder.id}`,
            sender: 'STAKEHOLDER',
            stakeholderId: activeStakeholder.id,
            senderName: `${activeStakeholder.name} (${activeStakeholder.title})`,
            content: activeStakeholder.sampleDialogue.greeting,
            timestamp: new Date().toISOString(),
          };
          setMessages([initialGreeting]);
        } else {
          setMessages(history);
        }
      });
    }
  }, [activeStakeholderId, session.id, team.id, session.updatedAt, session.currentRound]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isEvaluating]);

  const setCurrentSession = useSimulationStore(state => state.setCurrentSession);
  const updateTeam = useSimulationStore(state => state.updateTeam);
  const [pactBudgets, setPactBudgets] = useState<Record<string, number>>({});
  const [pactError, setPactError] = useState<string | null>(null);
  const signedPacts = team.currentRoundDecisions?.customPacts ?? [];

  // Server is the source of truth for trust and patience after each exchange
  const refreshSession = async () => {
    try {
      const { session: fresh } = await api.getSession(session.id);
      setCurrentSession(fresh);
    } catch {
      // keep optimistic state
    }
  };

  const handleSignPact = async (stakeholderId: string, concession: string, msgId: string) => {
    setPactError(null);
    try {
      const updated = await api.signPact(session.id, {
        teamId: team.id,
        stakeholderId,
        concession,
        committedBudget: pactBudgets[msgId] ?? 50,
      });
      updateTeam(updated);
    } catch (err: any) {
      setPactError(err.message);
    }
  };

  const mandateEffects = (verdict: keyof typeof BOARD_MANDATE_EFFECTS) => {
    const e = BOARD_MANDATE_EFFECTS[verdict];
    const parts: string[] = [];
    if (e.capacityDelta > 0) parts.push(t('mandate.effect.capacityUp', { n: e.capacityDelta }));
    if (e.capacityDelta < 0) parts.push(t('mandate.effect.capacityDown', { n: e.capacityDelta }));
    if (e.velocityBonus) parts.push(t('mandate.effect.velocity', { n: e.velocityBonus, velocity: vocab.metrics.deliveryVelocity.label.toLowerCase() }));
    if (e.blockedRisk.length) parts.push(t('mandate.effect.blocked', { risks: e.blockedRisk.map(r => risk(r)).join(' / ') }));
    return parts.join(' · ');
  };

  // Domain-neutral starter proposals, made concrete with the scenario's best debt-reducing initiatives
  const topInitiatives = [...(scenario?.initiativesCatalog ?? [])].filter(i => i.tdiDelta < 0).sort((a, b) => a.tdiDelta - b.tdiDelta);
  const first = topInitiatives[0]?.name ?? '';
  const second = topInitiatives[1]?.name ?? first;
  const quickPitches = [
    { id: 'phased', label: `🧭 ${t('war.pitch.phased.label')}`, text: t('war.pitch.phased.text', { first, second }) },
    { id: 'costs', label: `💰 ${t('war.pitch.costs.label')}`, text: t('war.pitch.costs.text', { opex: vocab.metrics.opEx.label.toLowerCase() }) },
    {
      id: 'balance',
      label: `⚖️ ${t('war.pitch.balance.label')}`,
      text: t('war.pitch.balance.text', { velocity: vocab.metrics.deliveryVelocity.label.toLowerCase(), debt: vocab.metrics.technicalDebtIndex.label.toLowerCase() }),
    },
    { id: 'compliance', label: `🛡️ ${t('war.pitch.compliance.label')}`, text: t('war.pitch.compliance.text', { compliance: vocab.metrics.complianceScore.label.toLowerCase() }) },
  ];

  const handleSendMessage = async () => {
    if (!inputText.trim() || isEvaluating) return;

    const userText = inputText.trim();
    setInputText('');

    // Optimistically add user message
    const tempPlayerMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: 'PLAYER',
      stakeholderId: isBoardroom ? 'BOARDROOM' : activeStakeholder?.id,
      senderName: `${team.name} (${t('war.playerRole')})`,
      content: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempPlayerMsg]);
    setIsEvaluating(true);

    try {
      if (isBoardroom) {
        // PLENARY BOARDROOM DELIBERATION
        const res = await api.callBoardroomMeeting({
          sessionId: session.id,
          teamId: team.id,
          playerMessage: userText,
        });

        setMessages(prev => [...prev, ...res.replies]);
        setAiProviderBadge(res.usedProvider);

        if (onTrustUpdated) {
          const updatedTeam: Team = {
            ...team,
            stakeholderTrustMap: res.updatedTrustMap,
            metrics: { ...team.metrics, stakeholderTrust: res.averageTrust },
          };
          onTrustUpdated(updatedTeam);
        }
      } else {
        // 1-ON-1 NEGOTIATION WITH REAL-TIME STREAMING
        if (!activeStakeholder) return;

        const streamingMsgId = `stream-${Date.now()}`;
        let accumulatedText = '';
        let hasAddedStreamingMsg = false;

        try {
          const res = await api.negotiateStakeholderStream(
            {
              sessionId: session.id,
              teamId: team.id,
              stakeholderId: activeStakeholder.id,
              playerMessage: userText,
            },
            (chunk: string) => {
              accumulatedText += chunk;
              setMessages(prev => {
                if (!hasAddedStreamingMsg) {
                  hasAddedStreamingMsg = true;
                  return [
                    ...prev,
                    {
                      id: streamingMsgId,
                      sender: 'STAKEHOLDER',
                      stakeholderId: activeStakeholder.id,
                      senderName: `${activeStakeholder.name} (${activeStakeholder.title})`,
                      content: accumulatedText,
                      timestamp: new Date().toISOString(),
                    },
                  ];
                } else {
                  return prev.map(m =>
                    m.id === streamingMsgId ? { ...m, content: accumulatedText } : m
                  );
                }
              });
            }
          );

          // Replace streaming bubble with finalized reply containing full evaluation badges
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== streamingMsgId);
            return [...filtered, res.reply];
          });
          setLastEvaluation(res.evaluation);
          setAiProviderBadge(res.usedProvider);

          if (onTrustUpdated) {
            const updatedTrustMap = { ...team.stakeholderTrustMap, [activeStakeholder.id]: res.updatedTrust };
            const trusts = Object.values(updatedTrustMap);
            const avg = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
            const updatedTeam: Team = {
              ...team,
              stakeholderTrustMap: updatedTrustMap,
              metrics: { ...team.metrics, stakeholderTrust: avg },
            };
            onTrustUpdated(updatedTeam);
          }
        } catch (streamErr: any) {
          console.warn('Streaming error, falling back to standard negotiate:', streamErr);
          // Remove streaming placeholder if any
          setMessages(prev => prev.filter(m => m.id !== streamingMsgId));

          // Try standard non-streaming negotiation fallback
          const fallbackRes = await api.negotiateStakeholder({
            sessionId: session.id,
            teamId: team.id,
            stakeholderId: activeStakeholder.id,
            playerMessage: userText,
          });

          setMessages(prev => [...prev, fallbackRes.reply]);
          setLastEvaluation(fallbackRes.evaluation);
          setAiProviderBadge(fallbackRes.usedProvider);

          if (onTrustUpdated) {
            const updatedTrustMap = { ...team.stakeholderTrustMap, [activeStakeholder.id]: fallbackRes.updatedTrust };
            const trusts = Object.values(updatedTrustMap);
            const avg = Math.round(trusts.reduce((a, b) => a + b, 0) / (trusts.length || 1));
            const updatedTeam: Team = {
              ...team,
              stakeholderTrustMap: updatedTrustMap,
              metrics: { ...team.metrics, stakeholderTrust: avg },
            };
            onTrustUpdated(updatedTeam);
          }
        }
      }
    } catch (err: any) {
      console.error('Negotiation / Boardroom error:', err);
      // Display error message in the chat so player sees circuit breaker or timeout message
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'SYSTEM',
        stakeholderId: isBoardroom ? 'BOARDROOM' : activeStakeholder?.id,
        senderName: t('war.error.sender'),
        content: `⚠️ ${err.message || t('war.error.body')}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsEvaluating(false);
      void refreshSession();
    }
  };

  const handleQuickProposal = (template: string) => {
    setInputText(template);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px] max-h-[85vh]">
      {/* Left Column: Stakeholder Persona Cards Selector */}
      <div className="lg:col-span-4 flex flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <span>{t('war.arena')}</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">{t('common.quarterShort', { n: session.currentRound })}</span>
        </div>

        {/* Executive Board Meeting (ComEx Plenary) Card */}
        <button
          onClick={() => setActiveStakeholderId('BOARDROOM')}
          className={`text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden group ${
            isBoardroom
              ? 'bg-gradient-to-r from-indigo-950/80 via-dark-800 to-indigo-900/40 border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500'
              : 'bg-dark-850 border-slate-800 hover:border-slate-700 hover:bg-dark-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
              🏛️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-slate-100 text-sm truncate">{t('war.board.name')}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                  {t('war.board.badge')}
                </span>
              </div>
              <div className="text-xs text-indigo-300 font-medium truncate mt-0.5">
                {t('war.board.members', { n: stakeholders.length })}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-sm bg-dark-900/60 p-1.5 rounded border border-slate-800">
                {stakeholders.map(s => (
                  <span key={s.id} title={`${s.name} (${s.title})`} className="cursor-help">{s.avatar}</span>
                ))}
                <span className="text-[10px] font-mono text-indigo-300 ml-auto font-bold">
                  {t('war.board.alignment', { n: averageBoardTrust })}
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 px-1 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <span>{t('war.oneOnOne')}</span>
        </div>

        {stakeholders.map(sh => {
          const trust = team.stakeholderTrustMap[sh.id] ?? sh.baseTrust ?? 60;
          const isSelected = sh.id === activeStakeholderId;

          let trustColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
          let barColor = 'bg-emerald-500';
          if (trust < 45) {
            trustColor = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
            barColor = 'bg-rose-500';
          } else if (trust < 70) {
            trustColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
            barColor = 'bg-amber-500';
          }

          return (
            <button
              key={sh.id}
              onClick={() => setActiveStakeholderId(sh.id)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden group ${
                isSelected
                  ? 'bg-dark-800 border-cyan-500 shadow-[0_0_20px_rgba(0,240,255,0.15)] ring-1 ring-cyan-500/50'
                  : 'bg-dark-850/80 border-slate-800 hover:border-slate-700 hover:bg-dark-800/80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-dark-750 flex items-center justify-center text-2xl border border-slate-700 shrink-0 shadow-inner">
                  {sh.avatar || '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-100 text-sm truncate">{sh.name}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${trustColor}`}>
                      {t('war.trust', { n: trust })}
                    </span>
                  </div>
                  <div className="text-xs text-cyan-400 font-medium truncate">{sh.title}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{sh.role}</div>
                </div>
              </div>

              {/* Trust Progress Bar */}
              <div className="mt-3 w-full bg-dark-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${trust}%` }}
                />
              </div>

              {/* Patience Meter: spent by rejected or empty pitches, recovers each quarter */}
              {(() => {
                const patience = team.stakeholderPatience?.[sh.id] ?? 100;
                return (
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <span className="flex items-center">
                      {t('war.patience')}
                      <InfoTip text={t('war.patienceHelp')} />
                    </span>
                    <div className="flex-1 bg-dark-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${patience}%` }} />
                    </div>
                    <span className={patience <= 0 ? 'text-rose-400 font-bold' : patience < 35 ? 'text-amber-400' : 'text-violet-300'}>
                      {patience <= 0 ? `🚪 ${t('war.closed')}` : `${patience}%`}
                    </span>
                  </div>
                );
              })()}

              {/* Quick Bias Tag */}
              <div className="mt-2 text-[10px] text-slate-400 italic line-clamp-1">
                <span className="font-semibold text-slate-300">{t('war.focus')}</span> {sh.bias}
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Column: Live Conversational Interface & Proposal Evaluator */}
      <div className="lg:col-span-8 flex flex-col bg-dark-850 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* Header with Stakeholder Briefing or Boardroom Overview */}
        <div className="p-4 border-b border-slate-800 bg-dark-900/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {isBoardroom ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                🏛️
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-100 text-base">{t('war.board.title')}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                    {t('war.board.inSession', { n: stakeholders.length })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t('war.board.subtitle', { n: session.currentRound })}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 rounded-xl bg-dark-800 border border-slate-700">
                {activeStakeholder.avatar}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-100 text-base">{activeStakeholder.name}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
                    {activeStakeholder.title}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  <strong className="text-slate-300">{t('brief.people.agenda')}</strong> {activeStakeholder.hiddenAgenda}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block font-mono">
                {isBoardroom ? t('war.board.alignmentLabel') : t('war.currentTrust')}
              </span>
              <span className={`text-sm font-mono font-bold ${
                (isBoardroom ? averageBoardTrust : currentTrust) > 60 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {isBoardroom ? `${averageBoardTrust}%` : `${currentTrust}/100`}
              </span>
            </div>
            {aiProviderBadge && (
              <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-cyan-400 font-mono border border-slate-700">
                {aiProviderBadge.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Chat Messages Transcript */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-dark-900/40">
          {messages.map((msg, idx) => {
            const isUser = msg.sender === 'PLAYER';
            const isSystem = msg.sender === 'SYSTEM';

            return (
              <div key={msg.id || idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-mono font-semibold text-slate-400">{msg.senderName}</span>
                  <span className="text-[10px] text-slate-600 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                    isUser
                      ? 'bg-cyan-600 text-white rounded-tr-none'
                      : isSystem
                      ? 'bg-indigo-950/70 text-indigo-100 border border-indigo-500/40 rounded-tl-none'
                      : 'bg-dark-800 text-slate-100 border border-slate-700/80 rounded-tl-none'
                  }`}
                >
                  {msg.boardResolution ? (
                    <p className="whitespace-pre-wrap">
                      {t('war.resolution.summary', {
                        verdict: t(`mandate.${msg.boardResolution.verdict}` as TranslationKey),
                        consensus: msg.boardResolution.consensusScore,
                        accepted: msg.boardResolution.votes.accepted,
                        conditional: msg.boardResolution.votes.conditional,
                        rejected: msg.boardResolution.votes.rejected,
                      })}
                      {'\n'}
                      {t('war.resolution.mandate', { effects: mandateEffects(msg.boardResolution.verdict) })}
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* If Boardroom Resolution Attached */}
                  {msg.boardResolution && (
                    <div className="mt-3 pt-3 border-t border-indigo-500/40 text-xs font-mono space-y-2">
                      <div className={`p-3 rounded-xl border flex items-center justify-between ${
                        msg.boardResolution.verdict === 'APPROVED'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : msg.boardResolution.verdict === 'CONDITIONAL_QUORUM'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}>
                        <span className="font-bold flex items-center gap-1.5 text-sm">
                          {msg.boardResolution.verdict === 'APPROVED' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                          )}
                          <span>{t(`mandate.${msg.boardResolution.verdict}` as TranslationKey)}</span>
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-dark-900 border border-slate-700">
                          {t('war.resolution.consensus', { n: msg.boardResolution.consensusScore })}
                        </span>
                      </div>

                      {/* Breakdown per stakeholder */}
                      {msg.boardResolution.breakdown && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                          {Object.entries(msg.boardResolution.breakdown).map(([shId, item]: [string, any]) => (
                            <div key={shId} className="bg-dark-900/80 p-2 rounded border border-slate-800">
                              <span className="text-slate-300 font-bold block truncate">{item.stakeholderName}</span>
                              <span className={item.verdict === 'ACCEPTED' ? 'text-emerald-400' : item.verdict === 'CONDITIONAL_ACCEPTANCE' ? 'text-amber-400' : 'text-rose-400'}>
                                {item.verdict === 'ACCEPTED' ? `✓ ${t('war.vote.for')}` : item.verdict === 'CONDITIONAL_ACCEPTANCE' ? `⚠️ ${t('war.vote.conditional')}` : `✗ ${t('war.vote.against')}`} ({item.trustDelta > 0 ? `+${item.trustDelta}` : item.trustDelta})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* If Stakeholder evaluation attached */}
                  {msg.evaluation && !msg.boardResolution && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs font-mono">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {msg.evaluation.verdict === 'ACCEPTED' ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('war.verdict.ACCEPTED')}
                            </span>
                          ) : msg.evaluation.verdict === 'CONDITIONAL_ACCEPTANCE' ? (
                            <span className="text-amber-400 flex items-center gap-1 font-bold">
                              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('war.verdict.CONDITIONAL_ACCEPTANCE')}
                            </span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-1 font-bold">
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('war.verdict.REJECTED')}
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-bold ${
                            msg.evaluation.trustDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {t('war.trustDelta', { n: msg.evaluation.trustDelta >= 0 ? `+${msg.evaluation.trustDelta}` : msg.evaluation.trustDelta })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-dark-900/60 p-2 rounded border border-slate-700/40 text-[10px]">
                        <div>
                          <span className="text-slate-500 block">{t('war.score.empathy')}</span>
                          <span className="text-slate-200 font-bold">{msg.evaluation.empathyScore}/100</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">{t('war.score.financial')}</span>
                          <span className="text-slate-200 font-bold">{msg.evaluation.financialAcumenScore}/100</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">{t('war.score.strategy')}</span>
                          <span className="text-slate-200 font-bold">{msg.evaluation.strategicAlignmentScore}/100</span>
                        </div>
                      </div>

                      {msg.evaluation.concessionRequired && (
                        <div className="mt-2 text-amber-300 text-[11px] bg-amber-500/10 p-2 rounded border border-amber-500/30">
                          <strong>{t('war.concession')}</strong> {msg.evaluation.concessionRequired}
                          {msg.stakeholderId && msg.stakeholderId !== 'BOARDROOM' && session.state !== 'COMPLETED' && msg.evaluation.decisionEngine !== 'sentinel' && (
                            signedPacts.some(p => p.stakeholderId === msg.stakeholderId && p.concession === msg.evaluation!.concessionRequired) ? (
                              <div className="mt-2 text-emerald-300 font-bold">🤝 {t('war.pact.signed')}</div>
                            ) : !team.decisionSubmitted ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <label className="text-slate-400" htmlFor={`pact-${msg.id}`}>
                                  {t('war.pact.budget')}
                                </label>
                                <input
                                  id={`pact-${msg.id}`}
                                  type="number"
                                  min={0}
                                  step={10}
                                  value={pactBudgets[msg.id] ?? 50}
                                  onChange={e => setPactBudgets(prev => ({ ...prev, [msg.id]: Number(e.target.value) }))}
                                  className="w-20 bg-dark-950 border border-slate-700 rounded px-2 py-0.5 text-cyan-300"
                                />
                                <button
                                  onClick={() => handleSignPact(msg.stakeholderId!, msg.evaluation!.concessionRequired!, msg.id)}
                                  className="px-2.5 py-1 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-bold"
                                >
                                  🤝 {t('war.pact.sign')}
                                </button>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isEvaluating && (
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono p-2 animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>
                {isBoardroom ? t('war.board.deliberating') : t('war.evaluating', { name: activeStakeholder.name })}
              </span>
            </div>
          )}

          {pactError && <div className="text-xs font-mono text-rose-400 p-2">⚠️ {pactError}</div>}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick proposals: built from the scenario's own initiatives, in the interface language */}
        <div className="px-4 py-2 bg-dark-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 text-[11px] font-mono shrink-0">{isBoardroom ? t('war.pitches.board') : t('war.pitches.individual')}</span>
          {quickPitches.map(chip => {
            const used = messages.some(
              m =>
                m.sender === 'PLAYER' &&
                m.stakeholderId === (isBoardroom ? 'BOARDROOM' : activeStakeholder?.id) &&
                m.content.trim().toLowerCase() === chip.text.trim().toLowerCase()
            );
            return (
              <button
                key={chip.id}
                disabled={used}
                onClick={() => handleQuickProposal(chip.text)}
                title={chip.text}
                className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  used
                    ? 'bg-slate-900 text-slate-500 border border-slate-800 line-through opacity-60 cursor-not-allowed'
                    : isBoardroom
                    ? 'bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40'
                    : 'bg-dark-800 hover:bg-dark-750 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                <span>{chip.label}</span>
                {used && <span className="text-[9px] font-mono text-amber-400 no-underline">({t('war.pitches.used')})</span>}
              </button>
            );
          })}
        </div>

        {/* Anti-Cheat / Repetition Warning Banner */}
        {messages.some(
          m => m.sender === 'PLAYER' &&
          m.stakeholderId === (isBoardroom ? 'BOARDROOM' : activeStakeholder?.id) &&
          m.content.trim().toLowerCase() === inputText.trim().toLowerCase() &&
          inputText.trim().length >= 8
        ) && (
          <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              ⚠️ {t('war.repeatWarning')}
            </span>
          </div>
        )}

        {/* Message Input Box */}
        <div className="p-4 bg-dark-900 border-t border-slate-800 flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            aria-label={isBoardroom ? t('war.input.board') : t('war.input.individual', { name: activeStakeholder.name })}
            placeholder={isBoardroom ? t('war.input.board') : t('war.input.individual', { name: activeStakeholder.name })}
            className="flex-1 bg-dark-800 text-slate-100 text-sm px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
            disabled={isEvaluating}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isEvaluating}
            className={`px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
              isBoardroom
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
            } disabled:opacity-50`}
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{isBoardroom ? t('war.send.board') : t('war.send.individual')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
