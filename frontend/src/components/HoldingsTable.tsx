/* ── Holdings Table — Wall Street Positions Ledger ── */
import type { HoldingData } from '../types';
import './HoldingsTable.css';

interface Props {
  holdings: HoldingData[];
  onTradeStock?: (ticker: string) => void;
}

export default function HoldingsTable({ holdings, onTradeStock }: Props) {
  const activeHoldings = holdings.filter(h => h.quantity > 0);

  if (activeHoldings.length === 0) {
    return (
      <div className="card holdings-empty-card">
        <div className="empty-icon-box">📦</div>
        <h3>EQUITY POSITIONS LEDGER</h3>
        <p>No active holdings. Execute a BUY order on any listed company above to build your market portfolio.</p>
      </div>
    );
  }

  const totalMarketValue = activeHoldings.reduce((sum, h) => sum + h.market_value, 0);
  const totalUnrealizedPL = activeHoldings.reduce((sum, h) => sum + h.unrealized_pl, 0);

  return (
    <div className="card holdings-card">
      <div className="holdings-header">
        <div className="holdings-title-group">
          <h3>📦 OPEN POSITIONS LEDGER</h3>
          <span className="holdings-count mono">{activeHoldings.length} Positions</span>
        </div>
        <div className="holdings-summary-stats mono">
          <span>Total Value: <strong>₡{totalMarketValue.toFixed(2)}</strong></span>
          <span className={totalUnrealizedPL >= 0 ? 'price-up' : 'price-down'}>
            P/L: <strong>{totalUnrealizedPL >= 0 ? '+' : ''}₡{totalUnrealizedPL.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company / Ticker</th>
              <th>Position</th>
              <th>Avg Cost</th>
              <th>Market Price</th>
              <th>Total Value</th>
              <th>Unrealized P/L</th>
              <th>Return %</th>
              {onTradeStock && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {activeHoldings.map(h => {
              const isProfit = h.unrealized_pl >= 0;
              const plClass = isProfit ? 'price-up' : 'price-down';

              return (
                <tr key={h.ticker}>
                  <td>
                    <div className="h-company-cell">
                      <span className="h-ticker mono">{h.ticker}</span>
                      <span className="h-name">{h.company_name}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {h.quantity.toLocaleString()} shs
                  </td>
                  <td className="mono">₡{h.average_cost.toFixed(2)}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>₡{h.current_price.toFixed(2)}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>₡{h.market_value.toFixed(2)}</td>
                  <td className={`mono ${plClass}`} style={{ fontWeight: 700 }}>
                    {isProfit ? '+' : ''}₡{h.unrealized_pl.toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge ${isProfit ? 'badge-green' : 'badge-red'}`}>
                      {isProfit ? '▲ +' : '▼ '}{h.unrealized_pl_percent.toFixed(2)}%
                    </span>
                  </td>
                  {onTradeStock && (
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onTradeStock(h.ticker)}
                      >
                        Trade
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
