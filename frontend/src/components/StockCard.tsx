/* ── Stock Card Component ── */
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

export default function StockCard({ stock, candles, holdingQty, onBuy, onSell, onClick, gameStatus }: Props) {
  const isUp = stock.change >= 0;
  const colorClass = stock.change > 0 ? 'price-up' : stock.change < 0 ? 'price-down' : 'price-neutral';
  const tradingOpen = gameStatus === 'RUNNING';

  return (
    <div className="stock-card card animate-fade-in" onClick={onClick}>
      <div className="sc-header">
        <div className="sc-info">
          <div className="sc-ticker-row">
            <span className="sc-ticker">{stock.ticker}</span>
            <span className={`sc-change-badge ${isUp ? 'badge-green' : 'badge-red'}`}>
              {isUp ? '▲' : '▼'} {Math.abs(stock.change_percent).toFixed(2)}%
            </span>
          </div>
          <span className="sc-name">{stock.name}</span>
          <span className="sc-sector">{stock.sector}</span>
        </div>
        <div className="sc-price-block">
          <span className={`sc-price mono ${colorClass}`}>
            ₡{stock.price.toFixed(2)}
          </span>
          <span className={`sc-change mono ${colorClass}`}>
            {isUp ? '+' : ''}{stock.change.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="sc-chart">
        <MiniChart candles={candles} isUp={isUp} />
      </div>

      <div className="sc-footer">
        <div className="sc-holding">
          {holdingQty > 0 && (
            <span className="sc-holding-badge mono">
              📦 {holdingQty} shares
            </span>
          )}
        </div>
        <div className="sc-actions">
          <button
            className="btn btn-buy btn-sm"
            onClick={onBuy}
            disabled={!tradingOpen}
          >
            Buy
          </button>
          <button
            className="btn btn-sell btn-sm"
            onClick={onSell}
            disabled={!tradingOpen || holdingQty === 0}
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
}
