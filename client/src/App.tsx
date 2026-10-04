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
import { api, wsService, onFacilitatorPinRequired } from './services/api';
import { useSimulationStore } from './stores/useSimulationStore';
import { useHelpStore } from './stores/useHelpStore';
import { useI18n } from './i18n';
import { useLocalizedScenario } from './i18n/game';
import { GlossaryPanel } from './components/help/GlossaryPanel';
import { DemoPlayer } from './components/help/DemoPlayer';
import { Navbar } from './components/navbar/Navbar';
import { PlayerArena } from './components/arena/PlayerArena';
import { FacilitatorCockpit } from './components/warroom/FacilitatorCockpit';
import { GameStudio } from './components/studio/GameStudio';
import { DocsPortal } from './components/docs/DocsPortal';
import { SettingsModal } from './components/settings/SettingsModal';
import { NewSessionModal } from './components/common/NewSessionModal';
import { Radio, AlertCircle, Sparkles, Lock, KeyRound, X, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const {
    scenarios,
    sessions,
    currentSession,
    currentScenario,
    selectedTeamId,
    isWsConnected,
    liveAnnouncement,
    setScenarios,
    setSessions,
    setCurrentSession,
    setCurrentScenario,
    setSelectedTeamId,
    setWsConnected,
    activateSession,
    selectSession,
    updateTeam,
    addScenario,
    announce,
    applyServerMessage,
  } = useSimulationStore();

  const [activeView, setActiveView] = useState<'ARENA' | 'FACILITATOR' | 'STUDIO' | 'DOCS'>('ARENA');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);

  // Role isolation and team locking states
  const [userRole, setUserRole] = useState<'PLAYER' | 'FACILITATOR' | 'ADMIN'>('ADMIN');
  const [isTeamLocked, setIsTeamLocked] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const { t } = useI18n();
  const shownScenario = useLocalizedScenario(currentScenario);
  const { setGlossaryOpen, setDemoOpen, startTutorial } = useHelpStore();

  // Practice game: a solo session on the current (or first) scenario, with the tutorial
  const handleStartPractice = async () => {
    const scenario = currentScenario ?? scenarios[0];
    if (!scenario) return;
    announce(t('app.practice.creating'), 3000);
    try {
      const session = await api.createSession({
        name: t('app.practice.name', { title: scenario.title }),
        scenarioId: scenario.id,
        teamNames: [t('nav.practice')],
        roundDurationSeconds: 1800,
      });
      setCurrentScenario(scenario);
      activateSession(session);
      setActiveView('ARENA');
      startTutorial();
    } catch (err: any) {
      announce(`⚠️ ${err.message}`, 6000);
    }
  };

  // Facilitator actions rejected by the server (missing or wrong PIN) open the unlock dialog
  useEffect(() => {
    onFacilitatorPinRequired(() => {
      setUnlockError(t('app.unlock.required'));
      setIsUnlockModalOpen(true);
    });
    return () => onFacilitatorPinRequired(null);
  }, []);

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
  const handleUnlockFacilitator = async () => {
    if (!currentSession) return;
    const isValid = await api.verifyFacilitatorPin(currentSession.id, unlockPasscode);
    if (isValid) {
      setUserRole('ADMIN');
      setIsTeamLocked(false);
      setActiveView('FACILITATOR');
      setIsUnlockModalOpen(false);
      setUnlockPasscode('');
      setUnlockError(null);
      announce(t('app.unlock.success'), 4000);
    } else {
      setUnlockError(t('app.unlock.wrong'));
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
    setWsConnected(true);

    const unsubscribe = wsService.subscribe((msg: WSServerMessage) => applyServerMessage(msg));

    return () => {
      unsubscribe();
    };
  }, [currentSession?.id, selectedTeamId, activeView]);

  const handleSessionCreated = (newSession: SimulationSession) => activateSession(newSession);
  const handleScenarioPublished = (newScenario: Scenario) => addScenario(newScenario);

  const currentTeam = currentSession?.teams.find(t => t.id === selectedTeamId) || currentSession?.teams[0];

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Executive Navigation Bar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        session={currentSession}
        sessions={sessions}
        onSelectSession={selectSession}
        onOpenNewSessionModal={() => setIsNewSessionOpen(true)}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isWsConnected={isWsConnected}
        userRole={userRole}
        isTeamLocked={isTeamLocked}
        onUnlockFacilitator={() => setIsUnlockModalOpen(true)}
        onStartTutorial={() => {
          setActiveView('ARENA');
          startTutorial();
        }}
        onOpenGlossary={() => setGlossaryOpen(true)}
        onOpenDemo={() => setDemoOpen(true)}
        onStartPractice={handleStartPractice}
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
            scenario={shownScenario!}
            onTeamUpdated={updateTeam}
          />
        )}

        {activeView === 'FACILITATOR' && userRole !== 'PLAYER' && currentSession && currentScenario && (
          <FacilitatorCockpit
            session={currentSession}
            scenario={shownScenario!}
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
          <div role="dialog" aria-modal="true" aria-labelledby="unlock-title" className="bg-dark-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Lock className="w-5 h-5" />
                <h3 id="unlock-title" className="font-bold text-slate-100 font-mono">{t('app.unlock.title')}</h3>
              </div>
              <button
                aria-label={t('common.close')}
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

            <p className="text-xs text-slate-400 leading-relaxed">{t('app.unlock.body')}</p>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleUnlockFacilitator();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="unlock-pin" className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase">
                  {t('app.unlock.label')}
                </label>
                <input
                  id="unlock-pin"
                  type="password"
                  value={unlockPasscode}
                  onChange={e => setUnlockPasscode(e.target.value)}
                  placeholder={t('app.unlock.placeholder')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t('app.unlock.submit')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help surfaces */}
      <GlossaryPanel />
      <DemoPlayer />

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
