// ============================================================================
// GEMSIM: MAP SIDE PANEL
// Next to the 3D map: the selected element's details, or the elements of the
// current plan ranked from most fragile to healthiest (keyboard accessible).
// ============================================================================

import React from 'react';
import { EnterpriseLayer, Scenario, Team, TopologyNode } from '../../types/index';
import { useGameText } from '../../i18n/game';
import type { TranslationKey } from '../../i18n';
import { AlertTriangle, ArrowLeft, MapPin } from 'lucide-react';

interface Props {
  scenario: Scenario;
  team: Team;
  layer: EnterpriseLayer | 'ALL';
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
}

const STATUS_DOT: Record<TopologyNode['status'], string> = {
  CRITICAL: 'bg-rose-500',
  DEGRADED: 'bg-amber-400',
  HEALTHY: 'bg-emerald-400',
  MODERNIZED: 'bg-cyan-400',
};

export const MapSidePanel: React.FC<Props> = ({ scenario, team, layer, selectedNodeId, onSelect }) => {
  const { t, vocab, money } = useGameText(scenario);
  // Current state of each element (health and debt evolve during the game)
  const nodes = scenario.topology.nodes.map(n => ({ ...n, ...(team.nodeHealthOverrides?.[n.id] ?? {}) }));
  const visible = nodes.filter(n => layer === 'ALL' || n.layer === layer).sort((a, b) => b.technicalDebt - a.technicalDebt);
  const selected = nodes.find(n => n.id === selectedNodeId);
  const status = (s: string) => t(`canvas.status.${s}` as TranslationKey);
  const layerName = (l: EnterpriseLayer) => vocab.layers[l] ?? l;

  if (selected) {
    const dependsOn = selected.dependencies.map(id => nodes.find(n => n.id === id)?.name).filter(Boolean);
    return (
      <section aria-label={selected.name} className="bg-dark-850 rounded-xl border border-slate-800 p-4 space-y-3 h-full overflow-y-auto">
        <button onClick={() => onSelect(null)} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          {t('map.back')}
        </button>
        <div className="space-y-1">
          <h3 className="font-bold text-slate-100 text-base">{selected.name}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">{layerName(selected.layer)}</span>
            {selected.criticalPath && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 font-mono flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {t('canvas.criticalPath')}
              </span>
            )}
          </div>
          {selected.description && <p className="text-xs text-slate-300">{selected.description}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs font-mono">
          {[
            [t('canvas.health'), `${status(selected.status)} (${selected.health}/100)`, selected.health >= 70 ? 'text-emerald-400' : 'text-amber-400'],
            [t('canvas.debt'), `${selected.technicalDebt} %`, selected.technicalDebt >= 60 ? 'text-rose-400' : 'text-emerald-400'],
            [t('canvas.flow'), `${selected.telemetry.throughputRps} | ${selected.telemetry.latencyMs} ms`, 'text-cyan-300'],
            [t('canvas.cost'), `${money(selected.costPerRound)} / ${t('common.quarter').toLowerCase()}`, 'text-slate-100'],
          ].map(([label, value, tone]) => (
            <div key={label} className="bg-dark-900 p-2 rounded border border-slate-800">
              <dt className="text-[10px] text-slate-400">{label}</dt>
              <dd className={`font-bold ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {dependsOn.length > 0 && (
          <p className="text-[11px] text-slate-400">
            {t('map.dependsOn')} <span className="text-slate-200">{dependsOn.join(', ')}</span>
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label={t('map.list')} className="bg-dark-850 rounded-xl border border-slate-800 p-4 flex flex-col h-full min-h-0">
      <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
        {layer === 'ALL' ? t('map.list') : t('map.listLayer', { layer: layerName(layer) })}
        <span className="text-slate-500 font-normal">({visible.length})</span>
      </h3>
      <p className="text-[11px] text-slate-400 mb-2">{t('map.hint')}</p>
      <ul className="space-y-1.5 overflow-y-auto min-h-0">
        {visible.map(n => (
          <li key={n.id}>
            <button
              onClick={() => onSelect(n.id)}
              className="w-full text-left p-2 rounded-lg bg-dark-900 border border-slate-800 hover:border-cyan-500/50 flex items-center gap-2 text-xs"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[n.status]}`} aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-slate-100 truncate">{n.name}</span>
                <span className="block text-[10px] text-slate-400 font-mono">
                  {layerName(n.layer)} · {status(n.status)} · {t('map.debtShort', { n: n.technicalDebt })}
                </span>
              </span>
              {n.criticalPath && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-label={t('canvas.criticalPath')} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
