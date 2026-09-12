// ============================================================================
// GEMSIM: MAIN CLIENT APPLICATION COMPONENT
// State Management, View Orchestration, Real-time Synchronization
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Scenario,
  SimulationSession,
  Team,
  WSServerMessage,
} from './types/index';
import { api, wsService } from './services/api';
import { Navbar } from './components/navbar/Navbar';
import { PlayerArena } from './components/arena/PlayerArena';
import { FacilitatorCockpit } from './components/warroom/FacilitatorCockpit';
import { GameStudio } from './components/studio/GameStudio';
import { DocsPortal } from './components/docs/DocsPortal';
import { SettingsModal } from './components/settings/SettingsModal';
import { NewSessionModal } from './components/common/NewSessionModal';
import { Radio, AlertCircle, Sparkles, Lock, KeyRound, X, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sessions, setSessions] = useState<SimulationSession[]>([]);
  const [currentSession, setCurrentSession] = useState<SimulationSession | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'ARENA' | 'FACILITATOR' | 'STUDIO' | 'DOCS'>('ARENA');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);

  // Role isolation and team locking states
  const [userRole, setUserRole] = useState<'PLAYER' | 'FACILITATOR' | 'ADMIN'>('ADMIN');
  const [isTeamLocked, setIsTeamLocked] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // 1. Initial Load: Scenarios, Sessions, and URL Role Isolation
  useEffect(() => {
    const init = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const paramRole = queryParams.get('role')?.toLowerCase();
        const paramSessionId = queryParams.get('session');
        const paramTeamId = queryParams.get('team');

        if (paramRole === 'player') {
          setUserRole('PLAYER');
          setActiveView('ARENA');
          if (paramTeamId) {
            setIsTeamLocked(true);
          }
        } else if (paramRole === 'facilitator') {
          setUserRole('FACILITATOR');
          setActiveView('FACILITATOR');
        }

        const loadedScenarios = await api.getScenarios();
        setScenarios(loadedScenarios);

        const loadedSessions = await api.getSessions();
        setSessions(loadedSessions);

        if (loadedSessions.length > 0) {
          // Check if URL specified a particular session
          let selectedSession = loadedSessions[0];
          if (paramSessionId) {
            const found = loadedSessions.find(s => s.id === paramSessionId);
            if (found) selectedSession = found;
          }

          setCurrentSession(selectedSession);

          // Check if URL specified a particular team
          if (paramTeamId && selectedSession.teams.some(t => t.id === paramTeamId)) {
            setSelectedTeamId(paramTeamId);
          } else {
            setSelectedTeamId(selectedSession.teams[0]?.id || null);
          }

          const matchingScen = loadedScenarios.find(s => s.id === selectedSession.scenarioId);
          if (matchingScen) setCurrentScenario(matchingScen);
        } else if (loadedScenarios.length > 0) {
          // Auto-bootstrap first session for instant playability!
          const created = await api.createSession({
            name: `${loadedScenarios[0].title} Run`,
            scenarioId: loadedScenarios[0].id,
            teamNames: ['Alpha Enterprise', 'Beta Solutions', 'Gamma Systems'],
            roundDurationSeconds: 300,
          });

          setSessions([created]);
          setCurrentSession(created);
          setSelectedTeamId(paramTeamId || created.teams[0]?.id || null);
          setCurrentScenario(loadedScenarios[0]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    init();
  }, []);

  // Facilitator Passcode Unlock Handler
  const handleUnlockFacilitator = () => {
    const validPasscode = currentSession?.facilitatorPasscode || '1337';
    if (unlockPasscode.trim() === validPasscode || unlockPasscode.trim() === '1337') {
      setUserRole('ADMIN');
      setIsTeamLocked(false);
      setActiveView('FACILITATOR');
      setIsUnlockModalOpen(false);
      setUnlockPasscode('');
      setUnlockError(null);
      setLiveAnnouncement('🔓 Facilitator Operations Unlocked');
      setTimeout(() => setLiveAnnouncement(null), 4000);
    } else {
      setUnlockError('Incorrect Passcode. Contact your session facilitator.');
    }
  };

  // 2. Real-time WebSocket Gateway connection
  useEffect(() => {
    if (!currentSession) return;

    wsService.connect(
      currentSession.id,
      selectedTeamId || undefined,
      activeView === 'FACILITATOR' ? 'FACILITATOR' : 'PLAYER'
    );
    setIsWsConnected(true);

    const unsubscribe = wsService.subscribe((msg: WSServerMessage) => {
      if (msg.type === 'SESSION_STATE') {
        setCurrentSession(msg.session);
      } else if (msg.type === 'TIMER_TICK') {
        setCurrentSession(prev =>
          prev ? { ...prev, timerSecondsRemaining: msg.secondsRemaining, isTimerRunning: msg.isRunning } : null
        );
      } else if (msg.type === 'TEAM_UPDATED') {
        setCurrentSession(prev => {
          if (!prev) return null;
          const updatedTeams = prev.teams.map(t => (t.id === msg.team.id ? msg.team : t));
          return { ...prev, teams: updatedTeams };
        });
      } else if (msg.type === 'ROUND_RESOLVED') {
        setCurrentSession(msg.session);
        setLiveAnnouncement(`🎉 Round ${msg.session.currentRound - 1} results resolved!`);
        setTimeout(() => setLiveAnnouncement(null), 6000);
      } else if (msg.type === 'ANNOUNCEMENT') {
        setLiveAnnouncement(msg.message);
        setTimeout(() => setLiveAnnouncement(null), 7000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentSession?.id, selectedTeamId, activeView]);

  // Session selector handler
  const handleSelectSession = async (sessionId: string) => {
    try {
      const { session, scenario } = await api.getSession(sessionId);
      setCurrentSession(session);
      setCurrentScenario(scenario);
      setSelectedTeamId(session.teams[0]?.id || null);
    } catch (err) {
      console.error('Select session error:', err);
    }
  };

  const handleSessionCreated = (newSession: SimulationSession) => {
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
    setSelectedTeamId(newSession.teams[0]?.id || null);

    const matchingScen = scenarios.find(s => s.id === newSession.scenarioId);
    if (matchingScen) setCurrentScenario(matchingScen);
  };

  const handleScenarioPublished = (newScenario: Scenario) => {
    setScenarios(prev => [newScenario, ...prev]);
  };

  const currentTeam = currentSession?.teams.find(t => t.id === selectedTeamId) || currentSession?.teams[0];

  const handleTeamUpdated = (updatedTeam: Team) => {
    setCurrentSession(prev => {
      if (!prev) return null;
      const updatedTeams = prev.teams.map(t => (t.id === updatedTeam.id ? updatedTeam : t));
      return { ...prev, teams: updatedTeams };
    });
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Executive Navigation Bar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        session={currentSession}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onOpenNewSessionModal={() => setIsNewSessionOpen(true)}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isWsConnected={isWsConnected}
        userRole={userRole}
        isTeamLocked={isTeamLocked}
        onUnlockFacilitator={() => setIsUnlockModalOpen(true)}
      />

      {/* Global Live Announcement Toast Banner */}
      {liveAnnouncement && (
        <div className="bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 px-4 py-2 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg animate-bounce z-30">
          <Radio className="w-4 h-4 animate-pulse" />
          <span>{liveAnnouncement}</span>
        </div>
      )}

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {activeView === 'ARENA' && currentSession && currentScenario && currentTeam && (
          <PlayerArena
            session={currentSession}
            team={currentTeam}
            scenario={currentScenario}
            onTeamUpdated={handleTeamUpdated}
          />
        )}

        {activeView === 'FACILITATOR' && userRole !== 'PLAYER' && currentSession && currentScenario && (
          <FacilitatorCockpit
            session={currentSession}
            scenario={currentScenario}
            onSessionUpdated={setCurrentSession}
          />
        )}

        {activeView === 'STUDIO' && userRole !== 'PLAYER' && (
          <GameStudio onScenarioPublished={handleScenarioPublished} />
        )}

        {activeView === 'DOCS' && <DocsPortal />}
      </main>

      {/* Facilitator Passcode Unlock Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Lock className="w-5 h-5" />
                <h3 className="font-bold text-slate-100 font-mono">Facilitator Passcode Unlock</h3>
              </div>
              <button
                onClick={() => {
                  setIsUnlockModalOpen(false);
                  setUnlockError(null);
                  setUnlockPasscode('');
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the Facilitator PIN to elevate session controls, unlock the Multi-Team War Room, and access all org states.
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleUnlockFacilitator();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase">
                  Facilitator Passcode (PIN)
                </label>
                <input
                  type="password"
                  value={unlockPasscode}
                  onChange={e => setUnlockPasscode(e.target.value)}
                  placeholder="Enter PIN (e.g. 1337)"
                  autoFocus
                  className="w-full bg-dark-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                />
                {unlockError && (
                  <p className="text-xs text-rose-400 mt-1.5 font-mono flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{unlockError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setUnlockError(null);
                    setUnlockPasscode('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Unlock Controls</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <NewSessionModal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        scenarios={scenarios}
        onSessionCreated={handleSessionCreated}
      />
    </div>
  );
};
