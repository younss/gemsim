// ============================================================================
// GEMSIM: WORKSHOP TEAM INVITES
// Team-scoped links (players are locked to their team) and the facilitator link.
// The facilitator PIN is never included: share it separately, by another channel.
// ============================================================================

import { useDialogFocus } from '../common/useDialogFocus';
import React, { useState } from 'react';
import { SimulationSession } from '../../types/index';
import { Copy, Check, Shield, Users, Radio, Lock, ExternalLink, X, Share2 } from 'lucide-react';
import { useI18n } from '../../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: SimulationSession;
}

export const WorkshopInvitesModal: React.FC<Props> = ({ isOpen, onClose, session }) => {
  const { t } = useI18n();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const baseUrl = window.location.origin;
  const facilitatorUrl = `${baseUrl}/?session=${session.id}&role=facilitator`;
  const getTeamUrl = (teamId: string) => `${baseUrl}/?session=${session.id}&team=${teamId}&role=player`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Message for the players' channel: team links only, never the facilitator link or PIN
  const copyAllInvites = () => {
    const lines = [
      `🎮 ${t('invites.message.title')}`,
      t('invites.message.session', { name: session.name, n: session.totalRounds }),
      '',
      `👥 ${t('invites.message.links')}`,
      ...session.teams.map(team => `• ${team.avatar} ${team.name} : ${getTeamUrl(team.id)}`),
      '',
      `📌 ${t('invites.message.note')}`,
    ].join('\n');
    navigator.clipboard.writeText(lines);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invites-title"
        className="bg-dark-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-dark-950 border-b border-slate-800 p-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Share2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="invites-title" className="font-bold text-slate-100 text-base font-mono">
                {t('invites.title')}
              </h3>
              <p className="text-xs text-slate-400">{t('invites.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-white border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-slate-300 space-y-1">
            <div className="flex items-center gap-2 font-bold text-cyan-400 font-mono">
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>{t('invites.isolation.title')}</span>
            </div>
            <p className="text-[11px] leading-relaxed">{t('invites.isolation.body')}</p>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-mono font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                {t('invites.teams', { n: session.teams.length })}
              </h4>
              <button
                onClick={copyAllInvites}
                className="text-[11px] font-mono px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5"
              >
                {copiedAll ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                <span>{copiedAll ? t('invites.copiedAll') : t('invites.copyAll')}</span>
              </button>
            </div>

            <ul className="space-y-2">
              {session.teams.map((team, idx) => {
                const teamUrl = getTeamUrl(team.id);
                const isCopied = copiedKey === team.id;
                return (
                  <li
                    key={team.id}
                    className="p-3 rounded-xl bg-dark-850 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl p-1.5 rounded-lg bg-dark-900 border border-slate-800" aria-hidden="true">
                        {team.avatar}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 flex items-center gap-2">
                          <span>{team.name}</span>
                          <span className="text-[10px] font-mono px-1.5 rounded bg-dark-900 text-slate-400 border border-slate-700">
                            {t('cockpit.team', { n: idx + 1 })}
                          </span>
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono truncate max-w-sm sm:max-w-md">{teamUrl}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => copyToClipboard(teamUrl, team.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                          isCopied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{isCopied ? t('studio.copied') : t('invites.copyLink')}</span>
                      </button>
                      <a
                        href={teamUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white border border-slate-700"
                        title={t('invites.open')}
                        aria-label={t('invites.open')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="font-mono font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              {t('invites.facilitator.title')}
            </h4>
            <div className="p-3 rounded-xl bg-dark-850 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="font-bold text-slate-100 flex items-center gap-2">
                  <span>{t('nav.facilitator')}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>{t('invites.facilitator.pin')}</span>
                  </span>
                </div>
                <div className="text-[10px] text-rose-400 font-mono truncate max-w-sm sm:max-w-md">{facilitatorUrl}</div>
              </div>
              <button
                onClick={() => copyToClipboard(facilitatorUrl, 'facilitator')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 shrink-0 self-end sm:self-center ${
                  copiedKey === 'facilitator' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700'
                }`}
              >
                {copiedKey === 'facilitator' ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{copiedKey === 'facilitator' ? t('studio.copied') : t('invites.copyLink')}</span>
              </button>
            </div>
          </section>
        </div>

        <div className="bg-dark-950 border-t border-slate-800 p-4 sm:px-6 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 font-mono">{t('invites.footer')}</span>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-slate-700 text-xs font-mono font-bold">
            {t('common.finish')}
          </button>
        </div>
      </div>
    </div>
  );
};
