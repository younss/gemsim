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
import type { WhatIfResult } from '../../../server/src/engine/whatif';
import type { PipelineReport } from '../../../server/src/studio/report';

export type { WhatIfResult, PipelineReport };

const API_BASE = '/api';

export interface ScenarioBalanceSummary {
  playable: boolean;
  issues: string[];
  bestAchievable?: { verdict: string; grade: string; score: number };
  strategies?: Record<string, { verdict: string; grade: string; score: number }>;
  tournament?: Record<string, { verdict: string; grade: string; score: number }>; // bots in one shared market
}

// Facilitator PIN, kept for the browser session once verified and sent with every request
const PIN_STORAGE_KEY = 'gemsim_facilitator_pin';
let facilitatorPinRequiredHandler: (() => void) | null = null;

function readStoredPin(): string | null {
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setFacilitatorPin(pin: string | null) {
  try {
    if (pin) sessionStorage.setItem(PIN_STORAGE_KEY, pin);
    else sessionStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    // storage unavailable: the PIN will be asked again
  }
}

export function hasFacilitatorPin(): boolean {
  return Boolean(readStoredPin());
}

/** Called when the server rejects a facilitator action, e.g. to open the unlock dialog. */
export function onFacilitatorPinRequired(handler: (() => void) | null) {
  facilitatorPinRequiredHandler = handler;
}

// The player's team: the server shows it its own pending decisions and hides the others'
let viewerTeamId: string | null = null;

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const pin = readStoredPin();
  if (pin) headers.set('x-facilitator-pin', pin);
  if (viewerTeamId) headers.set('x-gemsim-team', viewerTeamId);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && !input.includes('/verify-facilitator')) {
    setFacilitatorPin(null);
    facilitatorPinRequiredHandler?.();
    throw new Error('Facilitator PIN required for this action.');
  }
  return res;
}

