import { useState, useEffect, useCallback, useRef } from 'react';
import { getRawMessages, getRawMessageChannels, getRawMessageDates } from '../../api/rawMessages';
import { getMessageCreated, isSystemOrHidden } from '../../utils/message';
import { parseToLocalDate } from '../../utils/date';
import MessageBubble from './MessageBubble';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './RawMessagesPage.css';

const PAGE_SIZE = 50;
const SOURCE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'telegram', label: 'Telegram' },
];

export default function RawMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [channel, setChannel] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [channels, setChannels] = useState([]);
  const [dateSummary, setDateSummary] = useState([]);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const searchTimer = useRef(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(searchTimer.current);
  }, []);

  // Fetch channels on mount
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

  // Fetch dates when channel changes (for date picker)
  useEffect(() => {
    getRawMessageDates({ channel: channel || undefined })
      .then(res => setDateSummary(res.dates || []))
      .catch(console.error);
  }, [channel]);

  // Build request params — sort=desc so backend gives newest page first
  const buildParams = useCallback((pageNum) => {
    const params = {
      page: pageNum,
      pageSize: PAGE_SIZE,
      sort: 'desc',
    };
    if (channel) params.channel = channel;
    if (searchQ) params.q = searchQ;
    if (selectedDate) params.date = selectedDate;
    if (favOnly) params.favorite = 1;
    return params;
  }, [channel, searchQ, selectedDate, favOnly]);

  // Main fetch
  // Backend returns newest-first (desc). We reverse to display old→new (chat order).
  // "Load earlier" fetches the next desc page and prepends older messages.
  const fetchMessages = useCallback(async (pageNum = 1, loadEarlier = false) => {
    if (loadEarlier) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await getRawMessages(buildParams(pageNum));
      const data = (result.data || []).slice().reverse(); // reverse desc→asc for display

      if (loadEarlier) {
        // Prepend older messages before current ones
        setMessages(prev => [...data, ...prev]);
      } else {
        setMessages(data);
        window.setTimeout(() => {
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'auto',
          });
        }, 0);
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

  // Refetch when filters change
  useEffect(() => {
    fetchMessages(1);
  }, [fetchMessages]);

  // Debounced search
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

  const handleDateInput = (event) => {
    setSelectedDate(event.target.value);
    setShowDatePicker(false);
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  // Load earlier (older messages)
  const hasMore = messages.length < total;
  const handleLoadEarlier = () => {
    if (!loadingMore && hasMore) {
      fetchMessages(page + 1, true);
    }
  };

  // Update a single message (e.g., after fav toggle)
  const handleMessageUpdate = (updated) => {
    setMessages(prev => {
      // In favorite-only mode, remove the message if it was just unfavorited
      if (favOnly && !updated.favorite) {
        return prev.filter(m => m.id !== updated.id);
      }
      return prev.map(m => m.id === updated.id ? { ...m, ...updated } : m);
    });
  };

  // Filter system/hidden on frontend
  const visibleMessages = messages.filter(m => !isSystemOrHidden(m));

  // Group by date for separators
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

      items.push(
        <MessageBubble
          key={msg.id || idx}
          message={msg}
          onUpdate={handleMessageUpdate}
        />
      );
    });

    return items;
  };

  // Quick date chips (recent dates with data)
  const recentDates = dateSummary.slice(0, 7);

  return (
    <div className="raw-messages-page">
      {/* Page Header */}
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

      {/* Toolbar */}
      <div className="stream-toolbar">
        {/* Search */}
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
          />
          {searchInput && (
            <button className="search-clear" onClick={clearSearch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Chips Row: channel + date + fav */}
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
            <button
              className="stream-date-btn"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {selectedDate ? selectedDate.replace(/-/g, '/') : '日期'}
            </button>

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

        {/* Quick date picker */}
        {showDatePicker && (
          <div className="stream-date-picker">
            <input
              className="stream-date-input"
              type="date"
              value={selectedDate}
              onChange={handleDateInput}
              aria-label="选择日期"
            />
            <button
              className={`date-chip ${!selectedDate ? 'active' : ''}`}
              onClick={() => { setSelectedDate(''); setShowDatePicker(false); }}
            >全部日期</button>
            {recentDates.map(d => (
              <button
                key={d.date}
                className={`date-chip ${selectedDate === d.date ? 'active' : ''}`}
                onClick={() => { setSelectedDate(d.date); setShowDatePicker(false); }}
              >
                {d.date.slice(5).replace('-', '/')}
                <span className="date-chip-count">{d.total}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search result hint */}
      {searchQ && !loading && (
        <div className="stream-search-hint">
          搜索 &quot;{searchQ}&quot; · {total} 条结果
        </div>
      )}

      {/* Message List */}
      <div className="stream-messages">
        {loading ? (
          <LoadingSpinner />
        ) : visibleMessages.length === 0 ? (
          <EmptyState message="暂无对话消息" icon="💬" />
        ) : (
          <>
            {/* Load Earlier (older messages prepend above) */}
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
