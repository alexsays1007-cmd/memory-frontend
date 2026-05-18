import { useState, useRef, useEffect } from 'react';
import { formatDateTime } from '../../utils/date';
import { parseTags } from '../../utils/tags';
import './MemoryCard.css';

export default function MemoryCard({ memory, onUpdate, onHide }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(memory.content || '');
  const [draftTags, setDraftTags] = useState(memory.tags || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const contentRef = useRef(null);

  // Check if content is actually clamped
  useEffect(() => {
    if (contentRef.current) {
      setIsClamped(contentRef.current.scrollHeight > contentRef.current.clientHeight);
    }
  }, [memory.content]);

  useEffect(() => {
    setDraftContent(memory.content || '');
    setDraftTags(memory.tags || '');
  }, [memory.content, memory.tags]);

  const handleSave = async () => {
    if (!draftContent.trim()) {
      setError('Content is required');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onUpdate(memory.id, {
        content: draftContent,
        tags: draftTags,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save memory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHide = async () => {
    if (!window.confirm('Hide this memory from the default view?')) {
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onHide(memory.id);
    } catch (err) {
      setError(err.message || 'Failed to hide memory');
      setIsSaving(false);
    }
  };

  let parsedTags = parseTags(memory.tags);

  // Deduplicate metadata from visual tags
  if (memory.agent || memory.channel) {
    parsedTags = parsedTags.filter(t => {
      const val = t.value.toLowerCase();
      if (memory.agent && val === memory.agent.toLowerCase()) return false;
      if (memory.channel && val === memory.channel.toLowerCase()) return false;
      return true;
    });
  }

  return (
    <article className="memory-card">
      {/* Icon actions (top-right corner) */}
      {!isEditing && (
        <div className="memory-icon-actions">
          <button
            className="memory-icon-btn"
            onClick={() => setIsEditing(true)}
            disabled={isSaving}
            title="编辑"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </button>
          <button
            className="memory-icon-btn memory-icon-danger"
            onClick={handleHide}
            disabled={isSaving}
            title="删除"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>
      )}

      {isEditing ? (
        <div className="memory-editor">
          <label className="memory-editor-label">
            Content
            <textarea
              className="memory-editor-textarea"
              value={draftContent}
              onChange={event => setDraftContent(event.target.value)}
              rows={8}
            />
          </label>
          <label className="memory-editor-label">
            Tags
            <input
              className="memory-editor-input"
              value={draftTags}
              onChange={event => setDraftTags(event.target.value)}
              placeholder="source:codex,type:fact"
            />
          </label>
          <div className="memory-editor-actions">
            <button
              className="memory-action-btn primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
            <button
              className="memory-action-btn"
              onClick={() => {
                setIsEditing(false);
                setDraftContent(memory.content || '');
                setDraftTags(memory.tags || '');
                setError('');
              }}
              disabled={isSaving}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          className={`memory-content ${!isExpanded ? 'clamped' : ''}`}
        >
          {memory.content}
        </div>
      )}

      {!isEditing && !isExpanded && isClamped && (
        <button
          className="expand-toggle"
          onClick={() => setIsExpanded(true)}
        >
          展开内容
        </button>
      )}

      {parsedTags.length > 0 && (
        <div className="memory-tags">
          {parsedTags.map((tagObj, idx) => (
            <span
              key={idx}
              className={`memory-tag-chip type-${tagObj.type}`}
            >
              {tagObj.type === 'type' && <span className="tag-prefix">#</span>}
              {tagObj.type === 'person' && <span className="tag-prefix">@</span>}
              {tagObj.value}
            </span>
          ))}
        </div>
      )}

      <div className="memory-meta">
        <span className="memory-meta-item memory-id">
          <span className="meta-label">ID:</span> {memory.id}
        </span>
        {memory.agent && (
          <span className="memory-meta-item">
            <span className="meta-label">Agent:</span> {memory.agent}
          </span>
        )}
        {memory.channel && (
          <span className="memory-meta-item">
            <span className="meta-label">Channel:</span> {memory.channel}
          </span>
        )}
        <span className="memory-meta-item memory-date">
          {formatDateTime(memory.created)}
        </span>
      </div>

      {error && (
        <div className="memory-card-error">{error}</div>
      )}
    </article>
  );
}
