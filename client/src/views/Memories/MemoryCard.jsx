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

      <div className="memory-actions">
        {isEditing ? (
          <>
            <button
              className="memory-action-btn primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
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
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="memory-action-btn"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
            >
              Edit
            </button>
            <button
              className="memory-action-btn danger"
              onClick={handleHide}
              disabled={isSaving}
            >
              {isSaving ? 'Hiding...' : 'Hide'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
