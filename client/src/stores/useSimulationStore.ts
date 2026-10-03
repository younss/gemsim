// ============================================================================
// GEMSIM: GLOBAL SIMULATION STORE (ZUSTAND)
// Scenarios, sessions, the active session/team and real-time WebSocket updates.
// ============================================================================

import { create } from 'zustand';
import { Scenario, SimulationSession, Team, WSServerMessage } from '../types/index';
import { api } from '../services/api';
import { translate, useLangStore } from '../i18n';
import { translateCode } from '../i18n/game';

const tr = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
  translate(useLangStore.getState().lang, key, vars);

interface SimulationState {
  scenarios: Scenario[];
  sessions: SimulationSession[];
  currentSession: SimulationSession | null;
  currentScenario: Scenario | null;
  selectedTeamId: string | null;
  isWsConnected: boolean;
  liveAnnouncement: string | null;
  lastError: string | null;

  setScenarios: (scenarios: Scenario[]) => void;
  addScenario: (scenario: Scenario) => void;
  setSessions: (sessions: SimulationSession[]) => void;
  setCurrentSession: (session: SimulationSession | null) => void;
  setCurrentScenario: (scenario: Scenario | null) => void;
  setSelectedTeamId: (teamId: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  activateSession: (session: SimulationSession, teamId?: string | null) => void;
  selectSession: (sessionId: string) => Promise<void>;
  updateTeam: (team: Team) => void;
  announce: (message: string, durationMs?: number) => void;
  applyServerMessage: (msg: WSServerMessage) => void;
}

let announcementTimer: ReturnType<typeof setTimeout> | null = null;

export const useSimulationStore = create<SimulationState>((set, get) => ({
  scenarios: [],
  sessions: [],
  currentSession: null,
  currentScenario: null,
  selectedTeamId: null,
  isWsConnected: false,
  liveAnnouncement: null,
  lastError: null,

  setScenarios: scenarios => set({ scenarios }),
  addScenario: scenario => set(state => ({ scenarios: [scenario, ...state.scenarios] })),
  setSessions: sessions => set({ sessions }),
  setCurrentSession: session =>
    set(state => ({
      currentSession: session,
      // Keep the session list in sync so selectors show the latest round/state
      sessions: session ? state.sessions.map(s => (s.id === session.id ? session : s)) : state.sessions,
    })),
  setCurrentScenario: scenario => set({ currentScenario: scenario }),
  setSelectedTeamId: teamId => set({ selectedTeamId: teamId }),
  setWsConnected: connected => set({ isWsConnected: connected }),

  activateSession: (session, teamId) => {
    const { sessions, scenarios } = get();
    set({
      currentSession: session,
      sessions: sessions.some(s => s.id === session.id) ? sessions.map(s => (s.id === session.id ? session : s)) : [session, ...sessions],
      selectedTeamId: teamId && session.teams.some(t => t.id === teamId) ? teamId : session.teams[0]?.id || null,
      currentScenario: scenarios.find(s => s.id === session.scenarioId) ?? get().currentScenario,
    });
  },

  selectSession: async sessionId => {
    try {
      const { session, scenario } = await api.getSession(sessionId);
      set({ currentScenario: scenario });
      get().activateSession(session);
    } catch (err: any) {
      set({ lastError: err.message });
    }
  },

  updateTeam: team => {
    const session = get().currentSession;
    if (!session) return;
    get().setCurrentSession({ ...session, teams: session.teams.map(t => (t.id === team.id ? team : t)) });
  },

  announce: (message, durationMs = 6000) => {
    if (announcementTimer) clearTimeout(announcementTimer);
    set({ liveAnnouncement: message });
    announcementTimer = setTimeout(() => set({ liveAnnouncement: null }), durationMs);
  },

  applyServerMessage: msg => {
    const { setCurrentSession, updateTeam, announce, currentSession } = get();
    switch (msg.type) {
      case 'SESSION_STATE':
        setCurrentSession(msg.session);
        break;
      case 'TIMER_TICK':
        if (currentSession) {
          set({ currentSession: { ...currentSession, timerSecondsRemaining: msg.secondsRemaining, isTimerRunning: msg.isRunning } });
        }
        break;
      case 'TEAM_UPDATED':
        updateTeam(msg.team);
        break;
      case 'ROUND_RESOLVED':
        setCurrentSession(msg.session);
        announce(
          msg.session.state === 'COMPLETED'
            ? tr('app.announce.finalResolved')
            : tr('app.announce.roundResolved', { n: msg.session.currentRound - 1 })
        );
        break;
      case 'SESSION_RESET':
        setCurrentSession(msg.session);
        announce(tr('app.announce.reset'));
        break;
      case 'CRISIS_INJECTED':
        setCurrentSession(msg.session);
        announce(tr('app.announce.crisis', { title: msg.event.title }), 8000);
        break;
      case 'ANNOUNCEMENT':
        // Server announcements carry a translatable code; the raw text is the fallback
        announce(msg.code ? translateCode(useLangStore.getState().lang, msg.code) : msg.message, 7000);
        break;
      case 'ERROR':
        set({ lastError: msg.message });
        announce(`⚠️ ${msg.message}`, 7000);
        break;
    }
  },
}));
