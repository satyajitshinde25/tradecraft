import type { CompanyPrice, CandleData } from '../types';
import AdvancedChart from './AdvancedChart';
import './ChartModal.css';

interface Props {
  stock: CompanyPrice;
  candles: CandleData[];
  onClose: () => void;
}

export default function ChartModal({ stock, candles, onClose }: Props) {
  const isUp = stock.change >= 0;
  const colorClass = isUp ? 'price-up' : 'price-down';

  return (
    <div className="modal-overlay chart-modal-overlay" onClick={onClose}>
      <div className="modal-content chart-modal-content" onClick={e => e.stopPropagation()}>
        <div className="cm-header">
          <div className="cm-header-info">
            <span className="cm-ticker">{stock.ticker}</span>
            <span className="cm-name">{stock.name}</span>
            <span className={`cm-price mono ${colorClass}`}>₡{stock.price.toFixed(2)}</span>
            <span className={`cm-change mono ${colorClass}`}>
              {isUp ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.change_percent).toFixed(2)}%)
            </span>
          </div>
          <button className="btn btn-icon btn-outline cm-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="cm-chart-container">
          <AdvancedChart candles={candles} />
        </div>
      </div>
    </div>
  );
}
