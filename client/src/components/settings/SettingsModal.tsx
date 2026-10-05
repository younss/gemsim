// ============================================================================
// GEMSIM: AI ENGINES SETTINGS
// Two engines, configured separately and laid out the same way:
// System 2 writes (dialogue, cases, coach, debriefs), System 1 judges.
// ============================================================================

import { useDialogFocus } from '../common/useDialogFocus';
import React, { useState } from 'react';
import { AISettingsState } from '../../types/index';
import { useI18n } from '../../i18n';
import { SystemOnePanel } from './SystemOnePanel';
import { SystemTwoPanel } from './SystemTwoPanel';
import { Cpu, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: (settings: AISettingsState) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onSettingsUpdated }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'S2' | 'S1'>('S2');
  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-dark-850 w-full max-w-3xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="settings-title" className="font-bold text-slate-100 text-base font-mono">{t('settings.title')}</h3>
              <p className="text-xs text-slate-400">{t('settings.subtitle')}</p>
            </div>
          </div>
          <button aria-label={t('common.close')} onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two engines, configured separately */}
        <div role="tablist" aria-label={t('settings.tabs')} className="px-5 pt-3 bg-dark-900 border-b border-slate-800 flex gap-1 font-mono text-xs">
          {(['S2', 'S1'] as const).map(id => (
            <button
              key={id}
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`settings-panel-${id}`}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-t-lg border-b-2 -mb-px ${tab === id ? 'border-cyan-400 text-cyan-300 bg-dark-850' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <span className="font-bold">{t(id === 'S2' ? 'settings.tab.s2' : 'settings.tab.s1')}</span>
              <span className="block text-[10px] text-slate-400">{t(id === 'S2' ? 'settings.tab.s2.hint' : 'settings.tab.s1.hint')}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} className="p-6 overflow-y-auto flex-1 text-xs">
          {tab === 'S2' ? <SystemTwoPanel onApplied={onSettingsUpdated} /> : <SystemOnePanel />}
        </div>
      </div>
    </div>
  );
};
