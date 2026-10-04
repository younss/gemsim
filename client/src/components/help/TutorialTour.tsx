// ============================================================================
// GEMSIM: GUIDED TUTORIAL
// Step-by-step tour of the arena: highlights each area (data-tour anchors),
// switches tabs when needed and explains the rules in plain language.
// ============================================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useHelpStore } from '../../stores/useHelpStore';
import { useI18n, TranslationKey } from '../../i18n';

export type ArenaTab = '3D' | 'INITIATIVES' | 'MARKET' | 'GOVERNANCE' | 'STAKEHOLDERS' | 'HISTORY';

interface Step {
  id: string;
  anchor?: string; // data-tour value
  tab?: ArenaTab;
  marketOnly?: boolean; // shown only for scenarios with a competitive market
}

const ALL_STEPS: Step[] = [
  { id: 'welcome' },
  { id: 'hud', anchor: 'hud' },
  { id: 'objectives', anchor: 'objectives' },
  { id: 'dossier', anchor: 'dossier' },
  { id: 'map', anchor: 'map', tab: '3D' },
  { id: 'portfolio', anchor: 'constraints', tab: 'INITIATIVES' },
  { id: 'market', anchor: 'market', tab: 'MARKET', marketOnly: true },
  { id: 'posture', anchor: 'posture', tab: 'GOVERNANCE' },
  { id: 'crisis', anchor: 'crisis', tab: 'GOVERNANCE' },
  { id: 'warroom', anchor: 'tab-STAKEHOLDERS', tab: 'STAKEHOLDERS' },
  { id: 'submit', anchor: 'submit' },
  { id: 'history', anchor: 'tab-HISTORY' },
  { id: 'help', anchor: 'help' },
  { id: 'done' },
];

interface Props {
  onTabChange: (tab: ArenaTab) => void;
  isSolo: boolean;
  hasMarket?: boolean;
  objectiveCount?: number;
  totalRounds?: number;
}

export const TutorialTour: React.FC<Props> = ({ onTabChange, isSolo, hasMarket = false, objectiveCount = 7, totalRounds = 4 }) => {
  const STEPS = ALL_STEPS.filter(s => hasMarket || !s.marketOnly);
  const { t } = useI18n();
  const endTutorial = useHelpStore(s => s.endTutorial);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index];

  // Switch to the step's tab, then locate and scroll to its anchor
  useEffect(() => {
    if (step.tab) onTabChange(step.tab);
  }, [index]);

  useLayoutEffect(() => {
    if (!step.anchor) {
      setRect(null);
      return;
    }
    let frame = 0;
    const locate = () => {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`) as HTMLElement | null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // re-measure while the smooth scroll settles
      const settle = (n: number) => {
        locate();
        if (n > 0) frame = window.requestAnimationFrame(() => settle(n - 1));
      };
      settle(40);
    }, 60);
    window.addEventListener('resize', locate);
    window.addEventListener('scroll', locate, true);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', locate);
      window.removeEventListener('scroll', locate, true);
    };
  }, [index]);

  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTutorial();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, endTutorial]);

  const isLast = index === STEPS.length - 1;
  const bodyKey = (step.id === 'submit' && isSolo ? 'tutorial.submit.solo.body' : `tutorial.${step.id}.body`) as TranslationKey;

  // Card placement: below the highlighted area when there is room, otherwise above; centred without anchor
  const margin = 12;
  const cardWidth = Math.min(380, window.innerWidth - 32);
  let cardStyle: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: cardWidth };
  if (rect) {
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - cardWidth - 16);
    const below = rect.bottom + margin;
    cardStyle =
      below + 220 < window.innerHeight
        ? { left, top: below, width: cardWidth }
        : { left, top: Math.max(16, rect.top - margin - 230), width: cardWidth };
  }

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Dimmed backdrop with a cut-out around the highlighted area */}
      {rect ? (
        <div
          className="fixed rounded-xl ring-2 ring-cyan-400 transition-all duration-200 pointer-events-none"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/75" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="fixed bg-dark-900 border border-cyan-500/50 rounded-2xl shadow-2xl p-5 space-y-3 focus:outline-none"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="tutorial-title" className="font-bold text-slate-100 flex items-center gap-2 text-sm">
            <GraduationCap className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            {t(`tutorial.${step.id}.title` as TranslationKey)}
          </h2>
          <span className="text-[10px] font-mono text-slate-500">
            {index + 1}/{STEPS.length}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{t(bodyKey, {
          n: objectiveCount,
          half: Math.ceil(objectiveCount / 2),
          last: totalRounds,
          duration: totalRounds === 1 ? t('studio.rounds.one') : t('studio.rounds.many', { n: totalRounds }),
        })}</p>
        <div className="flex items-center justify-between pt-1">
          <button onClick={endTutorial} className="text-[11px] text-slate-500 hover:text-slate-300">
            {t('tutorial.skip')}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button onClick={() => setIndex(i => i - 1)} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800">
                {t('common.previous')}
              </button>
            )}
            <button
              onClick={() => (isLast ? endTutorial() : setIndex(i => i + 1))}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400"
              autoFocus
            >
              {isLast ? t('tutorial.start') : t('common.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
