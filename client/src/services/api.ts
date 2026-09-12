// ============================================================================
// GEMSIM: FRONTEND API CLIENT & WEBSOCKET SERVICE
// ============================================================================

import {
  Scenario,
  SimulationSession,
  Team,
  TeamDecision,
  AISettingsState,
  ChatMessage,
  ProposalEvaluation,
  AIProviderType,
  RoundEvent,
  ArchivedSimulationRun,
  WSServerMessage,
  WSClientMessage,
} from '../types/index';

const API_BASE = '/api';

export const api = {
  // Scenarios
  async getScenarios(): Promise<Scenario[]> {
    const res = await fetch(`${API_BASE}/scenarios`);
    const data = await res.json();
    return data.scenarios;
  },

  async getScenario(id: string): Promise<Scenario> {
    const res = await fetch(`${API_BASE}/scenarios/${id}`);
    const data = await res.json();
    return data.scenario;
  },

  async createScenario(scenario: Scenario): Promise<Scenario> {
    const res = await fetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    const data = await res.json();
    return data.scenario;
  },

  async deleteScenario(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/scenarios/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // Sessions
  async getSessions(): Promise<SimulationSession[]> {
    const res = await fetch(`${API_BASE}/sessions`);
    const data = await res.json();
    return data.sessions;
  },

  async getSession(id: string): Promise<{ session: SimulationSession; scenario: Scenario }> {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    const data = await res.json();
    return data;
  },

  async createSession(payload: {
    name: string;
    scenarioId: string;
    teamNames?: string[];
    roundDurationSeconds?: number;
  }): Promise<SimulationSession> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.session;
  },

  async submitDecisions(sessionId: string, teamId: string, decisions: TeamDecision): Promise<Team> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, decisions }),
    });
    const data = await res.json();
    return data.team;
  },

  async advanceRound(sessionId: string): Promise<{ session: SimulationSession; results: any }> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async updateTimer(sessionId: string, payload: { isRunning?: boolean; secondsRemaining?: number }): Promise<SimulationSession> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.session;
  },

  async injectEvent(sessionId: string, event: RoundEvent): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/inject-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    });
    return res.json();
  },

  async broadcastAnnouncement(sessionId: string, message: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  async resetSession(sessionId: string): Promise<{ session: SimulationSession; archivedRun?: ArchivedSimulationRun }> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async getSessionRuns(sessionId: string): Promise<ArchivedSimulationRun[]> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/runs`);
    const data = await res.json();
    return data.runs || [];
  },

  // Game Studio
  async generateStudioScenario(prompt: {
    industry: string;
    businessChallenge: string;
    difficulty?: string;
    customDirectives?: string;
  }): Promise<Scenario> {
    const res = await fetch(`${API_BASE}/studio/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Generation failed');
    }
    const data = await res.json();
    return data.scenario;
  },

  async validateScenario(scenario: Partial<Scenario>): Promise<{ valid: boolean; errors?: string[]; message?: string }> {
    const res = await fetch(`${API_BASE}/studio/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    return res.json();
  },

  async publishScenario(scenario: Scenario): Promise<Scenario> {
    const res = await fetch(`${API_BASE}/studio/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    const data = await res.json();
    return data.scenario;
  },

  // AI & Stakeholders
  async getAISettings(): Promise<AISettingsState> {
    const res = await fetch(`${API_BASE}/ai/settings`);
    return res.json();
  },

  async updateAISettings(payload: {
    activeProvider?: AIProviderType;
    updates?: Array<{ type: AIProviderType; config: any }>;
  }): Promise<AISettingsState> {
    const res = await fetch(`${API_BASE}/ai/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async testAIProvider(provider: AIProviderType): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const res = await fetch(`${API_BASE}/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    return res.json();
  },

  async negotiateStakeholder(payload: {
    sessionId: string;
    teamId: string;
    stakeholderId: string;
    playerMessage: string;
  }): Promise<{ reply: ChatMessage; evaluation: ProposalEvaluation; updatedTrust: number; usedProvider: string }> {
    const res = await fetch(`${API_BASE}/ai/negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Negotiation failed');
    }
    return res.json();
  },

  async getChatHistory(sessionId: string, teamId: string, stakeholderId?: string): Promise<ChatMessage[]> {
    let url = `${API_BASE}/ai/chat/${sessionId}/${teamId}`;
    if (stakeholderId) url += `?stakeholderId=${stakeholderId}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.messages;
  },

  // Docs
  async getDocs(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/docs`);
    const data = await res.json();
    return data.docs;
  },
};

// WebSocket Service
export class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Array<(msg: WSServerMessage) => void> = [];
  private reconnectTimer: any = null;
  private sessionId: string | null = null;
  private teamId: string | null = null;
  private role: 'PLAYER' | 'FACILITATOR' = 'PLAYER';

  public connect(sessionId: string, teamId?: string, role: 'PLAYER' | 'FACILITATOR' = 'PLAYER') {
    this.sessionId = sessionId;
    this.teamId = teamId || null;
    this.role = role;

    if (this.socket) {
      this.socket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WebSocket] Connected to GemSim real-time gateway');
        this.send({
          type: 'JOIN_SESSION',
          sessionId,
          teamId: this.teamId || undefined,
          role: this.role,
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSServerMessage;
          for (const listener of this.listeners) {
            listener(msg);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse incoming message:', err);
        }
      };

      this.socket.onclose = () => {
        console.log('[WebSocket] Disconnected. Attempting reconnect in 3s...');
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error('[WebSocket] Socket error:', err);
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  public subscribe(callback: (msg: WSServerMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public send(message: WSClientMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId, this.teamId || undefined, this.role);
      }
    }, 3000);
  }
}

export const wsService = new WebSocketService();
