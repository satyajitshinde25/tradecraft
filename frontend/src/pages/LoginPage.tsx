/* ── Login Page — Manhattan Brokerage Trading Floor Portal ── */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import './LoginPage.css';

export default function LoginPage() {
  const [teamId, setTeamId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(teamId, password);
      localStorage.setItem('ms_token', data.token);
      localStorage.setItem('ms_team_code', data.team_code);
      localStorage.setItem('ms_display_name', data.display_name);
      localStorage.setItem('ms_role', data.role);

      if (data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (tId: string, pass: string) => {
    setTeamId(tId);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="login-page">
      {/* Background Ambience & Manhattan Skyline Silhouette */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />
      <div className="login-skyline-silhouette" />

      {/* Top High-Energy Wall Street Marquee Tape */}
      <div className="login-top-tape">
        <div className="tape-track">
          <span className="tape-item"><strong className="tape-gold">★ NEW YORK STOCK EXCHANGE • WALL ST FLOOR</strong></span>
          <span className="tape-item"><span className="tape-ticker">TAVR</span> ₡84.50 <span className="price-up">▲ +4.8%</span></span>
          <span className="tape-item"><span className="tape-ticker">AERV</span> ₡42.00 <span className="price-up">▲ +2.1%</span></span>
          <span className="tape-item"><span className="tape-ticker">VLTN</span> ₡120.00 <span className="price-up">▲ +3.4%</span></span>
          <span className="tape-item"><span className="tape-ticker">BRKW</span> ₡65.25 <span className="price-down">▼ -1.2%</span></span>
          <span className="tape-item"><span className="tape-ticker">LMRA</span> ₡150.00 <span className="price-up">▲ +5.6%</span></span>
          <span className="tape-item"><span className="tape-ticker">GRFD</span> ₡58.00 <span className="price-down">▼ -0.9%</span></span>
          <span className="tape-item"><strong className="tape-gold">★ REGULAR TRADING SESSION OPEN</strong></span>
        </div>
      </div>

      <div className="login-container animate-fade-in">
        <div className="login-card-header">
          {/* Charging Bull Insignia Motif */}
          <div className="login-emblem">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="26" stroke="#D6A84F" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
              <circle cx="28" cy="28" r="21" fill="#060A0F" stroke="#D6A84F" strokeWidth="1.5"/>
              {/* Stylized Charging Bull Icon */}
              <path d="M16 32C19 28 23 27 28 26C33 25 38 23 41 18C41 23 38 28 35 30C32 32 29 33 26 34C22 35 18 34 16 32Z" fill="url(#bull-gold)"/>
              <path d="M38 18C36 15 32 14 29 16C31 17 34 18 36 19" stroke="#FFE8A3" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="34" cy="22" r="1.5" fill="#FFE8A3"/>
              <defs>
                <linearGradient id="bull-gold" x1="16" y1="18" x2="41" y2="34" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFE8A3"/>
                  <stop offset="0.5" stopColor="#D6A84F"/>
                  <stop offset="1" stopColor="#9E7020"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <span className="login-exchange-tag">THE WALL STREET TRADING FLOOR</span>
          <h1 className="login-title font-serif">TradeCraft</h1>
          <p className="login-subtitle font-editorial">Institutional Brokerage & Market Strategy Suite</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="team-id">
              <span>FLOOR ACCESS ID / TEAM CODE</span>
            </label>
            <div className="input-icon-wrapper">
              <input
                id="team-id"
                className="input mono"
                type="text"
                placeholder="e.g. TEAM-02 or ADMIN"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span>SECURITY PASSKEY</span>
            </label>
            <div className="input-icon-wrapper">
              <input
                id="password"
                className="input mono"
                type="password"
                placeholder="Enter authorized passkey"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Quick Sign-In Helpers */}
          <div className="quick-creds-box">
            <span className="quick-creds-label">Floor Presets:</span>
            <div className="quick-creds-chips">
              <button
                type="button"
                className="cred-chip"
                onClick={() => handleQuickFill('TEAM-01', 'sprint01')}
                title="Fill TEAM-01 credentials"
              >
                TEAM-01
              </button>
              <button
                type="button"
                className="cred-chip"
                onClick={() => handleQuickFill('TEAM-02', 'sprint02')}
                title="Fill TEAM-02 credentials"
              >
                TEAM-02
              </button>
              <button
                type="button"
                className="cred-chip cred-chip-admin"
                onClick={() => handleQuickFill('ADMIN', 'admin123')}
                title="Fill ADMIN credentials"
              >
                🛡️ ADMIN
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error animate-fade-in">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-gold login-btn"
            disabled={loading || !teamId || !password}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: 16, height: 16, borderTopColor: '#080D14' }} />
                <span>Authenticating Floor Key...</span>
              </>
            ) : (
              <span>AUTHORIZE FLOOR ACCESS →</span>
            )}
          </button>
        </form>

        <div className="login-footer-specs">
          <div className="spec-item">
            <span className="spec-val">6</span>
            <span className="spec-lbl">Market Equities</span>
          </div>
          <div className="spec-divider" />
          <div className="spec-item">
            <span className="spec-val">97</span>
            <span className="spec-lbl">Trading Ticks</span>
          </div>
          <div className="spec-divider" />
          <div className="spec-item">
            <span className="spec-val">₡10,000</span>
            <span className="spec-lbl">Starting Equity</span>
          </div>
        </div>

        <div className="login-rule-footer">
          ⚡ Next-Tick Settlement Execution • 0.4% Brokerage Fee • Max 22 Lifetime Trades
        </div>
      </div>
    </div>
  );
}
