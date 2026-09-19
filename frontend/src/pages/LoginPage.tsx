/* ── Login Page — Premium trading terminal entry ── */
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
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />

      <div className="login-container animate-fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 28L14 18L20 22L26 12L32 16" stroke="url(#grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="grad" x1="8" y1="28" x2="32" y2="12"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
            </svg>
          </div>
          <h1>Market Sprint</h1>
          <p className="login-subtitle">Fictional Markets Edition</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="team-id">Team ID</label>
            <input
              id="team-id"
              className="input"
              type="text"
              placeholder="e.g., TEAM-01 or ADMIN"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="login-error animate-fade-in">
              <span>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading || !teamId || !password}
          >
            {loading ? (
              <><div className="loading-spinner" style={{ width: 18, height: 18 }} /> Signing in...</>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-info">
          <p>🏦 6 fictional companies · 📈 97 trading ticks · 💰 10,000 V-Coins</p>
          <p className="login-warning">Orders fill at the <strong>next tick's price</strong></p>
        </div>
      </div>
    </div>
  );
}
