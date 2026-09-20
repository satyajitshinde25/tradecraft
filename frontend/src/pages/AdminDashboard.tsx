/* ── Admin Dashboard — Game control, leaderboard, team monitoring ── */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminGetGame, adminStartGame, adminRestartGame,
  adminGetLeaderboard, adminGetOrders, adminGetAudit, logout,
  adminPauseGame, adminResumeGame, adminToggleTestMode,
  adminGetNewsScript, adminFireReserveHeadline
} from '../api/client';
import type { LeaderboardEntry } from '../types';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [game, setGame] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<{ tick: number; entries: LeaderboardEntry[] } | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [newsScript, setNewsScript] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'orders' | 'audit' | 'news'>('leaderboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [g, lb, od, au, ns] = await Promise.all([
        adminGetGame(), adminGetLeaderboard(),
        adminGetOrders(), adminGetAudit(), adminGetNewsScript(),
      ]);
      setGame(g);
      setLeaderboard(lb);
      setOrders(od.orders || []);
      setAudit(au.logs || []);
      setNewsScript(ns.events || []);
    } catch (err) {
      console.error('Admin fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

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
      showToast('Game started!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRestart = async () => {
    try {
      await adminRestartGame();
      showToast('Game restarted! All teams reset to starting balance.', 'success');
      setConfirmRestart(false);
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
    try { await adminPauseGame(); showToast('Game paused', 'success'); fetchData(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleResume = async () => {
    try { await adminResumeGame(); showToast('Game resumed', 'success'); fetchData(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleToggleTestMode = async () => {
    try { await adminToggleTestMode(); showToast('Test mode toggled', 'success'); fetchData(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleFireReserve = async (id: string) => {
    try { await adminFireReserveHeadline(id); showToast('Reserve fired!', 'success'); fetchData(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  if (!game) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* ── Header ── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>🛡️ Admin Dashboard</h1>
          <span className={`badge ${game.status === 'RUNNING' ? 'badge-green' : game.status === 'FINISHED' ? 'badge-red' : 'badge-yellow'}`}>
            {game.status}
          </span>
          <span className="mono admin-tick">Tick {game.current_tick} / 96</span>
          {countdown > 0 && game.status === 'RUNNING' && (
            <span className="mono admin-countdown">⏱ {countdown}s</span>
          )}
        </div>
        <div className="admin-header-right">
          <div className="admin-controls">
            {(game.status === 'DRAFT' || game.status === 'READY') && (
              <>
                <button className="btn btn-outline" onClick={handleToggleTestMode}>
                  🧪 Test Mode: {game.is_test_mode ? 'ON (1s)' : 'OFF (75s)'}
                </button>
                <button className="btn btn-buy" onClick={handleStart}>
                  ▶ Start Game
                </button>
              </>
            )}
            {game.status === 'RUNNING' && (
              <button className="btn btn-outline" onClick={handlePause}>
                ⏸ Pause
              </button>
            )}
            {game.status === 'PAUSED' && (
              <button className="btn btn-outline" onClick={handleResume}>
                ▶ Resume
              </button>
            )}
            <button
              className="btn btn-outline"
              onClick={() => setConfirmRestart(true)}
            >
              🔄 Restart
            </button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ── Stats Bar ── */}
      <div className="admin-stats-bar">
        <div className="admin-stat">
          <span className="admin-stat-label">Teams</span>
          <span className="admin-stat-value mono">25</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Total Orders</span>
          <span className="admin-stat-value mono">{orders.length}</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Tick Duration</span>
          <span className="admin-stat-value mono">{game.is_test_mode ? '1s' : `${game.tick_seconds}s`}</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-label">Starting Balance</span>
          <span className="admin-stat-value mono">₡{game.starting_balance?.toLocaleString()}</span>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
          🏆 Leaderboard
        </button>
        <button className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          📋 Orders ({orders.length})
        </button>
        <button className={`admin-tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>
          📰 News Script
        </button>
        <button className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          📜 Audit Log
        </button>
      </div>

      {/* ── Content ── */}
      <div className="admin-content">
        {activeTab === 'leaderboard' && leaderboard && (
          <div className="card admin-table-card">
            <h3>🏆 Live Leaderboard — Tick {leaderboard.tick}</h3>
            <div className="admin-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>Portfolio</th>
                    <th>Cash</th>
                    <th>Holdings</th>
                    <th>P/L</th>
                    <th>P/L %</th>
                    <th>Trades</th>
                    <th>Companies</th>
                    <th>Eligible</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.entries.map((e: LeaderboardEntry) => {
                    const plClass = e.profit_loss >= 0 ? 'price-up' : 'price-down';
                    return (
                      <tr key={e.team_code}>
                        <td className="mono" style={{ fontWeight: 800 }}>
                          {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700 }}>{e.team_code}</span>
                          <br />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.display_name}</span>
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>₡{e.portfolio_value.toFixed(2)}</td>
                        <td className="mono">₡{e.cash.toFixed(2)}</td>
                        <td className="mono">₡{e.holdings_value.toFixed(2)}</td>
                        <td className={`mono ${plClass}`}>
                          {e.profit_loss >= 0 ? '+' : ''}₡{e.profit_loss.toFixed(2)}
                        </td>
                        <td className={`mono ${plClass}`}>
                          {e.profit_loss_percent >= 0 ? '+' : ''}{e.profit_loss_percent.toFixed(2)}%
                        </td>
                        <td className="mono">{e.trade_count}</td>
                        <td className="mono">{e.companies_traded}</td>
                        <td>
                          <span className={`badge ${e.is_eligible ? 'badge-green' : 'badge-red'}`}>
                            {e.is_eligible ? 'YES' : 'NO'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="card admin-table-card">
            <h3>📋 Recent Orders</h3>
            <div className="admin-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Side</th>
                    <th>Ticker</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Tick</th>
                    <th>Fill Price</th>
                    <th>Fee</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 100).map((o: any) => (
                    <tr key={o.order_id}>
                      <td style={{ fontWeight: 600 }}>{o.team_code}</td>
                      <td className={o.side === 'BUY' ? 'price-up' : 'price-down'} style={{ fontWeight: 700 }}>{o.side}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{o.ticker}</td>
                      <td className="mono">{o.quantity}</td>
                      <td><span className={`badge ${o.status === 'FILLED' ? 'badge-green' : o.status === 'REJECTED' ? 'badge-red' : 'badge-yellow'}`}>{o.status}</span></td>
                      <td className="mono">{o.submitted_tick}{o.fill_tick != null ? ` → ${o.fill_tick}` : ''}</td>
                      <td className="mono">{o.fill_price != null ? `₡${o.fill_price.toFixed(2)}` : '—'}</td>
                      <td className="mono">₡{o.fee?.toFixed(2) || '0.00'}</td>
                      <td className="mono" style={{ fontSize: '0.75rem' }}>{new Date(o.submitted_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="card admin-table-card">
            <h3>📜 Audit Log</h3>
            <div className="admin-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Team</th>
                    <th>Tick</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 100).map((log: any) => (
                    <tr key={log.id}>
                      <td className="mono" style={{ fontSize: '0.75rem' }}>{new Date(log.created_at).toLocaleTimeString()}</td>
                      <td><span className="badge badge-blue">{log.event_type}</span></td>
                      <td>{log.team_code || '—'}</td>
                      <td className="mono">{log.tick ?? '—'}</td>
                      <td style={{ fontSize: '0.82rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'news' && (
          <div className="card admin-table-card">
            <h3>📰 News Script & Controls</h3>
            <div className="admin-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Tick</th>
                    <th>Headline</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {newsScript.map((event: any) => (
                    <tr key={event.id}>
                      <td><span className="badge badge-blue">{event.event_type}</span></td>
                      <td className="mono">{event.event_type === 'RESERVE' ? '—' : event.release_tick}</td>
                      <td style={{ maxWidth: 400 }}><strong>{event.headline}</strong></td>
                      <td>
                        {event.released ? (
                          <span className="badge badge-green">RELEASED @ {event.released_at ? new Date(event.released_at).toLocaleTimeString() : '—'}</span>
                        ) : (
                          <span className="badge badge-yellow">ARMED</span>
                        )}
                      </td>
                      <td>
                        {event.event_type === 'RESERVE' && !event.released && (
                          <button className="btn btn-sell btn-sm" onClick={() => handleFireReserve(event.id)}>
                            Fire Now
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
      </div>

      {/* ── Restart Confirmation Modal ── */}
      {confirmRestart && (
        <div className="modal-overlay" onClick={() => setConfirmRestart(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>🔄 Restart Simulation?</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>
              This will:
            </p>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: 20, marginBottom: 20, lineHeight: 2 }}>
              <li>Reset <strong>all 25 teams</strong> to ₡10,000</li>
              <li>Clear all orders and holdings</li>
              <li>Reset all news events</li>
              <li>Start a fresh simulation from Tick 0</li>
            </ul>
            <div className="tm-warning">
              ⚠️ This action cannot be undone!
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setConfirmRestart(false)}>Cancel</button>
              <button className="btn btn-sell" style={{ flex: 1 }} onClick={handleRestart}>Confirm Restart</button>
            </div>
          </div>
        </div>
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
