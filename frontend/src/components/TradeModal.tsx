/* ── Trade Modal — Buy/Sell confirmation ── */
import { useState } from 'react';
import './TradeModal.css';

interface Props {
  ticker: string;
  name: string;
  side: 'BUY' | 'SELL';
  currentPrice: number;
  cash: number;
  holdingQty: number;
  feePercent: number;
  onConfirm: (quantity: number) => void;
  onClose: () => void;
}

export default function TradeModal({
  ticker, name, side, currentPrice, cash, holdingQty,
  feePercent, onConfirm, onClose
}: Props) {
  const [quantity, setQuantity] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const qty = parseInt(quantity) || 0;
  const estimatedValue = qty * currentPrice;
  const fee = estimatedValue * (feePercent / 100);
  const total = side === 'BUY' ? estimatedValue + fee : estimatedValue - fee;

  const maxBuyQty = Math.floor((cash * 0.99) / (currentPrice * (1 + feePercent / 100)));
  const maxQty = side === 'BUY' ? Math.max(0, maxBuyQty) : holdingQty;
  const meetsMinOrder = estimatedValue >= 100.0;
  const canSubmit = qty > 0 && qty <= maxQty && meetsMinOrder && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    await onConfirm(qty);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="tm-header">
          <h2 className={side === 'BUY' ? 'price-up' : 'price-down'}>
            {side} {ticker}
          </h2>
          <button className="btn btn-icon btn-outline" onClick={onClose}>✕</button>
        </div>

        <div className="tm-info">
          <span className="tm-company">{name}</span>
          <span className="tm-price mono">Market price: ₡{currentPrice.toFixed(2)}</span>
        </div>

        <div className="tm-warning">
          ⚡ Orders enter pending status and fill at the <strong>next tick's price</strong>. Minimum order: <strong>₡100</strong>.
        </div>

        {qty > 0 && !meetsMinOrder && (
          <div className="tm-warning" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            ⚠️ Order value (₡{estimatedValue.toFixed(2)}) is below the ₡100 minimum order requirement.
          </div>
        )}

        <div className="form-group">
          <label>Quantity</label>
          <div className="tm-qty-row">
            <input
              className="input mono"
              type="number"
              min="1"
              max={maxQty}
              placeholder="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              autoFocus
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setQuantity(String(maxQty))}
            >
              MAX ({maxQty})
            </button>
          </div>
        </div>

        {side === 'BUY' && (
          <div className="tm-detail">
            <span>Available cash</span>
            <span className="mono">₡{cash.toFixed(2)}</span>
          </div>
        )}
        {side === 'SELL' && (
          <div className="tm-detail">
            <span>Current holdings</span>
            <span className="mono">{holdingQty} shares</span>
          </div>
        )}

        <div className="tm-detail">
          <span>Estimated {side === 'BUY' ? 'cost' : 'proceeds'}</span>
          <span className="mono">₡{estimatedValue.toFixed(2)}</span>
        </div>
        <div className="tm-detail">
          <span>Fee ({feePercent}%)</span>
          <span className="mono">₡{fee.toFixed(2)}</span>
        </div>
        <div className="tm-detail tm-total">
          <span>Estimated total</span>
          <span className="mono">₡{total.toFixed(2)}</span>
        </div>

        <button
          className={`btn ${side === 'BUY' ? 'btn-buy' : 'btn-sell'} tm-submit`}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {loading ? (
            <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Processing...</>
          ) : (
            `Confirm ${side}`
          )}
        </button>
      </div>
    </div>
  );
}
