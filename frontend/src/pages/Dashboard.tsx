/* ── Dashboard — Main Trading Terminal ── */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getGameState, getMarketOverview, getNews, getPortfolio,
  getOrders, getCandles, submitBuy, submitSell,
  createMarketWebSocket, logout
} from '../api/client';
import type {
  GameState, MarketOverview, NewsResponse, Portfolio,
  OrderResponse, CandlesResponse, CompanyPrice, WSMarketMessage
} from '../types';
import NewsTicker from '../components/NewsTicker';
import PortfolioPanel from '../components/PortfolioPanel';
import HoldingsTable from '../components/HoldingsTable';
import OrderHistory from '../components/OrderHistory';
import TradeModal from '../components/TradeModal';
import AdvancedChart from '../components/AdvancedChart';
import './Dashboard.css';

// Subtle audio chime for trade execution (synthesized via Web Audio API)
const playTradeSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [market, setMarket] = useState<MarketOverview | null>(null);
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [candles, setCandles] = useState<Record<string, CandlesResponse>>({});

  const [tradeModal, setTradeModal] = useState<{
    ticker: string; side: 'BUY' | 'SELL'; price: number; name: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const [showOrderBookInfo, setShowOrderBookInfo] = useState<boolean>(false);
  
  const prevPricesRef = useRef<Record<string, number>>({});
  const fetchAllDataRef = useRef<() => void>(() => {});
  const intervalRef = useRef<number | null>(null);

  const teamCode = localStorage.getItem('ms_team_code') || '';
  const displayName = localStorage.getItem('ms_display_name') || '';

  // ── Trigger dynamic price flash animations ──
  const triggerPriceFlashes = (newPrices: CompanyPrice[]) => {
    const flashes: Record<string, 'up' | 'down'> = {};
    newPrices.forEach(p => {
      const prev = prevPricesRef.current[p.ticker];
      if (prev !== undefined && prev !== p.price) {
        flashes[p.ticker] = p.price > prev ? 'up' : 'down';
      }
      prevPricesRef.current[p.ticker] = p.price;
    });

    if (Object.keys(flashes).length > 0) {
      setPriceFlashes(prev => ({ ...prev, ...flashes }));
      setTimeout(() => {
        setPriceFlashes(prev => {
          const next = { ...prev };
          Object.keys(flashes).forEach(k => delete next[k]);
          return next;
        });
      }, 1200);
    }
  };

  // ── Fetch all data ──
  const fetchAllData = useCallback(async () => {
    try {
      const [gs, mk, nw, pf, od] = await Promise.all([
        getGameState(), getMarketOverview(), getNews(),
        getPortfolio(), getOrders(),
      ]);
      setGameState(gs);
      if (mk?.prices) {
        triggerPriceFlashes(mk.prices);
      }
      setMarket(mk);
      setNews(nw);
      setPortfolio(pf);
      setOrders(od.orders || []);
      setIsReconnecting(false);

      // Fetch candles for all companies
      const tickers = (mk.prices || []).map((p: CompanyPrice) => p.ticker);
      const candlePromises = tickers.map((t: string) => getCandles(t));
      const candleResults = await Promise.all(candlePromises);
      const candleMap: Record<string, CandlesResponse> = {};
      candleResults.forEach((c: CandlesResponse) => {
        candleMap[c.ticker] = c;
      });
      setCandles(candleMap);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

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
              // Tick advanced! Refresh portfolio and orders to show filled orders
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
            triggerPriceFlashes(data.prices as any);
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
  const handleTrade = async (
    ticker: string,
    quantity: number,
    side: 'BUY' | 'SELL',
    onRetryStatus?: (msg: string) => void,
  ) => {
    try {
      const retryCallback = (attempt: number, maxRetries: number) => {
        const msg = `⏳ High trading volume on server. Please wait, automatically retrying... (Attempt ${attempt}/${maxRetries})`;
        if (onRetryStatus) onRetryStatus(msg);
        showToast(msg, 'error');
      };

      if (side === 'BUY') {
        await submitBuy(ticker, quantity, retryCallback);
      } else {
        await submitSell(ticker, quantity, retryCallback);
      }
      playTradeSound();
      showToast(`${side} order confirmed: ${quantity} shares of ${ticker} (executing at Tick ${gameState!.current_tick + 1})`, 'success');
      setTradeModal(null);
      fetchAllData();
    } catch (err: any) {
      if (err.message && err.message.includes('another device')) {
        showToast('⚠️ Session ended: Another device logged into this team account.', 'error');
        setTimeout(() => {
          localStorage.clear();
          navigate('/');
        }, 3000);
      } else {
        showToast(err.message || 'Order failed', 'error');
      }
      throw err;
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
        <div className="loading-spinner" style={{ width: 44, height: 44 }} />
        <p style={{ letterSpacing: '0.1em', color: 'var(--gold-light)' }}>INITIALIZING TRADING TERMINAL...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-logo" onClick={() => setActiveTab('OVERVIEW')}>
            <div className="dash-logo-icon">
              <svg viewBox="0 0 64 64">
                <path d="M7 53h50" />
                <path d="M13 48V36" />
                <path d="M27 48V29" />
                <path d="M41 48V21" />
                <path d="M55 48V12" />
                <path d="M10 34l15-11 9 5 17-18" />
                <path d="M44 10h8v8" />
              </svg>
            </div>
            <div className="dash-logo-text">
              <span className="logo-title">THE WALL STREET ARENA</span>
              <span className="logo-sub">INSTITUTIONAL TERMINAL</span>
            </div>
          </div>

          <div className="dash-status-pills">
            <span className={`badge ${gameState.status === 'RUNNING' ? 'badge-green' : 'badge-yellow'}`}>
              {gameState.status === 'RUNNING' && (
                <div className="radar-pulse-container" style={{ marginRight: 6 }}>
                  <span className="radar-dot"></span>
                  <span className="radar-ring"></span>
                </div>
              )}
              {gameState.status}
            </span>

            <span className="dash-tick mono">
              TICK {gameState.current_tick} / {gameState.max_tick}
            </span>

            {countdown > 0 && (
              <span className={`dash-countdown mono ${countdown <= 5 ? 'dash-countdown-urgent' : ''}`}>
                ⏱ {countdown}s
              </span>
            )}

            {isReconnecting && (
              <span className="badge badge-red">⚡ Reconnecting...</span>
            )}
          </div>
        </div>

        <div className="dash-header-right">
          <div className="dash-team-info">
            <span className="dash-team-name">{displayName}</span>
            <span className="dash-team-code">{teamCode}</span>
          </div>
          <button className="btn btn-outline btn-sm logout-btn" onClick={handleLogout}>LOGOUT</button>
        </div>
      </header>

      {/* ── Permanent Market Rule Notice ── */}
      <div className="dash-permanent-notice">
        <span className="notice-icon">⚡</span>
        <span className="notice-text">
          <strong>TRADING RULE:</strong> Orders fill at the <u>next tick's price</u>. Minimum order: ₡100 | Fee: 0.4% | Max 22 trades.
        </span>
      </div>

      {/* ── Live Top Ticker Tape Ribbon ── */}
      <div className="dash-ticker-tape">
        <div className="ticker-tape-label">
          <span className="live-blip"></span>
          <span>MARKET TICKER</span>
        </div>
        <div className="ticker-tape-track">
          {market.prices.map(stock => {
            const flash = priceFlashes[stock.ticker];
            const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : '';
            const isUp = stock.change >= 0;
            return (
              <button
                key={stock.ticker}
                className={`tape-item ${activeTab === stock.ticker ? 'active' : ''} ${flashClass}`}
                onClick={() => setActiveTab(stock.ticker)}
              >
                <span className="tape-ticker">{stock.ticker}</span>
                <span className="tape-price mono">₡{stock.price.toFixed(2)}</span>
                <span className={`tape-change mono ${isUp ? 'price-up' : 'price-down'}`}>
                  {isUp ? '▲ +' : '▼ '}{stock.change_percent.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Layout with Sidebar ── */}
      <div className="dash-layout">
        {/* ── Main Content Area ── */}
        <div className="dash-main">
          {activeTab === 'OVERVIEW' ? (
            <div className="overview-container animate-fade-in">
              {portfolio && <PortfolioPanel portfolio={portfolio} />}
              {news && <NewsTicker news={news} currentTick={gameState.current_tick} tickSeconds={gameState.tick_seconds} />}
              <div className="bottom-panels">
                <div className="panel-left">
                  {portfolio && <HoldingsTable holdings={portfolio.holdings} />}
                  <OrderHistory orders={orders} maxTrades={gameState.max_trades} />
                </div>
              </div>
            </div>
          ) : (
            <div className="company-dashboard-view animate-fade-in">
              {(() => {
                const stock = market.prices.find(p => p.ticker === activeTab);
                if (!stock) return null;
                const stockCandles = candles[stock.ticker]?.candles || [];
                const holdingQty = getHoldingQty(stock.ticker);
                const isUp = stock.change >= 0;
                const colorClass = stock.change > 0 ? 'price-up' : stock.change < 0 ? 'price-down' : 'price-neutral';
                const flash = priceFlashes[stock.ticker];
                const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : '';

                // Simulated High, Low, Open from candles or current price
                const currentP = stock.price;
                const lastCandle = stockCandles.length > 0 ? stockCandles[stockCandles.length - 1] : null;
                const highP = lastCandle ? Math.max(lastCandle.high, currentP) : (currentP * 1.025);
                const lowP = lastCandle ? Math.min(lastCandle.low, currentP) : (currentP * 0.975);
                const openP = lastCandle ? lastCandle.open : currentP - stock.change;
                const spreadP = (currentP * 0.0012).toFixed(2);

                return (
                  <div className="company-dash-container">
                    {/* Top Company Bar */}
                    <div className="company-dash-header card">
                      <div className="cd-info">
                        <div className="cd-title">
                          <h2>{stock.ticker}</h2>
                          <span className="cd-name">{stock.name}</span>
                          <span className="sc-sector-badge">{stock.sector}</span>
                        </div>
                      </div>

                      <div className={`cd-price-block ${flashClass}`}>
                        <span className={`sc-price mono ${colorClass}`}>₡{stock.price.toFixed(2)}</span>
                        <span className={`sc-change mono ${colorClass}`}>
                          {isUp ? '▲ +' : '▼ '}{stock.change.toFixed(2)} ({stock.change_percent.toFixed(2)}%)
                        </span>
                      </div>

                      <div className="cd-actions">
                        {holdingQty > 0 && (
                          <div className="cd-holdings-badge mono">
                            <span>📦 {holdingQty} Shares</span>
                            <span className="cd-holdings-val">₡{(holdingQty * stock.price).toFixed(2)}</span>
                          </div>
                        )}
                        <button
                          className="btn btn-buy cd-trade-btn"
                          onClick={() => setTradeModal({ ticker: stock.ticker, side: 'BUY', price: stock.price, name: stock.name })}
                          disabled={gameState.status !== 'RUNNING'}
                        >
                          BUY {stock.ticker}
                        </button>
                        <button
                          className="btn btn-sell cd-trade-btn"
                          onClick={() => setTradeModal({ ticker: stock.ticker, side: 'SELL', price: stock.price, name: stock.name })}
                          disabled={gameState.status !== 'RUNNING' || holdingQty === 0}
                        >
                          SELL {stock.ticker}
                        </button>
                      </div>
                    </div>

                    {/* Intraday Stats Ribbon */}
                    <div className="intraday-stats-bar card">
                      <div className="stat-pill">
                        <span className="stat-pill-label">OPEN</span>
                        <span className="stat-pill-val mono">₡{openP.toFixed(2)}</span>
                      </div>
                      <div className="stat-divider"></div>
                      <div className="stat-pill">
                        <span className="stat-pill-label">HIGH</span>
                        <span className="stat-pill-val mono price-up">₡{highP.toFixed(2)}</span>
                      </div>
                      <div className="stat-divider"></div>
                      <div className="stat-pill">
                        <span className="stat-pill-label">LOW</span>
                        <span className="stat-pill-val mono price-down">₡{lowP.toFixed(2)}</span>
                      </div>
                      <div className="stat-divider"></div>
                      <div className="stat-pill">
                        <span className="stat-pill-label">SPREAD</span>
                        <span className="stat-pill-val mono">₡{spreadP} (0.12%)</span>
                      </div>
                      <div className="stat-divider"></div>
                      <div className="stat-pill">
                        <span className="stat-pill-label">STATUS</span>
                        <span className="stat-pill-val mono price-up">● REALTIME</span>
                      </div>
                    </div>

                    {/* Two-Column Trading Arena: Chart + Level 2 Order Book */}
                    <div className="company-arena-grid">
                      {/* Left: Interactive Candlestick Chart */}
                      <div className="company-dash-chart card">
                        <div className="chart-header-bar">
                          <span className="chart-title">INTRADAY CANDLESTICK TIMEFRAME</span>
                          <span className="chart-ticker-tag mono">{stock.ticker} / CR</span>
                        </div>
                        <div className="chart-canvas-wrapper">
                          <AdvancedChart candles={stockCandles} ticker={stock.ticker} isDarkTheme={true} />
                        </div>
                      </div>

                      {/* Right: Simulated Institutional Order Book / Depth */}
                      <div className="company-orderbook card">
                        <div className="ob-header">
                          <div className="ob-title-group">
                            <span className="ob-title">ORDER BOOK (LEVEL II)</span>
                            <button
                              type="button"
                              className="ob-info-btn"
                              onClick={() => setShowOrderBookInfo(true)}
                              title="What is an Order Book? Click to see explanation"
                              aria-label="Order Book Guide"
                            >
                              ⓘ
                            </button>
                          </div>
                          <span className="ob-spread mono">SPREAD ₡{spreadP}</span>
                        </div>

                        <div className="ob-columns">
                          <span>PRICE (₡)</span>
                          <span>SIZE</span>
                          <span>TOTAL</span>
                        </div>

                        {/* Asks (Sell Orders - Red) */}
                        <div className="ob-list ob-asks">
                          {[
                            { p: currentP * 1.012, q: 350, d: 85 },
                            { p: currentP * 1.008, q: 220, d: 65 },
                            { p: currentP * 1.005, q: 180, d: 50 },
                            { p: currentP * 1.002, q: 110, d: 30 },
                          ].map((ask, idx) => (
                            <div
                              key={idx}
                              className="ob-row ask-row mono"
                              onClick={() => setTradeModal({ ticker: stock.ticker, side: 'BUY', price: Number(ask.p.toFixed(2)), name: stock.name })}
                              title="Click to place matching Buy order"
                            >
                              <div className="ob-bar ask-bar" style={{ width: `${ask.d}%` }}></div>
                              <span className="ob-price price-down">₡{ask.p.toFixed(2)}</span>
                              <span className="ob-qty">{ask.q}</span>
                              <span className="ob-tot">₡{(ask.p * ask.q).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Mid Market Price Marker */}
                        <div className={`ob-mid-price mono ${colorClass} ${flashClass}`}>
                          <span>₡{currentP.toFixed(2)}</span>
                          <span className="ob-mid-label">{isUp ? '▲ UPTICK' : '▼ DOWNTICK'}</span>
                        </div>

                        {/* Bids (Buy Orders - Green) */}
                        <div className="ob-list ob-bids">
                          {[
                            { p: currentP * 0.998, q: 140, d: 35 },
                            { p: currentP * 0.995, q: 210, d: 55 },
                            { p: currentP * 0.992, q: 280, d: 70 },
                            { p: currentP * 0.988, q: 420, d: 90 },
                          ].map((bid, idx) => (
                            <div
                              key={idx}
                              className="ob-row bid-row mono"
                              onClick={() => setTradeModal({ ticker: stock.ticker, side: 'SELL', price: Number(bid.p.toFixed(2)), name: stock.name })}
                              title="Click to place matching Sell order"
                            >
                              <div className="ob-bar bid-bar" style={{ width: `${bid.d}%` }}></div>
                              <span className="ob-price price-up">₡{bid.p.toFixed(2)}</span>
                              <span className="ob-qty">{bid.q}</span>
                              <span className="ob-tot">₡{(bid.p * bid.q).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="ob-footer">
                          <button
                            className="btn btn-buy btn-sm ob-action-btn"
                            onClick={() => setTradeModal({ ticker: stock.ticker, side: 'BUY', price: stock.price, name: stock.name })}
                            disabled={gameState.status !== 'RUNNING'}
                          >
                            QUICK BUY
                          </button>
                          <button
                            className="btn btn-sell btn-sm ob-action-btn"
                            onClick={() => setTradeModal({ ticker: stock.ticker, side: 'SELL', price: stock.price, name: stock.name })}
                            disabled={gameState.status !== 'RUNNING' || holdingQty === 0}
                          >
                            QUICK SELL
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Right Sidebar Navigation ── */}
        <aside className="dash-sidebar">
          <div className="sidebar-section">
            <button className={`sidebar-btn ${activeTab === 'OVERVIEW' ? 'active' : ''}`} onClick={() => setActiveTab('OVERVIEW')}>
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-label">TERMINAL OVERVIEW</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">MARKET WATCHLIST</div>
            <div className="sidebar-companies">
              {market.prices.map(stock => {
                const flash = priceFlashes[stock.ticker];
                const flashClass = flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : '';
                const isUp = stock.change >= 0;

                return (
                  <button 
                    key={stock.ticker}
                    className={`sidebar-btn company-btn ${activeTab === stock.ticker ? 'active' : ''} ${flashClass}`}
                    onClick={() => setActiveTab(stock.ticker)}
                  >
                    <div className="sidebar-company-info">
                      <div className="sidebar-company-name-block">
                        <span className="sidebar-ticker">{stock.ticker}</span>
                        <span className="sidebar-name-sub">{stock.name}</span>
                      </div>
                      <div className="sidebar-company-price-block">
                        <span className={`sidebar-price mono ${isUp ? 'price-up' : 'price-down'}`}>
                          ₡{stock.price.toFixed(2)}
                        </span>
                        <span className={`sidebar-pct mono ${isUp ? 'price-up' : 'price-down'}`}>
                          {isUp ? '+' : ''}{stock.change_percent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Trade Modal ── */}
      {tradeModal && (
        <TradeModal
          ticker={tradeModal.ticker}
          name={tradeModal.name}
          side={tradeModal.side}
          currentPrice={tradeModal.price}
          cash={portfolio?.cash || 0}
          holdingQty={getHoldingQty(tradeModal.ticker)}
          feePercent={gameState.trade_fee_percent}
          onConfirm={(qty, onRetry) => handleTrade(tradeModal.ticker, qty, tradeModal.side, onRetry)}
          onClose={() => setTradeModal(null)}
        />
      )}

      {/* ── Order Book Info Modal ── */}
      {showOrderBookInfo && (
        <div className="modal-overlay" onClick={() => setShowOrderBookInfo(false)}>
          <div className="modal-content ob-info-modal" onClick={e => e.stopPropagation()}>
            <div className="ob-info-modal-header">
              <div className="ob-info-modal-title">
                <span className="ob-modal-icon">ⓘ</span>
                <h3>WHAT IS THE ORDER BOOK?</h3>
              </div>
              <button className="btn btn-icon btn-outline" onClick={() => setShowOrderBookInfo(false)}>✕</button>
            </div>

            <div className="ob-info-modal-body">
              <p className="ob-info-lead">
                In real financial markets (NYSE, NASDAQ, Bloomberg terminals), the <strong>Order Book (Level II)</strong> shows real-time buy and sell orders waiting to be filled.
              </p>

              <div className="ob-info-cards">
                <div className="ob-info-item ask-info">
                  <div className="ob-info-badge badge-red">🔴 ASKS (SELLERS — TOP)</div>
                  <p>
                    These are <strong>sellers</strong> offering their shares. Their prices are <strong>above</strong> current market price. The colored horizontal bar shows how many shares are waiting at each price level (liquidity depth).
                  </p>
                </div>

                <div className="ob-info-item mid-info">
                  <div className="ob-info-badge badge-gold">⚪ MARKET PRICE (CENTER)</div>
                  <p>
                    The current trading price. It flashes <strong>green (▲ UPTICK)</strong> when the price rises and <strong>red (▼ DOWNTICK)</strong> when it drops.
                  </p>
                </div>

                <div className="ob-info-item bid-info">
                  <div className="ob-info-badge badge-green">🟢 BIDS (BUYERS — BOTTOM)</div>
                  <p>
                    These are <strong>buyers</strong> wanting to purchase shares. Their prices are <strong>below</strong> current market price. Wider bars indicate strong buyer demand.
                  </p>
                </div>

                <div className="ob-info-item spread-info">
                  <div className="ob-info-badge badge-gold">⚡ SPREAD</div>
                  <p>
                    The price gap between the lowest seller and highest buyer. A tight spread means high trading liquidity and efficient pricing.
                  </p>
                </div>
              </div>

              <div className="ob-info-pro-tip">
                <span className="tip-star">💡</span>
                <div>
                  <strong>PRO TRADER SHORTCUT:</strong> You can <u>click directly on any price row</u> in the order book to immediately open the Trade Window with that price pre-filled!
                </div>
              </div>
            </div>

            <div className="ob-info-modal-footer">
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowOrderBookInfo(false)}>
                GOT IT, LET'S TRADE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span style={{ fontSize: '1.2rem' }}>{toast.type === 'success' ? '⚡' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
