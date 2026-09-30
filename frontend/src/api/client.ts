/* ── API Client for Market Sprint Backend ── */

// Read API URL from Vite environment, fallback dynamically based on window.location
const isBrowser = typeof window !== 'undefined';
const isDevServer = isBrowser && window.location.port === '5173';

const defaultApi = isBrowser
  ? (isDevServer ? 'http://localhost:8000' : '')
  : 'http://localhost:8000';

const defaultWs = isBrowser
  ? (isDevServer
      ? 'ws://localhost:8000'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`)
  : 'ws://localhost:8000';

const API_BASE = import.meta.env.VITE_API_URL || defaultApi;
const WS_BASE = import.meta.env.VITE_WS_URL || defaultWs;
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
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface RetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOpts?: RetryOptions,
): Promise<any> {
  const maxRetries = retryOpts?.maxRetries ?? 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);

      // If server returns rate limit (429) or temporary server errors (502, 503, 504)
      if ((res.status === 429 || res.status >= 502) && attempt < maxRetries) {
        attempt++;
        const delay = attempt * 1200;
        if (retryOpts?.onRetry) {
          retryOpts.onRetry(attempt, maxRetries, delay);
        }
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      return res.json();
    } catch (err: any) {
      const isNetworkError = err instanceof TypeError || (err.message && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')));
      if (isNetworkError && attempt < maxRetries) {
        attempt++;
        const delay = attempt * 1200;
        if (retryOpts?.onRetry) {
          retryOpts.onRetry(attempt, maxRetries, delay);
        }
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ── Auth ──
export async function login(team_id: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id, password }),
  });
  return handleResponse(res);
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

// ── Game ──
export async function getGameState() {
  const res = await fetch(`${API_BASE}/game/state`, { headers: getHeaders() });
  return handleResponse(res);
}

// ── Market ──
export async function getMarketOverview() {
  const res = await fetch(`${API_BASE}/market/overview`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getCandles(ticker: string) {
  const res = await fetch(`${API_BASE}/market/${ticker}/candles`, { headers: getHeaders() });
  return handleResponse(res);
}

// ── News ──
export async function getNews() {
  const res = await fetch(`${API_BASE}/news`, { headers: getHeaders() });
  return handleResponse(res);
}

// ── Portfolio ──
export async function getPortfolio() {
  const res = await fetch(`${API_BASE}/portfolio`, { headers: getHeaders() });
  return handleResponse(res);
}

// ── Orders ──
export async function getOrders() {
  const res = await fetch(`${API_BASE}/orders`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function submitBuy(
  ticker: string,
  quantity: number,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void
) {
  return fetchWithRetry(
    `${API_BASE}/orders/buy`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ticker, quantity }),
    },
    { maxRetries: 3, onRetry }
  );
}

export async function submitSell(
  ticker: string,
  quantity: number,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void
) {
  return fetchWithRetry(
    `${API_BASE}/orders/sell`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ticker, quantity }),
    },
    { maxRetries: 3, onRetry }
  );
}

// ── Admin ──
export async function adminGetGame() {
  const res = await fetch(`${API_BASE}/admin/game`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminStartGame() {
  const res = await fetch(`${API_BASE}/admin/game/start`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminRestartGame() {
  const res = await fetch(`${API_BASE}/admin/game/restart`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminPauseGame() {
  const res = await fetch(`${API_BASE}/admin/game/pause`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminResumeGame() {
  const res = await fetch(`${API_BASE}/admin/game/resume`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminToggleTestMode() {
  const res = await fetch(`${API_BASE}/admin/game/test-mode`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminGetNewsScript() {
  const res = await fetch(`${API_BASE}/admin/news-script`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminFireReserveHeadline(eventId: string) {
  const res = await fetch(`${API_BASE}/admin/game/fire-reserve/${eventId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminGetCandidateHeadlines(category: string = 'all') {
  const res = await fetch(`${API_BASE}/admin/news-generator/candidates?category=${category}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function adminGetLeaderboard() {
  const res = await fetch(`${API_BASE}/admin/leaderboard`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminGetTeams() {
  const res = await fetch(`${API_BASE}/admin/teams`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminGetOrders() {
  const res = await fetch(`${API_BASE}/admin/orders`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminGetAudit() {
  const res = await fetch(`${API_BASE}/admin/audit`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminGetLoggedInTeams() {
  const res = await fetch(`${API_BASE}/admin/logged-in-teams`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function adminClearAudit() {
  const res = await fetch(`${API_BASE}/admin/audit/clear`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
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
      // First check if the backend is genuinely unreachable
      const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (!res.ok) {
        if (onStatusChange) onStatusChange(true);
      } else {
        // Backend HTTP is alive; don't show reconnecting immediately
        if (failedAttempts > 2 && onStatusChange) {
          onStatusChange(true);
        }
      }
    } catch {
      // Backend unreachable, genuinely disconnected
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
        // Schedule verification check before displaying any reconnecting badge
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
        // Auto-reconnect with backoff
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

