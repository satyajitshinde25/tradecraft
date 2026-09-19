/* ── News Ticker Component ── */
import { useState } from 'react';
import type { NewsResponse } from '../types';
import './NewsTicker.css';

interface Props {
  news: NewsResponse;
  currentTick: number;
}

export default function NewsTicker({ news, currentTick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const latestEvent = news.released_events.length > 0 ? news.released_events[0] : null;

  return (
    <div className="news-section">
      {/* Main headline banner */}
      {latestEvent && (
        <div className="news-banner card" onClick={() => setExpanded(!expanded)}>
          <div className="news-banner-left">
            <span className={`news-badge ${latestEvent.is_scheduled ? 'badge-blue' : 'badge-yellow'}`}>
              {latestEvent.is_scheduled ? '📅 SCHEDULED' : '⚡ BREAKING'}
            </span>
            <span className="news-tick mono">Tick {latestEvent.release_tick}</span>
          </div>
          <div className="news-headline">{latestEvent.headline}</div>
          <span className="news-expand-btn">{expanded ? '▲' : '▼'}</span>
        </div>
      )}

      {/* Expanded news feed */}
      {expanded && (
        <div className="news-feed card animate-fade-in">
          {/* Upcoming scheduled events */}
          {news.upcoming_scheduled.length > 0 && (
            <div className="news-upcoming">
              <h4>📅 Upcoming Scheduled Events</h4>
              {news.upcoming_scheduled.map(evt => (
                <div key={evt.event_number} className="news-upcoming-item">
                  <span className="badge badge-blue">Tick {evt.release_tick}</span>
                  <span>{evt.headline}</span>
                  {evt.forecast && <span className="news-forecast">{evt.forecast}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Released events history */}
          <h4>📰 News History</h4>
          {news.released_events.map(evt => (
            <div key={evt.event_number} className="news-item">
              <div className="news-item-header">
                <span className={`news-badge-sm ${evt.is_scheduled ? 'badge-blue' : 'badge-yellow'}`}>
                  {evt.is_scheduled ? 'SCHEDULED' : 'SURPRISE'}
                </span>
                <span className="news-item-tick mono">Tick {evt.release_tick}</span>
              </div>
              <div className="news-item-headline">{evt.headline}</div>
              {evt.description && <div className="news-item-desc">{evt.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
