// ============================================================================
// GEMSIM: AI GAME STUDIO (SCENARIO & ARENA GENERATOR)
// Plain-text Generative Authoring, Schema Inspector, 3D Preview, and Publishing
// With Live AI Diagnostics, Model Selector, and Progressive Generation Telemetry
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Scenario, AISettingsState, AIProviderType } from '../../types/index';
import { api } from '../../services/api';
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
} from 'lucide-react';

interface Props {
  onScenarioPublished?: (newScenario: Scenario) => void;
}

export const GameStudio: React.FC<Props> = ({ onScenarioPublished }) => {
  const [industry, setIndustry] = useState('FinTech & Digital Banking');
  const [businessChallenge, setBusinessChallenge] = useState(
    'A Tier-1 bank scaling to 15M accounts struggles with a 25-year-old COBOL mainframe monolith causing batch-processing bottlenecks, escalating OpEx maintenance, and regulatory open-banking audit pressures.'
  );
  const [difficulty, setDifficulty] = useState<'ENTRY' | 'INTERMEDIATE' | 'EXECUTIVE' | 'CRISIS_CHIEF'>('INTERMEDIATE');
  const [customDirectives, setCustomDirectives] = useState('Include realistic friction between CFO margin targets and VP Product feature release velocity.');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<number>(0);
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);

  const [synthesizedScenario, setSynthesizedScenario] = useState<Scenario | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors?: string[]; message?: string } | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'TOPOLOGY' | 'STAKEHOLDERS' | 'TIMELINE' | 'INITIATIVES' | 'JSON'>('TOPOLOGY');
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
  const applyPreset = (presetIndustry: string, presetChallenge: string) => {
    setIndustry(presetIndustry);
    setBusinessChallenge(presetChallenge);
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
      setAiTestResult({ ok: false, message: err.message || 'Connection failed', latencyMs: 0 });
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

    // Step ticker to show real-time progress across generation phases
    const stepTimer = setInterval(() => {
      setGenerationStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 2400);

    try {
      const scenario = await api.generateStudioScenario({
        industry,
        businessChallenge,
        difficulty,
        customDirectives,
      });

      setGenerationStep(5);
      setSynthesizedScenario(scenario);
      setGenerationDuration(Math.round((Date.now() - startMs) / 100) / 10);

      // Automatically validate
      const validation = await api.validateScenario(scenario);
      setValidationResult(validation);
    } catch (err: any) {
      console.error('Scenario generation failed:', err);
      setValidationResult({ valid: false, errors: [err.message || 'Generation error'] });
    } finally {
      clearInterval(stepTimer);
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
    `Interrogating ${activeProvider === 'ollama' ? `Local Ollama (${activeOllamaModel})` : activeProvider.toUpperCase()}...`,
    'Synthesizing 4-Tier Topology (Business, App, Data, Infra)...',
    'Engineering Competing Stakeholder Agendas & Dialectics...',
    'Simulating 4 Quarters of Crisis Events & Remediation Curves...',
    'Validating Mathematical Constraints & Compiling 3D Arena...',
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
              <span className="text-slate-400 font-mono text-[11px]">ACTIVE AI ENGINE:</span>
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                {activeProvider === 'ollama' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                {activeProvider === 'gemini' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                {activeProvider === 'fallback' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                {activeProvider === 'ollama' ? 'Ollama (Local Private AI)' : activeProvider === 'gemini' ? 'Google Gemini Cloud' : 'Zero-Dependency Heuristic'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {activeProvider === 'ollama' ? (
                <span>Host endpoint: <code className="text-cyan-300 font-mono">{aiSettings?.providers?.ollama?.baseUrl || 'http://localhost:11434'}</code></span>
              ) : activeProvider === 'gemini' ? (
                <span>High-throughput Google BYOK Cloud Gateway</span>
              ) : (
                <span>Deterministic domain heuristic engine</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ollama Model Selector if Ollama is active */}
          {activeProvider === 'ollama' && (
            <div className="flex items-center gap-1.5 bg-dark-900 border border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-slate-400 font-mono">MODEL:</span>
              <select
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
              Offline
            </button>
          </div>

          {/* Test Ping Button */}
          <button
            onClick={handleTestAICall}
            disabled={testingAI}
            className="px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-all"
            title="Test AI connection and measure roundtrip latency"
          >
            {testingAI ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Activity className="w-3.5 h-3.5 text-slate-400" />}
            <span>{testingAI ? 'Testing...' : 'Ping'}</span>
          </button>

          {aiTestResult && (
            <span
              className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 ${
                aiTestResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {aiTestResult.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              <span>{aiTestResult.ok ? `${aiTestResult.latencyMs}ms` : 'Offline'}</span>
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
                <h3 className="font-bold text-slate-100 text-base font-mono">AI Scenario Studio</h3>
                <p className="text-xs text-slate-400">Synthesize validated playable arenas from plain text.</p>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono block">INDUSTRY TEMPLATES:</span>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  onClick={() => applyPreset('FinTech & Neobanking', 'Systemic Bank Corporate Services Remodernization: high-frequency payment gateway and core mainframe settlement suffering database deadlocks under surge volume.')}
                  className="px-2 py-1 rounded bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 transition-all text-left"
                >
                  💳 Systemic Banking
                </button>
                <button
                  onClick={() => applyPreset('Healthcare & Life Sciences', 'Hospital network migrating on-premise clinical EHR to cloud under HIPAA enforcement.')}
                  className="px-2 py-1 rounded bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 transition-all text-left"
                >
                  🏥 Healthcare EHR
                </button>
                <button
                  onClick={() => applyPreset('Global E-Commerce', 'Flash-sale retail ERP monolith suffering from database thread starvation on Black Friday.')}
                  className="px-2 py-1 rounded bg-dark-800 hover:bg-dark-750 text-slate-300 border border-slate-700 transition-all text-left"
                >
                  🛍️ E-Commerce ERP
                </button>
              </div>
            </div>

            {/* Input Fields */}
            <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Industry / Business Vertical:</label>
                <input
                  type="text"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. FinTech, Energy, Telecommunications..."
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Corporate Scenario & Challenge:</label>
                <textarea
                  value={businessChallenge}
                  onChange={e => setBusinessChallenge(e.target.value)}
                  rows={4}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs leading-relaxed"
                  placeholder="Describe legacy architecture bottlenecks, competing stakeholder agendas, and target outcomes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Difficulty:</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as any)}
                    className="w-full bg-dark-900 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ENTRY">Entry Level</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="EXECUTIVE">Executive Tier</option>
                    <option value="CRISIS_CHIEF">Crisis Chief</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Rounds:</label>
                  <input
                    type="text"
                    disabled
                    value="4 Quarters (Q1-Q4)"
                    className="w-full bg-dark-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Custom Political Directives:</label>
                <input
                  type="text"
                  value={customDirectives}
                  onChange={e => setCustomDirectives(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. CFO bonus is tied to margin; CPO is aggressive..."
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
                  <span>Synthesizing Enterprise Schema...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Scenario Schema</span>
                </>
              )}
            </button>

            {/* Progressive Generation Status Card */}
            {isGenerating && (
              <div className="p-3.5 rounded-xl bg-dark-900 border border-cyan-500/40 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span>SYNTHESIZING [PHASE {generationStep}/5]</span>
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
                  {stepLabels[generationStep] || 'Generating enterprise architecture blueprint...'}
                </p>
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
                  <span>{validationResult.valid ? 'SCHEMA VALIDATED' : 'VALIDATION ISSUES'}</span>
                </div>
                <p className="text-[11px] text-slate-300">{validationResult.message || validationResult.errors?.join(', ')}</p>
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
                      {synthesizedScenario.difficulty}
                    </span>
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
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>

                  <button
                    onClick={handlePublish}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Publish to Scenario Library</span>
                  </button>
                </div>
              </div>

              {publishSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4" />
                  <span>Scenario published successfully to the simulation arena library! Ready to launch sessions.</span>
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
                  <span>3D Topology ({synthesizedScenario.topology.nodes.length} Nodes)</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('STAKEHOLDERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'STAKEHOLDERS' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Stakeholders ({synthesizedScenario.stakeholders.length})</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('TIMELINE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'TIMELINE' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Timeline ({synthesizedScenario.roundEvents.length} Crises)</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('INITIATIVES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'INITIATIVES' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Initiatives ({synthesizedScenario.initiativesCatalog.length})</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('JSON')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    activeInspectorTab === 'JSON' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Raw JSON</span>
                </button>
              </div>

              {/* TAB CONTENT: 3D Topology Preview */}
              {activeInspectorTab === 'TOPOLOGY' && (
                <div className="h-[480px] w-full rounded-xl overflow-hidden border border-slate-800">
                  <EnterpriseCanvas topology={synthesizedScenario.topology} />
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
                        <strong className="text-slate-400">Bias:</strong> {sh.bias}
                      </div>
                      <div className="text-xs text-slate-300">
                        <strong className="text-slate-400">Hidden Agenda:</strong> {sh.hiddenAgenda}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB CONTENT: Timeline Crises */}
              {activeInspectorTab === 'TIMELINE' && (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {synthesizedScenario.roundEvents.map(event => (
                    <div key={event.roundNumber} className="bg-dark-900 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-cyan-400">QUARTER {event.roundNumber} CRISIS</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          {event.severity}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-100 text-sm">{event.title}</h4>
                      <p className="text-xs text-slate-300">{event.description}</p>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {event.choices.length} Remediation Choices Configured
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB CONTENT: Initiatives */}
              {activeInspectorTab === 'INITIATIVES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {synthesizedScenario.initiativesCatalog.map(init => (
                    <div key={init.id} className="bg-dark-900 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-xs">{init.name}</span>
                        <span className="text-[10px] font-mono text-cyan-400">${init.capExCost}K</span>
                      </div>
                      <p className="text-slate-400 text-[11px] line-clamp-2">{init.description}</p>
                      <div className="flex items-center gap-3 font-mono text-[10px] text-slate-300">
                        <span>TDI: {init.tdiDelta}%</span>
                        <span>Velocity: +{init.velocityDelta}%</span>
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
              <h4 className="text-base font-bold text-slate-200">No Scenario Synthesized Yet</h4>
              <p className="text-xs text-slate-400 max-w-md">
                Configure your industry challenge directives on the left and click <strong>Generate Scenario Schema</strong> to synthesize a playable multi-round enterprise arena.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
