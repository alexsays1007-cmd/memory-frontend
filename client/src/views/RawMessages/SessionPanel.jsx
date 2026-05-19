import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getSessions } from '../../api/rawMessages';
import './SessionPanel.css';

function formatDateRange(first, last) {
  if (!first) return '';
  const f = first.slice(0, 10);
  const l = last ? last.slice(0, 10) : f;
  if (f === l) return f.slice(5).replace('-', '/');
  return `${f.slice(5).replace('-', '/')} ~ ${l.slice(5).replace('-', '/')}`;
}

export default function SessionPanel({ open, onClose, onSelect, currentSession, currentChannel }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSessions(currentChannel ? { channel: currentChannel } : {})
      .then(res => setSessions(res.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, currentChannel]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
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

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.session || '').toLowerCase().includes(q) ||
      (s.channel || '').toLowerCase().includes(q) ||
      (s.source || '').toLowerCase().includes(q)
    );
  }, [sessions, search]);

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
          Object.entries(grouped).map(([channel, items]) => (
            <div key={channel} className="session-group">
              <div className="session-group-label">{channel}</div>
              {items.map(s => (
                <button
                  key={s.session}
                  className={`session-item ${currentSession === s.session ? 'active' : ''}`}
                  onClick={() => { onSelect(s.session, s.title); onClose(); }}
                >
                  <div className="session-item-info">
                    <span className="session-item-title">{s.title}</span>
                    <span className="session-item-meta">
                      {formatDateRange(s.first_created, s.last_created)}
                    </span>
                  </div>
                  <span className="session-item-count">{s.visible_count || s.message_count} 条</span>
                </button>
              ))}
            </div>
          ))
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
