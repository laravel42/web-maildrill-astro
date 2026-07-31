import { useId, useState, type MouseEvent as ReactMouseEvent } from 'react';
import styles from './Sparkline.module.css';

export type SparkPoint = { value: number; label: string };

export type SparkFormat = 'number' | 'percent' | ((value: number) => string);

function formatValue(value: number, format: SparkFormat): string {
  if (typeof format === 'function') return format(value);
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1);
}

/** Guarantee ≥2 points so a spark can always draw, ending at `current`. */
export function ensureSpark(
  points: SparkPoint[],
  current: number,
  currentLabel: string,
): SparkPoint[] {
  if (points.length >= 2) return points;
  if (points.length === 1) {
    const only = points[0]!;
    if (Math.abs(only.value - current) < 0.05) {
      return [{ value: 0, label: 'Start' }, only];
    }
    return [only, { value: current, label: currentLabel }];
  }
  return [
    { value: 0, label: 'Start' },
    { value: current, label: currentLabel },
  ];
}

/**
 * Interactive sparkline with a hover popup for the point under the cursor.
 * Hand SVG — no chart library. Used on campaign report/drawer, Analytics, Dashboard.
 */
export default function Sparkline({
  series,
  color,
  height = 30,
  format = 'number',
  area = false,
  className,
}: {
  series: SparkPoint[];
  color: string;
  height?: number;
  format?: SparkFormat;
  /** Fill under the line (dashboard-style). */
  area?: boolean;
  className?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 120;
  const H = height;
  const n = series.length;
  if (n < 2) return null;

  const values = series.map((p) => p.value);
  const min = area ? 0 : Math.min(...values);
  const max = Math.max(...values, area ? 1 : 0);
  const span = max - min || 1;
  const pad = area ? 2 : 4;
  const coords = series.map((p, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - pad - ((p.value - min) / span) * (H - pad * 2);
    return { x, y };
  });
  const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = area
    ? `0,${H} ${points} ${W},${H}`
    : '';

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = e.clientX - rect.left;
    const i = Math.round((x / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tip = hover != null ? series[hover] : null;
  const tipX = hover != null ? coords[hover]!.x : 0;
  const tipY = hover != null ? coords[hover]!.y : 0;

  return (
    <div
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        className={styles.svg}
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {area && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.18" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {area && <polyline points={areaPoints} fill={`url(#${gradId})`} stroke="none" />}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover != null && (
          <circle
            cx={tipX}
            cy={tipY}
            r="3.5"
            fill={color}
            stroke="var(--surface, #fff)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {tip && (
        <div
          className={styles.tip}
          style={{ left: `${(tipX / W) * 100}%` }}
          role="tooltip"
        >
          <div className={`tnum ${styles.tipVal}`}>{formatValue(tip.value, format)}</div>
          <div className={styles.tipLbl}>{tip.label}</div>
        </div>
      )}
    </div>
  );
}
