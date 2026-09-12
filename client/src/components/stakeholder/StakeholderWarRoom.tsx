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
            senderName: 'Secrétariat Général du Conseil d\'Administration',
            content: `🏛️ Séance Plénière du Conseil d'Administration convoquée pour le Trimestre ${session.currentRound}.\n\nParticipants au tour de table : ${stakeholders.map(s => `${s.name} (${s.title})`).join(', ')}.\n\nPrésentez votre stratégie d'architecture globale et vos arbitrages budgétaires. Tous les membres du Conseil délibèreront et voteront sur votre proposition.`,
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

  const handleSendMessage = async () => {
    if (!inputText.trim() || isEvaluating) return;

    const userText = inputText.trim();
    setInputText('');

    // Optimistically add user message
    const tempPlayerMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: 'PLAYER',
      stakeholderId: isBoardroom ? 'BOARDROOM' : activeStakeholder?.id,
      senderName: `${team.name} (Directeur Architecture)`,
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
        senderName: 'Système // Incident IA',
        content: `⚠️ ${err.message || 'La négociation a échoué. Veuillez réessayer.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsEvaluating(false);
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
            <Briefcase className="w-4 h-4 text-cyan-400" />
            <span>Political Arena</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">Q{session.currentRound}</span>
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
                <span className="font-bold text-slate-100 text-sm truncate">Conseil d'Administration</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                  PLÉNIÈRE COMEX
                </span>
              </div>
              <div className="text-xs text-indigo-300 font-medium truncate mt-0.5">
                Tous les Décideurs Réunis ({stakeholders.length} Membres)
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-sm bg-dark-900/60 p-1.5 rounded border border-slate-800">
                {stakeholders.map(s => (
                  <span key={s.id} title={`${s.name} (${s.title})`} className="cursor-help">{s.avatar}</span>
                ))}
                <span className="text-[10px] font-mono text-indigo-300 ml-auto font-bold">
                  {averageBoardTrust}% Quorum
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 px-1 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <span>Entretiens Individuels (1-sur-1)</span>
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
                      {trust}% Trust
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

              {/* Quick Bias Tag */}
              <div className="mt-2 text-[10px] text-slate-400 italic line-clamp-1">
                <span className="font-semibold text-slate-300">Focus:</span> {sh.bias}
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
                  <h4 className="font-bold text-slate-100 text-base">Conseil d'Administration & ComEx Plénier</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                    {stakeholders.length} DÉCIDEURS EN SÉANCE
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Délibération stratégique collective • Trimestre {session.currentRound}
                </p>
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
                  <strong className="text-slate-300">Hidden Agenda:</strong> {activeStakeholder.hiddenAgenda}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block font-mono">
                {isBoardroom ? 'ALIGNEMENT QUORUM' : 'CURRENT TRUST'}
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
                  <p className="whitespace-pre-wrap">{msg.content}</p>

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
                          <span>
                            {msg.boardResolution.verdict === 'APPROVED'
                              ? 'RÉSOLUTION ADOPTÉE'
                              : msg.boardResolution.verdict === 'CONDITIONAL_QUORUM'
                              ? 'QUORUM SOUS CONDITIONS'
                              : 'PROPOSITION REJETÉE'}
                          </span>
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-dark-900 border border-slate-700">
                          Consensus : {msg.boardResolution.consensusScore}%
                        </span>
                      </div>

                      {/* Breakdown per stakeholder */}
                      {msg.boardResolution.breakdown && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                          {Object.entries(msg.boardResolution.breakdown).map(([shId, item]: [string, any]) => (
                            <div key={shId} className="bg-dark-900/80 p-2 rounded border border-slate-800">
                              <span className="text-slate-300 font-bold block truncate">{item.stakeholderName}</span>
                              <span className={item.verdict === 'ACCEPTED' ? 'text-emerald-400' : item.verdict === 'CONDITIONAL_ACCEPTANCE' ? 'text-amber-400' : 'text-rose-400'}>
                                {item.verdict === 'ACCEPTED' ? '✓ Pour' : item.verdict === 'CONDITIONAL_ACCEPTANCE' ? '⚠️ Réserve' : '✗ Contre'} ({item.trustDelta > 0 ? `+${item.trustDelta}` : item.trustDelta})
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
                              <CheckCircle2 className="w-3.5 h-3.5" /> PACT ACCEPTED
                            </span>
                          ) : msg.evaluation.verdict === 'CONDITIONAL_ACCEPTANCE' ? (
                            <span className="text-amber-400 flex items-center gap-1 font-bold">
                              <HelpCircle className="w-3.5 h-3.5" /> CONDITIONAL CONCESSION
                            </span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-1 font-bold">
                              <XCircle className="w-3.5 h-3.5" /> PROPOSAL REJECTED
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-bold ${
                            msg.evaluation.trustDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {msg.evaluation.trustDelta >= 0 ? `+${msg.evaluation.trustDelta}` : msg.evaluation.trustDelta} Trust
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-dark-900/60 p-2 rounded border border-slate-700/40 text-[10px]">
                        <div>
                          <span className="text-slate-500 block">EMPATHY</span>
                          <span className="text-slate-200 font-bold">{msg.evaluation.empathyScore}/100</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">FINANCIAL</span>
                          <span className="text-slate-200 font-bold">{msg.evaluation.financialAcumenScore}/100</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">STRATEGY</span>
                          <span className="text-slate-200 font-bold">{msg.evaluation.strategicAlignmentScore}/100</span>
                        </div>
                      </div>

                      {msg.evaluation.concessionRequired && (
                        <div className="mt-2 text-amber-300 text-[11px] bg-amber-500/10 p-2 rounded border border-amber-500/30">
                          <strong>Concession Demanded:</strong> {msg.evaluation.concessionRequired}
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
                {isBoardroom
                  ? 'Le Conseil d\'Administration délibère en plénière...'
                  : `${activeStakeholder.name} is evaluating your proposal against executive metrics...`}
              </span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Strategic Proposal Chips */}
        <div className="px-4 py-2 bg-dark-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 text-[11px] font-mono shrink-0">
            {isBoardroom ? 'Board Pitches:' : 'Quick Pacts:'}
          </span>
          {isBoardroom ? (
            <>
              {[
                {
                  id: 'paved-path',
                  label: '⚖️ Compromis Sablier & Paved Path',
                  text: `Mesdames et messieurs du Conseil, nous proposons une architecture en sablier avec des Quality Gates automatiques : nous réduisons la dette technique tout en garantissant les délais de mise sur le marché.`,
                },
                {
                  id: 'sovereignty',
                  label: '🛡️ Souveraineté & Données Synthétiques',
                  text: `Nous sanctuarisons le coeur souverain avec des données synthétiques et un contrôle strict des prestataires, garantissant la conformité réglementaire et la sécurité.`,
                },
                {
                  id: 'opex-cut',
                  label: '💰 Engagement ROI & Baisse d\'OpEx',
                  text: `Nous nous engageons sur une baisse d'OpEx de 15% dès le prochain trimestre en échange du déblocage d'un budget d'outillage et d'automatisation CI/CD.`,
                },
              ].map(chip => {
                const used = messages.some(
                  m => m.sender === 'PLAYER' &&
                  m.stakeholderId === 'BOARDROOM' &&
                  m.content.trim().toLowerCase() === chip.text.trim().toLowerCase()
                );
                return (
                  <button
                    key={chip.id}
                    disabled={used}
                    onClick={() => handleQuickProposal(chip.text)}
                    className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      used
                        ? 'bg-slate-900 text-slate-500 border border-slate-800 line-through opacity-60 cursor-not-allowed'
                        : 'bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    <span>{chip.label}</span>
                    {used && <span className="text-[9px] font-mono text-amber-400 no-underline">(Déjà engagé)</span>}
                  </button>
                );
              })}
            </>
          ) : /(?:[éàèùâêîôûëïç]|directeur|responsable|chef|président|mirage|assurance)/i.test((activeStakeholder?.title || '') + (activeStakeholder?.name || '')) ? (
            <>
              {[
                {
                  id: 'fr-opex',
                  label: '💰 Engagement Réduction OpEx (-15%)',
                  text: `Nous nous engageons sur une baisse d'OpEx de 15% d'ici deux trimestres en échange de votre arbitrage budgétaire favorable.`,
                },
                {
                  id: 'fr-fasttrack',
                  label: '🚀 Fast-track Fonctionnalités Métier',
                  text: `Nous accélérons en parallèle les fonctionnalités métier prioritaires via des couches anti-corruption, sans violer les normes d'architecture.`,
                },
                {
                  id: 'fr-security',
                  label: '🛡️ Garantie Sécurité & Zero-Trust',
                  text: `Nous sanctuarisons les flux avec journalisation d'audit automatique et zero-trust pour éliminer toute exposition réglementaire.`,
                },
                {
                  id: 'fr-pavedpath',
                  label: '⚖️ Paved Path & Sas d\'Intégration',
                  text: `Nous déployons un sas d'intégration et un paved path standardisé pour fluidifier le delivery sans désorganiser les équipes.`,
                },
              ].map(chip => {
                const used = messages.some(
                  m => m.sender === 'PLAYER' &&
                  m.stakeholderId === activeStakeholder?.id &&
                  m.content.trim().toLowerCase() === chip.text.trim().toLowerCase()
                );
                return (
                  <button
                    key={chip.id}
                    disabled={used}
                    onClick={() => handleQuickProposal(chip.text)}
                    className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      used
                        ? 'bg-slate-900 text-slate-500 border border-slate-800 line-through opacity-60 cursor-not-allowed'
                        : 'bg-dark-800 hover:bg-dark-750 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    <span>{chip.label}</span>
                    {used && <span className="text-[9px] font-mono text-amber-400 no-underline">(Déjà engagé)</span>}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {[
                {
                  id: 'en-opex',
                  label: '💰 OpEx Cut Commitment',
                  text: `I commit to reducing ongoing legacy maintenance OpEx by 15% within two quarters in exchange for your capital sign-off.`,
                },
                {
                  id: 'en-fasttrack',
                  label: '🚀 Parallel Feature Fast-Track',
                  text: `We will fast-track high-priority user features concurrently using anti-corruption layers without violating architecture standards.`,
                },
                {
                  id: 'en-zerotrust',
                  label: '⚖️ Zero-Trust Compliance Guarantee',
                  text: `We are implementing automated compliance audit logging and zero-trust mTLS to eliminate all regulatory exposure.`,
                },
              ].map(chip => {
                const used = messages.some(
                  m => m.sender === 'PLAYER' &&
                  m.stakeholderId === activeStakeholder?.id &&
                  m.content.trim().toLowerCase() === chip.text.trim().toLowerCase()
                );
                return (
                  <button
                    key={chip.id}
                    disabled={used}
                    onClick={() => handleQuickProposal(chip.text)}
                    className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      used
                        ? 'bg-slate-900 text-slate-500 border border-slate-800 line-through opacity-60 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <span>{chip.label}</span>
                    {used && <span className="text-[9px] font-mono text-amber-400 no-underline">(Already pledged)</span>}
                  </button>
                );
              })}
            </>
          )}
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
              {/(?:[éàèùâêîôûëïç]|directeur|responsable|chef|président|mirage|assurance)/i.test((activeStakeholder?.title || '') + (activeStakeholder?.name || ''))
                ? '⚠️ Répétition détectée : Répéter exactement la même proposition sans nouvel élément sera rejeté et pénalisera la confiance (-6 à -12 pts).'
                : '⚠️ Duplicate proposal detected: Repeating identical pitches without new substance will be rejected and penalize executive trust (-6 to -12 pts).'}
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
            placeholder={
              isBoardroom
                ? 'Présentez votre stratégie globale au Conseil d\'Administration (CFO, CPO, Lead Tech, CISO)...'
                : `Negotiate governance, concessions, or deadlines with ${activeStakeholder.name}...`
            }
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
            <Send className="w-4 h-4" />
            <span>{isBoardroom ? 'Délibérer' : 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
