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
import StockCard from '../components/StockCard';
import NewsTicker from '../components/NewsTicker';
import PortfolioPanel from '../components/PortfolioPanel';
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

  const [tradeModal, setTradeModal] = useState<{
    ticker: string; side: 'BUY' | 'SELL'; price: number; name: string;
  } | null>(null);
  const [chartModal, setChartModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [connected, setConnected] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);
  const teamCode = localStorage.getItem('ms_team_code') || '';
  const displayName = localStorage.getItem('ms_display_name') || '';

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
      setConnected(true);

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
      setConnected(false);
    }
  }, []);

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
    const ws = createMarketWebSocket(
      (data: WSMarketMessage) => {
        if (data.type === 'market_update') {
          setGameState(prev => {
            if (prev && prev.current_tick !== data.tick) {
              // Tick advanced! Refresh portfolio and orders to show filled orders
              fetchAllData();
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

          if (data.prices && market) {
            setMarket(prev => prev ? {
              ...prev,
              tick: data.tick,
              prices: prev.prices.map(p => {
                const updated = data.prices.find(dp => dp.ticker === p.ticker);
                return updated ? { ...p, price: updated.price, change: updated.change, change_percent: updated.change_percent } : p;
              })
            } : prev);
          }
          setConnected(true);
        }
      },
      () => setConnected(false),
    );
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [fetchAllData, market]);

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
      showToast(`${side} order placed: ${quantity} ${ticker} (fills at Tick ${gameState!.current_tick + 1})`, 'success');
      setTradeModal(null);
      fetchAllData();
    } catch (err: any) {
      showToast(err.message || 'Order failed', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        <p>Connecting to Market Sprint...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-logo">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <path d="M8 28L14 18L20 22L26 12L32 16" stroke="url(#hg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="hg" x1="8" y1="28" x2="32" y2="12"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
            </svg>
            <span>Market Sprint</span>
          </div>
          <div className="dash-status-pills">
            <span className={`badge ${gameState.status === 'RUNNING' ? 'badge-green' : 'badge-yellow'}`}>
              {gameState.status}
            </span>
            <span className="dash-tick mono">
              Tick {gameState.current_tick} / {gameState.max_tick}
            </span>
            {countdown > 0 && (
              <span className="dash-countdown mono">
                ⏱ {countdown}s
              </span>
            )}
            {!connected && (
              <span className="badge badge-red">⚡ Reconnecting...</span>
            )}
          </div>
        </div>
        <div className="dash-header-right">
          <div className="dash-team-info">
            <span className="dash-team-name">{displayName}</span>
            <span className="dash-team-code">{teamCode}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ── Permanent Market Rule Notice (Spec Section 16) ── */}
      <div className="dash-permanent-notice">
        <span className="notice-icon">⚡</span>
        <span className="notice-text">
          <strong>TRADING RULE:</strong> Orders fill at the <u>next tick's price</u>. Minimum order: ₡100 | Fee: 0.4% | Cooldown: 7s | Max 22 trades.
        </span>
      </div>

      {/* ── Portfolio Summary Bar ── */}
      {portfolio && <PortfolioPanel portfolio={portfolio} />}

      {/* ── News Ticker ── */}
      {news && <NewsTicker news={news} currentTick={gameState.current_tick} />}

      {/* ── Stock Grid ── */}
      <div className="stock-grid">
        {market.prices.map(stock => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            candles={candles[stock.ticker]?.candles || []}
            holdingQty={getHoldingQty(stock.ticker)}
            onClick={() => setChartModal(stock.ticker)}
            onBuy={(e) => { e.stopPropagation(); setTradeModal({ ticker: stock.ticker, side: 'BUY', price: stock.price, name: stock.name }) }}
            onSell={(e) => { e.stopPropagation(); setTradeModal({ ticker: stock.ticker, side: 'SELL', price: stock.price, name: stock.name }) }}
            gameStatus={gameState.status}
          />
        ))}
      </div>

      {/* ── Bottom Panels ── */}
      <div className="bottom-panels">
        <div className="panel-left">
          {portfolio && <HoldingsTable holdings={portfolio.holdings} />}
          <OrderHistory orders={orders} maxTrades={gameState.max_trades} />
        </div>
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
          onConfirm={(qty) => handleTrade(tradeModal.ticker, qty, tradeModal.side)}
          onClose={() => setTradeModal(null)}
        />
      )}

      {chartModal && market.prices.find(p => p.ticker === chartModal) && (
        <ChartModal
          stock={market.prices.find(p => p.ticker === chartModal)!}
          candles={candles[chartModal]?.candles || []}
          onClose={() => setChartModal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}
    </div>
  );
}
