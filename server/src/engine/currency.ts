// ============================================================================
// GEMSIM: CURRENCY
// Amounts are thousands in the scenario's currency (display only: the engine is
// currency-agnostic). Shared by the server (teaching notes) and the client.
// ============================================================================

import type { Scenario, ScenarioCurrency } from '../types/index.js';

export const CURRENCIES: ScenarioCurrency[] = ['USD', 'EUR', 'GBP', 'CHF', 'CAD'];

const SUFFIX: Record<ScenarioCurrency, string> = { USD: 'K$', EUR: 'K€', GBP: 'K£', CHF: 'K CHF', CAD: 'K$ CA' };

export function currencySuffix(scenario: Pick<Scenario, 'currency'> | null | undefined): string {
  return SUFFIX[scenario?.currency ?? 'USD'] ?? 'K$';
}

/** Rewrites amounts written in dollars ("350K$", "$350K") into the given suffix. */
export function withCurrency(text: string, suffix: string): string {
  if (suffix === 'K$') return text;
  return text.replace(/\$\s?(-?\d[\d,.   ]*)K\b/g, `$1${suffix}`).replace(/K\$/g, suffix);
}

/** "1 700K€" in French, "1,700K€" in English. */
export function formatMoney(value: number, lang: 'fr' | 'en', suffix: string): string {
  return `${Math.round(value).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}${suffix}`;
}
