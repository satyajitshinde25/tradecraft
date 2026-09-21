/* ── Meridia Business Wire & Direct News Pop-Up Component ── */
import { useState, useMemo, useEffect, useRef } from 'react';
import type { NewsResponse, NewsEvent } from '../types';
import './NewsTicker.css';

interface Props {
  news: NewsResponse;
  currentTick: number;
  tickSeconds?: number;
}

export default function NewsTicker({ news, currentTick, tickSeconds = 37.5 }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popupEvent, setPopupEvent] = useState<NewsEvent | null>(null);

  // Format tick to simulation time (37.5s per tick for 1-hour contest: Tick 0 = 00:00:00, Tick 96 = 01:00:00)
  const formatSimulationTime = (tick: number) => {
    const totalSecs = Math.round(tick * tickSeconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const latestEvent = news.released_events.length > 0 ? news.released_events[0] : null;
  const initialLoadRef = useRef(true);
  const lastSeenEventRef = useRef<number>(-1);

  // Direct Pop-Up: whenever a new headline lands, pop it up directly in front of the user
  useEffect(() => {
    if (latestEvent) {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        lastSeenEventRef.current = latestEvent.event_number;
      } else if (lastSeenEventRef.current !== latestEvent.event_number) {
        lastSeenEventRef.current = latestEvent.event_number;
        setPopupEvent(latestEvent);
      }
    }
  }, [latestEvent]);

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

  return (
    <div className="meridia-wire-container">
      {/* ── Direct Breaking News Pop-Up Modal ── */}
      {popupEvent && (
        <div className="news-popup-overlay animate-fade-in" onClick={() => setPopupEvent(null)}>
          <div className="news-popup-card" onClick={e => e.stopPropagation()}>
            <div className="news-popup-header">
              <div className="news-popup-brand">
                <span className="live-dot" />
                <span className="news-popup-title">BREAKING NEWS — MERIDIA WIRE</span>
              </div>
              <button className="btn btn-icon btn-outline" onClick={() => setPopupEvent(null)}>✕</button>
            </div>
            <div className="news-popup-body">
              <div className="news-popup-meta mono">
                <span>TICK {popupEvent.release_tick}</span>
                <span>•</span>
                <span>{formatSimulationTime(popupEvent.release_tick)}</span>
                {popupEvent.calendar_title && (
                  <>
                    <span>•</span>
                    <span className="news-popup-topic">{popupEvent.calendar_title}</span>
                  </>
                )}
              </div>
              <h2 className="news-popup-headline">{popupEvent.headline}</h2>
              {popupEvent.description && (
                <p className="news-popup-desc">{popupEvent.description}</p>
              )}
            </div>
            <div className="news-popup-footer">
              <button className="btn btn-buy" onClick={() => setPopupEvent(null)}>
                Trade Now →
              </button>
            </div>
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
                className={`btn btn-sm ${showHistory ? 'btn-buy' : 'btn-outline'}`}
                onClick={() => setShowHistory(!showHistory)}
                title="View News History"
              >
                📰 News History ({news.released_events.length})
              </button>
            </div>
          </div>
        </div>

        <div className="wire-body">
          {latestEvent ? (
            <div
              className="latest-headline-wrapper clickable-headline"
              onClick={() => setPopupEvent(latestEvent)}
              title="Click to view full headline details"
            >
              <div className="headline-badge-row">
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
              <span>Awaiting market opening headlines... Official news begins at Tick 10.</span>
            </div>
          )}
        </div>
      </div>

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
                <div
                  key={evt.event_number}
                  className="history-item clickable-history-item"
                  onClick={() => {
                    setPopupEvent(evt);
                    setShowHistory(false);
                  }}
                  title="Click to view details"
                >
                  <div className="history-item-meta">
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
