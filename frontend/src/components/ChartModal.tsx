/* ── ChartModal.tsx — Wall Street Advanced Analytics Modal ── */
import type { CompanyPrice, CandleData } from '../types';
import AdvancedChart from './AdvancedChart';
import './ChartModal.css';

interface Props {
  stock: CompanyPrice;
  candles: CandleData[];
  onClose: () => void;
  onOpenTrade?: (side: 'BUY' | 'SELL') => void;
}

export default function ChartModal({ stock, candles, onClose, onOpenTrade }: Props) {
  const isUp = stock.change >= 0;
  const isZero = stock.change === 0;
  const colorClass = isUp && !isZero ? 'price-up' : !isUp ? 'price-down' : 'price-neutral';

  const highs = (candles || []).map(c => c.high);
  const lows = (candles || []).map(c => c.low);
  const sessionHigh = highs.length > 0 ? Math.max(...highs) : stock.price;
  const sessionLow = lows.length > 0 ? Math.min(...lows) : stock.price;

  return (
    <div className="modal-overlay chart-modal-overlay" onClick={onClose}>
      <div className="modal-content chart-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cm-header">
          <div className="cm-header-info">
            <div className="cm-ticker-block">
              <span className="cm-ticker mono">{stock.ticker}</span>
              <span className="cm-sector-badge">{stock.sector || 'EQUITY'}</span>
            </div>
            <div className="cm-name-block">
              <h2 className="cm-name">{stock.name}</h2>
              <span className="cm-market-tag">NYSE SIMULATION • TICK INTERVAL</span>
            </div>
          </div>

          <div className="cm-header-right">
            <div className="cm-quote-stats">
              <div className="cm-price-group">
                <span className={`cm-price mono ${colorClass}`}>₡{stock.price.toFixed(2)}</span>
                <span className={`cm-change-badge ${isUp && !isZero ? 'badge-green' : !isUp ? 'badge-red' : 'badge-neutral'}`}>
                  {isUp && !isZero ? '▲ +' : !isUp ? '▼ ' : ''}{stock.change.toFixed(2)} ({stock.change_percent.toFixed(2)}%)
                </span>
              </div>
              <div className="cm-hilo-group mono">
                <span>HIGH: ₡{sessionHigh.toFixed(2)}</span>
                <span>LOW: ₡{sessionLow.toFixed(2)}</span>
                <span>CANDLES: {candles.length}</span>
              </div>
            </div>

            {onOpenTrade && (
              <div className="cm-quick-actions">
                <button
                  className="btn btn-buy btn-sm"
                  onClick={() => {
                    onClose();
                    onOpenTrade('BUY');
                  }}
                >
                  Buy {stock.ticker}
                </button>
                <button
                  className="btn btn-sell btn-sm"
                  onClick={() => {
                    onClose();
                    onOpenTrade('SELL');
                  }}
                >
                  Sell {stock.ticker}
                </button>
              </div>
            )}

            <button className="btn btn-icon btn-outline cm-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="cm-chart-container">
          <AdvancedChart candles={candles} />
        </div>

        {/* Chart Footer info */}
        <div className="cm-footer-hint">
          <span>📊 Real-time candlestick data. Drag to pan, scroll to zoom. Hover candles for OHLC quotes.</span>
        </div>
      </div>
    </div>
  );
}
