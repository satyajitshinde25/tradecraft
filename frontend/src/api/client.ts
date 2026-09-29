/* ── API Client for Market Sprint / TradeCraft Backend ── */

// Read API URL from Vite environment, fallback to active port 8001 or 8000
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8001';

function getToken(): string | null {
  return localStorage.getItem('ms_token');
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Request failed' }));
    if (res.status === 401) {
      throw new Error(data.detail || 'Invalid credentials. Please verify your Floor Access ID and Passkey.');
    } else if (res.status === 403) {
      throw new Error(data.detail || 'Access forbidden.');
    } else if (res.status === 429) {
      throw new Error(data.detail || 'Account temporarily locked due to excessive failed attempts. Please try again later.');
    }
    throw new Error(data.detail || `Server error (HTTP ${res.status})`);
  }
  return res.json();
}

async function apiFetch(url: string, options: RequestInit = {}) {
  try {
    const res = await fetch(url, options);
    return await handleResponse(res);
  } catch (err: any) {
    // If connection to default port fails, attempt fallback to alternate port 8000
    if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('network'))) {
      if (url.includes(':8001')) {
        const altUrl = url.replace(':8001', ':8000');
        try {
          const altRes = await fetch(altUrl, options);
          return await handleResponse(altRes);
        } catch (_) {}
      } else if (url.includes(':8000')) {
        const altUrl = url.replace(':8000', ':8001');
        try {
          const altRes = await fetch(altUrl, options);
          return await handleResponse(altRes);
        } catch (_) {}
      }
      throw new Error(`Unable to establish connection to backend trading server at ${API_BASE}. Please ensure the server is running on port 8001 or 8000.`);
    }
    throw err;
  }
}

// ── Auth ──
export async function login(team_id: string, password: string) {
  return apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id, password }),
  });
}

export async function logout() {
  return apiFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

// ── Game ──
export async function getGameState() {
  return apiFetch(`${API_BASE}/game/state`, { headers: getHeaders() });
}

// ── Market ──
export async function getMarketOverview() {
  return apiFetch(`${API_BASE}/market/overview`, { headers: getHeaders() });
}

export async function getCandles(ticker: string) {
  return apiFetch(`${API_BASE}/market/${ticker}/candles`, { headers: getHeaders() });
}

export async function getLeaderboard() {
  return apiFetch(`${API_BASE}/market/leaderboard`, { headers: getHeaders() });
}

// ── News ──
export async function getNews() {
  return apiFetch(`${API_BASE}/news`, { headers: getHeaders() });
}

// ── Portfolio ──
export async function getPortfolio() {
  return apiFetch(`${API_BASE}/portfolio`, { headers: getHeaders() });
}

// ── Orders ──
export async function getOrders() {
  return apiFetch(`${API_BASE}/orders`, { headers: getHeaders() });
}

export async function submitBuy(ticker: string, quantity: number) {
  return apiFetch(`${API_BASE}/orders/buy`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ticker, quantity }),
  });
}

export async function submitSell(ticker: string, quantity: number) {
  return apiFetch(`${API_BASE}/orders/sell`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ticker, quantity }),
  });
}

// ── Admin ──
export async function adminGetGame() {
  return apiFetch(`${API_BASE}/admin/game`, { headers: getHeaders() });
}

export async function adminStartGame() {
  return apiFetch(`${API_BASE}/admin/game/start`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function adminRestartGame() {
  return apiFetch(`${API_BASE}/admin/game/restart`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function adminPauseGame() {
  return apiFetch(`${API_BASE}/admin/game/pause`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function adminResumeGame() {
  return apiFetch(`${API_BASE}/admin/game/resume`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function adminToggleTestMode() {
  return apiFetch(`${API_BASE}/admin/game/test-mode`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function adminGetNewsScript() {
  return apiFetch(`${API_BASE}/admin/news-script`, { headers: getHeaders() });
}

export async function adminFireReserveHeadline(eventId: string) {
  return apiFetch(`${API_BASE}/admin/game/fire-reserve/${eventId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function adminGetCandidateHeadlines(category: string = 'all') {
  return apiFetch(`${API_BASE}/admin/news-generator/candidates?category=${category}`, {
    headers: getHeaders(),
  });
}

export async function adminGetLeaderboard() {
  return apiFetch(`${API_BASE}/admin/leaderboard`, { headers: getHeaders() });
}

export async function adminGetTeams() {
  return apiFetch(`${API_BASE}/admin/teams`, { headers: getHeaders() });
}

export async function adminGetOrders() {
  return apiFetch(`${API_BASE}/admin/orders`, { headers: getHeaders() });
}

export async function adminGetAudit() {
  return apiFetch(`${API_BASE}/admin/audit`, { headers: getHeaders() });
}

// ── WebSocket ──
export interface ManagedWebSocket {
  close: () => void;
}

export function createMarketWebSocket(
  onMessage: (data: any) => void,
  onStatusChange?: (isReconnecting: boolean) => void,
): ManagedWebSocket {
  let ws: WebSocket | null = null;
  let isClosedIntentionally = false;
  let reconnectTimer: any = null;
  let healthCheckTimer: any = null;
  let failedAttempts = 0;

  const checkHealthAndNotify = async () => {
    if (isClosedIntentionally) return;
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (!res.ok) {
        if (onStatusChange) onStatusChange(true);
      } else {
        if (failedAttempts > 2 && onStatusChange) {
          onStatusChange(true);
        }
      }
    } catch {
      if (onStatusChange) onStatusChange(true);
    }
  };

  const connect = () => {
    if (isClosedIntentionally) return;

    try {
      ws = new WebSocket(`${WS_BASE}/ws/market`);

      ws.onopen = () => {
        failedAttempts = 0;
        if (healthCheckTimer) {
          clearTimeout(healthCheckTimer);
          healthCheckTimer = null;
        }
        if (onStatusChange) onStatusChange(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
          if (onStatusChange) onStatusChange(false);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onerror = () => {
        if (!healthCheckTimer && !isClosedIntentionally) {
          healthCheckTimer = setTimeout(checkHealthAndNotify, 2500);
        }
      };

      ws.onclose = () => {
        if (isClosedIntentionally) return;
        failedAttempts++;
        if (!healthCheckTimer) {
          healthCheckTimer = setTimeout(checkHealthAndNotify, 2500);
        }
        const delay = Math.min(1000 * Math.pow(1.4, failedAttempts), 5000);
        reconnectTimer = setTimeout(() => {
          if (!isClosedIntentionally) connect();
        }, delay);
      };
    } catch {
      if (!isClosedIntentionally) {
        checkHealthAndNotify();
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  };

  connect();

  return {
    close: () => {
      isClosedIntentionally = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (healthCheckTimer) clearTimeout(healthCheckTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
      if (onStatusChange) onStatusChange(false);
    },
  };
}
