// ============================================================================
// GEMSIM: MAIN EXECUTIVE NAVIGATION BAR
// Session Switcher, Live Timer HUD, Role Toggle, and Real-Time Gateway Indicator
// ============================================================================

import React from 'react';
import {
  SimulationSession,
  Team,
  Scenario,
} from '../../types/index';
import {
  Compass,
  Radio,
  Wand2,
  BookOpen,
  Settings,
  Plus,
  Play,
  Pause,
  Clock,
  Wifi,
  WifiOff,
  Users,
  Lock,
  Shield,
  KeyRound,
  HelpCircle,
  GraduationCap,
  PlayCircle,
  Dumbbell,
  Languages,
} from 'lucide-react';
import { useI18n } from '../../i18n';

interface Props {
  activeView: 'ARENA' | 'FACILITATOR' | 'STUDIO' | 'DOCS';
  setActiveView: (view: 'ARENA' | 'FACILITATOR' | 'STUDIO' | 'DOCS') => void;
  session: SimulationSession | null;
  sessions: SimulationSession[];
  onSelectSession: (sessionId: string) => void;
  onOpenNewSessionModal: () => void;
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onOpenSettings: () => void;
  isWsConnected: boolean;
  userRole?: 'PLAYER' | 'FACILITATOR' | 'ADMIN';
  isTeamLocked?: boolean;
  onUnlockFacilitator?: () => void;
  onStartTutorial?: () => void;
  onOpenGlossary?: () => void;
  onOpenDemo?: () => void;
  onStartPractice?: () => void;
}

