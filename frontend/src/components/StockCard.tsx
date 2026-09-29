/* ── StockCard.tsx — High-Energy Market Movers Quote Card ── */
import type { CompanyPrice, CandleData } from '../types';
import MiniChart from './MiniChart';
import './StockCard.css';

interface Props {
  stock: CompanyPrice;
  candles: CandleData[];
  holdingQty: number;
  onBuy: (e: React.MouseEvent) => void;
  onSell: (e: React.MouseEvent) => void;
  onClick: () => void;
  gameStatus: string;
}

export default function StockCard({
  stock,
  candles,
  holdingQty,
  onBuy,
  onSell,
  onClick,
  gameStatus
}: Props) {
  const isUp = stock.change >= 0;
  const isZero = stock.change === 0;
  const colorClass = isUp && !isZero ? 'price-up' : !isUp ? 'price-down' : 'price-neutral';
  const tradingOpen = gameStatus === 'RUNNING';
  const holdingValue = holdingQty * stock.price;

  return (
    <div className="stock-card card animate-fade-in" onClick={onClick} title="Click to launch candlestick analytics">
      {/* Subtle Charging Bull Watermark Silhouette */}
      <div className="sc-bull-watermark" />

      {/* Header */}
      <div className="sc-header">
        <div className="sc-info">
          <div className="sc-ticker-row">
            <span className="sc-ticker">{stock.ticker}</span>
            <span className="sc-sector-pill">{stock.sector || 'EQUITY'}</span>
          </div>
          <span className="sc-name font-editorial" title={stock.name}>{stock.name}</span>
        </div>

        <div className="sc-price-block">
          <div className={`sc-price mono ${colorClass}`}>
            ₡{stock.price.toFixed(2)}
          </div>
          <div className="sc-delta-row">
            <span className={`sc-change-badge ${isUp && !isZero ? 'badge-green' : !isUp ? 'badge-red' : 'badge-neutral'}`}>
              {isUp && !isZero ? '▲ +' : !isUp ? '▼ ' : ''}{stock.change.toFixed(2)} ({stock.change_percent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="sc-chart-wrapper">
        <div className="sc-chart-bg-line" />
        <MiniChart candles={candles} isUp={isUp} />
      </div>

      {/* Footer & Actions */}
      <div className="sc-footer">
        <div className="sc-position">
          {holdingQty > 0 ? (
            <div className="sc-holding-chip">
              <span className="sc-holding-dot" />
              <span className="mono"><strong>{holdingQty}</strong> shs (₡{holdingValue.toFixed(2)})</span>
            </div>
          ) : (
            <span className="sc-no-position">No active position</span>
          )}
        </div>

        <div className="sc-actions">
          <button
            className="btn btn-buy btn-sm"
            onClick={onBuy}
            disabled={!tradingOpen}
            title={tradingOpen ? `Execute BUY order on ${stock.ticker}` : 'Market closed'}
          >
            BUY
          </button>
          <button
            className="btn btn-sell btn-sm"
            onClick={onSell}
            disabled={!tradingOpen || holdingQty === 0}
            title={holdingQty === 0 ? 'No shares to sell' : `Execute SELL order on ${stock.ticker}`}
          >
            SELL
          </button>
        </div>
      </div>
    </div>
  );
}
