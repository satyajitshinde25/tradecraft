/* ── Login Page — User Provided Theme ── */
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
    <main className="page">
      <section className="visual" aria-label="Wall Street Arena visual"></section>

      <section className="login-side">
        <div className="login-card">
          <header className="brand">
            <div className="brand-icon" aria-hidden="true">
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

            <div className="eyebrow">THE</div>
            <h1>WALL STREET</h1>
            <div className="arena">ARENA</div>

            <div className="divider"></div>

            <div className="tagline">TRADE &nbsp;/&nbsp; ANALYZE &nbsp;/&nbsp; GROW</div>
          </header>

          <form id="loginForm" autoComplete="off" onSubmit={handleLogin}>
            <div className="field">
              <div className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.2"></circle>
                  <path d="M5.3 19c.7-3.1 3.1-5 6.7-5s6 1.9 6.7 5"></path>
                </svg>
              </div>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Username"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <div className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="5.5" y="10" width="13" height="10" rx="1.8"></rect>
                  <path d="M8 10V7.4a4 4 0 0 1 8 0V10"></path>
                  <circle cx="12" cy="15" r="1"></circle>
                  <path d="M12 16v1.5"></path>
                </svg>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="login-btn" type="submit" disabled={loading}>
              <span>{loading ? 'LOGGING IN...' : <>LOGIN <b className="arrow">→</b></>}</span>
            </button>

            {error && (
              <div id="error" className="error show" role="alert">{error}</div>
            )}
          </form>
        </div>

        <div className="copyright">MARKET SIMULATION • FICTIONAL MARKET</div>
      </section>
    </main>
  );
}
