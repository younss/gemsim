// ============================================================================
// GEMSIM: PILOT QUESTIONNAIRE (PLAYER)
// When the facilitator opens the before/after questionnaire, each participant
// answers anonymously from their team's screen. The browser remembers that it
// answered (random respondent id), so nobody is asked twice.
// ============================================================================

import React, { useState } from 'react';
import { SimulationSession, Team } from '../../types/index';
import { api } from '../../services/api';
import { PILOT_QUIZ, PILOT_SATISFACTION } from '../../engine';
import { useI18n } from '../../i18n';
import { useDialogFocus } from '../common/useDialogFocus';
import { ClipboardCheck, X } from 'lucide-react';

type Phase = 'PRE' | 'POST';
interface Memory {
  respondentId: string;
  done: Partial<Record<Phase, boolean>>;
}

function memoryKey(sessionId: string) {
  return `gemsim_pilot_${sessionId}`;
}

function readMemory(sessionId: string): Memory {
  try {
    const raw = localStorage.getItem(memoryKey(sessionId));
    if (raw) return JSON.parse(raw);
  } catch {
    // storage unavailable: a new id is generated (the server still rejects duplicates per id)
  }
  const respondentId = `r-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return { respondentId, done: {} };
}

function writeMemory(sessionId: string, memory: Memory) {
  try {
    localStorage.setItem(memoryKey(sessionId), JSON.stringify(memory));
  } catch {
    // ignore
  }
}

/** Banner + questionnaire dialog, shown while a phase is open and this browser has not answered it. */
export const PilotQuiz: React.FC<{ session: SimulationSession; team: Team }> = ({ session, team }) => {
  const { t, lang } = useI18n();
  const [memory, setMemory] = useState<Memory>(() => readMemory(session.id));
  const [phase, setPhase] = useState<Phase | null>(null);
  const [answers, setAnswers] = useState<number[]>(() => PILOT_QUIZ.map(() => -1));
  const [satisfaction, setSatisfaction] = useState<number[]>(() => PILOT_SATISFACTION.map(() => 0));
  const [hindrance, setHindrance] = useState('');
  const [lesson, setLesson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const dialogRef = useDialogFocus(phase !== null, () => setPhase(null));

  const pending: Phase | null = session.pilot?.postOpen && !memory.done.POST ? 'POST' : session.pilot?.preOpen && !memory.done.PRE ? 'PRE' : null;
  if (!pending && !phase) return null;

  const start = (p: Phase) => {
    setAnswers(PILOT_QUIZ.map(() => -1));
    setSatisfaction(PILOT_SATISFACTION.map(() => 0));
    setHindrance('');
    setLesson('');
    setError(null);
    setPhase(p);
  };

  const finish = (p: Phase) => {
    const next = { ...memory, done: { ...memory.done, [p]: true } };
    writeMemory(session.id, next);
    setMemory(next);
    setPhase(null);
  };

  const submit = async () => {
    if (!phase) return;
    setSending(true);
    setError(null);
    try {
      await api.submitPilotResponse(session.id, {
        teamId: team.id,
        phase,
        respondentId: memory.respondentId,
        answers,
        ...(phase === 'POST'
          ? { satisfaction, hindrance: hindrance.trim() || undefined, lesson: lesson.trim() || undefined }
          : {}),
      });
      finish(phase);
    } catch (err: any) {
      if (err.code === 'PILOT_DUPLICATE') finish(phase);
      else setError(err.code === 'PILOT_CLOSED' ? t('pilot.quiz.closed') : err.message);
    } finally {
      setSending(false);
    }
  };

  const complete = answers.every(a => a >= 0) && (phase !== 'POST' || satisfaction.every(v => v > 0));

  return (
    <>
      {pending && !phase && (
        <div role="status" className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-emerald-200 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
            {t(pending === 'PRE' ? 'pilot.quiz.bannerPre' : 'pilot.quiz.bannerPost')}
          </span>
          <button onClick={() => start(pending)} className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold">
            {t('pilot.quiz.start')}
          </button>
        </div>
      )}

      {phase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pilot-quiz-title"
            className="bg-dark-900 border border-emerald-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3">
              <div>
                <h2 id="pilot-quiz-title" className="text-sm font-bold text-slate-100">
                  {t(phase === 'PRE' ? 'pilot.phase.pre' : 'pilot.phase.post')}
                </h2>
                <p className="text-xs text-slate-400">{t('pilot.quiz.intro')}</p>
              </div>
              <button onClick={() => setPhase(null)} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div tabIndex={0} className="overflow-y-auto p-4 space-y-4 focus:outline-none">
              {PILOT_QUIZ.map((q, i) => (
                <fieldset key={q.id} className="space-y-1.5">
                  <legend className="text-xs font-bold text-slate-200 mb-1">
                    {i + 1}. {q.text[lang]}
                  </legend>
                  {q.options.map((o, j) => (
                    <label key={j} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`${phase}-${q.id}`}
                        checked={answers[i] === j}
                        onChange={() => setAnswers(a => a.map((v, k) => (k === i ? j : v)))}
                        className="w-5 h-5 shrink-0 accent-emerald-500"
                      />
                      <span>{o[lang]}</span>
                    </label>
                  ))}
                </fieldset>
              ))}

              {phase === 'POST' && (
                <>
                  <h3 className="text-xs font-mono font-bold text-emerald-300 pt-2">{t('pilot.quiz.satisfaction')}</h3>
                  {PILOT_SATISFACTION.map((s, i) => (
                    <fieldset key={s.id}>
                      <legend className="text-xs text-slate-200 mb-1">{s.text[lang]}</legend>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(v => (
                          <label key={v} className="flex flex-col items-center gap-0.5 text-[11px] text-slate-400 cursor-pointer">
                            <input
                              type="radio"
                              name={`sat-${s.id}`}
                              checked={satisfaction[i] === v}
                              onChange={() => setSatisfaction(a => a.map((x, k) => (k === i ? v : x)))}
                              className="w-5 h-5 accent-emerald-500"
                              aria-label={t('pilot.quiz.scale', { v })}
                            />
                            {v}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <label className="block text-xs text-slate-200 space-y-1">
                    <span>{t('pilot.quiz.lesson')}</span>
                    <textarea value={lesson} onChange={e => setLesson(e.target.value)} rows={2} maxLength={1000} className="w-full bg-dark-950 border border-slate-700 rounded-lg p-2 text-slate-100" />
                  </label>
                  <label className="block text-xs text-slate-200 space-y-1">
                    <span>{t('pilot.quiz.hindrance')}</span>
                    <textarea value={hindrance} onChange={e => setHindrance(e.target.value)} rows={2} maxLength={1000} className="w-full bg-dark-950 border border-slate-700 rounded-lg p-2 text-slate-100" />
                  </label>
                  <p className="text-[11px] text-slate-400">{t('pilot.quiz.noPersonalData')}</p>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
              {error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : <span className="text-[11px] text-slate-400">{t('pilot.quiz.anonymous')}</span>}
              <button
                onClick={submit}
                disabled={!complete || sending}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-40"
              >
                {t('pilot.quiz.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
