import { useState, useEffect, useCallback, useRef, useMemo, createRef } from 'react';
import {
  getRawMessages,
  getRawMessageChannels,
  getRawMessageDates,
  getRawMessageSummaries,
  updateRawMessageSummary,
  hideMessage,
} from '../../api/rawMessages';
import { getMessageCreated, getMessageText, isSystemOrHidden } from '../../utils/message';
import { parseToLocalDate } from '../../utils/date';
import MessageBubble from './MessageBubble';
import StreamCalendar from './StreamCalendar';
import SessionPanel from './SessionPanel';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ImportModal from '../Import/ImportModal';
import './RawMessagesPage.css';

const PAGE_SIZE = 50;
const SOURCE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'telegram-dm', label: 'TG DM' },
  { value: 'telegram-group', label: 'Group' },
  { value: 'chatgpt', label: 'ChatGPT' },
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
  const [threadId, setThreadId] = useState('');
  const [excludeThreadId, setExcludeThreadId] = useState('');
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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showDateChips, setShowDateChips] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedMatchIdx, setFocusedMatchIdx] = useState(-1);
  const [selectedSession, setSelectedSession] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [showSessionPanel, setShowSessionPanel] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hiding, setHiding] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [savedSearch, setSavedSearch] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const locateMessageIdRef = useRef(null);
  const restoreScrollRef = useRef(null);
  const [locateEndUtc, setLocateEndUtc] = useState(null); // endUtc for locate initial load
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [showSummaries, setShowSummaries] = useState(false);
  const [summaries, setSummaries] = useState([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [summaryKind, setSummaryKind] = useState('rolling');
  const [summarySource, setSummarySource] = useState('ember');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [editingSummaryId, setEditingSummaryId] = useState(null);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

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
    const updateScrollButtons = () => {
      const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      setShowScrollBottom(distanceToBottom > 600);
      setShowScrollTop(window.scrollY > 600);
    };
    updateScrollButtons();
    window.addEventListener('scroll', updateScrollButtons, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollButtons);
  }, []);

  useEffect(() => {
    const tz = getBrowserTimezone();
    getRawMessageDates({
      channel: channel || undefined,
      threadId: threadId || undefined,
      excludeThreadId: excludeThreadId || undefined,
      tz,
    })
      .then(res => setDateSummary(res.dates || []))
      .catch(console.error);
  }, [channel, threadId, excludeThreadId]);

  // When a date filter is active, sort ascending so messages start from morning
  const hasDateFilter = (dateMode === 'single' && selectedDate)
    || (dateMode === 'range' && rangeStart && rangeEnd);
  const sortOrder = hasDateFilter ? 'asc' : 'desc';

  const buildParams = useCallback((pageNum) => {
    const params = {
      page: pageNum,
      pageSize: PAGE_SIZE,
      sort: sortOrder,
    };
    if (channel) params.channel = channel;
    if (threadId) params.threadId = threadId;
    if (excludeThreadId) params.excludeThreadId = excludeThreadId;
    if (selectedSession) params.session = selectedSession;
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
    if (showHidden) params.includeHidden = '1';
    // Locate mode: restrict endUtc so target falls within loaded 50
    if (locateEndUtc && !params.startUtc && !params.endUtc) {
      params.endUtc = locateEndUtc;
    }
    return params;
  }, [channel, threadId, excludeThreadId, selectedSession, searchQ, selectedDate, rangeStart, rangeEnd, dateMode, favOnly, showHidden, locateEndUtc, sortOrder]);

  const sourceFilter = useMemo(() => {
    if (channel === 'telegram' && threadId === 'ember_group') return 'telegram-group';
    if (channel === 'telegram' && excludeThreadId === 'ember_group') return 'telegram-dm';
    return channel || '';
  }, [channel, threadId, excludeThreadId]);

  const handleSourceSelect = (value) => {
    setSelectedSession('');
    setSessionTitle('');
    if (value === 'telegram-group') {
      setChannel('telegram');
      setThreadId('ember_group');
      setExcludeThreadId('');
      return;
    }
    if (value === 'telegram-dm') {
      setChannel('telegram');
      setThreadId('');
      setExcludeThreadId('ember_group');
      return;
    }
    setChannel(value);
    setThreadId('');
    setExcludeThreadId('');
  };

  const fetchSummaries = useCallback(async () => {
    if (!showSummaries) return;
    setSummariesLoading(true);
    try {
      const result = await getRawMessageSummaries({
        channel: channel || undefined,
        threadId: threadId || undefined,
        kind: summaryKind || undefined,
      });
      setSummaries(result.summaries || []);
    } catch (err) {
      console.error('Failed to fetch summaries:', err);
      setSummaries([]);
    } finally {
      setSummariesLoading(false);
    }
  }, [showSummaries, channel, threadId, summaryKind]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const fetchMessages = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await getRawMessages(buildParams(pageNum));
      // desc: newest first from API, reverse for chronological display → load earlier = prepend
      // asc: oldest first from API, already chronological → load more = append
      const isAsc = sortOrder === 'asc';
      const data = isAsc ? (result.data || []) : (result.data || []).slice().reverse();
      if (append) {
        setMessages(prev => isAsc ? [...prev, ...data] : [...data, ...prev]);
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
  }, [buildParams, sortOrder]);

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Load newer messages beyond locateEndUtc
  const handleLoadNewer = useCallback(async () => {
    if (!locateEndUtc || loadingNewer) return;
    setLoadingNewer(true);
    try {
      const params = {
        page: 1,
        pageSize: PAGE_SIZE,
        sort: 'desc',
        startUtc: locateEndUtc,
      };
      if (selectedSession) params.session = selectedSession;
      if (channel) params.channel = channel;
      if (threadId) params.threadId = threadId;
      if (excludeThreadId) params.excludeThreadId = excludeThreadId;
      const result = await getRawMessages(params);
      const data = (result.data || []).slice().reverse();
      if (data.length > 0) {
        setMessages(prev => [...prev, ...data]);
        setTotal(prev => prev + data.length);
      }
      // Clear the endUtc restriction — all newer messages now loaded
      setLocateEndUtc(null);
    } catch (err) {
      console.error('Failed to load newer messages:', err);
    } finally {
      setLoadingNewer(false);
    }
  }, [locateEndUtc, loadingNewer, selectedSession, channel, threadId, excludeThreadId]);

  const handleSessionSelect = (sessionId) => {
    setSelectedSession(sessionId || '');
    setSessionTitle(sessionId ? '' : '');
  };

  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchHide = async () => {
    if (selectedIds.size === 0 || hiding) return;
    setHiding(true);
    try {
      await Promise.all([...selectedIds].map(id => hideMessage(id)));
      setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
      setTotal(prev => prev - selectedIds.size);
      setSelectedIds(new Set());
      setManageMode(false);
    } catch (err) {
      console.error('Failed to hide messages:', err);
    } finally {
      setHiding(false);
    }
  };

  const exitManageMode = () => {
    setManageMode(false);
    setSelectedIds(new Set());
  };

  const handleLocateMessage = useCallback((msg) => {
    if (!msg.session) return;
    // Save current search context
    setSavedSearch({
      searchQ,
      searchInput,
      channel,
      threadId,
      excludeThreadId,
      selectedSession,
      sessionTitle,
      scrollY: window.scrollY,
    });
    locateMessageIdRef.current = msg.id;
    // Fade out, then switch context
    setTransitioning(true);
    setTimeout(() => {
      // Set endUtc so target falls within loaded 50 (1 hour buffer after target)
      const created = getMessageCreated(msg);
      if (created) {
        const t = new Date(created).getTime();
        setLocateEndUtc(new Date(t + 60 * 60 * 1000).toISOString());
      }
      // Switch to that session, clear search
      clearTimeout(searchTimer.current);
      setSearchInput('');
      setSearchQ('');
      setSelectedSession(msg.session);
      setSessionTitle('');
      window.scrollTo({ top: 0 });
    }, 250);
  }, [searchQ, searchInput, channel, threadId, excludeThreadId, selectedSession, sessionTitle]);

  const handleBackToSearch = useCallback(() => {
    if (!savedSearch) return;
    const restoreScrollY = savedSearch.scrollY || 0;
    setTransitioning(true);
    setTimeout(() => {
      clearTimeout(searchTimer.current);
      setSearchInput(savedSearch.searchInput);
      setSearchQ(savedSearch.searchQ);
      setChannel(savedSearch.channel);
      setThreadId(savedSearch.threadId || '');
      setExcludeThreadId(savedSearch.excludeThreadId || '');
      setSelectedSession(savedSearch.selectedSession);
      setSessionTitle(savedSearch.sessionTitle);
      locateMessageIdRef.current = null;
      setLocateEndUtc(null);
      setSavedSearch(null);
      restoreScrollRef.current = restoreScrollY;
    }, 250);
  }, [savedSearch]);

  // Clear transition + scroll to located message after messages load
  useEffect(() => {
    if (loading) return;
    // Restore scroll position when returning from locate
    if (restoreScrollRef.current !== null) {
      const pos = restoreScrollRef.current;
      restoreScrollRef.current = null;
      setTimeout(() => {
        window.scrollTo({ top: pos });
        setTimeout(() => setTransitioning(false), 30);
      }, 50);
      return;
    }
    const targetId = locateMessageIdRef.current;
    if (!targetId) {
      if (transitioning) setTransitioning(false);
      return;
    }
    // Scroll to target while still faded out, then fade in
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${targetId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const offset = window.scrollY + rect.top - 160;
        window.scrollTo({ top: Math.max(0, offset) });
      }
      setTimeout(() => {
        setTransitioning(false);
        if (el) {
          const bubble = el.querySelector('.msg-bubble') || el;
          bubble.classList.add('msg-located');
          setTimeout(() => bubble.classList.remove('msg-located'), 2500);
        }
        locateMessageIdRef.current = null;
      }, 50);
    }, 80);
    return () => clearTimeout(timer);
  }, [loading, messages]);

  const handleMessageUpdate = (updated) => {
    setMessages(prev => {
      if (favOnly && !updated.favorite) {
        return prev.filter(m => m.id !== updated.id);
      }
      return prev.map(m => m.id === updated.id ? { ...m, ...updated } : m);
    });
  };

  const startEditSummary = (summary) => {
    setEditingSummaryId(summary.id);
    setSummaryDraft(summary.revised_summary ?? summary.original_summary ?? '');
  };

  const cancelEditSummary = () => {
    setEditingSummaryId(null);
    setSummaryDraft('');
  };

  const saveSummary = async (summary) => {
    if (savingSummary) return;
    setSavingSummary(true);
    try {
      const result = await updateRawMessageSummary(summary.id, summaryDraft);
      setSummaries(prev => prev.map(item => item.id === summary.id ? result.summary : item));
      cancelEditSummary();
    } catch (err) {
      console.error('Failed to save summary:', err);
    } finally {
      setSavingSummary(false);
    }
  };

  const formatSummaryRange = (summary) => {
    const first = summary.start_created?.slice(0, 10) || '';
    const last = summary.end_created?.slice(0, 10) || '';
    if (!first) return '';
    if (first === last) return first;
    return `${first} ~ ${last}`;
  };

  const formatSummaryTimestamp = (value) => {
    const date = parseToLocalDate(value);
    if (!date) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const formatPromptVersion = (value = '') => {
    const match = value.match(/v\d+$/i);
    return match ? match[0].toLowerCase() : value;
  };

  const displaySummaryText = (text = '') => (
    text.replace(/\n?【摘要完】\s*$/u, '').trim()
  );

  const visibleMessages = showHidden
    ? messages
    : messages.filter(m => !isSystemOrHidden(m));

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
        <div key={msg.id || idx} data-msg-id={msg.id}>
          <MessageBubble
            message={msg}
            onUpdate={handleMessageUpdate}
            searchQ={searchQ}
            isFocusedMatch={matchPos >= 0 && matchPos === focusedMatchIdx}
            bubbleRef={matchPos >= 0 ? matchRefs.current[matchPos] : undefined}
            manageMode={manageMode}
            selected={selectedIds.has(msg.id)}
            onToggleSelect={() => toggleSelectId(msg.id)}
            onLocate={searchQ && msg.session ? () => handleLocateMessage(msg) : undefined}
          />
        </div>
      );
    });

    return items;
  };

  const calendarDates = dateSummary.map(d => d.date);
  const calendarDateCounts = dateSummary.reduce((acc, d) => {
    acc[d.date] = d.total;
    return acc;
  }, {});

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
            <span className="page-subtitle">RAW MESSAGE</span>
          </div>
        </div>
      </div>

      <div className="stream-toolbar">
        {/* Row 1: search + action icons */}
        <div className="stream-row-search">
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

          <div className="stream-controls">
            <button
              className="stream-chip icon-chip import-chip"
              onClick={() => setShowImport(true)}
              title="导入对话"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>

            <div className="stream-date-wrapper">
              <button
                className={`stream-date-btn ${hasDateFilter ? 'has-date' : ''}`}
                onClick={handleDateBtnClick}
                title="日期"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {hasDateFilter && formatDateLabel()}
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
              className={`stream-chip icon-chip fav-chip ${favOnly ? 'active' : ''}`}
              onClick={() => setFavOnly(!favOnly)}
              title="收藏"
            >
              <svg viewBox="0 0 24 24" fill={favOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>

            <button
              className={`stream-chip icon-chip summary-chip ${showSummaries ? 'active' : ''}`}
              onClick={() => setShowSummaries(!showSummaries)}
              title="Summary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </button>

            <button
              className={`stream-chip icon-chip hidden-chip ${showHidden ? 'active' : ''}`}
              onClick={() => setShowHidden(!showHidden)}
              title="已隐藏"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>

            <button
              className={`stream-chip icon-chip manage-chip ${manageMode ? 'active' : ''}`}
              onClick={manageMode ? exitManageMode : () => setManageMode(true)}
              title={manageMode ? '退出管理' : '管理'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
                {manageMode
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                  : <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: channel chips */}
        <div className="stream-row-channels">
          <div className="channel-chips">
            {SOURCE_OPTIONS.map(option => (
              <button
                key={option.value || 'all'}
                className={`stream-chip ${sourceFilter === option.value ? 'active' : ''}`}
                onClick={() => handleSourceSelect(option.value)}
              >
                {option.label}
              </button>
            ))}
            {channels
              .filter(ch => ch !== 'telegram' && !SOURCE_OPTIONS.some(option => option.value === ch))
              .map(ch => (
                <button
                  key={ch}
                  className={`stream-chip ${sourceFilter === ch ? 'active' : ''}`}
                  onClick={() => handleSourceSelect(ch)}
                >
                  {ch}
                </button>
              ))}
          </div>
        </div>

        {/* Row 3: session selector (full width) */}
        <div className="stream-row-session">
          <div className="session-btn-wrapper">
            <button
              className={`session-selector ${selectedSession ? 'has-session' : ''}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowSessionPanel(!showSessionPanel)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="session-selector-icon">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <span className="session-selector-text">
                {selectedSession ? (sessionTitle || '已选会话') : '全部会话'}
              </span>
              <span className="session-selector-count">{total} 条</span>
              {selectedSession ? (
                <button className="session-clear" onClick={(e) => { e.stopPropagation(); handleSessionSelect(null); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="session-selector-caret">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>
            <SessionPanel
              open={showSessionPanel}
              onClose={() => setShowSessionPanel(false)}
              onSelect={(sid, title) => {
                setSelectedSession(sid || '');
                setSessionTitle(title || '');
              }}
              currentSession={selectedSession}
              currentChannel={channel}
              currentThreadId={threadId}
              currentExcludeThreadId={excludeThreadId}
            />
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
      </div>

      {showSummaries && (
        <section className="summary-panel">
          <div className="summary-panel-header">
            <div>
              <div className="summary-panel-title">Summary</div>
              <div className="summary-panel-subtitle">
                {sourceFilter === 'telegram-group' ? 'Group memory' : 'Filtered summaries'}
              </div>
            </div>
          </div>

          <div className="summary-source-tabs">
            <button
              className={summarySource === 'ember' ? 'active' : ''}
              onClick={() => setSummarySource('ember')}
            >
              小烬
            </button>
            <button
              className={summarySource === 'riven' ? 'source-coming-soon' : ''}
              onClick={() => {}}
              disabled
            >
              Riven
              <span className="coming-soon-badge">soon</span>
            </button>
          </div>

          {summarySource === 'riven' ? (
            <div className="summary-panel-empty">Riven summary coming soon ✦</div>
          ) : (
            <>
              <div className="summary-kind-tabs-row">
                <div className="summary-kind-tabs">
                  <button
                    className={summaryKind === 'rolling' ? 'active' : ''}
                    onClick={() => setSummaryKind('rolling')}
                  >
                    Rolling
                  </button>
                  <button
                    className={summaryKind === 'chunk' ? 'active' : ''}
                    onClick={() => setSummaryKind('chunk')}
                  >
                    Chunk
                  </button>
                </div>
              </div>

              {summariesLoading ? (
                <div className="summary-panel-empty">Loading summaries...</div>
              ) : summaries.length === 0 ? (
                <div className="summary-panel-empty">
                  No summaries yet for this filter.
                </div>
              ) : (() => {
                const latestSummary = summaries[0];
                const olderSummaries = summaries.slice(1);
                const renderSummaryItem = (summary) => {
                  const visibleSummary = displaySummaryText(summary.revised_summary || summary.original_summary);
                  const isEditing = editingSummaryId === summary.id;
                  return (
                    <article key={summary.id} className={`summary-item ${summary.is_current ? 'current' : ''}`}>
                      <div className="summary-item-meta">
                        <span>{summary.summary_kind}</span>
                        {summary.is_current ? <span>current</span> : null}
                        <span>{summary.message_count} msgs</span>
                        <span>{formatSummaryRange(summary)}</span>
                        {summary.updated_at ? (
                          <span>updated {formatSummaryTimestamp(summary.updated_at)}</span>
                        ) : null}
                        {summary.end_created ? (
                          <span>covers to {formatSummaryTimestamp(summary.end_created)}</span>
                        ) : null}
                        {summary.prompt_version ? (
                          <span>{formatPromptVersion(summary.prompt_version)}</span>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <>
                          <textarea
                            className="summary-editor"
                            value={summaryDraft}
                            onChange={e => setSummaryDraft(e.target.value)}
                            rows={12}
                          />
                          <div className="summary-actions">
                            <button onClick={cancelEditSummary}>Cancel</button>
                            <button className="primary" onClick={() => saveSummary(summary)} disabled={savingSummary}>
                              {savingSummary ? 'Saving...' : 'Save revision'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <pre className="summary-text">{visibleSummary}</pre>
                          {summary.revised_summary ? (
                            <details className="summary-original">
                              <summary>DS original</summary>
                              <pre>{displaySummaryText(summary.original_summary)}</pre>
                            </details>
                          ) : null}
                          <div className="summary-actions">
                            <button onClick={() => startEditSummary(summary)}>
                              {summary.revised_summary ? 'Edit revision' : 'Revise'}
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                };

                return (
                  <div className="summary-list">
                    {renderSummaryItem(latestSummary)}
                    {olderSummaries.length > 0 && (
                      summaryExpanded ? (
                        <>
                          {olderSummaries.map(s => renderSummaryItem(s))}
                          <button
                            className="summary-expand-btn"
                            onClick={() => setSummaryExpanded(false)}
                          >
                            收起
                          </button>
                        </>
                      ) : (
                        <button
                          className="summary-expand-btn"
                          onClick={() => setSummaryExpanded(true)}
                        >
                          查看更早 {olderSummaries.length} 条
                        </button>
                      )
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </section>
      )}

      <div className={`stream-messages ${transitioning ? 'stream-fade-out' : 'stream-fade-in'}`}>
        {loading ? (
          <LoadingSpinner />
        ) : visibleMessages.length === 0 ? (
          <EmptyState message="暂无对话消息" icon="💬" />
        ) : (
          <>
            {hasMore && sortOrder === 'desc' && (
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

            {hasMore && sortOrder === 'asc' && (
              <div className="stream-pagination stream-pagination-bottom">
                {loadingMore ? (
                  <span className="stream-loading-text">加载中...</span>
                ) : (
                  <button className="stream-load-more" onClick={handleLoadEarlier}>
                    加载更多消息 ({messages.length} / {total})
                  </button>
                )}
              </div>
            )}

            {locateEndUtc && (
              <div className="stream-pagination stream-pagination-bottom">
                {loadingNewer ? (
                  <span className="stream-loading-text">加载中...</span>
                ) : (
                  <button className="stream-load-more" onClick={handleLoadNewer}>
                    加载更新的消息
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {savedSearch && (
        <button className="back-to-search-btn" onClick={handleBackToSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14}}>
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回搜索结果
        </button>
      )}

      {showScrollTop && !manageMode && (
        <button className="scroll-top-btn" onClick={scrollToTop} aria-label="回到顶部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5"/>
            <path d="M5 12l7-7 7 7"/>
          </svg>
        </button>
      )}

      {showScrollBottom && !manageMode && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom} aria-label="回到底部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14"/>
            <path d="M19 12l-7 7-7-7"/>
          </svg>
        </button>
      )}

      {manageMode && (
        <div className="manage-bar">
          <span className="manage-bar-count">
            已选 {selectedIds.size} 条
          </span>
          <div className="manage-bar-actions">
            <button className="manage-bar-cancel" onClick={exitManageMode}>
              取消
            </button>
            <button
              className="manage-bar-hide"
              disabled={selectedIds.size === 0 || hiding}
              onClick={handleBatchHide}
            >
              {hiding ? '隐藏中...' : '隐藏'}
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            fetchMessages(1);
          }}
        />
      )}
    </div>
  );
}
