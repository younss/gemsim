// ============================================================================
// GEMSIM: WORKSHOP TEAM INVITES & ISOLATION HUB
// Team-Scoped Shareable URLs, Role-Based Access Links, and Facilitator Passcode
// ============================================================================

import React, { useState } from 'react';
import { SimulationSession, Team } from '../../types/index';
import {
  Link2,
  Copy,
  Check,
  Shield,
  Users,
  Radio,
  Lock,
  ExternalLink,
  X,
  Share2,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: SimulationSession;
}

export const WorkshopInvitesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen) return null;

  const baseUrl = window.location.origin;
  const facilitatorPasscode = session.facilitatorPasscode || '1337';

  // Generate links
  const facilitatorUrl = `${baseUrl}/?session=${session.id}&role=facilitator`;

  const getTeamUrl = (teamId: string) => {
    return `${baseUrl}/?session=${session.id}&team=${teamId}&role=player`;
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAllInvites = () => {
    const lines = [
      `🎮 GemSim Enterprise Architecture Simulation Workshop`,
      `Session: ${session.name} (4 Quarters)`,
      ``,
      `👑 Facilitator Control Room (Restricted):`,
      `${facilitatorUrl} (Passcode: ${facilitatorPasscode})`,
      ``,
      `👥 Team Arena Direct Links (Confidential & Locked per Squad):`,
      ...session.teams.map(
        t => `• ${t.avatar} ${t.name}: ${getTeamUrl(t.id)}`
      ),
      ``,
      `📌 Note: Joining your team's link locks you into your squad cockpit, prevents modifying other teams' decisions, and hides the facilitator war room.`,
    ].join('\n');

    navigator.clipboard.writeText(lines);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-sans">
      <div className="bg-dark-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="bg-dark-950 border-b border-slate-800 p-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base font-mono flex items-center gap-2">
                <span>Workshop Team Invite Hub</span>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  Role-Isolated
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Share dedicated team links to isolate player decisions and protect facilitator controls.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Isolation Policy Callout */}
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-slate-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-cyan-400 font-mono">
              <Shield className="w-4 h-4" />
              <span>TEAM ISOLATION & ACCESS CONTROL</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When players join via their squad link, their browser is <strong>locked to their assigned team</strong>. The team switcher is disabled, and access to the Facilitator War Room and AI Studio is completely hidden.
            </p>
          </div>

          {/* Player Team Direct Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>CONFIDENTIAL TEAM SQUAD LINKS ({session.teams.length} TEAMS)</span>
              </span>
              <button
                onClick={copyAllInvites}
                className="text-[11px] font-mono px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 transition-all"
              >
                {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedAll ? 'All Links Copied!' : 'Copy All for Slack / Teams'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {session.teams.map((t, idx) => {
                const teamUrl = getTeamUrl(t.id);
                const isCopied = copiedKey === t.id;

                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-dark-850 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl p-1.5 rounded-lg bg-dark-900 border border-slate-800">{t.avatar}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-dark-900 text-slate-400 border border-slate-700">
                            Team {idx + 1}
                          </span>
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono truncate max-w-sm sm:max-w-md">
                          {teamUrl}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => copyToClipboard(teamUrl, t.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                          isCopied
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      <a
                        href={teamUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                        title="Open Team Arena in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Facilitator Master URL & Passcode */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="font-mono font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              <span>FACILITATOR MASTER COCKPIT LINK (RESTRICTED)</span>
            </span>

            <div className="p-3 rounded-xl bg-dark-850 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="font-bold text-slate-100 flex items-center gap-2">
                  <span>Facilitator War Room</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>PIN: {facilitatorPasscode}</span>
                  </span>
                </div>
                <div className="text-[10px] text-rose-400 font-mono truncate max-w-sm sm:max-w-md">
                  {facilitatorUrl}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => copyToClipboard(facilitatorUrl, 'facilitator')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                    copiedKey === 'facilitator'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700'
                  }`}
                >
                  {copiedKey === 'facilitator' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'facilitator' ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-dark-950 border-t border-slate-800 p-4 sm:px-6 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Direct URLs work on LAN, VPN, or public reverse proxies.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
