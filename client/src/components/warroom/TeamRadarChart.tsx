// ============================================================================
// GEMSIM: COMPARATIVE TEAM RADAR CHART
// SVG radar comparing every team on the six executive outcome dimensions.
// ============================================================================

import React from 'react';
import { Scenario, Team } from '../../types/index';
import { useGameText } from '../../i18n/game';
import { marketShareTarget } from '../../engine';

type AxisKey = 'debt' | 'velocity' | 'trust' | 'resilience' | 'compliance' | 'cash' | 'market';
type Axis = { key: AxisKey; value: (t: Team, s: Scenario) => number };
const BASE_AXES: Axis[] = [
  { key: 'debt', value: t => 100 - t.metrics.technicalDebtIndex },
  { key: 'velocity', value: t => t.metrics.deliveryVelocity },
  { key: 'trust', value: t => t.metrics.stakeholderTrust },
  { key: 'resilience', value: t => t.metrics.resilienceIndex },
  { key: 'compliance', value: t => t.metrics.complianceScore },
  { key: 'cash', value: (t, s) => (t.metrics.budgetRemaining / Math.max(1, s.baselineMetrics.budgetRemaining)) * 100 },
];

// Market axis: 100 = the scenario's market-share target reached (scaled to the number of teams)
function marketAxis(teamCount: number): Axis {
  return {
    key: 'market',
    value: (t, s) => {
      const target = marketShareTarget(s, teamCount) ?? 100 / (teamCount + (s.market?.rivals.length ?? 0));
      return ((t.metrics.marketShare ?? 0) / Math.max(1, target)) * 100;
    },
  };
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 115;

function point(axis: number, value: number, count: number): [number, number] {
  const angle = (Math.PI * 2 * axis) / count - Math.PI / 2;
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export const TeamRadarChart: React.FC<{ teams: Team[]; scenario: Scenario }> = ({ teams, scenario }) => {
  const { t, vocab } = useGameText(scenario);
  const AXES = scenario.market ? [...BASE_AXES, marketAxis(teams.length)] : BASE_AXES;
  const label: Record<AxisKey, string> = {
    debt: t('radar.debtHealth', { debt: vocab.metrics.technicalDebtIndex.label }),
    velocity: vocab.metrics.deliveryVelocity.label,
    trust: vocab.metrics.stakeholderTrust.label,
    resilience: vocab.metrics.resilienceIndex.label,
    compliance: vocab.metrics.complianceScore.label,
    cash: vocab.metrics.budgetRemaining.label,
    market: vocab.metrics.marketShare.label,
  };
  return (
  <div className="bg-dark-850 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center gap-4">
    <svg viewBox={`-110 -10 ${SIZE + 220} ${SIZE + 20}`} className="w-full max-w-[480px]" role="img" aria-label={t('radar.aria')}>
      {[25, 50, 75, 100].map(level => (
        <polygon
          key={level}
          points={AXES.map((_, i) => point(i, level, AXES.length).join(',')).join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth={level === 100 ? 1.2 : 0.6}
        />
      ))}
      {AXES.map((axis, i) => {
        const [x, y] = point(i, 100, AXES.length);
        const [lx, ly] = point(i, 108, AXES.length);
        return (
          <g key={axis.key}>
            <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#334155" strokeWidth={0.6} />
            <text
              x={lx}
              y={ly}
              fill="#94a3b8"
              fontSize={10}
              fontFamily="monospace"
              textAnchor={lx < CENTER - 8 ? 'end' : lx > CENTER + 8 ? 'start' : 'middle'}
              dominantBaseline="middle"
            >
              {label[axis.key].length > 22 ? `${label[axis.key].slice(0, 21)}…` : label[axis.key]}
            </text>
          </g>
        );
      })}
      {teams.map(team => (
        <polygon
          key={team.id}
          points={AXES.map((axis, i) => point(i, axis.value(team, scenario), AXES.length).join(',')).join(' ')}
          fill={team.color}
          fillOpacity={0.15}
          stroke={team.color}
          strokeWidth={2}
        />
      ))}
    </svg>
    <div className="flex flex-col gap-2 text-xs font-mono">
      {teams.map(team => (
        <div key={team.id} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: team.color }} />
          <span className="text-slate-200">{team.avatar} {team.name}</span>
        </div>
      ))}
    </div>
  </div>
);
};
