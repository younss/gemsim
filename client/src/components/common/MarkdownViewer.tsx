// ============================================================================
// GEMSIM: COMPILED MARKDOWN & MATHEMATICAL FORMULA VIEWER
// Renders rich Markdown (GFM), syntax-highlighted code, lists, and LaTeX equations
// ============================================================================

import React, { useMemo } from 'react';
import { marked } from 'marked';

interface Props {
  content: string;
  className?: string;
}

function cleanLatex(expr: string): string {
  return expr
    .trim()
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\times/g, '×')
    .replace(/\\sum/g, '∑')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\Big\(/g, '(')
    .replace(/\\Big\)/g, ')')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\%/g, '%')
    .replace(/\\/g, '');
}

export const MarkdownViewer: React.FC<Props> = ({ content, className = '' }) => {
  const html = useMemo(() => {
    if (!content) return '';

    // 1. Preprocess LaTeX math blocks: $$...$$
    let preprocessed = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      const cleaned = cleanLatex(math);
      return `<div class="gemsim-math-block my-3 p-3.5 rounded-xl bg-dark-950/80 border border-indigo-500/30 font-mono text-cyan-300 text-xs shadow-inner flex items-center gap-3 overflow-x-auto"><span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/40 tracking-wider">FORMULA</span><span class="text-cyan-200 font-mono">${cleaned}</span></div>`;
    });

    // 2. Preprocess inline LaTeX math: $...$ (avoiding currency $100)
    preprocessed = preprocessed.replace(/(^|[^\$])\$([a-zA-Z\\Δ∑][^\$\n]*?)\$([^\$]|$)/g, (_, before, math, after) => {
      const cleaned = cleanLatex(math);
      return `${before}<code class="font-mono text-indigo-300 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/50 text-[11px]">${cleaned}</code>${after}`;
    });

    // 3. Configure marked
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    // 4. Parse markdown to HTML
    return marked.parse(preprocessed) as string;
  }, [content]);

  return (
    <div
      className={`gemsim-markdown prose prose-invert max-w-none text-xs leading-relaxed text-slate-300 font-sans ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
