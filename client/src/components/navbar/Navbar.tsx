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
} from 'lucide-react';

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
}) => {
  // Format MM:SS for countdown timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeTeam = session?.teams.find(t => t.id === selectedTeamId) || session?.teams[0];

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
                  SaaS v1.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">Enterprise Strategy & 3D Topology Sim</p>
            </div>
          </div>

          {/* Session Switcher Dropdown */}
          <div className="flex items-center gap-1.5 bg-dark-900 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-500 text-[10px]">SESSION:</span>
            {sessions.length > 0 ? (
              <select
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
              <span className="text-slate-400 text-xs">No Sessions</span>
            )}
            <button
              onClick={onOpenNewSessionModal}
              className="p-1 rounded hover:bg-slate-800 text-cyan-400"
              title="Create New Simulation Session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Navigation View Tabs */}
        <nav className="flex items-center gap-1 bg-dark-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveView('ARENA')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeView === 'ARENA'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Player Arena</span>
          </button>

          <button
            onClick={() => setActiveView('FACILITATOR')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeView === 'FACILITATOR'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Facilitator War Room</span>
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
            <span>AI Studio</span>
          </button>

          <button
            onClick={() => setActiveView('DOCS')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeView === 'DOCS'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Docs</span>
          </button>
        </nav>

        {/* Live Round Telemetry, Team Selector & Settings */}
        <div className="flex items-center gap-3">
          {session && (
            <>
              {/* Active Team Switcher (Player View) */}
              {activeView === 'ARENA' && session.teams.length > 0 && (
                <div className="flex items-center gap-1.5 bg-dark-900 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                  <span className="text-slate-500 text-[10px]">TEAM:</span>
                  <select
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
              )}

              {/* Round & Countdown Timer Badge */}
              <div className="flex items-center gap-2 bg-dark-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs">
                <span className="text-slate-400 font-bold">
                  Q{session.currentRound}
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
            title={isWsConnected ? 'Connected to WebSocket Telemetry Gateway' : 'Connecting to WebSocket Gateway...'}
          >
            {isWsConnected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors shadow-sm"
            title="Configure Pluggable AI Engine & Podman Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
