/* ── Meridia Business Wire & Economic Calendar Component ── */
import { useState, useMemo } from 'react';
import type { NewsResponse } from '../types';
import './NewsTicker.css';

interface Props {
  news: NewsResponse;
  currentTick: number;
}

export default function NewsTicker({ news, currentTick }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Format tick to simulation time (75s per tick: Tick 0 = 00:00:00, Tick 64 = 01:20:00)
  const formatSimulationTime = (tick: number) => {
    const totalSecs = tick * 75;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const latestEvent = news.released_events.length > 0 ? news.released_events[0] : null;

  // Next scheduled event approaching
  const nextScheduled = useMemo(() => {
    const upcoming = news.upcoming_scheduled.filter(e => e.release_tick > currentTick);
    if (upcoming.length === 0) return null;
    const sorted = [...upcoming].sort((a, b) => a.release_tick - b.release_tick);
    const next = sorted[0];
    const ticksAway = next.release_tick - currentTick;
    const secondsAway = ticksAway * 75;
    return {
      ...next,
      ticksAway,
      secondsAway,
      isClose: secondsAway <= 300, // within 5 simulation minutes (4 ticks)
      isImminent: secondsAway <= 75, // within 1 tick (approx 1 minute)
    };
  }, [news.upcoming_scheduled, currentTick]);

  // Filtered news history
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return news.released_events;
    const q = searchQuery.toLowerCase();
    return news.released_events.filter(
      e => e.headline.toLowerCase().includes(q) ||
           (e.description && e.description.toLowerCase().includes(q)) ||
           (e.calendar_title && e.calendar_title.toLowerCase().includes(q))
    );
  }, [news.released_events, searchQuery]);

  // Economic Calendar schedule items
  const scheduledSchedule = [
    { number: 3, tick: 24, time: 'T+30:00', title: 'Consumer Confidence', forecast: 'Forecast: Slight rise expected' },
    { number: 5, tick: 36, time: 'T+45:00', title: 'Vaultline Earnings', forecast: 'Forecast: Profit expected flat' },
    { number: 9, tick: 64, time: 'T+80:00', title: 'MRB Rate Decision', forecast: 'Forecast: Rates expected unchanged' },
  ];

  return (
    <div className="meridia-wire-container">
      {/* ── Approaching Event Warning Banner (5m / 1m warning) ── */}
      {nextScheduled && nextScheduled.isClose && (
        <div className={`scheduled-alert-banner ${nextScheduled.isImminent ? 'alert-imminent' : 'alert-warning'} animate-pulse`}>
          <div className="alert-badge">
            {nextScheduled.isImminent ? '⚠️ 1 MINUTE WARNING' : '⏱ 5 MINUTE WARNING'}
          </div>
          <div className="alert-content">
            <strong>NEXT SCHEDULED EVENT: {nextScheduled.calendar_title || nextScheduled.headline}</strong>
            <span className="alert-forecast">{nextScheduled.forecast}</span>
          </div>
          <div className="alert-countdown mono">
            Release: Tick {nextScheduled.release_tick} (~{Math.ceil(nextScheduled.secondsAway / 60)}m)
          </div>
        </div>
      )}

      {/* ── LIVE — MERIDIA BUSINESS WIRE ── */}
      <div className="meridia-wire-box card">
        <div className="wire-header">
          <div className="wire-brand">
            <span className="live-dot" />
            <span className="wire-title">LIVE — MERIDIA BUSINESS WIRE</span>
          </div>
          <div className="wire-meta mono">
            <span className="wire-tick">TICK {currentTick}</span>
            <span className="wire-time">{formatSimulationTime(currentTick)}</span>
            <div className="wire-actions">
              <button
                className={`btn btn-sm ${showCalendar ? 'btn-buy' : 'btn-outline'}`}
                onClick={() => setShowCalendar(!showCalendar)}
                title="View Economic Calendar"
              >
                📅 Calendar
              </button>
              <button
                className={`btn btn-sm ${showHistory ? 'btn-buy' : 'btn-outline'}`}
                onClick={() => setShowHistory(!showHistory)}
                title="View News History"
              >
                📰 History ({news.released_events.length})
              </button>
            </div>
          </div>
        </div>

        <div className="wire-body">
          {latestEvent ? (
            <div className="latest-headline-wrapper">
              <div className="headline-badge-row">
                <span className={`badge ${latestEvent.is_scheduled ? 'badge-blue' : 'badge-yellow'}`}>
                  {latestEvent.is_scheduled ? '📅 SCHEDULED RELEASE' : '⚡ BREAKING NEWS'}
                </span>
                <span className="headline-tick mono">Tick {latestEvent.release_tick}</span>
                {latestEvent.calendar_title && (
                  <span className="headline-topic">{latestEvent.calendar_title}</span>
                )}
              </div>
              <h2 className="latest-headline-text">
                {latestEvent.headline}
              </h2>
              {latestEvent.description && (
                <p className="latest-headline-desc">{latestEvent.description}</p>
              )}
            </div>
          ) : (
            <div className="wire-empty">
              <span>Awaiting market opening headlines... Official release begins at Tick 10.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Economic Calendar Modal / Drawer ── */}
      {showCalendar && (
        <div className="calendar-drawer card animate-fade-in">
          <div className="drawer-header">
            <h3>📅 ECONOMIC CALENDAR (PUBLIC FORECASTS)</h3>
            <button className="btn btn-icon btn-outline" onClick={() => setShowCalendar(false)}>✕</button>
          </div>
          <p className="calendar-info">
            Public consensus forecasts are released before the market sprint. Outcomes fill strictly at the designated release ticks.
          </p>
          <div className="calendar-grid">
            {scheduledSchedule.map(item => {
              const isReleased = currentTick >= item.tick;
              const releasedEvt = news.released_events.find(e => e.release_tick === item.tick);
              return (
                <div key={item.number} className={`calendar-card ${isReleased ? 'card-released' : 'card-upcoming'}`}>
                  <div className="calendar-card-top">
                    <span className="calendar-time mono">{item.time} (Tick {item.tick})</span>
                    <span className={`badge ${isReleased ? 'badge-green' : 'badge-yellow'}`}>
                      {isReleased ? 'RELEASED' : 'UPCOMING'}
                    </span>
                  </div>
                  <h4 className="calendar-event-title">{item.title}</h4>
                  <div className="calendar-forecast">{item.forecast}</div>
                  {isReleased && releasedEvt && (
                    <div className="calendar-actual">
                      <span className="actual-tag">OUTCOME:</span> {releasedEvt.headline}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── News History Drawer ── */}
      {showHistory && (
        <div className="history-drawer card animate-fade-in">
          <div className="drawer-header">
            <h3>📰 NEWS HISTORY ({news.released_events.length} HEADLINES)</h3>
            <div className="drawer-header-right">
              <input
                className="input input-sm"
                type="text"
                placeholder="Search headlines..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button className="btn btn-icon btn-outline" onClick={() => setShowHistory(false)}>✕</button>
            </div>
          </div>
          <div className="history-list">
            {filteredHistory.length === 0 ? (
              <p className="history-empty">No headlines match your search.</p>
            ) : (
              filteredHistory.map(evt => (
                <div key={evt.event_number} className="history-item">
                  <div className="history-item-meta">
                    <span className={`badge ${evt.is_scheduled ? 'badge-blue' : 'badge-yellow'}`}>
                      {evt.is_scheduled ? 'SCHEDULED' : 'SURPRISE'}
                    </span>
                    <span className="mono history-tick">Tick {evt.release_tick}</span>
                    <span className="mono history-time">{formatSimulationTime(evt.release_tick)}</span>
                    {evt.calendar_title && <span className="history-topic">{evt.calendar_title}</span>}
                  </div>
                  <div className="history-headline">{evt.headline}</div>
                  {evt.description && <div className="history-desc">{evt.description}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
