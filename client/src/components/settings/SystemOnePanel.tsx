// ============================================================================
// GEMSIM: SYSTEM 1 SETTINGS (JUDGMENTS)
// The model that judges proposals, board votes and Studio elements, configured
// apart from System 2 (writing). On Ollama, a decision model (Clef) answers
// natively; any other model (Ollama, Gemini, Claude, OpenAI, OpenAI-compatible)
// emulates it. The facilitator compares
// configurations on the same sample judgment before applying one.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { api, SystemOneModel, SystemOneProvider, SystemOneSample, SystemOneSettings } from '../../services/api';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { Activity, CheckCircle2, RefreshCw, Save, XCircle } from 'lucide-react';

const INPUT = 'w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono';
const PROVIDERS: SystemOneProvider[] = ['ollama', 'gemini', 'claude', 'openai', 'custom'];
const LOCAL: SystemOneProvider[] = ['ollama'];
const WITH_URL: SystemOneProvider[] = ['ollama', 'custom'];

export const SystemOnePanel: React.FC = () => {
  const { t } = useI18n();
  const [current, setCurrent] = useState<SystemOneSettings | null>(null);
  const [provider, setProvider] = useState<SystemOneProvider>('ollama');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [timeoutS, setTimeoutS] = useState(20);
  const [enabled, setEnabled] = useState(true);
  const [installed, setInstalled] = useState<SystemOneModel[]>([]);
  const [samples, setSamples] = useState<SystemOneSample[]>([]);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (s: SystemOneSettings) => {
    setCurrent(s);
    setProvider(s.provider);
    setBaseUrl(s.baseUrl);
    // "clef-flash" and "clef-flash:latest" are the same model: show the installed tag
    setModel(s.models.some(m => m.name === `${s.model}:latest`) ? `${s.model}:latest` : s.model);
    setApiKey('');
    setTimeoutS(Math.round(s.timeoutMs / 1000));
    setEnabled(s.enabled);
    setInstalled(s.models);
  };

  useEffect(() => {
    api.getSystemOneSettings().then(load).catch(() => setStatus({ ok: false, text: t('settings.s1.unreachable') }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Local servers list their installed models
  useEffect(() => {
    if (!LOCAL.includes(provider) || !baseUrl) return;
    api.listSystemOneModels(baseUrl).then(setInstalled).catch(() => setInstalled([]));
  }, [provider, baseUrl]);

  const switchProvider = (p: SystemOneProvider) => {
    setProvider(p);
    const keep = current?.provider === p;
    setBaseUrl(keep ? current!.baseUrl : current?.defaults[p].baseUrl ?? '');
    setModel(keep ? current!.model : current?.defaults[p].model ?? '');
    setApiKey('');
  };

  const candidate = () => ({
    provider,
    baseUrl: WITH_URL.includes(provider) ? baseUrl : '',
    model,
    apiKey: apiKey || undefined,
    timeoutMs: timeoutS * 1000,
  });

  const apply = async () => {
    setStatus(null);
    try {
      load(await api.updateSystemOneSettings({ ...candidate(), enabled }));
      setStatus({ ok: true, text: t('settings.s1.applied', { model }) });
    } catch (err: any) {
      setStatus({ ok: false, text: err.message });
    }
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const result = await api.sampleSystemOne(candidate());
      // Latest first, one line per provider and model
      setSamples(prev => [result, ...prev.filter(s => s.model !== result.model || s.provider !== result.provider)].slice(0, 8));
    } catch (err: any) {
      setStatus({ ok: false, text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const pct = (v?: number) => (v === undefined ? '-' : `${Math.round(v * 100)} %`);
  const providerName = (p: SystemOneProvider) => t(`settings.s1.provider.${p}` as TranslationKey);
  const models: SystemOneModel[] | null =
    LOCAL.includes(provider) && installed.length
      ? model && !installed.some(m => m.name === model)
        ? [{ name: model, decision: false }, ...installed]
        : installed
      : null;
  // Native only for an Ollama decision model (Clef); everything else is emulated
  const native = provider === 'ollama' && !!installed.find(m => m.name === model || m.name === `${model}:latest`)?.decision;
  const engineName = (s: { provider: SystemOneProvider; native?: boolean }) =>
    `${providerName(s.provider)} · ${t(s.native ? 'settings.s1.native' : 'settings.s1.emulatedShort')}`;
  const storedKey = current?.provider === provider ? current.apiKey : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {current && (
          <span className={`text-[11px] px-2 py-0.5 rounded font-mono ${current.enabled && current.circuit !== 'OPEN' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
            {!current.enabled
              ? t('settings.s1.off')
              : current.circuit === 'OPEN'
                ? t('settings.s1.paused')
                : t('settings.s1.on', { model: `${providerName(current.provider)} · ${current.model}` })}
          </span>
        )}
        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 accent-violet-500" />
          {t('settings.s1.enabled')}
        </label>
      </div>
      <p className="text-[11px] text-slate-400">{t('settings.s1.body')}</p>

      <fieldset>
        <legend className="text-slate-300 font-bold uppercase tracking-wider text-[11px] font-mono mb-2">{t('settings.s1.provider')}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
          {PROVIDERS.map(p => (
            <button
              key={p}
              onClick={() => switchProvider(p)}
              aria-pressed={provider === p}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                provider === p ? 'bg-violet-500/20 text-violet-200 border-violet-500' : 'bg-dark-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-[11px]">{providerName(p)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t(`settings.s1.providerHint.${p}` as TranslationKey)}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="s1-model" className="text-slate-400 block mb-1">{t('settings.model')}</label>
            {models ? (
              <select id="s1-model" value={model} onChange={e => setModel(e.target.value)} className={INPUT}>
                {models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.decision ? `${m.name} · ${t('settings.s1.decisionModel')}` : m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input id="s1-model" type="text" value={model} onChange={e => setModel(e.target.value)} className={INPUT} placeholder={current?.defaults[provider].model} />
            )}
          </div>
          {WITH_URL.includes(provider) && (
            <div>
              <label htmlFor="s1-url" className="text-slate-400 block mb-1">{t('settings.s1.url')}</label>
              <input id="s1-url" type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className={INPUT} placeholder={current?.defaults[provider].baseUrl} />
            </div>
          )}
          {!LOCAL.includes(provider) && (
            <div>
              <label htmlFor="s1-key" className="text-slate-400 block mb-1">{t('settings.s1.key')}</label>
              <input id="s1-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={INPUT} placeholder={storedKey || '...'} autoComplete="off" />
            </div>
          )}
          <div>
            <label htmlFor="s1-timeout" className="text-slate-400 block mb-1">{t('settings.s1.timeout')}</label>
            <input id="s1-timeout" type="number" min={1} max={120} value={timeoutS} onChange={e => setTimeoutS(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} className={INPUT} />
          </div>
        </div>
        <p className={`text-[11px] ${native ? 'text-emerald-300/90' : 'text-amber-300/90'}`}>{native ? t('settings.s1.nativeBody', { model: model.replace(/:latest$/, '') }) : t('settings.s1.emulated')}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={test}
            disabled={testing || !model}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Activity className="w-3 h-3 text-violet-300" aria-hidden="true" />}
            {t('settings.s1.test')}
          </button>
          <button
            onClick={apply}
            disabled={!model}
            className="px-3 py-1.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-500/40 font-mono flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3 h-3" aria-hidden="true" />
            {t('settings.s1.apply')}
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
            <caption className="text-left text-slate-400 mb-1">{t('settings.s1.compare')}</caption>
            <thead>
              <tr className="text-slate-400 text-left">
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.model')}</th>
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.verdict')}</th>
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.confidence')}</th>
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.effort')}</th>
                <th scope="col" className="py-1 pr-2 font-normal">{t('settings.s1.concession')}</th>
                <th scope="col" className="py-1 font-normal">{t('settings.s1.latency')}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map(s => (
                <tr key={`${s.provider}-${s.model}`} className="border-t border-slate-800 text-slate-200">
                  <th scope="row" className="py-1 pr-2 font-normal text-left">
                    {s.model} <span className="text-slate-400">({engineName(s)})</span>
                  </th>
                  {s.ok ? (
                    <>
                      <td className="py-1 pr-2">{t(`settings.s1.verdict.${s.verdict!.choice}` as TranslationKey)}</td>
                      <td className="py-1 pr-2">{pct(s.verdict!.confidence)}</td>
                      <td className="py-1 pr-2">{pct(s.effort)}</td>
                      <td className="py-1 pr-2">{pct(s.concession)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="py-1 pr-2 text-rose-300 break-words">{s.message}</td>
                  )}
                  <td className="py-1">{s.latencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-400 mt-1">{t('settings.s1.sample')}</p>
        </div>
      )}
      <p className="text-[10px] text-slate-400">{t('settings.s1.runtime')}</p>
    </div>
  );
};
