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
import { Radio, AlertCircle, Sparkles } from 'lucide-react';

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

  // 1. Initial Load: Scenarios and Sessions
  useEffect(() => {
    const init = async () => {
      try {
        const loadedScenarios = await api.getScenarios();
        setScenarios(loadedScenarios);

        const loadedSessions = await api.getSessions();
        setSessions(loadedSessions);

        if (loadedSessions.length > 0) {
          const first = loadedSessions[0];
          setCurrentSession(first);
          setSelectedTeamId(first.teams[0]?.id || null);

          const matchingScen = loadedScenarios.find(s => s.id === first.scenarioId);
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
          setSelectedTeamId(created.teams[0]?.id || null);
          setCurrentScenario(loadedScenarios[0]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    init();
  }, []);

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

        {activeView === 'FACILITATOR' && currentSession && currentScenario && (
          <FacilitatorCockpit
            session={currentSession}
            scenario={currentScenario}
            onSessionUpdated={setCurrentSession}
          />
        )}

        {activeView === 'STUDIO' && (
          <GameStudio onScenarioPublished={handleScenarioPublished} />
        )}

        {activeView === 'DOCS' && <DocsPortal />}
      </main>

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