export const Navbar: React.FC<Props> = ({
  activeView,
  setActiveView,
  session,
  sessions,
  onSelectSession,
  onOpenNewSessionModal,
  selectedTeamId,
  onSelectTeam,
  onOpenSettings,
  isWsConnected,
  userRole = 'ADMIN',
  isTeamLocked = false,
  onUnlockFacilitator,
  onStartTutorial,
  onOpenGlossary,
  onOpenDemo,
  onStartPractice,
}) => {
  const { t, lang, setLang } = useI18n();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const helpItems = [
    { label: t('nav.tutorial'), icon: GraduationCap, action: onStartTutorial },
    { label: t('nav.glossary'), icon: BookOpen, action: onOpenGlossary },
    { label: t('nav.demo'), icon: PlayCircle, action: onOpenDemo },
    { label: t('nav.practice'), icon: Dumbbell, action: onStartPractice },
  ].filter(item => item.action);
  // Format MM:SS for countdown timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeTeam = session?.teams.find(t => t.id === selectedTeamId) || session?.teams[0];
  const isPlayerMode = userRole === 'PLAYER';

  return (
    <header className="w-full bg-dark-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Active Session Info */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,240,255,0.4)] ring-1 ring-white/20">
              💎
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-100 tracking-wider text-base font-mono">GEMSIM</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  {isPlayerMode ? t('nav.squad') : 'SaaS v1.0'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                {isPlayerMode ? t('nav.tagline.player') : t('nav.tagline.admin')}
              </p>
            </div>
          </div>

          {/* Session Switcher Dropdown (or Locked Badge in Player Mode) */}
          {isPlayerMode ? (
            <div className="flex items-center gap-1.5 bg-dark-900 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-slate-500 text-[10px]">{t('nav.session')}</span>
              <span className="text-slate-200 text-xs font-bold max-w-[140px] truncate">
                {session?.name || 'Simulation'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-dark-900 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-slate-500 text-[10px]">{t('nav.session')}</span>
              {sessions.length > 0 ? (
                <select
                  aria-label={t('nav.session')}
                  value={session?.id || ''}
                  onChange={e => onSelectSession(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-bold focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id} className="bg-dark-900 text-slate-100">
                      {s.name} (Q{s.currentRound})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-400 text-xs">{t('nav.noSessions')}</span>
              )}
              <button
                onClick={onOpenNewSessionModal}
                className="p-1 rounded hover:bg-slate-800 text-cyan-400"
                title={t('nav.newSession')}
                aria-label={t('nav.newSession')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation View Tabs */}
        <nav aria-label="GemSim" className="flex items-center gap-1 bg-dark-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveView('ARENA')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeView === 'ARENA'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t('nav.arena')}</span>
          </button>

          {!isPlayerMode && (
            <>
              <button
                onClick={() => setActiveView('FACILITATOR')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  activeView === 'FACILITATOR'
                    ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>{t('nav.facilitator')}</span>
              </button>

              <button
                onClick={() => setActiveView('STUDIO')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  activeView === 'STUDIO'
                    ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{t('nav.studio')}</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveView('DOCS')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeView === 'DOCS'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('nav.docs')}</span>
          </button>
        </nav>

        {/* Live Round Telemetry, Team Selector & Settings */}
        <div className="flex items-center gap-3">
          {session && (
            <>
              {/* Active Team Switcher (Player View) */}
              {activeView === 'ARENA' && session.teams.length > 0 && (
                isPlayerMode || isTeamLocked ? (
                  <div className="flex items-center gap-1.5 bg-indigo-950/40 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 text-xs font-mono">
                    <Lock className="w-3 h-3 text-indigo-400" />
                    <span className="text-slate-500 text-[10px]">{t('nav.team')}</span>
                    <span className="font-bold text-indigo-300 max-w-[120px] truncate">
                      {activeTeam?.name || 'Squad'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-dark-900 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <span className="text-slate-500 text-[10px]">{t('nav.team')}</span>
                    <select
                      aria-label={t('nav.team')}
                      value={activeTeam?.id || ''}
                      onChange={e => onSelectTeam(e.target.value)}
                      className="bg-transparent text-cyan-400 font-bold focus:outline-none cursor-pointer text-xs"
                    >
                      {session.teams.map(t => (
                        <option key={t.id} value={t.id} className="bg-dark-900 text-slate-100">
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {/* Round & Countdown Timer Badge */}
              <div className="flex items-center gap-2 bg-dark-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs">
                <span className="text-slate-400 font-bold">
                  {t('common.quarterShort', { n: session.currentRound })}
                </span>
                <span className="text-slate-600">|</span>
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${session.isTimerRunning ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className={`font-bold ${session.isTimerRunning ? 'text-cyan-300' : 'text-slate-400'}`}>
                    {formatTimer(session.timerSecondsRemaining)}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* WebSocket Live Indicator */}
          <div
            className="flex items-center gap-1 text-[10px] font-mono text-slate-400"
            title={isWsConnected ? t('nav.ws.connected') : t('nav.ws.connecting')}
            role="status"
            aria-label={isWsConnected ? t('nav.ws.connected') : t('nav.ws.connecting')}
          >
            {isWsConnected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            className="px-2 py-1.5 rounded-xl bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-cyan-400 border border-slate-800 text-[11px] font-mono font-bold flex items-center gap-1"
            title={t('nav.switchLang')}
            aria-label={t('nav.switchLang')}
          >
            <Languages className="w-3.5 h-3.5" aria-hidden="true" />
            {lang.toUpperCase()}
          </button>

          {/* Help menu: tutorial, glossary, demo, practice */}
          {helpItems.length > 0 && (
            <div className="relative" onKeyDown={e => e.key === 'Escape' && setHelpOpen(false)}>
              <button
                onClick={() => setHelpOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={helpOpen}
                aria-label={t('nav.help')}
                title={t('nav.help')}
                data-tour="help"
                className="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-cyan-400 border border-slate-800"
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
              </button>
              {helpOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 bg-dark-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50">
                  {helpItems.map(item => (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={() => {
                        setHelpOpen(false);
                        item.action?.();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <item.icon className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings or Facilitator Unlock Trigger */}
          {isPlayerMode ? (
            onUnlockFacilitator && (
              <button
                onClick={onUnlockFacilitator}
                className="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition-colors shadow-sm"
                title={t('nav.unlock')}
                aria-label={t('nav.unlock')}
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )
          ) : (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors shadow-sm"
              title={t('nav.settings')}
              aria-label={t('nav.settings')}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
