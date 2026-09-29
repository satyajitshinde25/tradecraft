/* ── MiniChart — High-Precision Executive Sparkline ── */
import type { CandleData } from '../types';

interface Props {
  candles: CandleData[];
  isUp: boolean;
}

export default function MiniChart({ candles, isUp }: Props) {
  const w = 260;
  const h = 54;
  const padX = 6;
  const padY = 6;

  // If pre-market (1 candle or empty), render baseline reference level with starting dot
  if (!candles || candles.length < 2) {
    const basePrice = candles && candles.length === 1 ? candles[0].close : 100;
    const strokeColor = '#C5A059';

    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <line
          x1={padX}
          y1={h / 2}
          x2={w - padX}
          y2={h / 2}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        <circle
          cx={w - padX}
          cy={h / 2}
          r="3.5"
          fill={strokeColor}
        />
        <text
          x={w / 2}
          y={h / 2 - 8}
          textAnchor="middle"
          fill="#9BA3AF"
          fontSize="9"
          fontFamily="'JetBrains Mono', monospace"
          opacity="0.8"
        >
          PRE-MARKET BASELINE (₡{basePrice.toFixed(2)})
        </text>
      </svg>
    );
  }

  const prices = candles.map(c => c.close);
  const minP = Math.min(...prices) * 0.998;
  const maxP = Math.max(...prices) * 1.002;
  const range = maxP - minP || 1;

  const points = prices.map((p, i) => {
    const x = padX + (i / (prices.length - 1)) * (w - 2 * padX);
    const y = padY + ((maxP - p) / range) * (h - 2 * padY);
    return { x, y };
  });

  const polylinePoints = points.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  const areaPath = `M${firstPoint.x.toFixed(1)},${firstPoint.y.toFixed(1)} ` +
    points.map(pt => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ') +
    ` L${lastPoint.x.toFixed(1)},${h} L${firstPoint.x.toFixed(1)},${h} Z`;

  // Deep Emerald for gain, Rich Oxblood for loss
  const strokeColor = isUp ? '#18D088' : '#FF5759';
  const gradId = `wolf-spark-${isUp ? 'up' : 'down'}-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="90%" stopColor={strokeColor} stopOpacity="0.02" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area under curve */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Sparkline curve */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Pulsing endpoint dot */}
      {lastPoint && (
        <g>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill={strokeColor}
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="7"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.2"
            opacity="0.6"
          >
            <animate attributeName="r" values="3.5;8;3.5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </svg>
  );
}
