import { useState, useEffect, useCallback, useRef, useMemo, createRef } from 'react';
import { getRawMessages, getRawMessageChannels, getRawMessageDates } from '../../api/rawMessages';
import { getMessageCreated, getMessageText, isSystemOrHidden } from '../../utils/message';
import { parseToLocalDate } from '../../utils/date';
import MessageBubble from './MessageBubble';
import StreamCalendar from './StreamCalendar';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './RawMessagesPage.css';

const PAGE_SIZE = 50;
const SOURCE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'telegram', label: 'Telegram' },
];

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function getLocalDayUtcRange(dateString) {
  const start = new Date(`${dateString}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
  };
}

function chipHeatClass(count, max) {
  if (!count || max <= 0) return '';
  const ratio = count / max;
  if (ratio >= 0.7) return 'qchip-heat-4';
  if (ratio >= 0.4) return 'qchip-heat-3';
  if (ratio >= 0.15) return 'qchip-heat-2';
  return 'qchip-heat-1';
}

function getLocalRangeUtc(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
  };
}

export default function RawMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [channel, setChannel] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [dateMode, setDateMode] = useState('single');
  const [favOnly, setFavOnly] = useState(false);
  const [channels, setChannels] = useState([]);
  const [dateSummary, setDateSummary] = useState([]);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showDateChips, setShowDateChips] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedMatchIdx, setFocusedMatchIdx] = useState(-1);

  const searchTimer = useRef(null);
  const matchRefs = useRef([]);

  useEffect(() => {
    return () => clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    getRawMessageChannels()
      .then(res => {
        const apiChannels = res.channels || [];
        const merged = Array.from(new Set([...apiChannels, 'wechat', 'telegram']));
        setChannels(merged);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const updateScrollButton = () => {
      const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      setShowScrollBottom(distanceToBottom > 600);
    };
    updateScrollButton();
    window.addEventListener('scroll', updateScrollButton, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollButton);
  }, []);

  useEffect(() => {
    const tz = getBrowserTimezone();
    getRawMessageDates({ channel: channel || undefined, tz })
      .then(res => setDateSummary(res.dates || []))
      .catch(console.error);
  }, [channel]);

  const buildParams = useCallback((pageNum) => {
    const params = {
      page: pageNum,
      pageSize: PAGE_SIZE,
      sort: 'desc',
    };
    if (channel) params.channel = channel;
    if (searchQ) params.q = searchQ;
    if (dateMode === 'single' && selectedDate) {
      const { startUtc, endUtc } = getLocalDayUtcRange(selectedDate);
      params.startUtc = startUtc;
      params.endUtc = endUtc;
    } else if (dateMode === 'range' && rangeStart && rangeEnd) {
      const { startUtc, endUtc } = getLocalRangeUtc(rangeStart, rangeEnd);
      params.startUtc = startUtc;
      params.endUtc = endUtc;
    }
    if (favOnly) params.favorite = 1;
    return params;
  }, [channel, searchQ, selectedDate, rangeStart, rangeEnd, dateMode, favOnly]);

  const fetchMessages = useCallback(async (pageNum = 1, loadEarlier = false) => {
    if (loadEarlier) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await getRawMessages(buildParams(pageNum));
      const data = (result.data || []).slice().reverse();
      if (loadEarlier) {
        setMessages(prev => [...data, ...prev]);
      } else {
        setMessages(data);
      }
      setTotal(result.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch raw messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchMessages(1);
  }, [fetchMessages]);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQ(val.trim());
    }, 400);
  };

  const clearSearch = () => {
    clearTimeout(searchTimer.current);
    setSearchInput('');
    setSearchQ('');
  };

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
  };

  const handleRangeSelect = (start, end) => {
    setRangeStart(start || '');
    setRangeEnd(end || '');
  };

  const clearAllDates = () => {
    setSelectedDate('');
    setRangeStart('');
    setRangeEnd('');
    setShowDateChips(false);
    setShowDatePicker(false);
  };

  const handleDateBtnClick = () => {
    if (showDatePicker) {
      setShowDatePicker(false);
    } else {
      setShowDateChips(!showDateChips);
    }
  };

  const openFullCalendar = () => {
    setShowDateChips(false);
    setShowDatePicker(true);
  };

  const handleChipDateClick = (dateStr) => {
    setDateMode('single');
    setSelectedDate(dateStr);
    setRangeStart('');
    setRangeEnd('');
    setShowDateChips(false);
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  const hasMore = messages.length < total;
  const handleLoadEarlier = () => {
    if (!loadingMore && hasMore) {
      fetchMessages(page + 1, true);
    }
  };

  const handleMessageUpdate = (updated) => {
    setMessages(prev => {
      if (favOnly && !updated.favorite) {
        return prev.filter(m => m.id !== updated.id);
      }
      return prev.map(m => m.id === updated.id ? { ...m, ...updated } : m);
    });
  };

  const visibleMessages = messages.filter(m => !isSystemOrHidden(m));

  // Find indices of messages that match the search query (client-side)
  const matchIndices = useMemo(() => {
    if (!searchQ) return [];
    const q = searchQ.toLowerCase();
    return visibleMessages.reduce((acc, msg, idx) => {
      const text = getMessageText(msg) || '';
      if (text.toLowerCase().includes(q)) acc.push(idx);
      return acc;
    }, []);
  }, [visibleMessages, searchQ]);

  // Sync refs array length with match count
  useEffect(() => {
    matchRefs.current = matchIndices.map(() => createRef());
  }, [matchIndices.length]);

  // Reset focused match when search or matches change
  const prevSearchQ = useRef(searchQ);
  useEffect(() => {
    if (prevSearchQ.current !== searchQ) {
      // Search term changed → reset to first match
      setFocusedMatchIdx(matchIndices.length > 0 ? 0 : -1);
      prevSearchQ.current = searchQ;
    } else if (focusedMatchIdx === -1 && matchIndices.length > 0) {
      // Matches appeared (e.g. after fetch) → select first
      setFocusedMatchIdx(0);
    }
  }, [searchQ, matchIndices.length]);

  // Scroll focused match into view
  useEffect(() => {
    if (focusedMatchIdx < 0 || focusedMatchIdx >= matchRefs.current.length) return;
    const ref = matchRefs.current[focusedMatchIdx];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedMatchIdx]);

  const goNextMatch = useCallback(() => {
    if (matchIndices.length === 0) return;
    setFocusedMatchIdx(prev => {
      const next = prev + 1;
      // If we've gone past all loaded matches and there are more on server
      if (next >= matchIndices.length && hasMore) {
        handleLoadEarlier();
        return prev; // stay until new data loads
      }
      return next >= matchIndices.length ? 0 : next;
    });
  }, [matchIndices.length, hasMore]);

  const goPrevMatch = useCallback(() => {
    if (matchIndices.length === 0) return;
    setFocusedMatchIdx(prev =>
      prev <= 0 ? matchIndices.length - 1 : prev - 1
    );
  }, [matchIndices.length]);

  // Keyboard: Enter = next, Shift+Enter = prev (when search input focused)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && matchIndices.length > 0) {
      e.preventDefault();
      if (e.shiftKey) goPrevMatch();
      else goNextMatch();
    }
  };

  const renderMessages = () => {
    let lastDateLabel = null;
    const items = [];

    visibleMessages.forEach((msg, idx) => {
      const created = getMessageCreated(msg);
      const dateObj = parseToLocalDate(created);
      const dateLabel = dateObj
        ? dateObj.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

      if (dateLabel && dateLabel !== lastDateLabel) {
        items.push(
          <div key={`sep-${dateLabel}`} className="date-separator">
            <span className="date-separator-pill">{dateLabel}</span>
          </div>
        );
        lastDateLabel = dateLabel;
      }

      const matchPos = matchIndices.indexOf(idx);
      items.push(
        <MessageBubble
          key={msg.id || idx}
          message={msg}
          onUpdate={handleMessageUpdate}
          searchQ={searchQ}
          isFocusedMatch={matchPos >= 0 && matchPos === focusedMatchIdx}
          bubbleRef={matchPos >= 0 ? matchRefs.current[matchPos] : undefined}
        />
      );
    });

    return items;
  };

  const calendarDates = dateSummary.map(d => d.date);
  const calendarDateCounts = dateSummary.reduce((acc, d) => {
    acc[d.date] = d.total;
    return acc;
  }, {});
  const hasDateFilter = (dateMode === 'single' && selectedDate)
    || (dateMode === 'range' && rangeStart && rangeEnd);

  const formatDateLabel = () => {
    if (dateMode === 'single' && selectedDate) {
      const d = new Date(`${selectedDate}T12:00:00`);
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
    if (dateMode === 'range' && rangeStart && rangeEnd) {
      return `${rangeStart.slice(5).replace('-', '/')}~${rangeEnd.slice(5).replace('-', '/')}`;
    }
    return '日期';
  };

  return (
    <div className="raw-messages-page">
      <div className="page-header">
        <div className="page-title-wrap">
          <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <div>
            <h1 className="page-title">对话流</h1>
            <span className="page-subtitle">RAW MESSAGE STREAM</span>
          </div>
        </div>
      </div>

      <div className="stream-toolbar">
        <div className="stream-search-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="stream-search-input"
            type="text"
            placeholder="搜索对话内容..."
            value={searchInput}
            onChange={handleSearchInput}
            onKeyDown={handleSearchKeyDown}
          />
          {searchInput && (
            <button className="search-clear" onClick={clearSearch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="stream-chips-row">
          <div className="channel-chips">
            {SOURCE_OPTIONS.map(option => (
              <button
                key={option.value || 'all'}
                className={`stream-chip ${channel === option.value ? 'active' : ''}`}
                onClick={() => setChannel(option.value)}
              >
                {option.label}
              </button>
            ))}
            {channels
              .filter(ch => !SOURCE_OPTIONS.some(option => option.value === ch))
              .map(ch => (
                <button
                  key={ch}
                  className={`stream-chip ${channel === ch ? 'active' : ''}`}
                  onClick={() => setChannel(ch)}
                >
                  {ch}
                </button>
              ))}
          </div>

          <div className="stream-controls">
            <div className="stream-date-wrapper">
              <button
                className={`stream-date-btn ${hasDateFilter ? 'has-date' : ''}`}
                onClick={handleDateBtnClick}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {formatDateLabel()}
              </button>
              {hasDateFilter && (
                <button className="stream-date-clear" onClick={clearAllDates}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            <button
              className={`stream-chip fav-chip ${favOnly ? 'active' : ''}`}
              onClick={() => setFavOnly(!favOnly)}
            >
              <svg viewBox="0 0 24 24" fill={favOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              收藏
            </button>
          </div>
        </div>

        {searchQ && !loading && (
          <div className="stream-search-nav">
            <span className="search-nav-label">
              &quot;{searchQ}&quot; &middot; {total} 条结果
            </span>
            {matchIndices.length > 0 && (
              <div className="search-nav-controls">
                <button
                  className="search-nav-btn"
                  onClick={goPrevMatch}
                  disabled={matchIndices.length <= 1}
                  aria-label="上一个匹配"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                </button>
                <span className="search-nav-count">
                  {focusedMatchIdx + 1} / {matchIndices.length}
                  {hasMore && '+'}
                </span>
                <button
                  className="search-nav-btn"
                  onClick={goNextMatch}
                  disabled={matchIndices.length <= 1 && !hasMore}
                  aria-label="下一个匹配"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showDateChips && !showDatePicker && (() => {
        const recentDates = dateSummary.slice(0, 7);
        const chipMax = recentDates.length ? Math.max(...recentDates.map(d => d.total)) : 0;
        return (
          <div className="stream-date-chips-panel">
            {recentDates.map(d => (
              <button
                key={d.date}
                className={`stream-qchip ${chipHeatClass(d.total, chipMax)} ${selectedDate === d.date ? 'active' : ''}`}
                onClick={() => handleChipDateClick(d.date)}
              >
                {d.date.slice(5).replace('-', '/')}
                <span className="stream-qchip-count">{d.total}</span>
              </button>
            ))}
            <button className="stream-qchip stream-qchip-more" onClick={openFullCalendar}>
              更多日期...
            </button>
          </div>
        );
      })()}

      {showDatePicker && (
        <StreamCalendar
          dates={calendarDates}
          dateCounts={calendarDateCounts}
          selectedDate={selectedDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          mode={dateMode}
          onModeChange={setDateMode}
          onDateSelect={handleDateSelect}
          onRangeSelect={handleRangeSelect}
          onClear={clearAllDates}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <div className="stream-messages">
        {loading ? (
          <LoadingSpinner />
        ) : visibleMessages.length === 0 ? (
          <EmptyState message="暂无对话消息" icon="💬" />
        ) : (
          <>
            {hasMore && (
              <div className="stream-pagination stream-pagination-top">
                {loadingMore ? (
                  <span className="stream-loading-text">加载中...</span>
                ) : (
                  <button className="stream-load-more" onClick={handleLoadEarlier}>
                    加载更早的消息 ({messages.length} / {total})
                  </button>
                )}
              </div>
            )}

            {renderMessages()}
          </>
        )}
      </div>

      {showScrollBottom && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom} aria-label="回到底部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14"/>
            <path d="M19 12l-7 7-7-7"/>
          </svg>
        </button>
      )}
    </div>
  );
}
