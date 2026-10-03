// ============================================================================
// GEMSIM: COMPARATIVE TEAM RADAR CHART
// SVG radar comparing every team on the six executive outcome dimensions.
// ============================================================================

import React from 'react';
import { Scenario, Team } from '../../types/index';

const AXES: Array<{ label: string; value: (t: Team, s: Scenario) => number }> = [
  { label: 'Debt Health', value: t => 100 - t.metrics.technicalDebtIndex },
  { label: 'Velocity', value: t => t.metrics.deliveryVelocity },
  { label: 'Trust', value: t => t.metrics.stakeholderTrust },
  { label: 'Resilience', value: t => t.metrics.resilienceIndex },
  { label: 'Compliance', value: t => t.metrics.complianceScore },
  { label: 'Cash Health', value: (t, s) => (t.metrics.budgetRemaining / Math.max(1, s.baselineMetrics.budgetRemaining)) * 100 },
];

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 115;

function point(axis: number, value: number): [number, number] {
  const angle = (Math.PI * 2 * axis) / AXES.length - Math.PI / 2;
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export const TeamRadarChart: React.FC<{ teams: Team[]; scenario: Scenario }> = ({ teams, scenario }) => (
  <div className="bg-dark-850 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center gap-4">
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[320px]" role="img" aria-label="Comparative team radar chart">
      {[25, 50, 75, 100].map(level => (
        <polygon
          key={level}
          points={AXES.map((_, i) => point(i, level).join(',')).join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth={level === 100 ? 1.2 : 0.6}
        />
      ))}
      {AXES.map((axis, i) => {
        const [x, y] = point(i, 100);
        const [lx, ly] = point(i, 118);
        return (
          <g key={axis.label}>
            <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#334155" strokeWidth={0.6} />
            <text x={lx} y={ly} fill="#94a3b8" fontSize={10} fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">
              {axis.label}
            </text>
          </g>
        );
      })}
      {teams.map(team => (
        <polygon
          key={team.id}
          points={AXES.map((axis, i) => point(i, axis.value(team, scenario)).join(',')).join(' ')}
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
