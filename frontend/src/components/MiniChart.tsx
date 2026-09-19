/* ── MiniChart — SVG sparkline for stock cards ── */
import type { CandleData } from '../types';

interface Props {
  candles: CandleData[];
  isUp: boolean;
}

export default function MiniChart({ candles, isUp }: Props) {
  if (candles.length < 2) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Awaiting data...
      </div>
    );
  }

  const prices = candles.map(c => c.close);
  const minP = Math.min(...prices) * 0.998;
  const maxP = Math.max(...prices) * 1.002;
  const range = maxP - minP || 1;

  const w = 300;
  const h = 90;
  const padX = 4;
  const padY = 6;

  const points = prices.map((p, i) => {
    const x = padX + (i / (prices.length - 1)) * (w - 2 * padX);
    const y = padY + ((maxP - p) / range) * (h - 2 * padY);
    return `${x},${y}`;
  });

  const line = points.join(' ');
  const areaPath = `M${points[0]} ${points.join(' L')} L${padX + ((prices.length - 1) / (prices.length - 1)) * (w - 2 * padX)},${h} L${padX},${h} Z`;

  const color = isUp ? '#10b981' : '#ef4444';
  const gradId = `grad-${isUp ? 'up' : 'down'}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current price dot */}
      {prices.length > 0 && (
        <circle
          cx={padX + ((prices.length - 1) / (prices.length - 1)) * (w - 2 * padX)}
          cy={padY + ((maxP - prices[prices.length - 1]) / range) * (h - 2 * padY)}
          r="3"
          fill={color}
        >
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
