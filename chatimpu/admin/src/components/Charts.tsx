/**
 * Chart primitives. One measure per chart (never dual-axis), single brand hue,
 * thin 2px lines, recessive grid, hover crosshair + tooltip. Colours come from CSS
 * tokens (--chart-1/2), validated for light + dark surfaces.
 */
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, fmt } from '../lib/format';

const css = (v: string) => `var(${v})`;

export function TrendChart({ data, dataKey, label, color = '--chart-1', height = 220, percent }: {
  data: Record<string, number | string>[]; dataKey: string; label: string; color?: string; height?: number; percent?: boolean;
}) {
  const id = `g-${dataKey}`;
  const f = (v: number) => (percent ? `${Math.round(v * 100)}%` : compact(v));
  return (
    <div style={{ height }} role="img" aria-label={`${label} over the last ${data.length} days`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={css(color)} stopOpacity={0.22} />
              <stop offset="100%" stopColor={css(color)} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={css('--grid')} />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: css('--faint'), fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={f} tick={{ fill: css('--faint'), fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip cursor={{ stroke: css('--faint'), strokeDasharray: '3 3' }}
            content={({ active, payload, label: l }) => active && payload?.length ? (
              <div className="tooltip"><div className="faint">{String(l)}</div><div>{label}: <b>{percent ? f(Number(payload[0].value)) : fmt(Number(payload[0].value))}</b></div></div>
            ) : null} />
          <Area type="monotone" dataKey={dataKey} stroke={css(color)} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 5, strokeWidth: 2, stroke: css('--surface') }}
            animationDuration={500} isAnimationActive={!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars, single hue, value labelled at the end of each bar. */
export function BarList({ rows, format = fmt, color = '--chart-1' }: { rows: { label: string; value: number; dot?: string }[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${format(r.value)}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 64px', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {r.dot && <i style={{ width: 8, height: 8, borderRadius: 4, background: r.dot, flex: 'none' }} />}{r.label}
          </span>
          <div style={{ height: 12, background: 'var(--surface-alt)', borderRadius: 4 }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: css(color), borderRadius: 4, minWidth: 4 }} />
          </div>
          <span className="num" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && <div className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs last week</div>}
    </div>
  );
}
