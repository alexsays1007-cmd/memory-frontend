import { useState, useMemo } from 'react';
import { formatTime } from '../../utils/date';
import { getMessageText, getMessageRole, getMessageSource, getMessageCreated, isFavorited, isLongMessage, formatSource } from '../../utils/message';
import { toggleFavorite } from '../../api/rawMessages';
import './MessageBubble.css';

function highlightText(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="msg-highlight">{part}</mark>
      : part
  );
}

export default function MessageBubble({ message, onUpdate, searchQ, isFocusedMatch, bubbleRef, manageMode, selected, onToggleSelect, onLocate }) {
  const [expanded, setExpanded] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const role = getMessageRole(message);
  const content = getMessageText(message);
  const source = getMessageSource(message);
  const created = getMessageCreated(message);
  const favorited = isFavorited(message);
  const isLong = isLongMessage(content);
  const isUser = role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1600);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1600);
    }
  };

  const handleFavorite = async () => {
    try {
      const res = await toggleFavorite(message.id);
      if (res.ok && res.message && onUpdate) {
        onUpdate(res.message);
      } else if (onUpdate) {
        // Optimistic toggle
        onUpdate({ ...message, favorite: favorited ? 0 : 1 });
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const timeStr = formatTime(created);
  const renderedContent = useMemo(
    () => searchQ ? highlightText(content, searchQ) : content,
    [content, searchQ]
  );

  return (
    <div
      className={`msg-row ${isUser ? 'msg-user' : 'msg-assistant'} ${isFocusedMatch ? 'msg-focused-match' : ''} ${manageMode ? 'msg-manage' : ''}`}
      ref={bubbleRef}
      onClick={manageMode ? onToggleSelect : undefined}
    >
      {manageMode && (
        <label className="msg-checkbox" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
          <span className="msg-checkbox-mark" />
        </label>
      )}
      <div className="msg-bubble">
        <div className={`msg-text ${isLong && !expanded ? 'msg-clamped' : ''}`}>
          {renderedContent}
        </div>
        {isLong && !expanded && (
          <button className="msg-expand" onClick={() => setExpanded(true)}>
            展开全文
          </button>
        )}

        <div className="msg-footer">
          <span className="msg-meta">
            {source && <span className="msg-source">{formatSource(source)}</span>}
            {source && timeStr && <span className="msg-meta-sep">·</span>}
            {timeStr && <span className="msg-time">{timeStr}</span>}
          </span>

          <div className="msg-actions">
            {onLocate && (
              <button className="msg-action-btn msg-locate-btn" onClick={onLocate} title="查看上下文">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                </svg>
              </button>
            )}
            <button className="msg-action-btn" onClick={handleCopy} title="复制">
              {copyToast ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              )}
            </button>
            <button className={`msg-action-btn ${favorited ? 'favorited' : ''}`} onClick={handleFavorite} title="收藏">
              <svg viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      {copyToast && <div className="msg-toast">Copied</div>}
    </div>
  );
}
