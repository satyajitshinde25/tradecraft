/* ── Portfolio Panel — Wall Street Executive HUD ── */
import type { Portfolio } from '../types';
import './PortfolioPanel.css';

interface Props {
  portfolio: Portfolio;
}

export default function PortfolioPanel({ portfolio }: Props) {
  const isProfit = portfolio.profit_loss >= 0;
  const plClass = isProfit ? 'price-up' : 'price-down';
  const tradesPercent = Math.min(100, Math.round((portfolio.trades_used / (portfolio.max_trades || 22)) * 100));

  return (
    <div className="portfolio-hud-container">
      {/* Editorial Bar Header */}
      <div className="portfolio-hud-top-label">
        <span className="hud-eyebrow font-serif">THE TRADING FLOOR</span>
        <span className="hud-bar-title font-editorial">Capital Ledger & Buying Power</span>
      </div>

      <div className="portfolio-hud-grid">
        {/* Card 1: Total Portfolio Value */}
        <div className="hud-card hud-card-primary">
          <div className="hud-card-header">
            <span className="hud-label">TOTAL PORTFOLIO VALUE</span>
            <span className="hud-icon">🏛️</span>
          </div>
          <div className="hud-value-large mono">
            ₡{portfolio.portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="hud-subtext">
            <span>Net Asset Value (NAV)</span>
          </div>
        </div>

        {/* Card 2: Buying Power */}
        <div className="hud-card">
          <div className="hud-card-header">
            <span className="hud-label">BUYING POWER (CASH)</span>
            <span className="hud-icon">💵</span>
          </div>
          <div className="hud-value mono">
            ₡{portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="hud-subtext">
            <span>Available Margin & Capital</span>
          </div>
        </div>

        {/* Card 3: Invested Equity */}
        <div className="hud-card">
          <div className="hud-card-header">
            <span className="hud-label">EQUITY POSITIONS</span>
            <span className="hud-icon">📈</span>
          </div>
          <div className="hud-value mono">
            ₡{portfolio.holdings_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="hud-subtext">
            <span>Active Market Allocation</span>
          </div>
        </div>

        {/* Card 4: Session P/L */}
        <div className="hud-card">
          <div className="hud-card-header">
            <span className="hud-label">SESSION NET P/L</span>
            <span className={`hud-badge ${isProfit ? 'badge-green' : 'badge-red'}`}>
              {isProfit ? '▲ +' : '▼ '}{portfolio.profit_loss_percent.toFixed(2)}%
            </span>
          </div>
          <div className={`hud-value mono ${plClass}`} style={{ fontWeight: 800 }}>
            {isProfit ? '+' : ''}₡{portfolio.profit_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="hud-subtext">
            <span>Cumulative Floor Yield</span>
          </div>
        </div>

        {/* Card 5: Trade Allocation */}
        <div className="hud-card">
          <div className="hud-card-header">
            <span className="hud-label">TRADE QUOTA</span>
            <span className="hud-icon">⚡</span>
          </div>
          <div className="hud-value mono">
            {portfolio.trades_used} <span className="hud-value-dim">/ {portfolio.max_trades}</span>
          </div>
          <div className="hud-progress-bar">
            <div
              className="hud-progress-fill"
              style={{
                width: `${tradesPercent}%`,
                background: tradesPercent > 80 ? 'var(--red)' : tradesPercent > 50 ? 'var(--yellow)' : 'var(--gradient-gold)'
              }}
            />
          </div>
        </div>

        {/* Card 6: Regulatory Clearance */}
        <div className="hud-card">
          <div className="hud-card-header">
            <span className="hud-label">FLOOR CLEARANCE</span>
            <span className="hud-icon">⚖️</span>
          </div>
          <div className="hud-status-wrapper">
            <span className={`badge ${portfolio.is_eligible ? 'badge-green' : 'badge-yellow'}`}>
              {portfolio.is_eligible ? '✓ RANK ELIGIBLE' : '⚠️ PROBATION'}
            </span>
          </div>
          <div className="hud-subtext">
            <span>{portfolio.is_eligible ? 'Qualified for Leaderboard' : 'Requirements pending'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
