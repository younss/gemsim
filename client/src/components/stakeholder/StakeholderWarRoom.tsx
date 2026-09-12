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
  const [activeStakeholderId, setActiveStakeholderId] = useState<string>(stakeholders[0]?.id || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<ProposalEvaluation | null>(null);
  const [aiProviderBadge, setAiProviderBadge] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activeStakeholder = stakeholders.find(s => s.id === activeStakeholderId) || stakeholders[0];
  const currentTrust = activeStakeholder
    ? team.stakeholderTrustMap[activeStakeholder.id] ?? activeStakeholder.baseTrust ?? 60
    : 60;

  // Load chat history when active stakeholder changes
  useEffect(() => {
    if (!activeStakeholder) return;
    api.getChatHistory(session.id, team.id, activeStakeholder.id).then(history => {
      if (history.length === 0 && activeStakeholder.sampleDialogue) {
        // Seed initial greeting message
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
  }, [activeStakeholderId, session.id, team.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isEvaluating]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeStakeholder || isEvaluating) return;

    const userText = inputText.trim();
    setInputText('');

    // Optimistically add user message
    const tempPlayerMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: 'PLAYER',
      senderName: team.name,
      content: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempPlayerMsg]);
    setIsEvaluating(true);

    try {
      const res = await api.negotiateStakeholder({
        sessionId: session.id,
        teamId: team.id,
        stakeholderId: activeStakeholder.id,
        playerMessage: userText,
      });

      setMessages(prev => [...prev, res.reply]);
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
    } catch (err: any) {
      console.error('Negotiation error:', err);
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
            <span>Executive Stakeholders</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">Q{session.currentRound} Political Arena</span>
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
        {/* Header with Stakeholder Briefing */}
        <div className="p-4 border-b border-slate-800 bg-dark-900/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
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

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block font-mono">CURRENT TRUST</span>
              <span className={`text-sm font-mono font-bold ${currentTrust > 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {currentTrust}/100
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
                      : 'bg-dark-800 text-slate-100 border border-slate-700/80 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* If Stakeholder evaluation attached */}
                  {msg.evaluation && (
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
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono p-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>{activeStakeholder.name} is evaluating your proposal against executive metrics...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Strategic Proposal Chips */}
        <div className="px-4 py-2 bg-dark-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 text-[11px] font-mono shrink-0">Quick Pacts:</span>
          <button
            onClick={() => handleQuickProposal(`I commit to reducing ongoing legacy maintenance OpEx by 15% within two quarters in exchange for your capital sign-off.`)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] whitespace-nowrap"
          >
            💰 OpEx Cut Commitment
          </button>
          <button
            onClick={() => handleQuickProposal(`We will fast-track high-priority user features concurrently using anti-corruption layers without violating architecture standards.`)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] whitespace-nowrap"
          >
            🚀 Parallel Feature Fast-Track
          </button>
          <button
            onClick={() => handleQuickProposal(`We are implementing automated compliance audit logging and zero-trust mTLS to eliminate all regulatory exposure.`)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] whitespace-nowrap"
          >
            ⚖️ Zero-Trust Compliance Guarantee
          </button>
        </div>

        {/* Message Input Box */}
        <div className="p-4 bg-dark-900 border-t border-slate-800 flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Negotiate governance, concessions, or deadlines with ${activeStakeholder.name}...`}
            className="flex-1 bg-dark-800 text-slate-100 text-sm px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
            disabled={isEvaluating}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isEvaluating}
            className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
