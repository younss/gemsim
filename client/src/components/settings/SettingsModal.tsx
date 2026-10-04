// ============================================================================
// GEMSIM: SETTINGS & PLUGGABLE AI GATEWAY MANAGER
// Dynamic Provider Switching, API Key Configuration, and Health Diagnostics
// ============================================================================

import { useDialogFocus } from '../common/useDialogFocus';
import React, { useState, useEffect } from 'react';
import { AISettingsState, AIProviderType, AIProviderConfig } from '../../types/index';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { SystemOnePanel } from './SystemOnePanel';
import {
  Settings,
  Cpu,
  CheckCircle2,
  XCircle,
  Activity,
  Key,
  Globe,
  Save,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: (settings: AISettingsState) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AISettingsState | null>(null);
  const [activeProvider, setActiveProvider] = useState<AIProviderType>('fallback');

  // Provider editable inputs
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('gemma:2b');

  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');

  const [claudeKey, setClaudeKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-3-5-sonnet-20241022');

  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  // Any OpenAI-compatible API (Mistral, Groq, OpenRouter, LM Studio...)
  const [customUrl, setCustomUrl] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customModel, setCustomModel] = useState('');

  // System 2 writes (dialogue, cases, debriefs); System 1 judges (verdicts, votes)
  const [tab, setTab] = useState<'S2' | 'S1'>('S2');

  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; latencyMs: number }>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getAISettings().then(data => {
        setSettings(data);
        setActiveProvider(data.activeProvider);

        if (data.providers.ollama) {
          setOllamaUrl(data.providers.ollama.baseUrl || 'http://localhost:11434');
          setOllamaModel(data.providers.ollama.model || 'gemma:2b');
        }
        if (data.providers.gemini) {
          setGeminiModel(data.providers.gemini.model || 'gemini-1.5-flash');
        }
        if (data.providers.claude) {
          setClaudeModel(data.providers.claude.model || 'claude-3-5-sonnet-20241022');
        }
        if (data.providers.openai) {
          setOpenaiModel(data.providers.openai.model || 'gpt-4o-mini');
        }
        if (data.providers.custom) {
          setCustomUrl(data.providers.custom.baseUrl || '');
          setCustomModel(data.providers.custom.model || '');
        }
      });
    }
  }, [isOpen]);

  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  const handleTestConnection = async (type: AIProviderType) => {
    setTestingProvider(type);
    try {
      const res = await api.testAIProvider(type);
      setTestResults(prev => ({ ...prev, [type]: res }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [type]: { ok: false, message: err.message, latencyMs: 0 },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = async () => {
    try {
      const updates = [
        {
          type: 'ollama' as AIProviderType,
          config: { baseUrl: ollamaUrl, model: ollamaModel, enabled: true },
        },
        {
          type: 'gemini' as AIProviderType,
          config: { apiKey: geminiKey || undefined, model: geminiModel, enabled: Boolean(geminiKey) },
        },
        {
          type: 'claude' as AIProviderType,
          config: { apiKey: claudeKey || undefined, model: claudeModel, enabled: Boolean(claudeKey) },
        },
        {
          type: 'openai' as AIProviderType,
          config: { apiKey: openaiKey || undefined, model: openaiModel, enabled: Boolean(openaiKey) },
        },
        {
          type: 'custom' as AIProviderType,
          config: { apiKey: customKey || undefined, baseUrl: customUrl || undefined, model: customModel, enabled: Boolean(customUrl && customModel) },
        },
      ];

      const newSettings = await api.updateAISettings({
        activeProvider,
        updates,
      });

      setSettings(newSettings);
      if (onSettingsUpdated) onSettingsUpdated(newSettings);
      setSaveStatus(true);
      setTimeout(() => setSaveStatus(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div ref={dialogRef}
        tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="settings-title" className="bg-dark-850 w-full max-w-3xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 id="settings-title" className="font-bold text-slate-100 text-base font-mono">{t('settings.title')}</h3>
              <p className="text-xs text-slate-400">{t('settings.subtitle')}</p>
            </div>
          </div>

          <button
            aria-label={t('common.close')} onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
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

        {tab === 'S1' && (
          <div role="tabpanel" id="settings-panel-S1" aria-labelledby="settings-tab-S1" className="p-6 overflow-y-auto flex-1 text-xs">
            <SystemOnePanel />
          </div>
        )}

        {/* Body: System 2 */}
        {tab === 'S2' && (
        <div role="tabpanel" id="settings-panel-S2" aria-labelledby="settings-tab-S2" className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          <p className="text-[11px] text-slate-400">{t('settings.s2.body')}</p>
          {/* Active Provider Selector */}
          <div>
            <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px] font-mono block mb-2">
              {t('settings.active')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono">
              {(['fallback', 'ollama', 'gemini', 'claude', 'openai', 'custom'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveProvider(type)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    activeProvider === type
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                      : 'bg-dark-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold uppercase text-[11px]">{type === 'custom' ? t('settings.custom.short') : type}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {type === 'fallback' ? t('settings.kind.offline') : type === 'ollama' ? t('settings.kind.local') : type === 'custom' ? t('settings.s1.providerHint.custom') : t('settings.kind.cloud')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Provider 1: Local Ollama */}
          <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 font-mono">{t('settings.ollama')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono">
                  {t('settings.ollama.badge')}
                </span>
              </div>
              <button
                onClick={() => handleTestConnection('ollama')}
                disabled={testingProvider === 'ollama'}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5"
              >
                {testingProvider === 'ollama' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-cyan-400" />}
                <span>{t('settings.test')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">{t('settings.ollama.url')}</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">{t('settings.model')}</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={e => setOllamaModel(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                  placeholder="gemma:2b"
                />
              </div>
            </div>

            {testResults['ollama'] && (
              <div className={`p-2 rounded text-[11px] font-mono flex items-center gap-2 ${
                testResults['ollama'].ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {testResults['ollama'].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{testResults['ollama'].message} ({testResults['ollama'].latencyMs}ms)</span>
              </div>
            )}
          </div>

          {/* Provider 2: Google Gemini */}
          <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 font-mono">{t('settings.gemini')}</span>
              <button
                onClick={() => handleTestConnection('gemini')}
                disabled={testingProvider === 'gemini'}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5"
              >
                {testingProvider === 'gemini' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-cyan-400" />}
                <span>{t('settings.test')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">{t('settings.apiKey', { provider: 'Gemini' })}</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                  placeholder={settings?.providers.gemini?.apiKey || 'AIzaSy...'}
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">{t('settings.model')}</label>
                <input
                  type="text"
                  value={geminiModel}
                  onChange={e => setGeminiModel(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                  placeholder="gemini-1.5-flash"
                />
              </div>
            </div>

            {testResults['gemini'] && (
              <div className={`p-2 rounded text-[11px] font-mono flex items-center gap-2 ${
                testResults['gemini'].ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {testResults['gemini'].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{testResults['gemini'].message} ({testResults['gemini'].latencyMs}ms)</span>
              </div>
            )}
          </div>

          {/* Provider 3 & 4: Claude & OpenAI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Claude */}
            <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-2">
              <span className="font-bold text-slate-200 font-mono block">3. Anthropic Claude</span>
              <input
                type="password"
                value={claudeKey}
                onChange={e => setClaudeKey(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                placeholder={settings?.providers.claude?.apiKey || 'sk-ant-...'}
              />
              <input
                type="text"
                value={claudeModel}
                onChange={e => setClaudeModel(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-[11px]"
                placeholder="claude-3-5-sonnet-20241022"
              />
            </div>

            {/* OpenAI */}
            <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-2">
              <span className="font-bold text-slate-200 font-mono block">4. OpenAI</span>
              <input
                type="password"
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                placeholder={settings?.providers.openai?.apiKey || 'sk-...'}
              />
              <input
                type="text"
                value={openaiModel}
                onChange={e => setOpenaiModel(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-[11px]"
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>

          {/* Provider 5: any OpenAI-compatible API */}
          <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 font-mono">{t('settings.custom')}</span>
              <button
                onClick={() => handleTestConnection('custom')}
                disabled={testingProvider === 'custom'}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5"
              >
                {testingProvider === 'custom' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-cyan-400" />}
                <span>{t('settings.test')}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">{t('settings.custom.body')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="custom-url" className="text-slate-400 block mb-1">{t('settings.s1.url')}</label>
                <input id="custom-url" type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono" placeholder="https://api.mistral.ai/v1" />
              </div>
              <div>
                <label htmlFor="custom-key" className="text-slate-400 block mb-1">{t('settings.s1.key')}</label>
                <input id="custom-key" type="password" value={customKey} onChange={e => setCustomKey(e.target.value)} autoComplete="off" className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono" placeholder={settings?.providers.custom?.apiKey || '...'} />
              </div>
              <div>
                <label htmlFor="custom-model" className="text-slate-400 block mb-1">{t('settings.model')}</label>
                <input id="custom-model" type="text" value={customModel} onChange={e => setCustomModel(e.target.value)} className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono" placeholder="mistral-small-latest" />
              </div>
            </div>
            {testResults['custom'] && (
              <div className={`p-2 rounded text-[11px] font-mono flex items-center gap-2 ${testResults['custom'].ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {testResults['custom'].ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{testResults['custom'].message} ({testResults['custom'].latencyMs}ms)</span>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Footer (System 2; System 1 applies from its own tab) */}
        {tab === 'S2' && (
        <div className="p-4 border-t border-slate-800 bg-dark-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            {t('settings.fallbackChain')}
          </span>

          <div className="flex items-center gap-2">
            {saveStatus && (
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('settings.saved')}
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{t('settings.apply')}</span>
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
