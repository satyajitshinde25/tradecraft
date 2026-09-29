/* ── Dashboard — THE WOLF'S DEN Executive Trading Floor ── */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getGameState, getMarketOverview, getNews, getPortfolio,
  getOrders, getCandles, getLeaderboard, submitBuy, submitSell,
  createMarketWebSocket, logout
} from '../api/client';
import type {
  GameState, MarketOverview, NewsResponse, Portfolio,
  OrderResponse, CandlesResponse, CompanyPrice, WSMarketMessage,
  LeaderboardEntry
} from '../types';
import AdvancedChart from '../components/AdvancedChart';
import MiniChart from '../components/MiniChart';
import NewsTicker from '../components/NewsTicker';
import HoldingsTable from '../components/HoldingsTable';
import OrderHistory from '../components/OrderHistory';
import TradeModal from '../components/TradeModal';
import ChartModal from '../components/ChartModal';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [market, setMarket] = useState<MarketOverview | null>(null);
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [candles, setCandles] = useState<Record<string, CandlesResponse>>({});
  const [leaderboard, setLeaderboard] = useState<{ tick: number; entries: LeaderboardEntry[] } | null>(null);

  // Selected Stock for Central Focus Candlestick Chart
  const [selectedTicker, setSelectedTicker] = useState<string>('');

  // Active navigation rail tab & lower deck tabs
  const [activeNavTab, setActiveNavTab] = useState<'floor' | 'chart' | 'ledger' | 'news' | 'leaderboard'>('floor');
  const [activeBottomTab, setActiveBottomTab] = useState<'holdings' | 'orders' | 'leaderboard'>('holdings');

  // Modals & Notifications
  const [tradeModal, setTradeModal] = useState<{
    ticker: string; side: 'BUY' | 'SELL'; price: number; name: string;
  } | null>(null);
  const [chartModal, setChartModal] = useState<string | null>(null);
  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const fetchAllDataRef = useRef<() => void>(() => {});
  const intervalRef = useRef<number | null>(null);

  // Track rank changes
  const prevDashboardRanksRef = useRef<Map<string, number>>(new Map());
  const [dashboardRankDeltas, setDashboardRankDeltas] = useState<Map<string, number>>(new Map());
  const [dashboardChangedRows, setDashboardChangedRows] = useState<Set<string>>(new Set());

  const teamCode = localStorage.getItem('ms_team_code') || '';
  const displayName = localStorage.getItem('ms_display_name') || '';

  // Track rank updates
  useEffect(() => {
    if (!leaderboard?.entries) return;
    const newDeltas = new Map<string, number>();
    const changedRows = new Set<string>();

    leaderboard.entries.forEach(entry => {
      const prev = prevDashboardRanksRef.current.get(entry.team_code);
      if (prev !== undefined && prev !== entry.rank) {
        const delta = prev - entry.rank;
        newDeltas.set(entry.team_code, delta);
        changedRows.add(entry.team_code);
      }
      prevDashboardRanksRef.current.set(entry.team_code, entry.rank);
    });

    if (newDeltas.size > 0) {
      setDashboardRankDeltas(newDeltas);
      setDashboardChangedRows(changedRows);
      const timer = setTimeout(() => {
        setDashboardChangedRows(new Set());
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [leaderboard]);

  // ── Fetch all data ──
  const fetchAllData = useCallback(async () => {
    try {
      const [gs, mk, nw, pf, od] = await Promise.all([
        getGameState(), getMarketOverview(), getNews(),
        getPortfolio(), getOrders(),
      ]);
      setGameState(gs);
      setMarket(mk);
      setNews(nw);
      setPortfolio(pf);
      setOrders(od.orders || []);
      setIsReconnecting(false);

      // Default selected ticker if not set
      if (!selectedTicker && mk?.prices?.length > 0) {
        setSelectedTicker(mk.prices[0].ticker);
      }

      // Fetch candles for all listed companies
      const tickers = (mk.prices || []).map((p: CompanyPrice) => p.ticker);
      const candlePromises = tickers.map((t: string) => getCandles(t));
      const candleResults = await Promise.all(candlePromises);
      const candleMap: Record<string, CandlesResponse> = {};
      candleResults.forEach((c: CandlesResponse) => {
        candleMap[c.ticker] = c;
      });
      setCandles(candleMap);

      // Fetch leaderboard if available
      try {
        const lb = await getLeaderboard();
        if (lb) setLeaderboard(lb);
      } catch (_) {
        // Leaderboard fetch optional for non-admin
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [selectedTicker]);

  fetchAllDataRef.current = fetchAllData;

  // ── Initial load + polling ──
  useEffect(() => {
    fetchAllData();
    intervalRef.current = window.setInterval(fetchAllData, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAllData]);

  // ── WebSocket ──
  useEffect(() => {
    const managedWs = createMarketWebSocket(
      (data: WSMarketMessage) => {
        if (data.type === 'market_update') {
          setGameState(prev => {
            if (prev && prev.current_tick !== data.tick) {
              fetchAllDataRef.current();
            }
            return prev ? {
              ...prev,
              current_tick: data.tick,
              status: data.status,
              server_time: data.server_time,
              tick_started_at: data.tick_started_at,
              next_tick_at: data.next_tick_at,
            } : prev;
          });

          if (data.prices) {
            setMarket(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                tick: data.tick,
                prices: prev.prices.map(p => {
                  const updated = data.prices?.find((dp: any) => dp.ticker === p.ticker);
                  return updated ? { ...p, price: updated.price, change: updated.change, change_percent: updated.change_percent } : p;
                }),
              };
            });
          }
          setIsReconnecting(false);
        }
      },
      (reconnecting: boolean) => {
        setIsReconnecting(reconnecting);
      },
    );

    return () => {
      managedWs.close();
    };
  }, []);

  // ── Countdown timer ──
  useEffect(() => {
    if (!gameState?.next_tick_at) return;
    const tick = () => {
      const next = new Date(gameState.next_tick_at!).getTime();
      const remaining = Math.max(0, Math.floor((next - Date.now()) / 1000));
      setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gameState?.next_tick_at]);

  // ── Trade handler ──
  const handleTrade = async (ticker: string, quantity: number, side: 'BUY' | 'SELL') => {
    try {
      if (side === 'BUY') {
        await submitBuy(ticker, quantity);
      } else {
        await submitSell(ticker, quantity);
      }
      showToast(`${side} order submitted: ${quantity} ${ticker} (Executes at Tick ${gameState!.current_tick + 1})`, 'success');
      setTradeModal(null);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message || 'Execution rejected by exchange', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    localStorage.clear();
    navigate('/');
  };

  const getHoldingQty = (ticker: string) => {
    const h = portfolio?.holdings?.find(h => h.ticker === ticker);
    return h?.quantity || 0;
  };

  if (!gameState || !market) {
    return (
      <div className="dashboard-loading">
        <div className="wolf-bull-spinner">
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#0A0D12" stroke="#C5A059" strokeWidth="2"/>
            <path d="M12 28C15 24 19 23 24 22C29 21 34 19 37 14C37 19 34 24 31 26C28 28 25 29 22 30C18 31 14 30 12 28Z" fill="url(#ld-gold)"/>
            <path d="M34 14C32 11 28 10 25 12" stroke="#F5DE9C" strokeWidth="2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="ld-gold" x1="12" y1="14" x2="37" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F5DE9C"/>
                <stop offset="0.5" stopColor="#C5A059"/>
                <stop offset="1" stopColor="#8C6D33"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="loading-label">
          <h2 className="font-editorial">THE WOLF'S DEN</h2>
          <p className="font-mono">Connecting to Manhattan Executive Trading Feed...</p>
        </div>
      </div>
    );
  }

  // Focus stock derivation
  const activeStock = market.prices.find(p => p.ticker === (selectedTicker || market.prices[0]?.ticker)) || market.prices[0];
  const activeCandles = candles[activeStock?.ticker]?.candles || [];
  const tickProgress = Math.min(100, Math.round((gameState.current_tick / (gameState.max_tick || 96)) * 100));

  // Portfolio calculations
  const totalNetWorth = portfolio?.portfolio_value ?? 100000;
  const cashBalance = portfolio?.cash ?? 100000;
  const positionsEquity = Math.max(0, totalNetWorth - cashBalance);
  const totalPnL = portfolio?.profit_loss ?? 0;
  const totalPnLPercent = portfolio?.profit_loss_percent ?? 0;
  const tradesCount = portfolio?.trades_used ?? orders.length;
  const maxTrades = gameState.max_trades || portfolio?.max_trades || 22;

  return (
    <div className="wolf-terminal-layout">
      {/* ── 1. Slim Vertical Navigation Rail ── */}
      <aside className="wolf-nav-rail">
        <div className="rail-top">
          <div className="rail-brand-crest" title="The Wolf's Den — TradeCraft Executive Floor">
            <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="#0A0D12" stroke="#C5A059" strokeWidth="2"/>
              <path d="M12 28C15 24 19 23 24 22C29 21 34 19 37 14C37 19 34 24 31 26C28 28 25 29 22 30C18 31 14 30 12 28Z" fill="url(#rail-gold)"/>
              <path d="M34 14C32 11 28 10 25 12" stroke="#F5DE9C" strokeWidth="2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="rail-gold" x1="12" y1="14" x2="37" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F5DE9C"/>
                  <stop offset="0.5" stopColor="#C5A059"/>
                  <stop offset="1" stopColor="#8C6D33"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <nav className="rail-nav-menu">
            <button
              className={`rail-nav-item ${activeNavTab === 'floor' ? 'active' : ''}`}
              onClick={() => { setActiveNavTab('floor'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              title="Trading Floor"
            >
              <span className="rail-icon">🏛️</span>
              <span className="rail-tooltip">Floor Overview</span>
            </button>

            <button
              className={`rail-nav-item ${activeNavTab === 'chart' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('chart');
                document.getElementById('wolf-focus-chart-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Candlestick Terminal"
            >
              <span className="rail-icon">📈</span>
              <span className="rail-tooltip">Focus Terminal</span>
            </button>

            <button
              className={`rail-nav-item ${activeNavTab === 'ledger' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('ledger');
                document.getElementById('wolf-ledger-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Positions & Audit Ledger"
            >
              <span className="rail-icon">📋</span>
              <span className="rail-tooltip">Executive Ledger</span>
            </button>

            <button
              className={`rail-nav-item ${activeNavTab === 'news' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('news');
                document.getElementById('wolf-chronicle-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              title="The Wall Street Chronicle"
            >
              <span className="rail-icon">📰</span>
              <span className="rail-tooltip">The Chronicle</span>
            </button>

            <button
              className={`rail-nav-item ${activeNavTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setLeaderboardModalOpen(true)}
              title="Floor Standings & Leaderboard"
            >
              <span className="rail-icon">🏆</span>
              <span className="rail-tooltip">Floor Standings</span>
            </button>
          </nav>
        </div>

        <div className="rail-bottom">
          <div className="rail-user-avatar" title={`Active Desk: ${displayName || teamCode}`}>
            <span className="rail-user-initial">{(displayName || teamCode).substring(0, 2).toUpperCase()}</span>
          </div>
          <button className="rail-logout-btn" onClick={handleLogout} title="Exit Executive Desk">
            <span className="rail-icon">⏻</span>
            <span className="rail-tooltip">Exit Desk</span>
          </button>
        </div>
      </aside>

      {/* ── Main Executive Trading Arena ── */}
      <main className="wolf-main-arena">
        {/* Broadcast-Style Stock Marquee Ticker */}
        <div className="wolf-marquee-tape">
          <div className="wolf-marquee-track">
            {market.prices.map(p => {
              const isUp = p.change >= 0;
              const isZero = p.change === 0;
              return (
                <span
                  key={p.ticker}
                  className={`wolf-marquee-item ${selectedTicker === p.ticker ? 'selected' : ''}`}
                  onClick={() => setSelectedTicker(p.ticker)}
                >
                  <span className="wm-ticker">{p.ticker}</span>
                  <span className="wm-price mono">₡{p.price.toFixed(2)}</span>
                  <span className={`wm-delta mono ${isUp && !isZero ? 'emerald' : !isUp ? 'oxblood' : 'neutral'}`}>
                    {isUp && !isZero ? '▲ +' : !isUp ? '▼ ' : ''}{p.change_percent.toFixed(2)}%
                  </span>
                </span>
              );
            })}
            <span className="wolf-marquee-divider">◆</span>
            <span className="wolf-marquee-bulletin font-serif">
              🔔 <strong>MANHATTAN BROKERAGE SESSION • REAL-TIME EXECUTION AT 0.4% BROKERAGE</strong>
            </span>
            <span className="wolf-marquee-divider">◆</span>
            {market.prices.map(p => {
              const isUp = p.change >= 0;
              const isZero = p.change === 0;
              return (
                <span
                  key={`dup-${p.ticker}`}
                  className={`wolf-marquee-item ${selectedTicker === p.ticker ? 'selected' : ''}`}
                  onClick={() => setSelectedTicker(p.ticker)}
                >
                  <span className="wm-ticker">{p.ticker}</span>
                  <span className="wm-price mono">₡{p.price.toFixed(2)}</span>
                  <span className={`wm-delta mono ${isUp && !isZero ? 'emerald' : !isUp ? 'oxblood' : 'neutral'}`}>
                    {isUp && !isZero ? '▲ +' : !isUp ? '▼ ' : ''}{p.change_percent.toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Top Bar with Opening-Bell Status ── */}
        <header className="wolf-top-bar">
          <div className="wolf-top-left">
            <div className="wolf-brand-title">
              <span className="brand-den font-editorial">THE WOLF'S DEN</span>
              <span className="brand-sub font-mono">1980s MANHATTAN BROKERAGE</span>
            </div>

            <div className="wolf-session-status">
              <span className={`status-pill ${gameState.status === 'RUNNING' ? 'status-open' : 'status-pre'}`}>
                <span className="bell-pulsar" />
                {gameState.status === 'RUNNING' ? '🔔 FLOOR ACTIVE' : `⏸ ${gameState.status}`}
              </span>

              <div className="wolf-tick-indicator mono">
                <span>TICK {gameState.current_tick}</span>
                <span className="tick-max">/ {gameState.max_tick}</span>
                <div className="tick-progress-bar">
                  <div className="tick-progress-fill" style={{ width: `${tickProgress}%` }} />
                </div>
              </div>

              {countdown > 0 && (
                <span className="wolf-countdown mono">
                  ⏱ NEXT TICK: <strong>{countdown}s</strong>
                </span>
              )}

              {isReconnecting && (
                <span className="badge badge-red animate-pulse">⚡ RECONNECTING FEED...</span>
              )}
            </div>
          </div>

          <div className="wolf-top-right">
            <button
              className="wolf-standings-trigger-btn"
              onClick={() => setLeaderboardModalOpen(true)}
            >
              🏆 Floor Standings
            </button>
            <div className="wolf-desk-badge">
              <div className="desk-code mono">{teamCode}</div>
              <div className="desk-name font-editorial">{displayName || 'Executive Trader'}</div>
            </div>
          </div>
        </header>

        {/* ── 2 & 3. Cinematic Manhattan Welcome Section & Grand Editorial Portfolio Statement ── */}
        <section className="wolf-hero-statement">
          <div className="wolf-hero-skyline-backdrop" />
          <div className="wolf-hero-content">
            <div className="hero-salutation-row">
              <span className="hero-subtitle font-serif">MANHATTAN EXECUTIVE SUITE • FLOOR TERMINAL</span>
              <span className="hero-directive mono">
                ⚡ 0.4% BROKERAGE FEE | ₡100 MIN ORDER | NEXT-TICK EXECUTION
              </span>
            </div>

            <div className="hero-valuation-grid">
              <div className="hero-primary-valuation">
                <span className="valuation-eyebrow font-mono">TOTAL PORTFOLIO VALUATION</span>
                <div className="valuation-figure font-editorial">
                  ₡{totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="valuation-delta-row">
                  <span className={`pnl-pill mono ${totalPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                    {totalPnL >= 0 ? '▲ +' : '▼ '}₡{Math.abs(totalPnL).toFixed(2)} ({totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                  </span>
                  <span className="pnl-caption">Session Net Return</span>
                </div>
              </div>

              <div className="hero-metrics-cluster">
                <div className="metric-pod">
                  <span className="pod-label">AVAILABLE LIQUIDITY</span>
                  <span className="pod-value mono">₡{cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="pod-sub mono">Cash Reserves</span>
                </div>

                <div className="metric-pod">
                  <span className="pod-label">EQUITY IN POSITIONS</span>
                  <span className="pod-value mono">₡{positionsEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="pod-sub mono">{portfolio?.holdings?.filter(h => h.quantity > 0).length || 0} Open Holdings</span>
                </div>

                <div className="metric-pod">
                  <div className="pod-label-row">
                    <span className="pod-label">EXECUTION QUOTA</span>
                    <span className="pod-quota mono">{tradesCount}/{maxTrades}</span>
                  </div>
                  <div className="quota-bar">
                    <div className="quota-fill" style={{ width: `${Math.min(100, (tradesCount / maxTrades) * 100)}%` }} />
                  </div>
                  <span className="pod-sub mono">{(maxTrades - tradesCount)} Trades Remaining</span>
                </div>
              </div>

              <div className="hero-actions-cluster">
                <button
                  className="wolf-hero-buy-btn"
                  onClick={() => {
                    if (activeStock) {
                      setTradeModal({ ticker: activeStock.ticker, side: 'BUY', price: activeStock.price, name: activeStock.name });
                    }
                  }}
                >
                  ⚡ Execute Order
                </button>
                <button
                  className="wolf-hero-ledger-btn"
                  onClick={() => {
                    document.getElementById('wolf-ledger-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  📜 Review Ledger
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4 & 5. Asymmetric Primary Grid: Central Focus Candlestick Terminal (65%) + Watchlist (35%) ── */}
        <section id="wolf-focus-chart-section" className="wolf-trading-split-grid">
          {/* Left/Center: Wide Candlestick Terminal */}
          <div className="wolf-focus-chart-card">
            <div className="chart-card-header">
              <div className="stock-identity-group">
                <div className="stock-ticker-row">
                  <h2 className="focus-ticker mono">{activeStock.ticker}</h2>
                  <span className="focus-name font-editorial">{activeStock.name}</span>
                  <span className="focus-sector-badge font-mono">{activeStock.sector}</span>
                </div>
                <div className="stock-quote-row">
                  <span className="focus-price mono">₡{activeStock.price.toFixed(2)}</span>
                  <span className={`focus-change-badge mono ${activeStock.change >= 0 ? 'emerald' : 'oxblood'}`}>
                    {activeStock.change >= 0 ? '▲ +' : '▼ '}{activeStock.change.toFixed(2)} ({activeStock.change_percent >= 0 ? '+' : ''}{activeStock.change_percent.toFixed(2)}%)
                  </span>
                  <span className="focus-baseline mono">
                    Open Base: ₡{activeStock.start_price.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="chart-controls-group">
                <div className="chart-ticker-selector">
                  {market.prices.map(p => (
                    <button
                      key={p.ticker}
                      className={`ticker-chip mono ${p.ticker === activeStock.ticker ? 'active' : ''}`}
                      onClick={() => setSelectedTicker(p.ticker)}
                    >
                      {p.ticker}
                    </button>
                  ))}
                </div>

                <div className="chart-direct-actions">
                  <button
                    className="btn-chart-buy"
                    onClick={() => setTradeModal({ ticker: activeStock.ticker, side: 'BUY', price: activeStock.price, name: activeStock.name })}
                  >
                    BUY {activeStock.ticker}
                  </button>
                  <button
                    className="btn-chart-sell"
                    onClick={() => setTradeModal({ ticker: activeStock.ticker, side: 'SELL', price: activeStock.price, name: activeStock.name })}
                    disabled={getHoldingQty(activeStock.ticker) <= 0}
                  >
                    SELL {activeStock.ticker} ({getHoldingQty(activeStock.ticker)})
                  </button>
                  <button
                    className="btn-chart-expand"
                    onClick={() => setChartModal(activeStock.ticker)}
                    title="Fullscreen Candlestick Analysis"
                  >
                    ⛶
                  </button>
                </div>
              </div>
            </div>

            {/* Candlestick Canvas */}
            <div className="chart-canvas-wrapper">
              <AdvancedChart candles={activeCandles} />
            </div>

            <div className="chart-card-footer font-mono">
              <span className="footer-interval">INTERVAL: 1 TICK / BAR</span>
              <span className="footer-live">● REAL-TIME ENGINE FEED</span>
              <span className="footer-holding">
                PORTFOLIO ALLOCATION: <strong>{getHoldingQty(activeStock.ticker)} SHARES</strong> (₡{(getHoldingQty(activeStock.ticker) * activeStock.price).toFixed(2)})
              </span>
            </div>
          </div>

          {/* Right: Vertical Market Movers Watchlist */}
          <div className="wolf-watchlist-card">
            <div className="watchlist-header">
              <div className="wl-title-group">
                <h3 className="font-editorial">MARKET MOVERS</h3>
                <span className="wl-count mono">{market.prices.length} INSTRUMENTS</span>
              </div>
              <span className="wl-sub font-mono">Live Manhattan Quote Board</span>
            </div>

            <div className="watchlist-items-container">
              {market.prices.map(stock => {
                const isSelected = stock.ticker === activeStock.ticker;
                const isUp = stock.change >= 0;
                const holding = getHoldingQty(stock.ticker);
                const stockCandles = candles[stock.ticker]?.candles || [];

                return (
                  <div
                    key={stock.ticker}
                    className={`watchlist-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTicker(stock.ticker)}
                  >
                    <div className="wl-item-left">
                      <div className="wl-ticker-line">
                        <span className="wl-ticker mono">{stock.ticker}</span>
                        {holding > 0 && <span className="wl-owned-tag mono">OWNED: {holding}</span>}
                      </div>
                      <span className="wl-name">{stock.name}</span>
                      <span className="wl-sector font-mono">{stock.sector}</span>
                    </div>

                    <div className="wl-item-center">
                      <div className="wl-mini-chart" style={{ width: 80, height: 32 }}>
                        <MiniChart candles={stockCandles} isUp={isUp} />
                      </div>
                    </div>

                    <div className="wl-item-right">
                      <div className="wl-price mono">₡{stock.price.toFixed(2)}</div>
                      <div className={`wl-change mono ${isUp ? 'emerald' : 'oxblood'}`}>
                        {isUp ? '▲ +' : '▼ '}{stock.change_percent.toFixed(2)}%
                      </div>
                      <div className="wl-quick-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="wl-btn-buy"
                          onClick={() => setTradeModal({ ticker: stock.ticker, side: 'BUY', price: stock.price, name: stock.name })}
                          title={`Buy ${stock.ticker}`}
                        >
                          BUY
                        </button>
                        <button
                          className="wl-btn-sell"
                          onClick={() => setTradeModal({ ticker: stock.ticker, side: 'SELL', price: stock.price, name: stock.name })}
                          disabled={holding <= 0}
                          title={`Sell ${stock.ticker}`}
                        >
                          SELL
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 7. Financial News in a Newspaper-Inspired Panel ── */}
        <section id="wolf-chronicle-section" className="wolf-chronicle-wrapper">
          {news && (
            <NewsTicker
              news={news}
              currentTick={gameState.current_tick}
              tickSeconds={gameState.tick_seconds}
            />
          )}
        </section>

        {/* ── 6. Sophisticated Lower Ledger (Positions & Execution Audit) ── */}
        <section id="wolf-ledger-section" className="wolf-lower-ledger-deck">
          <div className="ledger-tabs-bar">
            <div className="ledger-tabs-group">
              <button
                className={`ledger-tab-btn ${activeBottomTab === 'holdings' ? 'active' : ''}`}
                onClick={() => setActiveBottomTab('holdings')}
              >
                💼 Executive Portfolio Positions ({portfolio?.holdings?.filter(h => h.quantity > 0).length || 0})
              </button>
              <button
                className={`ledger-tab-btn ${activeBottomTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveBottomTab('orders')}
              >
                📜 Execution Audit Trail ({orders.length} Executed)
              </button>
              <button
                className={`ledger-tab-btn ${activeBottomTab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setActiveBottomTab('leaderboard')}
              >
                🏆 Floor Standings & Rankings ({leaderboard?.entries?.length || 0})
              </button>
            </div>
          </div>

          <div className="ledger-content-frame">
            {activeBottomTab === 'holdings' && portfolio && (
              <HoldingsTable
                holdings={portfolio.holdings}
                onTradeStock={(ticker) => {
                  const stock = market.prices.find(p => p.ticker === ticker);
                  if (stock) {
                    setTradeModal({ ticker: stock.ticker, side: 'SELL', price: stock.price, name: stock.name });
                  }
                }}
              />
            )}

            {activeBottomTab === 'orders' && (
              <OrderHistory orders={orders} maxTrades={gameState.max_trades} />
            )}

            {activeBottomTab === 'leaderboard' && (
              <div className="wolf-inline-standings">
                {leaderboard && leaderboard.entries.length > 0 ? (
                  <div className="standings-table-container">
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th>RANK</th>
                          <th>TRADING DESK</th>
                          <th>PORTFOLIO VALUE</th>
                          <th>SESSION P&L</th>
                          <th>RETURN %</th>
                          <th>22-TRADE QUOTA</th>
                          <th>BREADTH</th>
                          <th>QUALIFICATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.entries.map((entry) => {
                          const isSelf = entry.team_code === teamCode;
                          const isProfitable = entry.profit_loss >= 0;
                          const delta = dashboardRankDeltas.get(entry.team_code);
                          const isChanged = dashboardChangedRows.has(entry.team_code);
                          const tradeProgress = Math.min(100, (entry.trade_count / (gameState.max_trades || 22)) * 100);

                          return (
                            <tr
                              key={entry.team_code}
                              className={`${isSelf ? 'highlight-self' : ''} ${isChanged ? 'row-changed-pulse' : ''}`}
                            >
                              <td className="mono rank-cell">
                                <div className="rank-badge-wrapper">
                                  <span>
                                    {entry.rank === 1 ? '🥇 #1' : entry.rank === 2 ? '🥈 #2' : entry.rank === 3 ? '🥉 #3' : `#${entry.rank}`}
                                  </span>
                                  {delta !== undefined && delta !== 0 && (
                                    <span className={`rank-delta-pill ${delta > 0 ? 'delta-up' : 'delta-down'}`}>
                                      {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="desk-cell">
                                <strong className="mono">{entry.team_code}</strong>
                                {isSelf && <span className="self-tag">(YOUR DESK)</span>}
                                {entry.display_name && <span className="sub-desk"> — {entry.display_name}</span>}
                              </td>
                              <td className="mono bold-val" style={{ color: 'var(--gold-bright)' }}>
                                ₡{entry.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className={`mono ${isProfitable ? 'emerald' : 'oxblood'}`} style={{ fontWeight: 800 }}>
                                {isProfitable ? '+' : ''}₡{entry.profit_loss.toFixed(2)}
                              </td>
                              <td>
                                <span className={`badge ${isProfitable ? 'badge-green' : 'badge-red'}`}>
                                  {isProfitable ? '▲ +' : '▼ '}{entry.profit_loss_percent.toFixed(2)}%
                                </span>
                              </td>
                              <td>
                                <div className="quota-cell">
                                  <div className="quota-text mono">
                                    <span>{entry.trade_count} / {gameState.max_trades || 22}</span>
                                    <span className="quota-pct">{Math.round(tradeProgress)}%</span>
                                  </div>
                                  <div className="quota-track">
                                    <div
                                      className={`quota-fill ${entry.trade_count >= (gameState.max_trades || 22) ? 'quota-completed' : ''}`}
                                      style={{ width: `${tradeProgress}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="mono">
                                <span className="breadth-tag">{entry.companies_traded} co</span>
                              </td>
                              <td>
                                <span className={`badge ${entry.is_eligible ? 'badge-green' : 'badge-yellow'}`}>
                                  {entry.is_eligible ? '✓ QUALIFIED' : '⏳ PENDING'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="standings-empty-note font-editorial">
                    Official Floor Standings will update on next tick calculation.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ── Floor Standings Grand Executive Modal ── */}
      {leaderboardModalOpen && (
        <div className="modal-overlay" onClick={() => setLeaderboardModalOpen(false)}>
          <div className="modal-content wolf-leaderboard-modal" onClick={e => e.stopPropagation()}>
            <div className="wolf-modal-header">
              <div className="wm-title-group">
                <span className="wm-badge font-mono">OFFICIAL NEW YORK FLOOR STANDINGS</span>
                <h2 className="font-serif">WALL STREET CHAMPIONS OF THE FLOOR — TICK {gameState.current_tick}</h2>
              </div>
              <button className="btn btn-icon btn-outline" onClick={() => setLeaderboardModalOpen(false)}>✕</button>
            </div>

            <div className="wolf-modal-body">
              {leaderboard && leaderboard.entries.length > 0 ? (
                <>
                  {/* Top 3 Podium Cards inside Modal */}
                  <div className="modal-podium-row">
                    {leaderboard.entries.slice(0, 3).map((podiumTeam, pIdx) => {
                      const isSelf = podiumTeam.team_code === teamCode;
                      const isProfitable = podiumTeam.profit_loss >= 0;
                      return (
                        <div
                          key={podiumTeam.team_code}
                          className={`modal-podium-card podium-rank-${pIdx + 1} ${isSelf ? 'highlight-self' : ''}`}
                        >
                          <div className="podium-badge">
                            {pIdx === 0 ? '🥇 1ST PLACE' : pIdx === 1 ? '🥈 2ND PLACE' : '🥉 3RD PLACE'}
                            {isSelf && ' • (YOU)'}
                          </div>
                          <div className="podium-team mono">{podiumTeam.team_code}</div>
                          <div className="podium-name font-editorial">{podiumTeam.display_name || 'Trading Desk'}</div>
                          <div className="podium-value mono">₡{podiumTeam.portfolio_value.toFixed(2)}</div>
                          <div className={`podium-pl mono ${isProfitable ? 'price-up' : 'price-down'}`}>
                            {isProfitable ? '+' : ''}₡{podiumTeam.profit_loss.toFixed(2)} ({podiumTeam.profit_loss_percent.toFixed(2)}%)
                          </div>
                          <div className="quota-track" style={{ marginTop: 8 }}>
                            <div
                              className={`quota-fill ${podiumTeam.trade_count >= (gameState.max_trades || 22) ? 'quota-completed' : ''}`}
                              style={{ width: `${Math.min(100, (podiumTeam.trade_count / (gameState.max_trades || 22)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="modal-standings-scroll">
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th>RANK</th>
                          <th>TRADING DESK</th>
                          <th>PORTFOLIO VALUE</th>
                          <th>SESSION P&L</th>
                          <th>RETURN %</th>
                          <th>22-TRADE QUOTA</th>
                          <th>BREADTH</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.entries.map((entry) => {
                          const isSelf = entry.team_code === teamCode;
                          const isProfitable = entry.profit_loss >= 0;
                          const delta = dashboardRankDeltas.get(entry.team_code);
                          const tradeProgress = Math.min(100, (entry.trade_count / (gameState.max_trades || 22)) * 100);

                          return (
                            <tr key={entry.team_code} className={isSelf ? 'highlight-self' : ''}>
                              <td className="mono rank-cell">
                                <div className="rank-badge-wrapper">
                                  <span>
                                    {entry.rank === 1 ? '🥇 #1' : entry.rank === 2 ? '🥈 #2' : entry.rank === 3 ? '🥉 #3' : `#${entry.rank}`}
                                  </span>
                                  {delta !== undefined && delta !== 0 && (
                                    <span className={`rank-delta-pill ${delta > 0 ? 'delta-up' : 'delta-down'}`}>
                                      {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="desk-cell">
                                <strong className="mono">{entry.team_code}</strong>
                                {isSelf && <span className="self-tag">(YOUR DESK)</span>}
                                {entry.display_name && <span className="sub-desk"> — {entry.display_name}</span>}
                              </td>
                              <td className="mono bold-val" style={{ color: 'var(--gold-bright)' }}>
                                ₡{entry.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className={`mono ${isProfitable ? 'emerald' : 'oxblood'}`} style={{ fontWeight: 800 }}>
                                {isProfitable ? '+' : ''}₡{entry.profit_loss.toFixed(2)}
                              </td>
                              <td>
                                <span className={`badge ${isProfitable ? 'badge-green' : 'badge-red'}`}>
                                  {isProfitable ? '▲ +' : '▼ '}{entry.profit_loss_percent.toFixed(2)}%
                                </span>
                              </td>
                              <td>
                                <div className="quota-cell">
                                  <div className="quota-text mono">
                                    <span>{entry.trade_count} / {gameState.max_trades || 22}</span>
                                    <span className="quota-pct">{Math.round(tradeProgress)}%</span>
                                  </div>
                                  <div className="quota-track">
                                    <div
                                      className={`quota-fill ${entry.trade_count >= (gameState.max_trades || 22) ? 'quota-completed' : ''}`}
                                      style={{ width: `${tradeProgress}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="mono">
                                <span className="breadth-tag">{entry.companies_traded} co</span>
                              </td>
                              <td>
                                <span className={`badge ${entry.is_eligible ? 'badge-green' : 'badge-yellow'}`}>
                                  {entry.is_eligible ? '✓ QUALIFIED' : '⏳ PENDING'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="empty-modal-note font-editorial">
                  Floor standings will populate once official ticks commence.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Order Execution Modal ── */}
      {tradeModal && (
        <TradeModal
          ticker={tradeModal.ticker}
          name={tradeModal.name}
          side={tradeModal.side}
          currentPrice={tradeModal.price}
          cash={portfolio?.cash || 0}
          holdingQty={getHoldingQty(tradeModal.ticker)}
          feePercent={gameState.trade_fee_percent}
          onConfirm={(qty) => handleTrade(tradeModal.ticker, qty, tradeModal.side)}
          onClose={() => setTradeModal(null)}
        />
      )}

      {/* ── Candlestick Modal for Deep Dive ── */}
      {chartModal && market.prices.find(p => p.ticker === chartModal) && (
        <ChartModal
          stock={market.prices.find(p => p.ticker === chartModal)!}
          candles={candles[chartModal]?.candles || []}
          onClose={() => setChartModal(null)}
          onOpenTrade={(side) => {
            const stock = market.prices.find(p => p.ticker === chartModal);
            if (stock) {
              setTradeModal({ ticker: stock.ticker, side, price: stock.price, name: stock.name });
            }
          }}
        />
      )}

      {/* ── Toast Notifications ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
