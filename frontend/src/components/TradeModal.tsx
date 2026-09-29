/* ── Trade Modal — Wall Street Order Execution Ticket ── */
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
  ticker,
  name,
  side,
  currentPrice,
  cash,
  holdingQty,
  feePercent,
  onConfirm,
  onClose
}: Props) {
  const [quantity, setQuantity] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const isBuy = side === 'BUY';
  const qty = parseInt(quantity, 10) || 0;
  const estimatedValue = qty * currentPrice;
  const fee = estimatedValue * (feePercent / 100);
  const total = isBuy ? estimatedValue + fee : estimatedValue - fee;

  const maxBuyQty = Math.floor((cash * 0.99) / (currentPrice * (1 + feePercent / 100)));
  const maxQty = isBuy ? Math.max(0, maxBuyQty) : holdingQty;
  const meetsMinOrder = estimatedValue >= 100.0;
  const canSubmit = qty > 0 && qty <= maxQty && meetsMinOrder && !loading;

  const handlePercentage = (percent: number) => {
    const targetQty = Math.floor((maxQty * percent) / 100);
    setQuantity(String(Math.max(0, targetQty)));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onConfirm(qty);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content trade-modal-card" onClick={e => e.stopPropagation()}>
        {/* Ticket Header */}
        <div className="tm-ticket-header">
          <div className="tm-ticket-title-row">
            <span className="tm-exchange-badge">NYSE SIMULATION</span>
            <span className="tm-ticket-id">ORDER TICKET</span>
          </div>
          <button className="btn btn-icon btn-outline tm-close" onClick={onClose}>✕</button>
        </div>

        <div className="tm-main-info">
          <div className="tm-side-tag-row">
            <span className={`tm-side-badge ${isBuy ? 'tm-side-buy' : 'tm-side-sell'}`}>
              {side} MARKET ORDER
            </span>
            <span className="tm-ticker-title mono">{ticker}</span>
          </div>
          <div className="tm-company-name">{name}</div>
          <div className="tm-price-quote mono">
            Indicative Price: <strong>₡{currentPrice.toFixed(2)}</strong> / share
          </div>
        </div>

        {/* Official Exchange Rule Reminder */}
        <div className="tm-rule-box">
          <span className="tm-rule-icon">⚡</span>
          <span>
            Order will enter pending queue and execute at <strong>next tick's opening price</strong>. Minimum order: <strong>₡100</strong>.
          </span>
        </div>

        {/* Warning if below minimum */}
        {qty > 0 && !meetsMinOrder && (
          <div className="tm-error-box animate-fade-in">
            ⚠️ Order value (₡{estimatedValue.toFixed(2)}) is below the ₡100 minimum execution limit.
          </div>
        )}

        {/* Quantity Input with Allocation Presets */}
        <div className="tm-form-section">
          <div className="tm-label-row">
            <label htmlFor="tm-qty-input">ORDER QUANTITY (SHARES)</label>
            <span className="tm-max-available mono">
              Max {isBuy ? 'Purchasable' : 'Available'}: {maxQty.toLocaleString()} shs
            </span>
          </div>

          <div className="tm-qty-input-wrapper">
            <input
              id="tm-qty-input"
              className="input mono tm-input"
              type="number"
              min="1"
              max={maxQty}
              placeholder="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              autoFocus
            />
          </div>

          {/* Quick Allocation Buttons */}
          <div className="tm-preset-buttons">
            <button type="button" className="btn-preset" onClick={() => handlePercentage(25)}>25%</button>
            <button type="button" className="btn-preset" onClick={() => handlePercentage(50)}>50%</button>
            <button type="button" className="btn-preset" onClick={() => handlePercentage(75)}>75%</button>
            <button type="button" className="btn-preset btn-preset-max" onClick={() => handlePercentage(100)}>100% MAX</button>
          </div>
        </div>

        {/* Financial Breakdown Ledger */}
        <div className="tm-breakdown-ledger">
          <div className="tm-ledger-row">
            <span>{isBuy ? 'Available Buying Power' : 'Current Holdings'}</span>
            <span className="mono">
              {isBuy ? `₡${cash.toFixed(2)}` : `${holdingQty} shares`}
            </span>
          </div>
          <div className="tm-ledger-row">
            <span>Estimated Gross Value</span>
            <span className="mono">₡{estimatedValue.toFixed(2)}</span>
          </div>
          <div className="tm-ledger-row">
            <span>Exchange Regulatory Fee ({feePercent}%)</span>
            <span className="mono">₡{fee.toFixed(2)}</span>
          </div>
          <div className="tm-ledger-row tm-ledger-total">
            <span>Estimated Net Settlement</span>
            <span className="mono tm-total-value">₡{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Submit Execution Action */}
        <button
          className={`btn ${isBuy ? 'btn-buy' : 'btn-sell'} tm-submit-btn`}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {loading ? (
            <>
              <div className="loading-spinner" style={{ width: 16, height: 16, borderTopColor: '#FFFFFF' }} />
              <span>Transmitting Order to Floor...</span>
            </>
          ) : (
            <span>Authorize & Transmit {side} Order →</span>
          )}
        </button>
      </div>
    </div>
  );
}
