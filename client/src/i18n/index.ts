// ============================================================================
// GEMSIM: INTERFACE LANGUAGE (FR / EN)
// Flat dictionaries with {placeholders}; the chosen language persists per browser.
// ============================================================================

import { create } from 'zustand';
import { fr } from './fr';
import { en } from './en';
import type { Lang } from '../../../server/src/engine/vocabulary';

export type { Lang };
export type TranslationKey = keyof typeof fr;
export type Dictionary = Record<TranslationKey, string>;

const DICTIONARIES: Record<Lang, Dictionary> = { fr, en };
const STORAGE_KEY = 'gemsim_lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    // storage unavailable
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>(set => ({
  lang: initialLang(),
  setLang: lang => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // keep in memory only
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

export function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`)) : template;
}

/** React hook: current language, setter and translator. */
export function useI18n() {
  const lang = useLangStore(state => state.lang);
  const setLang = useLangStore(state => state.setLang);
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  return { lang, setLang, t };
}
