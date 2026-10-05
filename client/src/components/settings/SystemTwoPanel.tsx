// ============================================================================
// GEMSIM: SYSTEM 2 SETTINGS (WRITING)
// The model that writes the executives' replies, Studio cases, the coach and
// debriefs, configured apart from System 1 (judgments) and laid out like it:
// one provider, its settings, a test that does not apply the configuration and
// a comparison of models on the same sample reply.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { AIProviderType, AISettingsState } from '../../types/index';
import { api, SystemTwoSample } from '../../services/api';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Activity, CheckCircle2, RefreshCw, Save, XCircle } from 'lucide-react';

const INPUT = 'w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono';
const PROVIDERS: AIProviderType[] = ['ollama', 'gemini', 'claude', 'openai', 'custom', 'fallback'];
const WITH_URL: AIProviderType[] = ['ollama', 'custom'];
const WITH_KEY: AIProviderType[] = ['gemini', 'claude', 'openai', 'custom'];
const PLACEHOLDER: Record<AIProviderType, { model: string; baseUrl?: string }> = {
  ollama: { model: 'gemma4:12b', baseUrl: 'http://localhost:11434' },
  gemini: { model: 'gemini-2.0-flash' },
  claude: { model: 'claude-haiku-4-5-20251001' },
  openai: { model: 'gpt-4o-mini' },
  custom: { model: 'mistral-small-latest', baseUrl: 'https://api.mistral.ai/v1' },
  fallback: { model: 'heuristic-v1' },
};

