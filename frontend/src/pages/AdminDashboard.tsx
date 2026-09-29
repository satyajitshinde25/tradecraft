/* ── Admin Dashboard — Wall Street Floor Master & Champions of the Floor ── */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminGetGame, adminStartGame, adminRestartGame,
  adminGetLeaderboard, adminGetOrders, adminGetAudit, logout,
  adminPauseGame, adminResumeGame, adminToggleTestMode,
  adminGetNewsScript, adminFireReserveHeadline, adminGetCandidateHeadlines,
  getMarketOverview
} from '../api/client';
import type { LeaderboardEntry, CompanyPrice } from '../types';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [game, setGame] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<{ tick: number; entries: LeaderboardEntry[] } | null>(null);
  const [marketPrices, setMarketPrices] = useState<CompanyPrice[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [newsScript, setNewsScript] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'orders' | 'news' | 'generator' | 'audit'>('leaderboard');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidateCat, setCandidateCat] = useState<string>('all');
  const [candidateLoading, setCandidateLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Leaderboard filters & inspection
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'qualified' | 'profitable' | 'top10'>('all');
  const [sortField, setSortField] = useState<'rank' | 'portfolio_value' | 'profit_loss' | 'trade_count' | 'profit_loss_percent'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDesk, setSelectedDesk] = useState<LeaderboardEntry | null>(null);

  // Rank change tracking
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<Map<string, number>>(new Map());
  const [recentlyChangedRows, setRecentlyChangedRows] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [g, lb, od, au, ns, mkt] = await Promise.all([
        adminGetGame(), adminGetLeaderboard(),
        adminGetOrders(), adminGetAudit(), adminGetNewsScript(),
        getMarketOverview().catch(() => null),
      ]);
      setGame(g);
      setLeaderboard(lb);
      setOrders(od.orders || []);
      setAudit(au.logs || []);
      setNewsScript(ns.events || []);
      if (mkt?.prices) setMarketPrices(mkt.prices);
    } catch (err) {
      console.error('Admin fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 4000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Track rank changes whenever leaderboard updates
  useEffect(() => {
    if (!leaderboard?.entries) return;
    const newDeltas = new Map<string, number>();
    const changedRows = new Set<string>();

    leaderboard.entries.forEach(entry => {
      const prev = prevRanksRef.current.get(entry.team_code);
      if (prev !== undefined && prev !== entry.rank) {
        // Delta: positive means improved (e.g. was 5, now 2 -> +3)
        const delta = prev - entry.rank;
        newDeltas.set(entry.team_code, delta);
        changedRows.add(entry.team_code);
      }
      prevRanksRef.current.set(entry.team_code, entry.rank);
    });

    if (newDeltas.size > 0) {
      setRankDeltas(newDeltas);
      setRecentlyChangedRows(changedRows);
      const timer = setTimeout(() => {
        setRecentlyChangedRows(new Set());
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [leaderboard]);

  useEffect(() => {
    if (!game?.next_tick_at) return;
    const tick = () => {
      const next = new Date(game.next_tick_at).getTime();
      const remaining = Math.max(0, Math.floor((next - Date.now()) / 1000));
      setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game?.next_tick_at]);

  const handleStart = async () => {
    try {
      await adminStartGame();
      showToast('Trading session opened! Market ticks advancing.', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRestart = async () => {
    try {
      await adminRestartGame();
      showToast('Exchange reset: all 25 teams restored to ₡10,000 starting capital.', 'success');
      setConfirmRestart(false);
      prevRanksRef.current.clear();
      setRankDeltas(new Map());
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    localStorage.clear();
    navigate('/');
  };

  const handlePause = async () => {
    try {
      await adminPauseGame();
      showToast('Trading floor halted (Paused).', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResume = async () => {
    try {
      await adminResumeGame();
      showToast('Trading floor session resumed.', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleTestMode = async () => {
    try {
      await adminToggleTestMode();
      showToast('Simulation clock velocity toggled.', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleFireReserve = async (id: string) => {
    try {
      await adminFireReserveHeadline(id);
      showToast('Reserve wire headline broadcasted live across floor!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const loadCandidates = async (cat: string) => {
    setCandidateLoading(true);
    setCandidateCat(cat);
    try {
      const res = await adminGetCandidateHeadlines(cat);
      setCandidates(res.candidates || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to generate templates', 'error');
    } finally {
      setCandidateLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Top 3 Podium Teams
  const top3 = useMemo(() => {
    if (!leaderboard?.entries) return [];
    return [...leaderboard.entries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  }, [leaderboard]);

  // Filtered and Sorted Entries
  const filteredEntries = useMemo(() => {
    if (!leaderboard?.entries) return [];
    let list = [...leaderboard.entries];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(e =>
        e.team_code.toLowerCase().includes(q) ||
        (e.display_name && e.display_name.toLowerCase().includes(q))
      );
    }

    if (filterMode === 'qualified') {
      list = list.filter(e => e.is_eligible);
    } else if (filterMode === 'profitable') {
      list = list.filter(e => e.profit_loss >= 0);
    } else if (filterMode === 'top10') {
      list = list.filter(e => e.rank <= 10);
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });

    return list;
  }, [leaderboard, searchTerm, filterMode, sortField, sortOrder]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'rank' ? 'asc' : 'desc');
    }
  };

  if (!game) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-loading-emblem">
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#080D14" stroke="#D6A84F" strokeWidth="2.5"/>
            <path d="M12 28C15 24 19 23 24 22C29 21 34 19 37 14C37 19 34 24 31 26C28 28 25 29 22 30C18 31 14 30 12 28Z" fill="url(#adm-spin-gold)"/>
            <defs>
              <linearGradient id="adm-spin-gold" x1="12" y1="14" x2="37" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFE8A3"/>
                <stop offset="0.5" stopColor="#D6A84F"/>
                <stop offset="1" stopColor="#9E7020"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="loading-spinner" style={{ width: 44, height: 44 }} />
        <div className="admin-loading-label">
          <h2 className="font-serif">WALL STREET EXCHANGE SURVEILLANCE</h2>
          <p className="font-editorial">Calibrating Floor Master Terminal & Standings Engine...</p>
        </div>
      </div>
    );
  }

  // Floor aggregated calculations
  const totalFloorTrades = orders.length;
  const qualifiedCount = leaderboard?.entries.filter(e => e.is_eligible).length || 0;
  const avgPortfolio = leaderboard?.entries.length
    ? leaderboard.entries.reduce((sum, e) => sum + e.portfolio_value, 0) / leaderboard.entries.length
    : game.starting_balance || 10000;
  const topLeader = top3[0];

  return (
    <div className="admin-dashboard">
      {/* ── Cinematic Manhattan Backdrop Elements ── */}
      <div className="admin-skyline-silhouette" />
      <div className="admin-bull-watermark">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 65C30 55 42 52 55 50C68 48 80 42 88 30C87 42 80 54 72 60C64 65 56 68 48 70C38 72 27 70 20 65Z" fill="url(#bg-bull-gold)"/>
          <path d="M88 30C82 25 70 22 58 24C48 26 38 32 30 40C38 36 48 34 58 35C70 36 80 40 88 48V30Z" fill="url(#bg-bull-gold)"/>
          <defs>
            <linearGradient id="bg-bull-gold" x1="20" y1="22" x2="88" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5DE9C" stopOpacity="0.8"/>
              <stop offset="0.5" stopColor="#C5A059" stopOpacity="0.4"/>
              <stop offset="1" stopColor="#8C6D33" stopOpacity="0.1"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="admin-ambient-glow" />

      {/* ── Live Continuous Broadcast Stock Marquee Ticker ── */}
      {marketPrices.length > 0 && (
        <div className="admin-ticker-tape">
          <div className="admin-ticker-track">
            {marketPrices.map(p => {
              const isUp = p.change >= 0;
              const isZero = p.change === 0;
              return (
                <span key={p.ticker} className="admin-ticker-item">
                  <span className="adm-ticker-sym">{p.ticker}</span>
                  <span className="adm-ticker-price mono">₡{p.price.toFixed(2)}</span>
                  <span className={`adm-ticker-delta mono ${isUp && !isZero ? 'price-up' : !isUp ? 'price-down' : 'price-neutral'}`}>
                    {isUp && !isZero ? '▲ +' : !isUp ? '▼ ' : ''}{p.change_percent.toFixed(2)}%
                  </span>
                </span>
              );
            })}
            <span className="admin-ticker-bulletin font-serif">
              🏛 <strong>NEW YORK FINANCIAL EXCHANGE • 25 ACTIVE TRADING DESKS • 22 TRADE TARGET • 0.4% BROKERAGE</strong>
            </span>
            <span className="admin-ticker-divider">◆</span>
            {marketPrices.map(p => {
              const isUp = p.change >= 0;
              const isZero = p.change === 0;
              return (
                <span key={`dup-${p.ticker}`} className="admin-ticker-item">
                  <span className="adm-ticker-sym">{p.ticker}</span>
                  <span className="adm-ticker-price mono">₡{p.price.toFixed(2)}</span>
                  <span className={`adm-ticker-delta mono ${isUp && !isZero ? 'price-up' : !isUp ? 'price-down' : 'price-neutral'}`}>
                    {isUp && !isZero ? '▲ +' : !isUp ? '▼ ' : ''}{p.change_percent.toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Executive Floor Master Header ── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-brand-icon">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="#080D14" stroke="#D6A84F" strokeWidth="2"/>
              <path d="M12 28C15 24 19 23 24 22C29 21 34 19 37 14C37 19 34 24 31 26C28 28 25 29 22 30C18 31 14 30 12 28Z" fill="url(#adm-bull-gold)"/>
              <defs>
                <linearGradient id="adm-bull-gold" x1="12" y1="14" x2="37" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFE8A3"/>
                  <stop offset="0.5" stopColor="#D6A84F"/>
                  <stop offset="1" stopColor="#9E7020"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="admin-header-titles">
            <h1 className="font-serif">WALL STREET FLOOR MASTER & SURVEILLANCE</h1>
            <span className="admin-sub font-editorial">NEW YORK EXECUTIVE EXCHANGE • SURVEILLANCE & LEADERBOARD DESK</span>
          </div>

          <div className="admin-status-group">
            <span className={`admin-status-pill ${game.status === 'RUNNING' ? 'status-running' : game.status === 'FINISHED' ? 'status-finished' : 'status-paused'}`}>
              <span className="admin-live-dot" />
              {game.status === 'RUNNING' ? 'FLOOR ACTIVE' : game.status}
            </span>
            <span className="mono admin-tick">TICK {game.current_tick} / {game.max_tick || 96}</span>
            {countdown > 0 && game.status === 'RUNNING' && (
              <span className="mono admin-countdown">⏱ NEXT: <strong>{countdown}s</strong></span>
            )}
          </div>
        </div>

        <div className="admin-header-right">
          <div className="admin-controls">
            {(game.status === 'DRAFT' || game.status === 'READY') && (
              <>
                <button className="btn btn-outline btn-sm" onClick={handleToggleTestMode} title="Toggle simulation tick velocity">
                  ⚡ Velocity: {game.is_test_mode ? 'Fast (1s)' : `Standard (${game.tick_seconds}s)`}
                </button>
                <button className="btn btn-buy btn-sm" onClick={handleStart}>
                  🔔 Open Trading Floor
                </button>
              </>
            )}
            {game.status === 'RUNNING' && (
              <button className="btn btn-outline btn-sm btn-halt" onClick={handlePause}>
                ⏸ Halt Trading Floor (Pause)
              </button>
            )}
            {game.status === 'PAUSED' && (
              <button className="btn btn-gold btn-sm" onClick={handleResume}>
                ▶ Resume Floor Session
              </button>
            )}
            <button
              className="btn btn-outline btn-sm btn-reset"
              onClick={() => setConfirmRestart(true)}
              title="Reset simulation and all 25 teams back to ₡10,000"
            >
              🔄 Reset Floor
            </button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Exit Desk</button>
        </div>
      </header>

      {/* ── Wall Street Overview HUD Metrics ── */}
      <div className="admin-stats-bar">
        <div className="admin-stat">
          <span className="admin-stat-label">REGISTERED DESKS</span>
          <div className="admin-stat-row">
            <span className="admin-stat-value mono">25</span>
            <span className="admin-stat-sub">Trading Teams</span>
          </div>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">QUALIFIED DESKS</span>
          <div className="admin-stat-row">
            <span className="admin-stat-value mono price-up">{qualifiedCount} / 25</span>
            <span className="admin-stat-sub">≥22 Trades</span>
          </div>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">FLOOR LEADER</span>
          <div className="admin-stat-row">
            <span className="admin-stat-value mono gold-text">{topLeader ? topLeader.team_code : '—'}</span>
            <span className="admin-stat-sub">{topLeader ? `₡${topLeader.portfolio_value.toFixed(2)}` : '₡10,000'}</span>
          </div>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">TOTAL ORDERS TRANSMITTED</span>
          <div className="admin-stat-row">
            <span className="admin-stat-value mono">{totalFloorTrades}</span>
            <span className="admin-stat-sub">Executed Trades</span>
          </div>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">FLOOR AVERAGE VALUATION</span>
          <div className="admin-stat-row">
            <span className="admin-stat-value mono">₡{avgPortfolio.toFixed(2)}</span>
            <span className="admin-stat-sub">Base ₡10,000</span>
          </div>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">SIMULATION VELOCITY</span>
          <div className="admin-stat-row">
            <span className="admin-stat-value mono">{game.is_test_mode ? '1.0s / tick' : `${game.tick_seconds}s / tick`}</span>
            <span className="admin-stat-sub">{game.is_test_mode ? 'Fast-Forward' : 'Standard'}</span>
          </div>
        </div>
      </div>

      {/* ── Operations Navigation Tabs ── */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Wall Street Champions & Standings ({leaderboard?.entries?.length || 0})
        </button>
        <button
          className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📋 Transmitted Floor Orders ({orders.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          📰 Financial Wire Script & Broadcast Controls ({newsScript.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'generator' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('generator');
            if (candidates.length === 0) loadCandidates('all');
          }}
        >
          💡 Headline Generator Utility
        </button>
        <button
          className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📜 Surveillance Audit Log ({audit.length})
        </button>
      </div>

      {/* ── Content Area ── */}
      <div className="admin-content">
        {/* TAB 1: WALL STREET CHAMPIONS LEADERBOARD */}
        {activeTab === 'leaderboard' && leaderboard && (
          <div className="admin-leaderboard-section">
            {/* ── Grand Top-3 Executive Podium ── */}
            {top3.length > 0 && (
              <div className="admin-podium-container">
                <div className="admin-podium-header">
                  <div className="podium-header-titles">
                    <span className="podium-eyebrow font-mono">EXECUTIVE FLOOR PODIUM</span>
                    <h2 className="font-serif podium-title">WALL STREET CHAMPIONS OF THE FLOOR</h2>
                  </div>
                  <div className="podium-live-tag font-mono">
                    TICK {leaderboard.tick} STANDINGS • ₡10,000 BASE CAPITAL
                  </div>
                </div>

                <div className="admin-podium-grid">
                  {/* 2nd Place Silver (Left) */}
                  {top3[1] && (
                    <div
                      className={`podium-card podium-silver ${selectedDesk?.team_code === top3[1].team_code ? 'podium-selected' : ''}`}
                      onClick={() => setSelectedDesk(top3[1])}
                    >
                      <div className="podium-medal-badge silver-badge">🥈 2ND PLACE • RUNNER UP</div>
                      <div className="podium-team-header">
                        <div className="podium-avatar silver-avatar">{top3[1].team_code.substring(0, 2)}</div>
                        <div className="podium-team-meta">
                          <span className="podium-code mono">{top3[1].team_code}</span>
                          <span className="podium-name font-editorial">{top3[1].display_name || 'Trading Desk'}</span>
                        </div>
                      </div>
                      <div className="podium-val-box">
                        <span className="podium-val-label font-mono">TOTAL VALUATION</span>
                        <div className="podium-value mono">₡{top3[1].portfolio_value.toFixed(2)}</div>
                      </div>
                      <div className="podium-metrics-row">
                        <span className={`podium-pl-pill mono ${top3[1].profit_loss >= 0 ? 'price-up' : 'price-down'}`}>
                          {top3[1].profit_loss >= 0 ? '▲ +' : '▼ '}₡{top3[1].profit_loss.toFixed(2)} ({top3[1].profit_loss_percent.toFixed(2)}%)
                        </span>
                        <span className="podium-trade-count mono">{top3[1].trade_count}/22 Trades</span>
                      </div>
                      <div className="podium-quota-bar">
                        <div
                          className="podium-quota-fill"
                          style={{
                            width: `${Math.min(100, (top3[1].trade_count / 22) * 100)}%`,
                            background: top3[1].is_eligible ? 'var(--green-light)' : 'var(--brass)'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 1st Place 24K Gold (Center, Elevated & Shimmering) */}
                  {top3[0] && (
                    <div
                      className={`podium-card podium-gold ${selectedDesk?.team_code === top3[0].team_code ? 'podium-selected' : ''}`}
                      onClick={() => setSelectedDesk(top3[0])}
                    >
                      <div className="gold-shimmer-sweep" />
                      <div className="podium-crown-icon">👑</div>
                      <div className="podium-medal-badge gold-badge">🥇 GRAND CHAMPION • TOP DESK</div>
                      <div className="podium-team-header">
                        <div className="podium-avatar gold-avatar">{top3[0].team_code.substring(0, 2)}</div>
                        <div className="podium-team-meta">
                          <span className="podium-code mono gold-glow-text">{top3[0].team_code}</span>
                          <span className="podium-name font-editorial">{top3[0].display_name || 'Floor Master'}</span>
                        </div>
                      </div>
                      <div className="podium-val-box">
                        <span className="podium-val-label font-mono">TOTAL PORTFOLIO VALUATION</span>
                        <div className="podium-value mono gold-value">₡{top3[0].portfolio_value.toFixed(2)}</div>
                      </div>
                      <div className="podium-metrics-row">
                        <span className={`podium-pl-pill gold-pl mono ${top3[0].profit_loss >= 0 ? 'price-up' : 'price-down'}`}>
                          {top3[0].profit_loss >= 0 ? '▲ +' : '▼ '}₡{top3[0].profit_loss.toFixed(2)} ({top3[0].profit_loss_percent.toFixed(2)}%)
                        </span>
                        <span className="podium-trade-count mono">{top3[0].trade_count}/22 Trades</span>
                      </div>
                      <div className="podium-quota-bar">
                        <div
                          className="podium-quota-fill gold-quota-fill"
                          style={{
                            width: `${Math.min(100, (top3[0].trade_count / 22) * 100)}%`,
                            background: top3[0].is_eligible ? 'var(--green-light)' : 'var(--gold-bright)'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 3rd Place Bronze (Right) */}
                  {top3[2] && (
                    <div
                      className={`podium-card podium-bronze ${selectedDesk?.team_code === top3[2].team_code ? 'podium-selected' : ''}`}
                      onClick={() => setSelectedDesk(top3[2])}
                    >
                      <div className="podium-medal-badge bronze-badge">🥉 3RD PLACE • LAUREL</div>
                      <div className="podium-team-header">
                        <div className="podium-avatar bronze-avatar">{top3[2].team_code.substring(0, 2)}</div>
                        <div className="podium-team-meta">
                          <span className="podium-code mono">{top3[2].team_code}</span>
                          <span className="podium-name font-editorial">{top3[2].display_name || 'Trading Desk'}</span>
                        </div>
                      </div>
                      <div className="podium-val-box">
                        <span className="podium-val-label font-mono">TOTAL VALUATION</span>
                        <div className="podium-value mono">₡{top3[2].portfolio_value.toFixed(2)}</div>
                      </div>
                      <div className="podium-metrics-row">
                        <span className={`podium-pl-pill mono ${top3[2].profit_loss >= 0 ? 'price-up' : 'price-down'}`}>
                          {top3[2].profit_loss >= 0 ? '▲ +' : '▼ '}₡{top3[2].profit_loss.toFixed(2)} ({top3[2].profit_loss_percent.toFixed(2)}%)
                        </span>
                        <span className="podium-trade-count mono">{top3[2].trade_count}/22 Trades</span>
                      </div>
                      <div className="podium-quota-bar">
                        <div
                          className="podium-quota-fill"
                          style={{
                            width: `${Math.min(100, (top3[2].trade_count / 22) * 100)}%`,
                            background: top3[2].is_eligible ? 'var(--green-light)' : 'var(--brass)'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Interactive Floor Standings Full-Width Table ── */}
            <div className="card admin-table-card admin-standings-card">
              <div className="admin-standings-toolbar">
                <div className="standings-toolbar-left">
                  <h3 className="font-serif standings-heading">
                    🏆 Official Floor Standings — Tick {leaderboard.tick}
                  </h3>
                  <span className="admin-card-badge mono">
                    {filteredEntries.length} of {leaderboard.entries.length} Desks Displayed
                  </span>
                </div>

                <div className="standings-toolbar-right">
                  <div className="standings-search-box">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      className="standings-search-input"
                      placeholder="Search team code or desk name..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button className="search-clear-btn" onClick={() => setSearchTerm('')}>✕</button>
                    )}
                  </div>

                  <div className="standings-filter-pills">
                    <button
                      className={`filter-pill ${filterMode === 'all' ? 'active' : ''}`}
                      onClick={() => setFilterMode('all')}
                    >
                      All (25)
                    </button>
                    <button
                      className={`filter-pill ${filterMode === 'qualified' ? 'active' : ''}`}
                      onClick={() => setFilterMode('qualified')}
                    >
                      ✓ Qualified ({qualifiedCount})
                    </button>
                    <button
                      className={`filter-pill ${filterMode === 'profitable' ? 'active' : ''}`}
                      onClick={() => setFilterMode('profitable')}
                    >
                      ▲ Profitable
                    </button>
                    <button
                      className={`filter-pill ${filterMode === 'top10' ? 'active' : ''}`}
                      onClick={() => setFilterMode('top10')}
                    >
                      Top 10
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Width Responsive Data Table */}
              <div className="admin-table-wrapper full-width-table-wrapper">
                <table className="data-table admin-leaderboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => toggleSort('rank')}>
                        Rank {sortField === 'rank' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th style={{ minWidth: '180px' }}>Trading Desk Identity</th>
                      <th style={{ minWidth: '150px', cursor: 'pointer' }} onClick={() => toggleSort('portfolio_value')}>
                        Total Portfolio {sortField === 'portfolio_value' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th style={{ minWidth: '130px' }}>Cash Reserve</th>
                      <th style={{ minWidth: '130px' }}>Holdings Value</th>
                      <th style={{ minWidth: '140px', cursor: 'pointer' }} onClick={() => toggleSort('profit_loss')}>
                        Net P/L {sortField === 'profit_loss' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th style={{ minWidth: '110px', cursor: 'pointer' }} onClick={() => toggleSort('profit_loss_percent')}>
                        Return % {sortField === 'profit_loss_percent' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th style={{ minWidth: '150px', cursor: 'pointer' }} onClick={() => toggleSort('trade_count')}>
                        22-Trade Quota {sortField === 'trade_count' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th style={{ minWidth: '95px' }}>Breadth</th>
                      <th style={{ minWidth: '125px' }}>Qualification</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((e: LeaderboardEntry, idx: number) => {
                      const isProfit = e.profit_loss >= 0;
                      const plClass = isProfit ? 'price-up' : 'price-down';
                      const delta = rankDeltas.get(e.team_code);
                      const isRecentlyChanged = recentlyChangedRows.has(e.team_code);
                      const isSelected = selectedDesk?.team_code === e.team_code;
                      const tradeProgress = Math.min(100, (e.trade_count / 22) * 100);

                      return (
                        <tr
                          key={e.team_code}
                          className={`leaderboard-row ${isSelected ? 'row-selected' : ''} ${isRecentlyChanged ? 'row-changed-pulse' : ''}`}
                          style={{ '--row-index': idx } as React.CSSProperties}
                          onClick={() => setSelectedDesk(e)}
                        >
                          {/* Rank with Medals & Rank Change Delta */}
                          <td className="mono rank-col">
                            <div className="rank-badge-wrapper">
                              <span className={`rank-number rank-${e.rank}`}>
                                {e.rank === 1 ? '🥇 1' : e.rank === 2 ? '🥈 2' : e.rank === 3 ? '🥉 3' : `#${e.rank}`}
                              </span>
                              {delta !== undefined && delta !== 0 && (
                                <span className={`rank-delta-pill ${delta > 0 ? 'delta-up' : 'delta-down'}`}>
                                  {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Desk Identity */}
                          <td>
                            <div className="admin-team-cell">
                              <div className="admin-tcode-row">
                                <span className="admin-tcode mono">{e.team_code}</span>
                                {e.rank <= 3 && <span className="top-laurel">★</span>}
                              </div>
                              <span className="admin-tname font-editorial">{e.display_name || 'Trading Desk'}</span>
                            </div>
                          </td>

                          {/* Total Valuation */}
                          <td className="mono portfolio-val-col">
                            <span className="portfolio-val-text">₡{e.portfolio_value.toFixed(2)}</span>
                          </td>

                          {/* Cash */}
                          <td className="mono cash-col">
                            ₡{e.cash.toFixed(2)}
                          </td>

                          {/* Holdings */}
                          <td className="mono holdings-col">
                            ₡{e.holdings_value.toFixed(2)}
                          </td>

                          {/* Net P/L */}
                          <td className={`mono ${plClass} pnl-col`}>
                            {isProfit ? '+' : ''}₡{e.profit_loss.toFixed(2)}
                          </td>

                          {/* Return % */}
                          <td>
                            <span className={`badge ${isProfit ? 'badge-green' : 'badge-red'}`}>
                              {isProfit ? '▲ +' : '▼ '}{e.profit_loss_percent.toFixed(2)}%
                            </span>
                          </td>

                          {/* 22-Trade Quota with Progress Bar */}
                          <td>
                            <div className="quota-cell">
                              <div className="quota-text mono">
                                <span>{e.trade_count} / 22</span>
                                <span className="quota-pct">{Math.round(tradeProgress)}%</span>
                              </div>
                              <div className="quota-track">
                                <div
                                  className={`quota-fill ${e.trade_count >= 22 ? 'quota-completed' : ''}`}
                                  style={{ width: `${tradeProgress}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Breadth */}
                          <td className="mono">
                            <span className="breadth-tag">{e.companies_traded} co</span>
                          </td>

                          {/* Qualification Status */}
                          <td>
                            <span className={`badge ${e.is_eligible ? 'badge-green' : 'badge-yellow'}`}>
                              {e.is_eligible ? '✓ QUALIFIED' : '⏳ PENDING'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setSelectedDesk(e);
                              }}
                              title="Inspect Desk dossier"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMPLETE FLOOR ORDERS STREAM */}
        {activeTab === 'orders' && (
          <div className="card admin-table-card">
            <div className="admin-card-header">
              <div>
                <h3 className="font-serif">📋 Complete Floor Order Stream</h3>
                <p className="admin-tab-sub font-editorial">Real-time surveillance stream of all transmitted desk market & limit orders</p>
              </div>
              <span className="admin-card-badge mono">{orders.length} Logged Executions</span>
            </div>
            <div className="admin-table-wrapper full-width-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Desk</th>
                    <th>Side</th>
                    <th>Ticker</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Tick Progression</th>
                    <th>Fill Price</th>
                    <th>Fee (0.4%)</th>
                    <th>Net Amount</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 150).map((o: any) => (
                    <tr key={o.order_id}>
                      <td className="mono font-bold">{o.team_code}</td>
                      <td>
                        <span className={`badge ${o.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>
                          {o.side}
                        </span>
                      </td>
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{o.ticker}</td>
                      <td className="mono">{o.quantity.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${o.status === 'FILLED' ? 'badge-green' : o.status === 'REJECTED' ? 'badge-red' : 'badge-yellow'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="mono">
                        T{o.submitted_tick}{o.fill_tick != null ? ` → T${o.fill_tick}` : ''}
                      </td>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {o.fill_price != null ? `₡${o.fill_price.toFixed(2)}` : '—'}
                      </td>
                      <td className="mono" style={{ color: 'var(--text-muted)' }}>₡{o.fee?.toFixed(2) || '0.00'}</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>
                        {o.net_value != null ? `₡${o.net_value.toFixed(2)}` : '—'}
                      </td>
                      <td className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {new Date(o.submitted_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FINANCIAL WIRE SCRIPT & BROADCAST GUN */}
        {activeTab === 'news' && (
          <div className="card admin-table-card">
            <div className="admin-card-header">
              <div>
                <h3 className="font-serif">📰 Financial Wire Script & Broadcast Controls</h3>
                <p className="admin-tab-sub font-editorial">Surveillance timeline of market-moving economic bulletins and reserve teletype releases</p>
              </div>
              <span className="admin-card-badge mono">{newsScript.length} Scripted Dispatches</span>
            </div>
            <div className="admin-table-wrapper full-width-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Release Tick</th>
                    <th>Headline & Wire Narrative</th>
                    <th>Release State</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {newsScript.map((event: any) => (
                    <tr key={event.id}>
                      <td><span className="badge badge-blue">{event.event_type}</span></td>
                      <td className="mono" style={{ fontWeight: 800 }}>
                        {event.event_type === 'RESERVE' ? 'RESERVE WIRE' : `Tick ${event.release_tick}`}
                      </td>
                      <td style={{ maxWidth: 540 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{event.headline}</div>
                        {event.forecast && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--gold)', marginTop: 2 }}>
                            Forecast: {event.forecast}
                          </div>
                        )}
                        {event.description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {event.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {event.released ? (
                          <span className="badge badge-green">
                            ✓ BROADCASTED @ {event.released_at ? new Date(event.released_at).toLocaleTimeString() : '—'}
                          </span>
                        ) : (
                          <span className="badge badge-yellow">ARMED</span>
                        )}
                      </td>
                      <td>
                        {event.event_type === 'RESERVE' && !event.released && (
                          <button className="btn btn-sell btn-sm" onClick={() => handleFireReserve(event.id)}>
                            ⚡ Broadcast Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: HEADLINE GENERATOR UTILITY */}
        {activeTab === 'generator' && (
          <div className="card admin-table-card">
            <div className="admin-generator-header">
              <div>
                <h3 className="font-serif">💡 Scenario & Narrative Generator</h3>
                <p className="admin-generator-desc font-editorial">
                  Synthesizes factual candidate news dispatches across Macro, Corporate, and Regulatory templates.
                </p>
              </div>
              <div className="admin-cat-filter">
                {['all', 'macro', 'company', 'policy'].map(cat => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${candidateCat === cat ? 'btn-gold' : 'btn-outline'}`}
                    onClick={() => loadCandidates(cat)}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {candidateLoading ? (
              <p style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>
                Synthesizing headline dispatch templates...
              </p>
            ) : (
              <div className="admin-table-wrapper full-width-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Template Descriptor</th>
                      <th>Wire Headline</th>
                      <th>Suggested Market Drivers</th>
                      <th>Reaction Dynamic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <span className="badge badge-blue">
                            {c.category}{c.ticker ? ` (${c.ticker})` : ''}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.title}</td>
                        <td style={{ maxWidth: 500, fontWeight: 500, color: 'var(--text-primary)' }}>{c.headline}</td>
                        <td className="mono" style={{ color: 'var(--blue)' }}>{c.suggested_drivers}</td>
                        <td><span className="badge badge-yellow">{c.profile}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SURVEILLANCE & EVENT AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="card admin-table-card">
            <div className="admin-card-header">
              <div>
                <h3 className="font-serif">📜 Floor Surveillance & Event Audit Log</h3>
                <p className="admin-tab-sub font-editorial">Tamper-evident chronological log of all exchange system events and desk activity</p>
              </div>
              <span className="admin-card-badge mono">{audit.length} Audit Records</span>
            </div>
            <div className="admin-table-wrapper full-width-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Category</th>
                    <th>Target Desk</th>
                    <th>Tick</th>
                    <th>Surveillance Message</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 150).map((log: any) => (
                    <tr key={log.id}>
                      <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td><span className="badge badge-blue">{log.event_type}</span></td>
                      <td className="mono" style={{ fontWeight: 700 }}>{log.team_code || 'FLOOR'}</td>
                      <td className="mono">{log.tick ?? '—'}</td>
                      <td style={{ fontSize: '0.84rem' }}>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Desk Inspection Dossier Modal ── */}
      {selectedDesk && (
        <div className="modal-overlay" onClick={() => setSelectedDesk(null)}>
          <div className="modal-content desk-dossier-modal" onClick={e => e.stopPropagation()}>
            <div className="dossier-header">
              <div className="dossier-title-row">
                <div className="dossier-avatar mono">{selectedDesk.team_code.substring(0, 2)}</div>
                <div>
                  <span className="dossier-eyebrow font-mono">FLOOR SURVEILLANCE DOSSIER</span>
                  <h2 className="font-serif">{selectedDesk.team_code} — {selectedDesk.display_name || 'Trading Desk'}</h2>
                </div>
              </div>
              <button className="btn btn-icon btn-outline" onClick={() => setSelectedDesk(null)}>✕</button>
            </div>

            <div className="dossier-body">
              <div className="dossier-metrics-grid">
                <div className="dossier-metric">
                  <span className="dossier-label">CURRENT RANK</span>
                  <span className="dossier-val mono gold-text">
                    {selectedDesk.rank === 1 ? '🥇 1st Place' : selectedDesk.rank === 2 ? '🥈 2nd Place' : selectedDesk.rank === 3 ? '🥉 3rd Place' : `#${selectedDesk.rank}`}
                  </span>
                </div>
                <div className="dossier-metric">
                  <span className="dossier-label">PORTFOLIO VALUATION</span>
                  <span className="dossier-val mono">₡{selectedDesk.portfolio_value.toFixed(2)}</span>
                </div>
                <div className="dossier-metric">
                  <span className="dossier-label">SESSION NET P/L</span>
                  <span className={`dossier-val mono ${selectedDesk.profit_loss >= 0 ? 'price-up' : 'price-down'}`}>
                    {selectedDesk.profit_loss >= 0 ? '+' : ''}₡{selectedDesk.profit_loss.toFixed(2)} ({selectedDesk.profit_loss_percent.toFixed(2)}%)
                  </span>
                </div>
                <div className="dossier-metric">
                  <span className="dossier-label">22-TRADE QUOTA</span>
                  <span className="dossier-val mono">{selectedDesk.trade_count} / 22 ({Math.round((selectedDesk.trade_count / 22) * 100)}%)</span>
                </div>
              </div>

              {/* Asset Allocation Split */}
              <div className="dossier-allocation">
                <div className="allocation-header">
                  <span className="font-mono">ASSET ALLOCATION BREAKDOWN</span>
                  <span className="mono">Cash ₡{selectedDesk.cash.toFixed(2)} | Equity ₡{selectedDesk.holdings_value.toFixed(2)}</span>
                </div>
                <div className="allocation-bar">
                  <div
                    className="alloc-cash"
                    style={{
                      width: `${(selectedDesk.cash / Math.max(1, selectedDesk.portfolio_value)) * 100}%`
                    }}
                    title={`Cash: ₡${selectedDesk.cash.toFixed(2)}`}
                  />
                  <div
                    className="alloc-equity"
                    style={{
                      width: `${(selectedDesk.holdings_value / Math.max(1, selectedDesk.portfolio_value)) * 100}%`
                    }}
                    title={`Equity: ₡${selectedDesk.holdings_value.toFixed(2)}`}
                  />
                </div>
                <div className="allocation-legend">
                  <span className="legend-cash">● Cash Liquidity ({Math.round((selectedDesk.cash / Math.max(1, selectedDesk.portfolio_value)) * 100)}%)</span>
                  <span className="legend-equity">● Stock Holdings ({Math.round((selectedDesk.holdings_value / Math.max(1, selectedDesk.portfolio_value)) * 100)}%)</span>
                </div>
              </div>

              <div className="dossier-criteria">
                <span className="criteria-title font-serif">Official Championship Qualification Checklist:</span>
                <ul className="criteria-list">
                  <li className={selectedDesk.trade_count >= 22 ? 'crit-pass' : 'crit-pending'}>
                    {selectedDesk.trade_count >= 22 ? '✓' : '⏳'} Minimum 22 Executed Trades: {selectedDesk.trade_count}/22 completed
                  </li>
                  <li className={selectedDesk.companies_traded >= 2 ? 'crit-pass' : 'crit-pending'}>
                    {selectedDesk.companies_traded >= 2 ? '✓' : '⏳'} Portfolio Breadth: {selectedDesk.companies_traded} distinct companies traded
                  </li>
                  <li className={selectedDesk.is_eligible ? 'crit-pass' : 'crit-pending'}>
                    {selectedDesk.is_eligible ? '✓' : '⏳'} Official Status: {selectedDesk.is_eligible ? 'QUALIFIED FOR PODIUM' : 'PENDING QUOTA COMPLETION'}
                  </li>
                </ul>
              </div>
            </div>

            <div className="dossier-footer">
              <button className="btn btn-gold btn-sm" onClick={() => setSelectedDesk(null)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Emergency Restart Floor Modal ── */}
      {confirmRestart && (
        <div className="modal-overlay" onClick={() => setConfirmRestart(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--gold-bright)' }}>
              🔄 Reset Exchange Simulation?
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '14px 0', fontSize: '0.88rem' }}>
              Executing a floor reset will perform the following actions:
            </p>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: 20, marginBottom: 18, lineHeight: 1.8, fontSize: '0.84rem' }}>
              <li>Reset all <strong>25 competitor teams</strong> to ₡10,000 cash balance</li>
              <li>Purge all active orders and equity holdings</li>
              <li>Re-arm all news dispatches to Tick 0 schedule</li>
              <li>Reset simulation clock back to Tick 0</li>
            </ul>
            <div className="tm-error-box">
              ⚠️ Warning: This administrative reset cannot be reversed!
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setConfirmRestart(false)}>
                Cancel
              </button>
              <button className="btn btn-sell" style={{ flex: 1 }} onClick={handleRestart}>
                Confirm Reset Floor
              </button>
            </div>
          </div>
        </div>
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

