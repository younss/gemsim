// ============================================================================
// GEMSIM: MARKET PANEL
// Prices, marketing and market entries per segment, with a live projection of
// demand, share and P&L computed by the same clearing function as the server.
// ============================================================================

import React from 'react';
import { MarketDecision, MarketSegmentResult, Scenario, SimulationSession, Team } from '../../types/index';
import { clearMarket, rivalPrice, segmentDemand, teamPresence, MARKET_PRICE_BOUNDS } from '../../engine';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { InfoTip } from '../help/InfoTip';
import { AlertTriangle, Globe2, Store, TrendingUp, Users } from 'lucide-react';

interface Props {
  scenario: Scenario;
  session: SimulationSession;
  team: Team;
  decision: MarketDecision;
  onChange: (decision: MarketDecision) => void;
  disabled: boolean;
}

type DriverKey = keyof MarketSegmentResult['drivers'];
const DRIVERS: DriverKey[] = ['price', 'quality', 'availability', 'reliability', 'marketing'];
const CRITERIA: Array<{ key: 'priceSensitivity' | 'qualitySensitivity' | 'speedSensitivity' | 'reliabilitySensitivity'; driver: DriverKey }> = [
  { key: 'priceSensitivity', driver: 'price' },
  { key: 'qualitySensitivity', driver: 'quality' },
  { key: 'speedSensitivity', driver: 'availability' },
  { key: 'reliabilitySensitivity', driver: 'reliability' },
];

