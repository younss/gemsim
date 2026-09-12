// ============================================================================
// GEMSIM: NEW SIMULATION SESSION MODAL
// ============================================================================

import React, { useState } from 'react';
import { Scenario, SimulationSession } from '../../types/index';
import { api } from '../../services/api';
import { X, Play, Users, Layers, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  onSessionCreated: (session: SimulationSession) => void;
}

export const NewSessionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  scenarios,
  onSessionCreated,
}) => {
  const [sessionName, setSessionName] = useState('Executive Architecture War Game');
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '');
  const [teamCount, setTeamCount] = useState<number>(3);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState<number>(5);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!sessionName.trim() || !selectedScenarioId || isCreating) return;
    setIsCreating(true);

    try {
      const defaultTeamNames = [
        'Team Alpha Enterprise',
        'Team Beta Solutions',
        'Team Gamma Systems',
        'Team Delta Digital',
        'Team Epsilon Platform',
      ];
      const assignedTeams = defaultTeamNames.slice(0, teamCount);

      const session = await api.createSession({
        name: sessionName.trim(),
        scenarioId: selectedScenarioId,
        teamNames: assignedTeams,
        roundDurationSeconds: roundDurationMinutes * 60,
      });

      onSessionCreated(session);
      onClose();
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-850 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Play className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-100 text-base font-mono">Launch New Simulation Arena</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Simulation Session Title:</label>
            <input
              type="text"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
              placeholder="e.g. Q4 Executive Strategy Challenge"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Select Scenario / Business Arena:</label>
            <select
              value={selectedScenarioId}
              onChange={e => setSelectedScenarioId(e.target.value)}
              className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {scenarios.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.industry} - {s.difficulty})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Competing Teams:</label>
              <select
                value={teamCount}
                onChange={e => setTeamCount(parseInt(e.target.value, 10))}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value={1}>1 Team (Solo Executive)</option>
                <option value={2}>2 Teams (Head-to-Head)</option>
                <option value={3}>3 Teams (Multi-Squad)</option>
                <option value={4}>4 Teams (Tournament)</option>
                <option value={5}>5 Teams (Enterprise Division)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Round Timer:</label>
              <select
                value={roundDurationMinutes}
                onChange={e => setRoundDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value={3}>3 Minutes / Round</option>
                <option value={5}>5 Minutes / Round (Standard)</option>
                <option value={8}>8 Minutes / Round</option>
                <option value={12}>12 Minutes / Round (In-Depth)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-dark-900 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !sessionName.trim() || !selectedScenarioId}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Simulation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
