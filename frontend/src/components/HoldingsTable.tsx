/* ── Holdings Table ── */
import type { HoldingData } from '../types';
import './HoldingsTable.css';

interface Props {
  holdings: HoldingData[];
}

export default function HoldingsTable({ holdings }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="card holdings-empty">
        <h3>📦 Holdings</h3>
        <p>No positions yet. Start trading to build your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="card holdings-card">
      <h3>📦 Holdings</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Qty</th>
            <th>Avg Cost</th>
            <th>Price</th>
            <th>Value</th>
            <th>P/L</th>
            <th>P/L %</th>
          </tr>
        </thead>
        <tbody>
          {holdings.filter(h => h.quantity > 0).map(h => {
            const plClass = h.unrealized_pl >= 0 ? 'price-up' : 'price-down';
            return (
              <tr key={h.ticker}>
                <td>
                  <span className="h-ticker">{h.ticker}</span>
                  <span className="h-name">{h.company_name}</span>
                </td>
                <td className="mono">{h.quantity}</td>
                <td className="mono">₡{h.average_cost.toFixed(2)}</td>
                <td className="mono">₡{h.current_price.toFixed(2)}</td>
                <td className="mono">₡{h.market_value.toFixed(2)}</td>
                <td className={`mono ${plClass}`}>
                  {h.unrealized_pl >= 0 ? '+' : ''}₡{h.unrealized_pl.toFixed(2)}
                </td>
                <td className={`mono ${plClass}`}>
                  {h.unrealized_pl_percent >= 0 ? '+' : ''}{h.unrealized_pl_percent.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
