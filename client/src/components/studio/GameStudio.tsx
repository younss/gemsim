// ============================================================================
// GEMSIM: AI GAME STUDIO (SCENARIO & ARENA GENERATOR)
// Plain-text Generative Authoring, Schema Inspector, 3D Preview, and Publishing
// With Live AI Diagnostics, Model Selector, and Progressive Generation Telemetry
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Scenario, AISettingsState, AIProviderType } from '../../types/index';
import { api, ScenarioBalanceSummary } from '../../services/api';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import type { ScenarioDomain } from '../../types/index';

const PRESETS: Array<{ id: string; icon: string; domain: ScenarioDomain }> = [
  { id: 'banking', icon: '💳', domain: 'IT' },
  { id: 'health', icon: '🏥', domain: 'IT' },
  { id: 'plant', icon: '🏭', domain: 'INDUSTRIAL' },
  { id: 'expansion', icon: '🌎', domain: 'MARKET_EXPANSION' },
  { id: 'offshore', icon: '🌍', domain: 'SOURCING' },
];
const DOMAINS: ScenarioDomain[] = ['IT', 'INDUSTRIAL', 'MARKET_EXPANSION', 'SOURCING', 'GENERIC'];
import { EnterpriseCanvas } from '../3d/EnterpriseCanvas';
import {
  Wand2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Layers,
  Users,
  Calendar,
  Save,
  Code,
  Copy,
  Check,
  Compass,
  Cpu,
  Activity,
  RefreshCw,
  Zap,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface Props {
  onScenarioPublished?: (newScenario: Scenario) => void;
}

export const GameStudio: React.FC<Props> = ({ onScenarioPublished }) => {
  const { t, category, severity } = useGameText(null);
  const [industry, setIndustry] = useState(() => t('studio.preset.banking.industry'));
  const [businessChallenge, setBusinessChallenge] = useState(() => t('studio.preset.banking.challenge'));
  const [domain, setDomain] = useState<ScenarioDomain>('IT');
  const [difficulty, setDifficulty] = useState<'ENTRY' | 'INTERMEDIATE' | 'EXECUTIVE' | 'CRISIS_CHIEF'>('INTERMEDIATE');
  const [customDirectives, setCustomDirectives] = useState(() => t('studio.defaultDirectives'));

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<number>(0);
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);

  const [synthesizedScenario, setSynthesizedScenario] = useState<Scenario | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors?: string[];
    message?: string;
    balance?: ScenarioBalanceSummary;
  } | null>(null);
  const [streamPreview, setStreamPreview] = useState('');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'TOPOLOGY' | 'STAKEHOLDERS' | 'TIMELINE' | 'INITIATIVES' | 'JSON'>('TOPOLOGY');
  const [timelineViewMode, setTimelineViewMode] = useState<'AUTHOR' | 'PLAYER_FOG'>('AUTHOR');
  const [copied, setCopied] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // AI Runtime State
  const [aiSettings, setAiSettings] = useState<AISettingsState | null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);

  // Load AI configuration on mount
  const refreshAISettings = async () => {
    try {
      const data = await api.getAISettings();
      setAiSettings(data);
    } catch (err) {
      console.error('Failed to load AI settings in GameStudio:', err);
    }
  };

  useEffect(() => {
    refreshAISettings();
  }, []);

  // Quick Prompt Presets
  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setIndustry(t(`studio.preset.${preset.id}.industry` as TranslationKey));
    setBusinessChallenge(t(`studio.preset.${preset.id}.challenge` as TranslationKey));
    setDomain(preset.domain);
  };

  const handleProviderSwitch = async (provider: AIProviderType) => {
    try {
      const updated = await api.updateAISettings({ activeProvider: provider });
      setAiSettings(updated);
      setAiTestResult(null);
    } catch (err) {
      console.error('Failed to switch AI provider:', err);
    }
  };

  const handleModelChange = async (newModel: string) => {
    if (!aiSettings) return;
    try {
      const updated = await api.updateAISettings({
        activeProvider: 'ollama',
        updates: [{ type: 'ollama', config: { model: newModel, enabled: true } }],
      });
      setAiSettings(updated);
      setAiTestResult(null);
    } catch (err) {
      console.error('Failed to update Ollama model:', err);
    }
  };

  const handleTestAICall = async () => {
    if (!aiSettings) return;
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const res = await api.testAIProvider(aiSettings.activeProvider);
      setAiTestResult(res);
      await refreshAISettings();
    } catch (err: any) {
      setAiTestResult({ ok: false, message: err.message || t('studio.ai.failed'), latencyMs: 0 });
    } finally {
      setTestingAI(false);
    }
  };

  const handleGenerate = async () => {
    if (!industry.trim() || !businessChallenge.trim() || isGenerating) return;
    setIsGenerating(true);
    setValidationResult(null);
    setGenerationStep(1);
    const startMs = Date.now();


    try {
      setStreamPreview('');
      let received = 0;
      const { scenario } = await api.generateStudioScenarioStream(
        { industry, businessChallenge, difficulty, customDirectives, domain },
        chunk => {
          received += chunk.length;
          // Keep the tail of the stream visible and move the phase bar with real progress
          setStreamPreview(prev => (prev + chunk).slice(-700));
          setGenerationStep(Math.min(4, 1 + Math.floor(received / 2500)));
        }
      );

      setGenerationStep(5);
      setSynthesizedScenario(scenario);
      setGenerationDuration(Math.round((Date.now() - startMs) / 100) / 10);

      // Automatically validate
      const validation = await api.validateScenario(scenario);
      setValidationResult(validation);
    } catch (err: any) {
      console.error('Scenario generation failed:', err);
      setValidationResult({ valid: false, errors: [err.message || t('studio.generationError')] });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!synthesizedScenario) return;
    try {
      const published = await api.publishScenario(synthesizedScenario);
      setPublishSuccess(true);
      if (onScenarioPublished) onScenarioPublished(published);
      setTimeout(() => setPublishSuccess(false), 4000);
    } catch (err) {
      console.error('Publish error:', err);
    }
  };

  const handleCopyJSON = () => {
    if (!synthesizedScenario) return;
    navigator.clipboard.writeText(JSON.stringify(synthesizedScenario, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeProvider = aiSettings?.activeProvider || 'ollama';
  const activeOllamaModel = aiSettings?.providers?.ollama?.model || 'gemma4:12b';
  const availableModels = aiSettings?.availableOllamaModels || ['gemma4:12b', 'gemma4:26b', 'qwen3.5:9b', 'granite4.2:8b'];

  const stepLabels = [
    '',
    t('studio.step.1', { engine: activeProvider === 'ollama' ? `Ollama (${activeOllamaModel})` : activeProvider.toUpperCase() }),
    t('studio.step.2'),
    t('studio.step.3'),
    t('studio.step.4'),
    t('studio.step.5'),
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Bar: AI Engine Diagnostics & Quick Switcher */}
      <div className="bg-dark-850 border border-slate-800 rounded-xl p-3.5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[11px]">{t('studio.ai.active')}</span>
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                {activeProvider === 'ollama' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                {activeProvider === 'gemini' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                {activeProvider === 'fallback' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                {activeProvider === 'ollama' ? t('studio.ai.ollama') : activeProvider === 'gemini' ? 'Google Gemini' : activeProvider === 'fallback' ? t('studio.ai.fallback') : activeProvider.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {activeProvider === 'ollama' ? (
                <span>
                  {t('studio.ai.endpoint')} <code className="text-cyan-300 font-mono">{aiSettings?.providers?.ollama?.baseUrl || 'http://localhost:11434'}</code>
                </span>
              ) : activeProvider === 'gemini' ? (
                <span>{t('studio.ai.geminiDesc')}</span>
              ) : (
                <span>{t('studio.ai.fallbackDesc')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ollama Model Selector if Ollama is active */}
          {activeProvider === 'ollama' && (
            <div className="flex items-center gap-1.5 bg-dark-900 border border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-slate-400 font-mono">{t('studio.ai.model')}</span>
              <select
                aria-label={t('studio.ai.model')}
                value={activeOllamaModel}
                onChange={e => handleModelChange(e.target.value)}
                className="bg-transparent text-cyan-400 font-mono text-xs focus:outline-none cursor-pointer"
              >
                {availableModels.map(m => (
                  <option key={m} value={m} className="bg-dark-900 text-slate-100">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Provider Switcher Quick Buttons */}
          <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => handleProviderSwitch('ollama')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                activeProvider === 'ollama' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ollama
            </button>
            <button
              onClick={() => handleProviderSwitch('gemini')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                activeProvider === 'gemini' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gemini
            </button>
            <button
              onClick={() => handleProviderSwitch('fallback')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                activeProvider === 'fallback' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('studio.ai.offline')}
            </button>
          </div>

          {/* Test Ping Button */}
          <button
            onClick={handleTestAICall}
            disabled={testingAI}
            className="px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-all"
            title={t('studio.ai.ping')}
          >
            {testingAI ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Activity className="w-3.5 h-3.5 text-slate-400" />}
            <span>{testingAI ? t('studio.ai.testing') : 'Ping'}</span>
          </button>

          {aiTestResult && (
            <span
              className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 ${
                aiTestResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {aiTestResult.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              <span>{aiTestResult.ok ? `${aiTestResult.latencyMs} ms` : t('studio.ai.unreachable')}</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* Left Column: Generative Authoring Studio Controls */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-dark-850 p-5 rounded-xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base font-mono">{t('studio.title')}</h3>
                <p className="text-xs text-slate-400">{t('studio.subtitle')}</p>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">{t('studio.templates')}</span>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className="px-2 py-1 rounded bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 transition-all text-left"
                  >
                    {preset.icon} {t(`studio.preset.${preset.id}.label` as TranslationKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Fields */}
            <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
              <div>
                <label htmlFor="studio-domain" className="text-slate-400 font-semibold block mb-1">
                  {t('studio.domain')}
                </label>
                <select
                  id="studio-domain"
                  value={domain}
                  onChange={e => setDomain(e.target.value as ScenarioDomain)}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 mb-1"
                >
                  {DOMAINS.map(d => (
                    <option key={d} value={d}>
                      {t(`studio.domain.${d}` as TranslationKey)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mb-3">{t(`studio.domain.${domain}.hint` as TranslationKey)}</p>
                <label htmlFor="studio-industry" className="text-slate-400 font-semibold block mb-1">
                  {t('studio.industry')}
                </label>
                <input
                  id="studio-industry"
                  type="text"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder={t('studio.industry.placeholder')}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="studio-challenge" className="text-slate-400 font-semibold block">
                    {t('studio.challenge')}
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">{t('studio.challenge.badge')}</span>
                </div>
                <textarea
                  id="studio-challenge"
                  value={businessChallenge}
                  onChange={e => setBusinessChallenge(e.target.value)}
                  rows={8}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs leading-relaxed min-h-[140px] resize-y font-mono"
                  placeholder={t('studio.challenge.placeholder')}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('studio.challenge.help')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="studio-difficulty" className="text-slate-400 font-semibold block mb-1">
                    {t('studio.difficulty')}
                  </label>
                  <select
                    id="studio-difficulty"
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as any)}
                    className="w-full bg-dark-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {(['ENTRY', 'INTERMEDIATE', 'EXECUTIVE', 'CRISIS_CHIEF'] as const).map(d => (
                      <option key={d} value={d}>
                        {t(`brief.difficulty.${d}` as TranslationKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">{t('studio.rounds')}</label>
                  <input
                    type="text"
                    disabled
                    aria-label={t('studio.rounds')}
                    value={t('studio.rounds.value')}
                    className="w-full bg-dark-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="studio-directives" className="text-slate-400 font-semibold block mb-1">
                  {t('studio.directives')}
                </label>
                <input
                  id="studio-directives"
                  type="text"
                  value={customDirectives}
                  onChange={e => setCustomDirectives(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  placeholder={t('studio.directives.placeholder')}
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !industry.trim() || !businessChallenge.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)]"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-white" />
                  <span>{t('studio.generating')}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>{t('studio.generate')}</span>
                </>
              )}
            </button>

            {/* Progressive Generation Status Card */}
            {isGenerating && (
              <div className="p-3.5 rounded-xl bg-dark-900 border border-cyan-500/40 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span>{t('studio.phase', { n: generationStep })}</span>
                  </span>
                  <span className="text-slate-400">{Math.round(generationStep * 20)}%</span>
                </div>

                <div className="w-full bg-dark-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-700"
                    style={{ width: `${Math.max(10, generationStep * 20)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                  {stepLabels[generationStep] || t('studio.step.2')}
                </p>
                {streamPreview && (
                  <pre className="text-[10px] text-cyan-200/80 font-mono bg-dark-950 border border-slate-800 rounded p-2 max-h-40 overflow-hidden whitespace-pre-wrap break-all">
                    {streamPreview}
                  </pre>
                )}
              </div>
            )}

            {/* Validation Feedback */}
            {validationResult && !isGenerating && (
              <div className={`p-3 rounded-lg border text-xs font-mono ${
                validationResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {validationResult.valid ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                  <span>{validationResult.valid ? t('studio.valid') : t('studio.invalid')}</span>
                </div>
                <p className="text-[11px] text-slate-300">{validationResult.message || validationResult.errors?.join(', ')}</p>
                {validationResult.balance?.strategies && (
                  <div className={`mt-2 text-[11px] ${validationResult.balance.playable ? 'text-emerald-300' : 'text-amber-300'}`}>
                    <div className="font-bold">
                      {validationResult.balance.playable ? `⚖️ ${t('studio.balance.ok')}` : `⚠️ ${t('studio.balance.issues')}`}
                      {validationResult.balance.bestAchievable &&
                        ` — ${t('studio.balance.best', {
                          verdict: t(`outcome.verdict.${validationResult.balance.bestAchievable.verdict}` as TranslationKey),
                          grade: validationResult.balance.bestAchievable.grade,
                        })}`}
                    </div>
                    <div className="text-slate-400">
                      {Object.entries(validationResult.balance.strategies)
                        .map(([name, r]) => `${t(`demo.strategy.${name}` as TranslationKey)} : ${t(`outcome.verdict.${r.verdict}` as TranslationKey)} ${r.grade}`)
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Schema Inspector, 3D Graph Preview, and Publisher */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {synthesizedScenario ? (
            <div className="bg-dark-850 p-5 rounded-xl border border-slate-800 shadow-xl flex flex-col gap-4">
              {/* Header & Publishing Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                      {t(`brief.difficulty.${synthesizedScenario.difficulty}` as TranslationKey)}
                    </span>
                    {synthesizedScenario.domain && (
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono">
                        {t(`studio.domain.${synthesizedScenario.domain}` as TranslationKey)}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">{synthesizedScenario.industry}</span>
                    {generationDuration && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{generationDuration}s</span>
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded bg-dark-900 text-slate-400 border border-slate-700 font-mono">
                      {synthesizedScenario.author}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">{synthesizedScenario.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJSON}
                    className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t('studio.copied') : t('studio.copy')}</span>
                  </button>

                  <button
                    onClick={handlePublish}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t('studio.publish')}</span>
                  </button>
                </div>
              </div>

              {publishSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4" />
                  <span>{t('studio.published')}</span>
                </div>
              )}

              {/* Inspector Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveInspectorTab('TOPOLOGY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'TOPOLOGY' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{t('studio.tab.map', { n: synthesizedScenario.topology.nodes.length })}</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('STAKEHOLDERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'STAKEHOLDERS' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('brief.tab.people', { n: synthesizedScenario.stakeholders.length })}</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('TIMELINE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'TIMELINE' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t('studio.tab.timeline', { n: synthesizedScenario.roundEvents.length })}</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('INITIATIVES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'INITIATIVES' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t('studio.tab.initiatives', { n: synthesizedScenario.initiativesCatalog.length })}</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('JSON')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'JSON' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </div>

              {/* TAB CONTENT: 3D Topology Preview */}
              {activeInspectorTab === 'TOPOLOGY' && (
                <div className="h-[480px] w-full rounded-xl overflow-hidden border border-slate-800">
                  <EnterpriseCanvas topology={synthesizedScenario.topology} layerLabels={synthesizedScenario.vocabulary?.layers} />
                </div>
              )}

              {/* TAB CONTENT: Stakeholders */}
              {activeInspectorTab === 'STAKEHOLDERS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {synthesizedScenario.stakeholders.map(sh => (
                    <div key={sh.id} className="bg-dark-900 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 rounded-lg bg-dark-800 border border-slate-700">{sh.avatar}</span>
                        <div>
                          <h4 className="font-bold text-slate-100 text-sm">{sh.name}</h4>
                          <div className="text-xs text-cyan-400">{sh.title}</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-300">
                        <strong className="text-slate-400">{t('brief.people.bias')}</strong> {sh.bias}
                      </div>
                      <div className="text-xs text-slate-300">
                        <strong className="text-slate-400">{t('brief.people.agenda')}</strong> {sh.hiddenAgenda}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB CONTENT: Timeline Crises */}
              {activeInspectorTab === 'TIMELINE' && (
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {/* Pedagogical Banner on Progressive Surprise & Fog of War */}
                  <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{t('studio.fog.title')}</span>
                      </span>
                      <div className="flex items-center gap-1 bg-dark-900/80 p-0.5 rounded-lg border border-slate-700 shrink-0">
                        <button
                          onClick={() => setTimelineViewMode('AUTHOR')}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                            timelineViewMode === 'AUTHOR'
                              ? 'bg-cyan-500 text-black font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t('studio.fog.author')}
                        </button>
                        <button
                          onClick={() => setTimelineViewMode('PLAYER_FOG')}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                            timelineViewMode === 'PLAYER_FOG'
                              ? 'bg-indigo-500 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t('studio.fog.player')}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {t('studio.fog.body')}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {synthesizedScenario.roundEvents.map(event => {
                      const isFogged = timelineViewMode === 'PLAYER_FOG' && event.roundNumber > 1;

                      if (isFogged) {
                        return (
                          <div key={event.roundNumber} className="bg-dark-900/60 p-4 rounded-xl border border-indigo-500/30 space-y-2 opacity-80">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                <span>{t('studio.fog.quarter', { n: event.roundNumber })}</span>
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                {t('studio.fog.locked')}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-400 text-sm italic">{t('studio.fog.hiddenTitle')}</h4>
                            <p className="text-xs text-slate-500">{t('studio.fog.hiddenBody')}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={event.roundNumber} className="bg-dark-900 p-4 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-cyan-400">{t('studio.fog.crisis', { n: event.roundNumber })}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              {severity(event.severity)}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-100 text-sm">{event.title}</h4>
                          <p className="text-xs text-slate-300">{event.description}</p>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {t('cockpit.crisis.choices', { n: event.choices.length })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: Initiatives */}
              {activeInspectorTab === 'INITIATIVES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {synthesizedScenario.initiativesCatalog.map(init => (
                    <div key={init.id} className="bg-dark-900 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-xs">{init.name}</span>
                        <span className="text-[10px] font-mono text-cyan-400">{init.capExCost}K$</span>
                      </div>
                      <p className="text-slate-400 text-[11px] line-clamp-2">{init.description}</p>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-300">
                        <span>{category(init.category)}</span>
                        <span>{t('studio.init.debt', { n: `${init.tdiDelta > 0 ? '+' : ''}${init.tdiDelta}` })}</span>
                        <span>{t('studio.init.velocity', { n: `${init.velocityDelta > 0 ? '+' : ''}${init.velocityDelta}` })}</span>
                        {(init.durationRounds ?? 1) > 1 && <span>⏱ {t('arena.init.duration', { n: init.durationRounds })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB CONTENT: Raw JSON */}
              {activeInspectorTab === 'JSON' && (
                <pre className="p-4 rounded-xl bg-dark-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto max-h-[480px]">
                  {JSON.stringify(synthesizedScenario, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="bg-dark-850 p-12 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-200">{t('studio.empty.title')}</h4>
              <p className="text-xs text-slate-400 max-w-md">{t('studio.empty.body')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