export const MarketPanel: React.FC<Props> = ({ scenario, session, team, decision, onChange, disabled }) => {
  const { t, lang } = useGameText(scenario);
  const market = scenario.market!;
  const round = session.currentRound;
  const presence = teamPresence(scenario, team);
  const entering = decision.enter ?? [];

  const money = (v: number) => `${Math.round(v).toLocaleString(lang)}K$`;
  const price = (v: number) => `${v.toLocaleString(lang, { maximumFractionDigits: 2 })}K$`;

  // Other teams are projected on last quarter's public prices: their new prices stay secret
  const others = session.teams.filter(o => o.id !== team.id).map(o => ({ team: o, decision: o.lastMarketDecision }));
  const projection = clearMarket(scenario, [{ team, decision }, ...others], round)[team.id];
  const bySegment = new Map(projection?.segments.map(s => [s.segmentId, s]) ?? []);

  const setPrice = (segmentId: string, value: number) => onChange({ ...decision, prices: { ...decision.prices, [segmentId]: Math.round(value * 100) / 100 } });
  const setMarketing = (segmentId: string, value: number) =>
    onChange({ ...decision, marketing: { ...decision.marketing, [segmentId]: Math.max(0, Math.round(value) || 0) } });
  const toggleEntry = (segmentId: string) => {
    const enter = entering.includes(segmentId) ? entering.filter(id => id !== segmentId) : [...entering, segmentId];
    const marketing = enter.includes(segmentId) ? decision.marketing : { ...decision.marketing, [segmentId]: 0 };
    onChange({ ...decision, enter, marketing });
  };

  const summary: Array<{ label: string; value: string; tone?: string; help: string }> = projection
    ? [
        { label: t('market.proj.revenue'), value: money(projection.revenue), help: t('market.help.revenue') },
        { label: t('market.proj.share'), value: `${projection.marketShare} %`, help: t('market.help.share') },
        {
          label: t('market.proj.profit'),
          value: money(projection.operatingProfit),
          tone: projection.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400',
          help: t('market.help.profit'),
        },
        {
          label: t('market.proj.cash'),
          value: `${projection.programCashDelta >= 0 ? '+' : ''}${money(projection.programCashDelta)}`,
          tone: projection.programCashDelta >= 0 ? 'text-emerald-400' : 'text-rose-400',
          help: t('market.help.cash', { retention: Math.round(market.cashRetention * 100) }),
        },
      ]
    : [];

  const utilisation = projection && projection.capacityUnits > 0 ? Math.min(100, Math.round((projection.unitsSold / projection.capacityUnits) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Store className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            {t('market.title')}
            <InfoTip label={t('market.title')} text={t('market.help.model')} />
          </h3>
          <p className="text-xs text-slate-400">{t('market.subtitle')}</p>
          <p className="text-[11px] text-amber-300/90 mt-1">{t('market.lag')}</p>
        </div>
      </div>

      {/* Projection summary */}
      <div data-tour="market" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map(card => (
          <div key={card.label} className="bg-dark-850 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
              {card.label}
              <InfoTip label={card.label} text={card.help} />
            </div>
            <div className={`text-lg font-bold font-mono ${card.tone ?? 'text-slate-100'}`}>{card.value}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 font-mono -mt-2">{t('market.proj.estimate')}</p>

      {projection && (
        <div className="bg-dark-850 p-3 rounded-xl border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">{t('market.capacity', { sold: projection.unitsSold.toLocaleString(lang), capacity: projection.capacityUnits.toLocaleString(lang) })}</span>
            <span className={utilisation >= 99 ? 'text-amber-400' : 'text-slate-400'}>{utilisation} %</span>
          </div>
          <div className="h-2 bg-dark-900 rounded-full overflow-hidden" role="progressbar" aria-valuenow={utilisation} aria-valuemin={0} aria-valuemax={100} aria-label={t('market.capacityLabel')}>
            <div className={`h-full ${utilisation >= 99 ? 'bg-amber-400' : 'bg-cyan-500'}`} style={{ width: `${utilisation}%` }} />
          </div>
          {projection.lostSales > 0 && (
            <p className="text-[11px] text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              {t('market.lostSales', { units: projection.lostSales.toLocaleString(lang) })}
            </p>
          )}
        </div>
      )}

      {/* Segments */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {market.segments.map(seg => {
          const open = presence.includes(seg.id);
          const isEntering = entering.includes(seg.id);
          const active = open || isEntering;
          const p = decision.prices[seg.id] ?? seg.referencePrice;
          const index = Math.round((p / seg.referencePrice) * 100);
          const res = bySegment.get(seg.id);
          const rivals = market.rivals.filter(r => !r.segmentIds || r.segmentIds.includes(seg.id));
          return (
            <section key={seg.id} aria-label={seg.name} className={`p-4 rounded-xl border ${active ? 'bg-dark-850 border-slate-700' : 'bg-dark-900 border-slate-800 border-dashed'} space-y-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    {open ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Globe2 className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
                    {seg.name}
                  </h4>
                  {seg.description && <p className="text-[11px] text-slate-400">{seg.description}</p>}
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0 text-right">
                  {t('market.seg.demand', { units: Math.round(segmentDemand(seg, round)).toLocaleString(lang), growth: Math.round(seg.growth * 100) })}
                </span>
              </div>

              {/* What customers weigh */}
              <div>
                <div className="text-[10px] font-mono text-slate-500 mb-1">{t('market.criteria.title')}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CRITERIA.map(c => (
                    <div key={c.key} className="text-[10px] text-slate-400">
                      <div className="truncate">{t(`market.criteria.${c.driver}` as TranslationKey)}</div>
                      <div className="h-1.5 bg-dark-900 rounded-full overflow-hidden" aria-hidden="true">
                        <div className="h-full bg-indigo-400" style={{ width: `${Math.round(seg[c.key] * 100)}%` }} />
                      </div>
                      <span className="sr-only">{Math.round(seg[c.key] * 100)} %</span>
                    </div>
                  ))}
                </div>
              </div>

              {!open && (
                <button
                  onClick={() => toggleEntry(seg.id)}
                  disabled={disabled}
                  aria-pressed={isEntering}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-mono font-bold border disabled:opacity-50 ${
                    isEntering ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-dark-800 border-slate-700 text-slate-300 hover:border-amber-500/50'
                  }`}
                >
                  {isEntering ? t('market.seg.entering', { cost: seg.entryCost ?? 0 }) : t('market.seg.enter', { cost: seg.entryCost ?? 0 })}
                </button>
              )}

              {active && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-[11px] text-slate-400 space-y-1 block">
                      <span className="flex justify-between">
                        <span>{t('market.seg.price')}</span>
                        <span className="font-mono text-slate-200">{price(p)} · {index} %</span>
                      </span>
                      <input
                        type="range"
                        min={Math.round(seg.referencePrice * MARKET_PRICE_BOUNDS.min * 100) / 100}
                        max={Math.round(seg.referencePrice * MARKET_PRICE_BOUNDS.max * 100) / 100}
                        step={Math.max(0.01, Math.round(seg.referencePrice * 0.01 * 100) / 100)}
                        value={p}
                        disabled={disabled}
                        onChange={e => setPrice(seg.id, Number(e.target.value))}
                        className="w-full accent-cyan-500"
                        aria-valuetext={`${price(p)}, ${index} %`}
                      />
                      <span className="text-[10px] text-slate-500">{t('market.seg.reference', { price: price(seg.referencePrice) })}</span>
                    </label>
                    <label className="text-[11px] text-slate-400 space-y-1 block">
                      <span>{t('market.seg.marketing')}</span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={decision.marketing[seg.id] ?? 0}
                        disabled={disabled}
                        onChange={e => setMarketing(seg.id, Number(e.target.value))}
                        className="w-full bg-dark-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500">{t('market.seg.marketingHint')}</span>
                    </label>
                  </div>

                  {res && (
                    <div className="bg-dark-900 p-2.5 rounded-lg border border-slate-800 space-y-2">
                      <div className="text-xs font-mono text-cyan-300">
                        {t('market.seg.projected', { share: Math.round(res.share * 1000) / 10, units: res.unitsSold.toLocaleString(lang), revenue: res.revenue.toLocaleString(lang) })}
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-slate-500 mb-1">{t('market.drivers.title')}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {DRIVERS.map(d => (
                            <span
                              key={d}
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                res.drivers[d] > 0.05 ? 'border-emerald-500/40 text-emerald-300' : res.drivers[d] < -0.05 ? 'border-rose-500/40 text-rose-300' : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              {t(`market.criteria.${d}` as TranslationKey)} {res.drivers[d] > 0 ? '+' : ''}{res.drivers[d].toFixed(2)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {rivals.length > 0 && (
                <ul className="text-[10px] text-slate-500 space-y-0.5">
                  {rivals.map(r => (
                    <li key={r.id}>{t('market.rival.line', { name: r.name, price: price(rivalPrice(r, seg, round)), quality: r.quality })}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Competitors and P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-dark-850 p-4 rounded-xl border border-slate-800 space-y-2" aria-label={t('market.competitors.title')}>
          <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
            {t('market.competitors.title')}
          </h4>
          <ul className="text-xs space-y-1">
            {session.teams
              .filter(o => o.id !== team.id)
              .map(o => (
                <li key={o.id} className="flex justify-between text-slate-300">
                  <span>{o.avatar} {o.name}</span>
                  <span className="font-mono text-slate-400">{o.metrics.marketShare !== undefined ? `${o.metrics.marketShare} %` : '—'}</span>
                </li>
              ))}
            {projection?.rivals.map(r => (
              <li key={r.id} className="flex justify-between text-slate-400">
                <span>🏢 {r.name}</span>
                <span className="font-mono">{t('market.competitors.rivalShare', { share: r.share })}</span>
              </li>
            ))}
          </ul>
          {session.teams.length > 1 && <p className="text-[10px] text-slate-500">{t('market.competitors.secret')}</p>}
        </section>

        {projection && (
          <section className="bg-dark-850 p-4 rounded-xl border border-slate-800" aria-label={t('market.pl.title')}>
            <h4 className="text-xs font-mono font-bold text-slate-300 mb-2">{t('market.pl.title')}</h4>
            <PnL result={projection} money={money} />
          </section>
        )}
      </div>
    </div>
  );
};

/** Profit and loss lines of a market result, shared by the projection and the quarter history. */
export const PnL: React.FC<{ result: NonNullable<ReturnType<typeof clearMarket>[string]>; money: (v: number) => string }> = ({ result, money }) => {
  const { t } = useGameText(null);
  const lines: Array<[TranslationKey, number, boolean?]> = [
    ['market.pl.revenue', result.revenue],
    ['market.pl.variable', -result.variableCost],
    ['market.pl.margin', result.grossMargin, true],
    ['market.pl.fixed', -result.fixedCosts],
    ['market.pl.opex', -result.opEx],
    ['market.pl.marketing', -result.marketing],
    ['market.pl.result', result.operatingProfit, true],
  ];
  return (
    <table className="w-full text-xs font-mono">
      <tbody>
        {lines.map(([key, value, strong]) => (
          <tr key={key} className={strong ? 'border-t border-slate-700' : ''}>
            <td className={`py-0.5 ${strong ? 'text-slate-200 font-bold' : 'text-slate-400'}`}>{t(key)}</td>
            <td className={`py-0.5 text-right ${strong ? (value >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold') : 'text-slate-300'}`}>{money(value)}</td>
          </tr>
        ))}
        {result.entryCosts > 0 && (
          <tr>
            <td className="py-0.5 text-slate-400">{t('market.pl.entries')}</td>
            <td className="py-0.5 text-right text-slate-300">{money(-result.entryCosts)}</td>
          </tr>
        )}
        <tr className="border-t border-slate-700">
          <td className="py-0.5 text-cyan-300 font-bold">{t('market.pl.cash')}</td>
          <td className={`py-0.5 text-right font-bold ${result.programCashDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {result.programCashDelta >= 0 ? '+' : ''}
            {money(result.programCashDelta)}
          </td>
        </tr>
      </tbody>
    </table>
  );
};
