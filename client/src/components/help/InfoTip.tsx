// ============================================================================
// GEMSIM: ACCESSIBLE DEFINITION TOOLTIP
// Small "i" button next to a term; definition shows on hover and keyboard focus.
// ============================================================================

import React, { useId } from 'react';
import { Info } from 'lucide-react';

interface Props {
  text: string;
  label?: string; // accessible name, e.g. the term being defined
  className?: string;
  align?: 'left' | 'right';
}

export const InfoTip: React.FC<Props> = ({ text, label, className = '', align = 'left' }) => {
  const id = useId();
  return (
    <span className={`relative inline-flex items-center group align-middle ${className}`}>
      <button
        type="button"
        aria-label={label ? `${label} : ${text}` : text}
        aria-describedby={id}
        className="ml-1 text-slate-500 hover:text-cyan-300 focus:text-cyan-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded-full"
      >
        <Info className="w-3 h-3" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={id}
        // display:none until hover/focus so hidden tooltips never widen the page; aria-describedby still reads it
        className={`pointer-events-none absolute top-full mt-1.5 z-50 w-64 rounded-lg border border-slate-700 bg-dark-950 p-2.5 text-[11px] font-sans normal-case tracking-normal leading-relaxed text-slate-200 shadow-xl hidden group-hover:block group-focus-within:block ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
};
