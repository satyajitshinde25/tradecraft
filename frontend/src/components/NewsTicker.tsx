/* ── NewsTicker — The Wall Street Chronicle (Financial Gazette) ── */
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

  // Format tick to simulation time (Tick 0 = 00:00:00 EST)
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

  // Direct Pop-Up: when a new breaking dispatch lands during active gameplay
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
    <div className="chronicle-gazette-panel card">
      {/* ── Breaking News Pop-Up Modal ── */}
      {popupEvent && (
        <div className="news-popup-overlay animate-fade-in" onClick={() => setPopupEvent(null)}>
          <div className="news-popup-card" onClick={e => e.stopPropagation()}>
            <div className="news-popup-header">
              <div className="news-popup-brand">
                <span className="live-dot-red" />
                <span className="news-popup-title font-serif">THE WALL STREET CHRONICLE • FLASH DISPATCH</span>
              </div>
              <button className="btn btn-icon btn-outline" onClick={() => setPopupEvent(null)}>✕</button>
            </div>
            <div className="news-popup-body">
              <div className="news-popup-meta mono">
                <span className="meta-tick">TICK {popupEvent.release_tick}</span>
                <span className="meta-sep">•</span>
                <span>{formatSimulationTime(popupEvent.release_tick)} EST</span>
                {popupEvent.calendar_title && (
                  <>
                    <span className="meta-sep">•</span>
                    <span className="news-popup-topic">{popupEvent.calendar_title}</span>
                  </>
                )}
              </div>
              <h2 className="news-popup-headline font-editorial">{popupEvent.headline}</h2>
              {popupEvent.description && (
                <p className="news-popup-desc font-editorial">{popupEvent.description}</p>
              )}
            </div>
            <div className="news-popup-footer">
              <span className="news-popup-rule-hint">💡 Market impact reflects on subsequent tick opening prices.</span>
              <button className="btn btn-brass" onClick={() => setPopupEvent(null)}>
                Acknowledge & Trade →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Newspaper Masthead ── */}
      <div className="chronicle-masthead">
        <div className="masthead-title-row">
          <span className="chronicle-edition font-serif">MANHATTAN FINANCIAL GAZETTE</span>
          <div className="masthead-date-stamp mono">
            <span>TICK {currentTick}</span> • <span>{formatSimulationTime(currentTick)} EST</span>
          </div>
        </div>
        <h2 className="chronicle-main-title font-editorial">The Wall Street Chronicle</h2>
        <div className="masthead-rule-line" />
      </div>

      {/* ── Editorial Body ── */}
      <div className="chronicle-body">
        {latestEvent ? (
          <div
            className="chronicle-lead-article clickable-article"
            onClick={() => setPopupEvent(latestEvent)}
            title="Click to view full dispatch"
          >
            <div className="lead-meta-row">
              <span className="badge badge-red">BREAKING DISPATCH</span>
              <span className="lead-tick mono">Tick {latestEvent.release_tick}</span>
              {latestEvent.calendar_title && (
                <span className="lead-category">{latestEvent.calendar_title}</span>
              )}
            </div>
            <h3 className="lead-headline font-editorial">{latestEvent.headline}</h3>
            {latestEvent.description && (
              <p className="lead-excerpt">{latestEvent.description}</p>
            )}
          </div>
        ) : (
          /* Pre-Market Opening Briefing */
          <div className="chronicle-premarket-briefing">
            <div className="lead-meta-row">
              <span className="badge badge-brass">PRE-MARKET BRIEFING</span>
              <span className="lead-tick mono">TICK 00 • OPENING BELL</span>
            </div>
            <h3 className="lead-headline font-editorial">
              Manhattan Floor Awaits Opening Bell Dispatches As Trading Desk Readies 6 Listed Equities
            </h3>
            <p className="lead-excerpt">
              Floor analysts anticipate heightened volatility across Energy (TAVR), Technology (LMRA), and Banking (VLTN). Corporate disclosures and regulatory filings will broadcast live across this teletype wire as ticks advance.
            </p>
          </div>
        )}
      </div>

      {/* ── Archive Action Bar ── */}
      <div className="chronicle-footer-bar">
        <span className="chronicle-status-hint">
          {news.released_events.length > 0
            ? `Transmitted ${news.released_events.length} wire dispatches this session.`
            : 'Floor dispatch wire online. Ticks advance on timer.'}
        </span>
        <button
          className={`btn btn-sm ${showHistory ? 'btn-brass' : 'btn-outline'}`}
          onClick={() => setShowHistory(!showHistory)}
        >
          📰 Gazette Archive ({news.released_events.length})
        </button>
      </div>

      {/* ── Gazette Archive Drawer ── */}
      {showHistory && (
        <div className="history-drawer card animate-fade-in">
          <div className="drawer-header">
            <div className="drawer-title-group">
              <h3 className="font-editorial">CHRONICLE DISPATCH ARCHIVE</h3>
              <span className="drawer-count mono">{news.released_events.length} Records</span>
            </div>
            <div className="drawer-header-right">
              <input
                className="input input-sm"
                type="text"
                placeholder="Search archive headlines or tickers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button className="btn btn-icon btn-outline" onClick={() => setShowHistory(false)}>✕</button>
            </div>
          </div>
          <div className="history-list">
            {filteredHistory.length === 0 ? (
              <p className="history-empty">No historical dispatches recorded for this query.</p>
            ) : (
              filteredHistory.map(evt => (
                <div
                  key={evt.event_number}
                  className="history-item clickable-history-item"
                  onClick={() => {
                    setPopupEvent(evt);
                    setShowHistory(false);
                  }}
                  title="Click to inspect dispatch"
                >
                  <div className="history-item-meta">
                    <span className="mono history-tick">Tick {evt.release_tick}</span>
                    <span className="mono history-time">{formatSimulationTime(evt.release_tick)} EST</span>
                    {evt.calendar_title && <span className="history-topic">{evt.calendar_title}</span>}
                  </div>
                  <div className="history-headline font-editorial">{evt.headline}</div>
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
