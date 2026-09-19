/* ── Portfolio Panel — Summary bar below header ── */
import type { Portfolio } from '../types';
import './PortfolioPanel.css';

interface Props {
  portfolio: Portfolio;
}

export default function PortfolioPanel({ portfolio }: Props) {
  const plClass = portfolio.profit_loss >= 0 ? 'price-up' : 'price-down';

  return (
    <div className="portfolio-bar">
      <div className="pf-item">
        <span className="pf-label">Portfolio</span>
        <span className="pf-value mono">₡{portfolio.portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="pf-divider" />
      <div className="pf-item">
        <span className="pf-label">Cash</span>
        <span className="pf-value mono">₡{portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="pf-divider" />
      <div className="pf-item">
        <span className="pf-label">Holdings</span>
        <span className="pf-value mono">₡{portfolio.holdings_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="pf-divider" />
      <div className="pf-item">
        <span className="pf-label">P/L</span>
        <span className={`pf-value mono ${plClass}`}>
          {portfolio.profit_loss >= 0 ? '+' : ''}₡{portfolio.profit_loss.toFixed(2)}
        </span>
      </div>
      <div className="pf-divider" />
      <div className="pf-item">
        <span className="pf-label">P/L %</span>
        <span className={`pf-value mono ${plClass}`}>
          {portfolio.profit_loss_percent >= 0 ? '+' : ''}{portfolio.profit_loss_percent.toFixed(2)}%
        </span>
      </div>
      <div className="pf-divider" />
      <div className="pf-item">
        <span className="pf-label">Trades</span>
        <span className="pf-value mono">{portfolio.trades_used} / {portfolio.max_trades}</span>
      </div>
      <div className="pf-divider" />
      <div className="pf-item">
        <span className="pf-label">Eligible</span>
        <span className={`pf-value ${portfolio.is_eligible ? 'price-up' : 'price-neutral'}`}>
          {portfolio.is_eligible ? '✓ Yes' : 'No'}
        </span>
      </div>
    </div>
  );
}
