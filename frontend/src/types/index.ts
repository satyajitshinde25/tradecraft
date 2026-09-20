/* ── Types for Market Sprint Frontend ── */

export interface LoginResponse {
  token: string;
  team_code: string;
  display_name: string;
  role: string;
}

export interface GameState {
  game_id: string;
  game_name: string;
  status: string;
  current_tick: number;
  max_tick: number;
  tick_seconds: number;
  server_time: string;
  tick_started_at: string | null;
  next_tick_at: string | null;
  starting_balance: number;
  max_trades: number;
  buy_limit_percent: number;
  concentration_limit: number;
  trade_fee_percent: number;
  cooldown_seconds: number;
}

export interface CompanyPrice {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  change_percent: number;
  start_price: number;
}

export interface MarketOverview {
  tick: number;
  timestamp: string;
  prices: CompanyPrice[];
}

export interface CandleData {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlesResponse {
  ticker: string;
  name: string;
  candles: CandleData[];
}

export interface NewsEvent {
  event_number: number;
  release_tick: number;
  event_type: string;
  headline: string;
  calendar_title?: string | null;
  time_offset?: string | null;
  description: string | null;
  forecast: string | null;
  is_scheduled: boolean;
  released_at: string | null;
}

export interface UpcomingEvent {
  event_number: number;
  release_tick: number;
  calendar_title?: string;
  headline: string;
  time_offset?: string | null;
  forecast: string | null;
}

export interface NewsResponse {
  released_events: NewsEvent[];
  upcoming_scheduled: UpcomingEvent[];
}

export interface OrderResponse {
  order_id: string;
  status: string;
  side: string;
  ticker: string;
  quantity: number;
  submitted_tick: number;
  requested_price: number | null;
  fill_tick: number | null;
  fill_price: number | null;
  fee: number;
  gross_value: number | null;
  net_value: number | null;
  rejection_reason: string | null;
  submitted_at: string;
}

export interface HoldingData {
  ticker: string;
  company_name: string;
  quantity: number;
  average_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_pl_percent: number;
}

export interface Portfolio {
  team_code: string;
  display_name: string;
  cash: number;
  holdings_value: number;
  portfolio_value: number;
  starting_balance: number;
  profit_loss: number;
  profit_loss_percent: number;
  trades_used: number;
  max_trades: number;
  companies_traded: number;
  is_eligible: boolean;
  holdings: HoldingData[];
}

export interface LeaderboardEntry {
  rank: number;
  team_code: string;
  display_name: string;
  portfolio_value: number;
  profit_loss: number;
  profit_loss_percent: number;
  trade_count: number;
  companies_traded: number;
  is_eligible: boolean;
  cash: number;
  holdings_value: number;
  is_active: boolean;
  last_order_at: string | null;
}

export interface WSMarketMessage {
  type: string;
  tick: number;
  status: string;
  is_test_mode?: boolean;
  server_time: string;
  tick_started_at: string | null;
  next_tick_at: string | null;
  latest_news?: NewsEvent | null;
  upcoming_scheduled?: UpcomingEvent[];
  prices: {
    ticker: string;
    name: string;
    price: number;
    change: number;
    change_percent: number;
  }[];
}
