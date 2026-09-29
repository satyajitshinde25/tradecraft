/* ── Order History — Wall Street Execution Audit Trail ── */
import type { OrderResponse } from '../types';
import './OrderHistory.css';

interface Props {
  orders: OrderResponse[];
  maxTrades: number;
}

export default function OrderHistory({ orders, maxTrades }: Props) {
  const statusBadge = (status: string) => {
    switch (status) {
      case 'FILLED': return 'badge-green';
      case 'PENDING': return 'badge-yellow';
      case 'REJECTED': return 'badge-red';
      case 'EXPIRED': return 'badge-red';
      default: return 'badge-neutral';
    }
  };

  const filledCount = orders.filter(o => o.status === 'FILLED').length;
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <div className="card order-history-card">
      <div className="oh-header">
        <div className="oh-title-group">
          <h3>📋 ORDER EXECUTION AUDIT TRAIL</h3>
          <span className="mono oh-count">
            {filledCount} / {maxTrades} Trades Executed
          </span>
          {pendingCount > 0 && (
            <span className="badge badge-yellow animate-pulse">
              ⚡ {pendingCount} PENDING
            </span>
          )}
        </div>
        <div className="oh-rule-hint">
          <span>*Orders fill at next tick's opening price</span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="oh-empty-state">
          <span className="oh-empty-icon">📝</span>
          <p>No trade orders logged yet. Submit a Buy or Sell order to initiate execution.</p>
        </div>
      ) : (
        <div className="oh-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tick Sequence</th>
                <th>Side</th>
                <th>Ticker</th>
                <th>Quantity</th>
                <th>Fill Price</th>
                <th>Exchange Fee</th>
                <th>Net Settlement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map(o => {
                const isBuy = o.side === 'BUY';

                return (
                  <tr key={o.order_id}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      <span className="tick-pill">
                        T{o.submitted_tick} {o.fill_tick != null ? `→ T${o.fill_tick}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`side-badge ${isBuy ? 'side-buy' : 'side-sell'}`}>
                        {o.side}
                      </span>
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {o.ticker}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {o.quantity.toLocaleString()}
                    </td>
                    <td className="mono">
                      {o.status === 'PENDING' ? (
                        <span className="oh-pending-tag">
                          Pending @ Tick {o.fill_tick}
                        </span>
                      ) : (
                        o.fill_price != null ? `₡${o.fill_price.toFixed(2)}` : '—'
                      )}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>
                      ₡{o.fee.toFixed(2)}
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {o.net_value != null ? `₡${o.net_value.toFixed(2)}` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
