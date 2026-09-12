// ============================================================================
// GEMSIM: SETTINGS & PLUGGABLE AI GATEWAY MANAGER
// Dynamic Provider Switching, API Key Configuration, and Health Diagnostics
// ============================================================================

import React, { useState, useEffect } from 'react';
import { AISettingsState, AIProviderType, AIProviderConfig } from '../../types/index';
import { api } from '../../services/api';
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
      });
    }
  }, [isOpen]);

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
      <div className="bg-dark-850 w-full max-w-3xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base font-mono">Pluggable AI Abstraction Gateway</h3>
              <p className="text-xs text-slate-400">Bring Your Own AI / Local Gemma Container Configuration</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Active Provider Selector */}
          <div>
            <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px] font-mono block mb-2">
              ACTIVE SIMULATION AI ENGINE:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
              {(['fallback', 'ollama', 'gemini', 'claude', 'openai'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveProvider(type)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    activeProvider === type
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                      : 'bg-dark-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold uppercase text-[11px]">{type}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {type === 'fallback' ? 'Zero-Dep' : type === 'ollama' ? 'Local Gemma' : 'Cloud BYOK'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Provider 1: Local Ollama */}
          <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 font-mono">1. Local Ollama (Gemma 4 / Gemma 2)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono">
                  Default Container Bridge
                </span>
              </div>
              <button
                onClick={() => handleTestConnection('ollama')}
                disabled={testingProvider === 'ollama'}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5"
              >
                {testingProvider === 'ollama' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-cyan-400" />}
                <span>Test Ping</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Base URL / Podman Bridge:</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Target Model Tag:</label>
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
              <span className="font-bold text-slate-200 font-mono">2. Google Gemini (BYOK)</span>
              <button
                onClick={() => handleTestConnection('gemini')}
                disabled={testingProvider === 'gemini'}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5"
              >
                {testingProvider === 'gemini' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 text-cyan-400" />}
                <span>Test Ping</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Gemini API Key:</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
                  placeholder={settings?.providers.gemini?.apiKey || 'AIzaSy...'}
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Model:</label>
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-dark-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Automatic Fallback: Active Provider → Ollama → Heuristic Engine
          </span>

          <div className="flex items-center gap-2">
            {saveStatus && (
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Apply Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
