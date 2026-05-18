import { useState } from 'react';
import { formatTime } from '../../utils/date';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './DiaryEntry.css';

const PROTECTED_SOURCES = ['cyberboss_diary_md'];

export default function DiaryEntry({ entry, onUpdate, onHide }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(entry.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = !PROTECTED_SOURCES.includes(entry.source);

  const handleSave = async () => {
    if (!draftContent.trim()) {
      setError('内容不能为空');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onUpdate(entry.id, { content: draftContent });
      setIsEditing(false);
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHideConfirmed = async () => {
    setConfirmDelete(false);
    setIsSaving(true);
    setError('');
    try {
      await onHide(entry.id);
    } catch (err) {
      setError(err.message || '删除失败');
      setIsSaving(false);
    }
  };

  return (
    <article className="diary-entry">
      {/* Edit/delete icons — only for non-protected sources */}
      {canEdit && !isEditing && (
        <div className="diary-icon-actions">
          <button
            className="diary-icon-btn"
            onClick={() => {
              setDraftContent(entry.content || '');
              setIsEditing(true);
            }}
            disabled={isSaving}
            title="编辑"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </button>
          <button
            className="diary-icon-btn diary-icon-danger"
            onClick={() => setConfirmDelete(true)}
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

      <div className="diary-entry-header">
        {entry.agent && (
          <span className="diary-meta">
            <span className="meta-label">Agent:</span> {entry.agent}
          </span>
        )}
        {entry.channel && (
          <span className="diary-meta">
            <span className="meta-label">Channel:</span> {entry.channel}
          </span>
        )}
        {entry.source && !PROTECTED_SOURCES.includes(entry.source) && (
          <span className="diary-meta diary-source">
            {entry.source}
          </span>
        )}
        <span className="diary-time">{formatTime(entry.created)}</span>
      </div>

      {isEditing ? (
        <div className="diary-editor">
          <textarea
            className="diary-editor-textarea"
            value={draftContent}
            onChange={e => setDraftContent(e.target.value)}
            rows={6}
          />
          <div className="diary-editor-actions">
            <button
              className="diary-action-btn primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
            <button
              className="diary-action-btn"
              onClick={() => {
                setIsEditing(false);
                setDraftContent(entry.content || '');
                setError('');
              }}
              disabled={isSaving}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="diary-content">
          {entry.content}
        </div>
      )}

      {error && <div className="diary-entry-error">{error}</div>}

      <ConfirmDialog
        open={confirmDelete}
        message="删除这条日记？"
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        icon="trash"
        onConfirm={handleHideConfirmed}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}
