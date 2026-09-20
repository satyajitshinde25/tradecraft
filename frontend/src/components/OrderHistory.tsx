/* ── Order History ── */
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
      default: return '';
    }
  };

  return (
    <div className="card order-history-card">
      <div className="oh-header">
        <h3>📋 Order History</h3>
        <span className="mono oh-count">
          {orders.filter(o => o.status === 'FILLED').length} / {maxTrades} trades
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="oh-empty">No orders yet.</p>
      ) : (
        <div className="oh-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tick</th>
                <th>Side</th>
                <th>Ticker</th>
                <th>Qty</th>
                <th>Fill Price</th>
                <th>Fee</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map(o => (
                <tr key={o.order_id}>
                  <td className="mono">{o.submitted_tick}{o.fill_tick != null ? ` → ${o.fill_tick}` : ''}</td>
                  <td>
                    <span className={o.side === 'BUY' ? 'price-up' : 'price-down'} style={{ fontWeight: 700 }}>
                      {o.side}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{o.ticker}</td>
                  <td className="mono">{o.quantity}</td>
                  <td className="mono">
                    {o.status === 'PENDING' ? (
                      <span style={{ color: 'var(--yellow)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                        Pending (Tick {o.fill_tick})
                      </span>
                    ) : (
                      o.fill_price != null ? `₡${o.fill_price.toFixed(2)}` : '—'
                    )}
                  </td>
                  <td className="mono">₡{o.fee.toFixed(2)}</td>
                  <td className="mono">{o.net_value != null ? `₡${o.net_value.toFixed(2)}` : '—'}</td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