export const SystemTwoPanel: React.FC<{ onApplied?: (settings: AISettingsState) => void }> = ({ onApplied }) => {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState<AISettingsState | null>(null);
  const [provider, setProvider] = useState<AIProviderType>('ollama');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [installed, setInstalled] = useState<string[]>([]);
  const [decisionModels, setDecisionModels] = useState<string[]>([]);
  const [samples, setSamples] = useState<SystemTwoSample[]>([]);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const select = (s: AISettingsState, p: AIProviderType) => {
    const cfg = s.providers[p];
    setProvider(p);
    setModel(cfg?.model || PLACEHOLDER[p].model);
    setBaseUrl(cfg?.baseUrl || PLACEHOLDER[p].baseUrl || '');
    setApiKey('');
  };

  const load = (s: AISettingsState) => {
    setCurrent(s);
    select(s, s.activeProvider);
  };

  useEffect(() => {
    api.getAISettings().then(load).catch(() => setStatus({ ok: false, text: t('settings.s1.unreachable') }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Installed Ollama models that can write: decision models (Clef...) only judge, they belong to System 1
  useEffect(() => {
    if (provider !== 'ollama' || !baseUrl) return;
    api
      .listSystemOneModels(baseUrl)
      .then(models => {
        setInstalled(models.filter(m => !m.decision).map(m => m.name));
        setDecisionModels(models.filter(m => m.decision).map(m => m.name.replace(/:latest$/, '')));
      })
      .catch(() => setInstalled(current?.availableOllamaModels ?? []));
  }, [provider, baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidate = () => ({
    model: provider === 'fallback' ? undefined : model,
    baseUrl: WITH_URL.includes(provider) ? baseUrl : undefined,
    apiKey: WITH_KEY.includes(provider) && apiKey ? apiKey : undefined,
  });

  const apply = async () => {
    setStatus(null);
    try {
      const updates = provider === 'fallback' ? [] : [{ type: provider, config: { ...candidate(), enabled: true } }];
      const next = await api.updateAISettings({ activeProvider: provider, updates });
      load(next);
      onApplied?.(next);
      setStatus({ ok: true, text: t('settings.s2.applied', { model: provider === 'fallback' ? providerName('fallback') : model }) });
    } catch (err: any) {
      setStatus({ ok: false, text: err.message });
    }
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const result = await api.sampleSystemTwo({ provider, lang, ...candidate() });
      // Latest first, one line per provider and model
      setSamples(prev => [result, ...prev.filter(s => s.model !== result.model || s.provider !== result.provider)].slice(0, 8));
    } catch (err: any) {
      setStatus({ ok: false, text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const providerName = (p: AIProviderType) => t(`settings.s2.provider.${p}` as TranslationKey);
  const models = provider === 'ollama' && installed.length ? (model && !installed.includes(model) ? [model, ...installed] : installed) : null;
  const storedKey = current?.providers[provider]?.apiKey;
  const active = current ? current.providers[current.activeProvider] : undefined;

  return (
    <div className="space-y-4">
      {current && (
        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-300">
          {t('settings.s1.on', {
            model: current.activeProvider === 'fallback' ? providerName('fallback') : `${providerName(current.activeProvider)} · ${active?.model ?? ''}`,
          })}
        </span>
      )}
      <p className="text-[11px] text-slate-400">{t('settings.s2.body')}</p>

      <fieldset>
        <legend className="text-slate-300 font-bold uppercase tracking-wider text-[11px] font-mono mb-2">{t('settings.s1.provider')}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
          {PROVIDERS.map(p => (
            <button
              key={p}
              onClick={() => current && select(current, p)}
              aria-pressed={provider === p}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                provider === p ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500' : 'bg-dark-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-[11px]">{providerName(p)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t(`settings.s2.providerHint.${p}` as TranslationKey)}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
        {provider === 'fallback' ? (
          <p className="text-[11px] text-slate-300">{t('settings.s2.fallbackBody')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="s2-model" className="text-slate-400 block mb-1">{t('settings.model')}</label>
              {models ? (
                <select id="s2-model" value={model} onChange={e => setModel(e.target.value)} className={INPUT}>
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input id="s2-model" type="text" value={model} onChange={e => setModel(e.target.value)} className={INPUT} placeholder={PLACEHOLDER[provider].model} />
              )}
            </div>
            {WITH_URL.includes(provider) && (
              <div>
                <label htmlFor="s2-url" className="text-slate-400 block mb-1">{t('settings.s1.url')}</label>
                <input id="s2-url" type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className={INPUT} placeholder={PLACEHOLDER[provider].baseUrl} />
              </div>
            )}
            {WITH_KEY.includes(provider) && (
              <div>
                <label htmlFor="s2-key" className="text-slate-400 block mb-1">{t('settings.s1.key')}</label>
                <input id="s2-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={INPUT} placeholder={storedKey || '...'} autoComplete="off" />
              </div>
            )}
          </div>
        )}
        {provider === 'ollama' && decisionModels.length > 0 && (
          <p className="text-[11px] text-slate-400">{t('settings.s2.decisionHidden', { models: decisionModels.join(', ') })}</p>
        )}
        {provider === 'custom' && <p className="text-[11px] text-slate-400">{t('settings.custom.body')}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={test}
            disabled={testing || (provider !== 'fallback' && !model)}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Activity className="w-3 h-3 text-cyan-300" aria-hidden="true" />}
            {t('settings.s1.test')}
          </button>
          <button
            onClick={apply}
            disabled={provider !== 'fallback' && !model}
            className="px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-mono flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3 h-3" aria-hidden="true" />
            {t('settings.s2.apply')}
          </button>
          {status && (
            <span role="status" className={`text-[11px] font-mono flex items-center gap-1 ${status.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {status.ok ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <XCircle className="w-3.5 h-3.5" aria-hidden="true" />}
              {status.text}
            </span>
          )}
        </div>
      </div>

      {samples.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <caption className="text-left text-slate-400 mb-1">{t('settings.s2.compare')}</caption>
            <thead>
              <tr className="text-slate-400 text-left">
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.model')}</th>
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.latency')}</th>
                <th scope="col" className="py-1 font-normal">{t('settings.s2.reply')}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map(s => (
                <tr key={`${s.provider}-${s.model}`} className="border-t border-slate-800 text-slate-200 align-top">
                  <th scope="row" className="py-1.5 pr-2 font-normal text-left whitespace-nowrap">
                    {s.model} <span className="text-slate-400">({providerName(s.provider)})</span>
                  </th>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{s.latencyMs} ms</td>
                  <td className={`py-1.5 font-sans ${s.ok ? 'text-slate-200' : 'text-rose-300 break-words'}`}>{s.ok ? s.text : s.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-400 mt-1">{t('settings.s2.sample')}</p>
        </div>
      )}
      <p className="text-[10px] text-slate-400">{t('settings.fallbackChain')}</p>
      <p className="text-[10px] text-slate-400">{t('settings.s2.runtime')}</p>
    </div>
  );
};
