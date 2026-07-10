import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getSessions } from '../../api/rawMessages';
import { parseToLocalDate } from '../../utils/date';
import './SessionPanel.css';

const INITIAL_HISTORY_LIMIT = 8;
const HISTORY_BATCH_SIZE = 10;

function formatLocalDate(date, includeYear = false) {
  if (!date) return '';
  const year = includeYear ? `${date.getFullYear()}年` : '';
  return `${year}${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatLocalTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isSameLocalDay(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateRange(first, last) {
  const start = parseToLocalDate(first);
  const end = parseToLocalDate(last) || start;
  if (!start) return '';

  const includeYear = start.getFullYear() !== new Date().getFullYear()
    || end.getFullYear() !== start.getFullYear();

  if (isSameLocalDay(start, end)) {
    const startText = `${formatLocalDate(start, includeYear)} ${formatLocalTime(start)}`;
    if (start.getTime() === end.getTime()) return startText;
    return `${startText}–${formatLocalTime(end)}`;
  }

  return `${formatLocalDate(start, includeYear)} ${formatLocalTime(start)} – ${formatLocalDate(end, includeYear)} ${formatLocalTime(end)}`;
}

function formatLastActivity(value) {
  const date = parseToLocalDate(value);
  if (!date) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameLocalDay(date, today)) return `今天 ${formatLocalTime(date)}更新`;
  if (isSameLocalDay(date, yesterday)) return `昨天 ${formatLocalTime(date)}更新`;
  return `${formatLocalDate(date, date.getFullYear() !== today.getFullYear())} ${formatLocalTime(date)}更新`;
}

function hasMeaningfulTitle(session) {
  const title = (session.title || '').trim();
  if (!title || title === session.session) return false;
  return !['untitled', '无标题'].includes(title.toLowerCase());
}

function getStreamKey(session) {
  return [session.channel || session.source || 'unknown', session.thread_id || 'default'].join(':');
}

function supportsCurrentSession(session) {
  return ['wechat', 'telegram'].includes((session.channel || '').toLowerCase());
}

function getSessionTitle(session, isCurrent) {
  if (hasMeaningfulTitle(session)) return session.title.trim();
  if (isCurrent) return '当前会话';
  return formatDateRange(session.first_created, session.last_created) || '历史会话';
}

function getSessionMeta(session, isCurrent) {
  if (!isCurrent) {
    return hasMeaningfulTitle(session)
      ? formatDateRange(session.first_created, session.last_created)
      : '历史会话';
  }

  const start = parseToLocalDate(session.first_created);
  const started = start
    ? `${formatLocalDate(start, start.getFullYear() !== new Date().getFullYear())}开始`
    : '';
  const updated = formatLastActivity(session.last_created || session.first_created);
  return [started, updated].filter(Boolean).join(' · ');
}

function getSessionActivityTime(session) {
  return parseToLocalDate(session.last_created || session.first_created)?.getTime() || 0;
}

function getSessionMonthLabel(session) {
  const date = parseToLocalDate(session.first_created || session.last_created);
  return date ? `${date.getFullYear()}年${date.getMonth() + 1}月` : '日期未知';
}

export default function SessionPanel({
  open,
  onClose,
  onSelect,
  currentSession,
  currentChannel,
  currentThreadId,
  currentExcludeThreadId,
}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [historyLimits, setHistoryLimits] = useState({});
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSessions({
      channel: currentChannel || undefined,
      threadId: currentThreadId || undefined,
      excludeThreadId: currentExcludeThreadId || undefined,
    })
      .then(res => setSessions(res.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, currentChannel, currentThreadId, currentExcludeThreadId]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setHistoryLimits({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)
          && !e.target.closest('.session-selector')) {
        onClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const currentSessionIds = useMemo(() => {
    const latestByStream = new Map();

    sessions.filter(supportsCurrentSession).forEach(session => {
      const key = getStreamKey(session);
      const activity = parseToLocalDate(session.last_created || session.first_created)?.getTime() || 0;
      const current = latestByStream.get(key);
      if (!current || activity > current.activity) {
        latestByStream.set(key, { session: session.session, activity });
      }
    });

    return new Set([...latestByStream.values()].map(item => item.session));
  }, [sessions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.session || '').toLowerCase().includes(q) ||
      (s.channel || '').toLowerCase().includes(q) ||
      (s.source || '').toLowerCase().includes(q) ||
      getSessionTitle(s, currentSessionIds.has(s.session)).toLowerCase().includes(q) ||
      getSessionMeta(s, currentSessionIds.has(s.session)).toLowerCase().includes(q)
    );
  }, [sessions, search, currentSessionIds]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(s => {
      const ch = s.channel || '未知';
      if (!groups[ch]) groups[ch] = [];
      groups[ch].push(s);
    });
    return groups;
  }, [filtered]);

  if (!open) return null;

  const isMobile = window.innerWidth <= 600;

  const content = (
    <div
      className={`session-panel ${isMobile ? 'session-panel-sheet' : 'session-panel-popover'}`}
      ref={panelRef}
    >
      {isMobile && <div className="session-panel-handle" />}
      <div className="session-panel-header">
        <span className="session-panel-title">选择会话</span>
        <button className="session-panel-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="session-panel-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="搜索会话..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus={!isMobile}
        />
      </div>

      <div className="session-panel-list">
        <button
          className={`session-item session-item-all ${!currentSession ? 'active' : ''}`}
          onClick={() => { onSelect(null, ''); onClose(); }}
        >
          <span className="session-item-title">全部会话</span>
          <span className="session-item-count">
            {sessions.reduce((sum, s) => sum + (s.visible_count || s.message_count), 0)} 条
          </span>
        </button>

        {loading ? (
          <div className="session-panel-loading">加载中...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="session-panel-empty">无匹配会话</div>
        ) : (
          Object.entries(grouped).map(([channel, items]) => {
            const orderedItems = [...items].sort(
              (a, b) => getSessionActivityTime(b) - getSessionActivityTime(a)
            );
            const currentItems = orderedItems.filter(s => currentSessionIds.has(s.session));
            const historyItems = orderedItems.filter(s => !currentSessionIds.has(s.session));
            const historyLimit = search.trim()
              ? historyItems.length
              : (historyLimits[channel] || INITIAL_HISTORY_LIMIT);
            const visibleHistory = historyItems.slice(0, historyLimit);
            const hiddenHistoryCount = Math.max(0, historyItems.length - visibleHistory.length);
            let previousMonth = null;

            const renderSession = (s) => {
                const isCurrent = currentSessionIds.has(s.session);
                const title = getSessionTitle(s, isCurrent);
                return (
                  <button
                    key={s.session}
                    className={`session-item ${currentSession === s.session ? 'active' : ''}`}
                    onClick={() => { onSelect(s.session, title); onClose(); }}
                  >
                    <div className="session-item-info">
                      <span className="session-item-title">
                        {title}
                        {isCurrent && hasMeaningfulTitle(s) && (
                          <span className="session-current-badge">当前</span>
                        )}
                      </span>
                      <span className="session-item-meta">
                        {getSessionMeta(s, isCurrent)}
                      </span>
                    </div>
                    <span className="session-item-count">{s.visible_count || s.message_count} 条</span>
                  </button>
                );
            };

            return (
              <div key={channel} className="session-group">
                <div className="session-group-label">{channel}</div>
                {currentItems.map(renderSession)}

                {!search.trim() && visibleHistory.length > 0 && (
                  <div className="session-history-label">最近会话</div>
                )}

                {visibleHistory.map((s, index) => {
                  const month = getSessionMonthLabel(s);
                  const showMonth = index > 0 && month !== previousMonth;
                  previousMonth = month;
                  return (
                    <Fragment key={s.session}>
                      {showMonth && <div className="session-month-label">{month}</div>}
                      {renderSession(s)}
                    </Fragment>
                  );
                })}

                {!search.trim() && hiddenHistoryCount > 0 && (
                  <button
                    className="session-load-more"
                    onClick={() => setHistoryLimits(prev => ({
                      ...prev,
                      [channel]: (prev[channel] || INITIAL_HISTORY_LIMIT) + HISTORY_BATCH_SIZE,
                    }))}
                  >
                    查看更早会话（还有 {hiddenHistoryCount} 个）
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="session-panel-overlay">{content}</div>,
      document.body
    );
  }

  return content;
}