export const api = {
  // Scenarios
  async getScenarios(): Promise<Scenario[]> {
    const res = await apiFetch(`${API_BASE}/scenarios`);
    const data = await res.json();
    return data.scenarios;
  },

  async getScenario(id: string): Promise<Scenario> {
    const res = await apiFetch(`${API_BASE}/scenarios/${id}`);
    const data = await res.json();
    return data.scenario;
  },

  async createScenario(scenario: Scenario): Promise<Scenario> {
    const res = await apiFetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    const data = await res.json();
    return data.scenario;
  },

  async deleteScenario(id: string): Promise<boolean> {
    const res = await apiFetch(`${API_BASE}/scenarios/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },

  // Sessions
  async getSessions(): Promise<SimulationSession[]> {
    const res = await apiFetch(`${API_BASE}/sessions`);
    const data = await res.json();
    return data.sessions;
  },

  async getSession(id: string): Promise<{ session: SimulationSession; scenario: Scenario }> {
    const res = await apiFetch(`${API_BASE}/sessions/${id}`);
    const data = await res.json();
    return data;
  },

  async createSession(payload: {
    name: string;
    scenarioId: string;
    teamNames?: string[];
    roundDurationSeconds?: number;
  }): Promise<SimulationSession> {
    const res = await apiFetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.session;
  },

  async submitDecisions(sessionId: string, teamId: string, decisions: TeamDecision): Promise<Team> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, decisions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Decision submission rejected');
    return data.team;
  },

  async advanceRound(sessionId: string): Promise<{ session: SimulationSession; results: any }> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Round resolution failed');
    return data;
  },

  async signPact(
    sessionId: string,
    payload: { teamId: string; stakeholderId: string; concession: string; committedBudget: number }
  ): Promise<Team> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/pacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Pact rejected');
    return data.team;
  },

  async withdrawPact(sessionId: string, teamId: string, stakeholderId: string): Promise<Team> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/pacts/${teamId}/${stakeholderId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not withdraw pact');
    return data.team;
  },

  async updateTimer(sessionId: string, payload: { isRunning?: boolean; secondsRemaining?: number }): Promise<SimulationSession> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.session;
  },

  async injectEvent(sessionId: string, event: RoundEvent): Promise<any> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/inject-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    });
    return res.json();
  },

  async broadcastAnnouncement(sessionId: string, message: string): Promise<any> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  async resetSession(sessionId: string): Promise<{ session: SimulationSession; archivedRun?: ArchivedSimulationRun }> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async getSessionRuns(sessionId: string): Promise<ArchivedSimulationRun[]> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/runs`);
    const data = await res.json();
    return data.runs || [];
  },

  async verifyFacilitatorPin(sessionId: string, pin: string): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/verify-facilitator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.valid === true) {
        setFacilitatorPin(pin);
        wsService.rejoin();
      }
      return data.valid === true;
    } catch {
      return false;
    }
  },

  // Game Studio
  async generateStudioScenarioStream(
    prompt: { industry: string; businessChallenge: string; difficulty?: string; customDirectives?: string; domain?: string; withMarket?: boolean },
    onChunk: (text: string) => void,
    onStage?: (stage: string, detail?: string) => void
  ): Promise<{ scenario: Scenario; balance?: ScenarioBalanceSummary; pipeline?: PipelineReport }> {
    const res = await apiFetch(`${API_BASE}/studio/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Scenario generation failed');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        if (!event.startsWith('data: ')) continue;
        const data = JSON.parse(event.slice(6));
        if (data.type === 'chunk') onChunk(data.text);
        else if (data.type === 'stage') onStage?.(data.stage, data.detail);
        else if (data.type === 'done') return { scenario: data.scenario, balance: data.balance, pipeline: data.pipeline };
        else if (data.type === 'error') throw new Error(data.error);
      }
    }
    throw new Error('Generation stream ended before the scenario was received');
  },

  // Studio translation pass (SSE): progress per chunk, then the scenario with its stored translation
  async translateScenario(id: string, lang: 'fr' | 'en', onProgress: (done: number, total: number) => void): Promise<Scenario> {
    const res = await apiFetch(`${API_BASE}/studio/translate/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Translation failed');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        if (!event.startsWith('data: ')) continue;
        const data = JSON.parse(event.slice(6));
        if (data.type === 'progress') onProgress(data.done, data.total);
        else if (data.type === 'done') return data.scenario;
        else if (data.type === 'error') throw Object.assign(new Error(data.error), { code: data.code });
      }
    }
    throw new Error('Translation stream ended before the scenario was received');
  },

  async generateStudioScenario(prompt: {
    industry: string;
    businessChallenge: string;
    difficulty?: string;
    customDirectives?: string;
  }): Promise<Scenario> {
    const res = await apiFetch(`${API_BASE}/studio/generate`, {
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

  async validateScenario(
    scenario: Partial<Scenario>
  ): Promise<{ valid: boolean; errors?: string[]; message?: string; balance?: ScenarioBalanceSummary }> {
    const res = await apiFetch(`${API_BASE}/studio/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    return res.json();
  },

  async publishScenario(scenario: Scenario): Promise<Scenario> {
    const res = await apiFetch(`${API_BASE}/studio/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    const data = await res.json();
    return data.scenario;
  },

  // AI & Stakeholders
  async getAISettings(): Promise<AISettingsState> {
    const res = await apiFetch(`${API_BASE}/ai/settings`);
    return res.json();
  },

  async updateAISettings(payload: {
    activeProvider?: AIProviderType;
    updates?: Array<{ type: AIProviderType; config: any }>;
  }): Promise<AISettingsState> {
    const res = await apiFetch(`${API_BASE}/ai/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async testAIProvider(provider: AIProviderType): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const res = await apiFetch(`${API_BASE}/ai/test`, {
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
    const res = await apiFetch(`${API_BASE}/ai/negotiate`, {
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

  async negotiateStakeholderStream(
    payload: {
      sessionId: string;
      teamId: string;
      stakeholderId: string;
      playerMessage: string;
    },
    onChunk: (chunk: string) => void
  ): Promise<{ reply: ChatMessage; evaluation: ProposalEvaluation; updatedTrust: number; usedProvider: string }> {
    const res = await apiFetch(`${API_BASE}/ai/negotiate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream request failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let finalResult: { reply: ChatMessage; evaluation: ProposalEvaluation; updatedTrust: number; usedProvider: string } | null = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'chunk' && data.text) {
              onChunk(data.text);
            } else if (data.type === 'done') {
              finalResult = {
                reply: data.reply,
                evaluation: data.evaluation,
                updatedTrust: data.updatedTrust,
                usedProvider: data.usedProvider,
              };
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Streaming error');
            }
          } catch (e: any) {
            if (e.message && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }
    }

    if (!finalResult) {
      throw new Error('Stream terminated before receiving done payload');
    }

    return finalResult;
  },

  async callBoardroomMeeting(payload: {
    sessionId: string;
    teamId: string;
    playerMessage: string;
  }): Promise<{
    replies: ChatMessage[];
    boardResolution: any;
    updatedTrustMap: Record<string, number>;
    averageTrust: number;
    usedProvider: string;
  }> {
    const res = await apiFetch(`${API_BASE}/ai/boardroom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Boardroom meeting failed');
    }
    return res.json();
  },

  async getChatHistory(sessionId: string, teamId: string, stakeholderId?: string): Promise<ChatMessage[]> {
    let url = `${API_BASE}/ai/chat/${sessionId}/${teamId}`;
    if (stakeholderId) url += `?stakeholderId=${stakeholderId}`;
    const res = await apiFetch(url);
    const data = await res.json();
    return data.messages;
  },

  // Docs
  // A restricted document (teaching note): needs the facilitator PIN
  async getDoc(id: string, lang: string = 'fr'): Promise<any> {
    const res = await apiFetch(`${API_BASE}/docs/${encodeURIComponent(id)}?lang=${encodeURIComponent(lang)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Document unavailable');
    return data.doc;
  },

  async getDocs(lang: string = 'fr'): Promise<any[]> {
    const res = await apiFetch(`${API_BASE}/docs?lang=${encodeURIComponent(lang)}`);
    const data = await res.json();
    return data.docs;
  },

  // Pilot questionnaires: the facilitator opens or closes a phase; players answer anonymously
  async setPilotPhase(sessionId: string, phase: 'PRE' | 'POST', open: boolean): Promise<SimulationSession> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/pilot/phase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, open }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Pilot update failed');
    return data.session;
  },

  async submitPilotResponse(
    sessionId: string,
    payload: { teamId: string; phase: 'PRE' | 'POST'; respondentId: string; answers: number[]; satisfaction?: number[]; hindrance?: string; lesson?: string }
  ): Promise<void> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/pilot/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw Object.assign(new Error(data.error || 'Answer not saved'), { code: data.code });
    }
  },

  // "What if": replays the team's game, optionally with one quarter decided differently
  async whatIf(sessionId: string, teamId: string, round?: number, decision?: Omit<TeamDecision, 'customPacts'>): Promise<WhatIfResult> {
    const res = await apiFetch(`${API_BASE}/sessions/${sessionId}/whatif`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, round, decision }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Replay failed');
    return data;
  },

  // The coach's facts rephrased by the active LLM (null without one)
  async coachNarrative(payload: { lang: string; teamName: string; round: number; insights: string[]; advice: string[] }): Promise<string | null> {
    const res = await apiFetch(`${API_BASE}/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return typeof data.narrative === 'string' && data.narrative ? data.narrative : null;
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
    viewerTeamId = this.teamId;

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
          pin: readStoredPin() || undefined,
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

  /** Joins the session again, e.g. after the facilitator PIN is verified, to get the full view. */
  public rejoin() {
    if (this.sessionId) {
      this.send({ type: 'JOIN_SESSION', sessionId: this.sessionId, teamId: this.teamId || undefined, role: this.role, pin: readStoredPin() || undefined });
    }
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
