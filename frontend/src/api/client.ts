/* ── API Client for Market Sprint Backend ── */

// Read API URL from Vite environment, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
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

export async function submitBuy(ticker: string, quantity: number) {
  const res = await fetch(`${API_BASE}/orders/buy`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ticker, quantity }),
  });
  return handleResponse(res);
}

export async function submitSell(ticker: string, quantity: number) {
  const res = await fetch(`${API_BASE}/orders/sell`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ ticker, quantity }),
  });
  return handleResponse(res);
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

// ── WebSocket ──
export function createMarketWebSocket(
  onMessage: (data: any) => void,
  onClose?: () => void,
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/market`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };
  ws.onclose = () => {
    if (onClose) onClose();
  };
  return ws;
}
