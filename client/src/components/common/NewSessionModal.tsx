// ============================================================================
// GEMSIM: NEW SIMULATION SESSION MODAL
// ============================================================================

import { useDialogFocus } from './useDialogFocus';
import { useLocalizedScenarios } from '../../i18n/game';
import React, { useState } from 'react';
import { Scenario, SimulationSession } from '../../types/index';
import { api } from '../../services/api';
import { useI18n, TranslationKey } from '../../i18n';
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
  const { t } = useI18n();
  const shown = useLocalizedScenarios(scenarios);
  const [sessionName, setSessionName] = useState(() => t('newSession.defaultName'));
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '');
  const [teamCount, setTeamCount] = useState<number>(3);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState<number>(20);
  const [isCreating, setIsCreating] = useState(false);

  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!sessionName.trim() || !selectedScenarioId || isCreating) return;
    setIsCreating(true);

    try {
      const defaultTeamNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(letter => t('newSession.teamName', { letter }));
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
      <div ref={dialogRef}
        tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="new-session-title" className="bg-dark-850 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Play className="w-4 h-4" />
            </div>
            <h3 id="new-session-title" className="font-bold text-slate-100 text-base font-mono">{t('newSession.title')}</h3>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label htmlFor="ns-name" className="text-slate-300 font-semibold block mb-1">{t('newSession.name')}</label>
            <input
              id="ns-name"
              type="text"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
              placeholder={t('newSession.name.placeholder')}
            />
          </div>

          <div>
            <label htmlFor="ns-scenario" className="text-slate-300 font-semibold block mb-1">{t('newSession.scenario')}</label>
            <select
              id="ns-scenario"
              value={selectedScenarioId}
              onChange={e => setSelectedScenarioId(e.target.value)}
              className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {shown.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.industry} — {t(`brief.difficulty.${s.difficulty}` as TranslationKey)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ns-teams" className="text-slate-300 font-semibold block mb-1">{t('newSession.teams')}</label>
              <select
                id="ns-teams"
                value={teamCount}
                onChange={e => setTeamCount(parseInt(e.target.value, 10))}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {t(n === 1 ? 'newSession.teams.solo' : 'newSession.teams.n', { n })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ns-timer" className="text-slate-300 font-semibold block mb-1">{t('newSession.timer')}</label>
              <select
                id="ns-timer"
                value={roundDurationMinutes}
                onChange={e => setRoundDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {[10, 15, 20, 25, 30, 45].map(n => (
                  <option key={n} value={n}>
                    {t(n === 20 ? 'newSession.timer.recommended' : 'newSession.timer.n', { n })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-dark-900 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !sessionName.trim() || !selectedScenarioId}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{t('newSession.launch')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
