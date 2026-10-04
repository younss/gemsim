// ============================================================================
// GEMSIM: PILOT PANEL (FACILITATOR)
// Opens and closes the pilot questionnaires, follows answers per team, and
// shows the learning gain, satisfaction and the protocol's success criteria,
// with CSV and Markdown exports for the pilot report.
// ============================================================================

import React, { useState } from 'react';
import { SimulationSession } from '../../types/index';
import { api } from '../../services/api';
import { PILOT_QUIZ, PILOT_SATISFACTION, PILOT_CRITERIA, pilotResults, quizScore } from '../../engine';
import { useI18n } from '../../i18n';
import { ClipboardCheck, Download, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

interface Props {
  session: SimulationSession;
  onSessionUpdated: (session: SimulationSession) => void;
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);
const num = (v: number | null) => (v === null ? '—' : String(v));

export const PilotPanel: React.FC<Props> = ({ session, onSessionUpdated }) => {
  const { t, lang } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const pilot = session.pilot ?? { preOpen: false, postOpen: false, responses: [] };
  const r = pilotResults(session);

  const toggle = async (phase: 'PRE' | 'POST', open: boolean) => {
    setError(null);
    try {
      onSessionUpdated(await api.setPilotPhase(session.id, phase, open));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const base = session.name.replace(/\s+/g, '_');
  const teamName = (id: string) => session.teams.find(tm => tm.id === id)?.name ?? id;
  const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const exportCsv = () => {
    const header = ['team', 'phase', ...PILOT_QUIZ.map(q => q.id), 'score', ...PILOT_SATISFACTION.map(s => s.id), 'hindrance', 'lesson', 'submittedAt'];
    const rows = pilot.responses.map(resp => [
      teamName(resp.teamId),
      resp.phase,
      ...PILOT_QUIZ.map((q, i) => (resp.answers[i] === q.answer ? 1 : 0)),
      quizScore(resp.answers),
      ...PILOT_SATISFACTION.map((_, i) => resp.satisfaction?.[i] ?? ''),
      resp.hindrance ?? '',
      resp.lesson ?? '',
      resp.submittedAt,
    ]);
    download(`${base}_pilot.csv`, [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n'), 'text/csv');
  };

  const verdict = (ok: boolean | null) => (ok === null ? t('pilot.criterion.pending') : ok ? t('pilot.criterion.met') : t('pilot.criterion.missed'));

  const exportMarkdown = () => {
    const lines = [
      `# ${t('pilot.report.title', { name: session.name })}`,
      '',
      t('pilot.report.counts', { pre: r.counts.pre, post: r.counts.post }),
      '',
      `## ${t('pilot.results.score')}`,
      '',
      `| ${t('pilot.col.before')} | ${t('pilot.col.after')} | ${t('pilot.col.gain')} | ${t('pilot.col.normalized')} |`,
      '| --- | --- | --- | --- |',
      `| ${num(r.score.pre)} / 7 | ${num(r.score.post)} / 7 | ${num(r.score.gain)} | ${pct(r.score.normalizedGain)} |`,
      '',
      `## ${t('pilot.results.questions')}`,
      '',
      `| ${t('pilot.col.question')} | ${t('pilot.col.before')} | ${t('pilot.col.after')} |`,
      '| --- | --- | --- |',
      ...PILOT_QUIZ.map((q, i) => `| ${q.text[lang]} | ${pct(r.questions[i].pre)} | ${pct(r.questions[i].post)} |`),
      '',
      `## ${t('pilot.results.satisfaction')}`,
      '',
      ...PILOT_SATISFACTION.map((s, i) => `- ${s.text[lang]} ${num(r.satisfaction[i].mean)} / 5 (n = ${r.satisfaction[i].n})`),
      '',
      `## ${t('pilot.results.criteria')}`,
      '',
      `- ${t('pilot.criterion.gain', { n: PILOT_CRITERIA.gain })} ${verdict(r.criteria.gain)}`,
      `- ${t('pilot.criterion.clarity', { n: PILOT_CRITERIA.clarity })} ${verdict(r.criteria.clarity)}`,
      `- ${t('pilot.criterion.lessons', { n: Math.round(PILOT_CRITERIA.lessonShare * 100) })} ${verdict(r.criteria.lessons)}`,
      '',
      `## ${t('pilot.results.lessons')}`,
      '',
      ...(r.lessons.length ? r.lessons.map(l => `- ${l}`) : ['—']),
      '',
      `## ${t('pilot.results.hindrances')}`,
      '',
      ...(r.hindrances.length ? r.hindrances.map(h => `- ${h}`) : ['—']),
    ];
    download(`${base}_pilot.md`, lines.join('\n'), 'text/markdown');
  };

  const Criterion: React.FC<{ ok: boolean | null; label: string }> = ({ ok, label }) => (
    <li className="flex items-center gap-2 text-xs">
      {ok === null ? (
        <MinusCircle className="w-4 h-4 text-slate-500" aria-hidden="true" />
      ) : ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
      ) : (
        <XCircle className="w-4 h-4 text-rose-400" aria-hidden="true" />
      )}
      <span className="text-slate-200">{label}</span>
      <span className="text-slate-400">— {verdict(ok)}</span>
    </li>
  );

  return (
    <div className="space-y-4">
      <section className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-3" aria-labelledby="pilot-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="pilot-title" className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              {t('pilot.title')}
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl">{t('pilot.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={!pilot.responses.length} className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-slate-200 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> CSV
            </button>
            <button onClick={exportMarkdown} disabled={!pilot.responses.length} className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-slate-200 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> {t('pilot.exportReport')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['PRE', 'POST'] as const).map(phase => {
            const open = phase === 'PRE' ? pilot.preOpen : pilot.postOpen;
            const n = phase === 'PRE' ? r.counts.pre : r.counts.post;
            return (
              <div key={phase} className="p-3 rounded-lg bg-dark-900 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-200">{t(phase === 'PRE' ? 'pilot.phase.pre' : 'pilot.phase.post')}</div>
                  <div className="text-[11px] text-slate-400">{t('pilot.answers', { n })}</div>
                </div>
                <button
                  onClick={() => toggle(phase, !open)}
                  aria-pressed={open}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                    open ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'bg-dark-800 border-slate-700 text-slate-300 hover:border-emerald-500/50'
                  }`}
                >
                  {open ? t('pilot.close') : t('pilot.open')}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">{t('pilot.privacy')}</p>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      </section>

      <section className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-3" aria-label={t('pilot.results.criteria')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
          {[
            [t('pilot.col.before'), `${num(r.score.pre)} / 7`],
            [t('pilot.col.after'), `${num(r.score.post)} / 7`],
            [t('pilot.col.gain'), r.score.gain === null ? '—' : `${r.score.gain > 0 ? '+' : ''}${r.score.gain}`],
            [t('pilot.col.normalized'), pct(r.score.normalizedGain)],
          ].map(([label, value]) => (
            <div key={label} className="p-3 rounded-lg bg-dark-900 border border-slate-800">
              <div className="text-[10px] font-mono uppercase text-slate-400">{label}</div>
              <div className="text-lg font-bold font-mono text-slate-100">{value}</div>
            </div>
          ))}
        </div>
        <h4 className="text-xs font-mono font-bold text-slate-300">{t('pilot.results.criteria')}</h4>
        <ul className="space-y-1">
          <Criterion ok={r.criteria.gain} label={t('pilot.criterion.gain', { n: PILOT_CRITERIA.gain })} />
          <Criterion ok={r.criteria.clarity} label={t('pilot.criterion.clarity', { n: PILOT_CRITERIA.clarity })} />
          <Criterion ok={r.criteria.lessons} label={t('pilot.criterion.lessons', { n: Math.round(PILOT_CRITERIA.lessonShare * 100) })} />
        </ul>
        <p className="text-[11px] text-slate-400">{t('pilot.criterion.observer')}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-dark-850 p-4 rounded-xl border border-slate-800 overflow-x-auto" aria-label={t('pilot.results.questions')}>
          <h4 className="text-xs font-mono font-bold text-slate-300 mb-2">{t('pilot.results.questions')}</h4>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-slate-400 font-mono">
              <tr>
                <th className="text-left py-1">{t('pilot.col.question')}</th>
                <th className="text-right py-1">{t('pilot.col.before')}</th>
                <th className="text-right py-1">{t('pilot.col.after')}</th>
              </tr>
            </thead>
            <tbody>
              {PILOT_QUIZ.map((q, i) => (
                <tr key={q.id} className="border-t border-slate-800">
                  <td className="py-1.5 pr-2 text-slate-300">{q.text[lang]}</td>
                  <td className="py-1.5 text-right font-mono text-slate-300">{pct(r.questions[i].pre)}</td>
                  <td className="py-1.5 text-right font-mono text-slate-100">{pct(r.questions[i].post)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-3" aria-label={t('pilot.results.satisfaction')}>
          <h4 className="text-xs font-mono font-bold text-slate-300">{t('pilot.results.teams')}</h4>
          <ul className="text-xs space-y-1">
            {r.teams.map(tm => (
              <li key={tm.teamId} className="flex justify-between text-slate-300">
                <span>{tm.teamName}</span>
                <span className="font-mono text-slate-400">
                  {num(tm.pre)} → {num(tm.post)} / 7 <span className="text-slate-500">(n {tm.n.pre} / {tm.n.post})</span>
                </span>
              </li>
            ))}
          </ul>
          <h4 className="text-xs font-mono font-bold text-slate-300">{t('pilot.results.satisfaction')}</h4>
          <ul className="text-xs space-y-1">
            {PILOT_SATISFACTION.map((s, i) => (
              <li key={s.id} className="flex justify-between gap-3 text-slate-300">
                <span>{s.text[lang]}</span>
                <span className="font-mono text-slate-100 shrink-0">{num(r.satisfaction[i].mean)} / 5</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(
          [
            ['pilot.results.lessons', r.lessons],
            ['pilot.results.hindrances', r.hindrances],
          ] as const
        ).map(([key, items]) => (
          <section key={key} className="bg-dark-850 p-4 rounded-xl border border-slate-800" aria-label={t(key)}>
            <h4 className="text-xs font-mono font-bold text-slate-300 mb-2">{t(key)}</h4>
            {items.length ? (
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">—</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};
