import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import {
  getHandoffCurrent,
  getHandoffPrevious,
  updateHandoffCurrent,
} from '../../api/diary';
import './HandoffModal.css';

function stripFrontmatter(text = '') {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('---', 3);
  if (end === -1) return text;
  return text.slice(end + 3).trimStart();
}

function formatUpdatedAt(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    }) + ' ' + d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function normalizeHandoff(res = {}) {
  return {
    content: stripFrontmatter(res.content || ''),
    updatedAt: res.updatedAt || res.mtime || '',
    path: res.path || '',
  };
}

export default function HandoffModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('current');
  const [current, setCurrent] = useState({ content: '', updatedAt: '', path: '' });
  const [previous, setPrevious] = useState({ content: '', updatedAt: '', path: '' });
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [statusText, setStatusText] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setStatusText('');
    setEditing(false);
    setActiveTab('current');

    Promise.allSettled([getHandoffCurrent(), getHandoffPrevious()])
      .then(([currentResult, previousResult]) => {
        if (cancelled) return;

        if (currentResult.status === 'fulfilled') {
          const nextCurrent = normalizeHandoff(currentResult.value);
          setCurrent(nextCurrent);
          setDraft(nextCurrent.content);
        } else {
          console.error('Failed to load current handoff:', currentResult.reason);
          setCurrent({ content: '无法加载当前交接信', updatedAt: '', path: '' });
          setDraft('');
        }

        if (previousResult.status === 'fulfilled') {
          setPrevious(normalizeHandoff(previousResult.value));
        } else {
          setPrevious({ content: '暂无上一篇交接信', updatedAt: '', path: '' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false);
          setDraft(current.content);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, editing, current.content]);

  const shown = activeTab === 'previous' ? previous : current;
  const shownContent = editing && activeTab === 'current' ? draft : shown.content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shownContent);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1600);
    } catch {
      setStatusText('复制失败');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusText('');
    try {
      const res = await updateHandoffCurrent(draft);
      const nextCurrent = normalizeHandoff({
        ...res,
        content: res.content ?? draft,
      });
      setCurrent(nextCurrent);
      setDraft(nextCurrent.content);
      setEditing(false);
      setStatusText('已保存');
      setTimeout(() => setStatusText(''), 1800);
    } catch (err) {
      console.error('Failed to save handoff:', err);
      setStatusText('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isMobile = window.innerWidth <= 600;
  const hasChanges = draft !== current.content;

  const modal = (
    <div className="handoff-overlay" onClick={onClose}>
      <div
        className={`handoff-modal ${isMobile ? 'handoff-sheet' : 'handoff-card'}`}
        ref={panelRef}
        onClick={e => e.stopPropagation()}
      >
        {isMobile && <div className="handoff-handle" />}

        <div className="handoff-header">
          <div className="handoff-title-row">
            <svg className="handoff-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="handoff-title-text">交接信</span>
          </div>

          <div className="handoff-header-right">
            {shown.updatedAt && (
              <span className="handoff-updated">{formatUpdatedAt(shown.updatedAt)}</span>
            )}
            <button className="handoff-action-btn" onClick={handleCopy} title="复制">
              {copyToast ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            {activeTab === 'current' && (
              <button
                className={`handoff-action-btn ${editing ? 'is-active' : ''}`}
                onClick={() => {
                  setEditing(value => {
                    const next = !value;
                    if (!next) setDraft(current.content);
                    return next;
                  });
                }}
                title={editing ? '取消编辑' : '编辑'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            )}
            <button className="handoff-action-btn handoff-close" onClick={onClose} title="关闭">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="handoff-tabs" role="tablist" aria-label="交接信版本">
          <button
            className={`handoff-tab ${activeTab === 'previous' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('previous');
              setEditing(false);
            }}
            role="tab"
            aria-selected={activeTab === 'previous'}
          >
            上一篇
          </button>
          <button
            className={`handoff-tab ${activeTab === 'current' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('current');
              setEditing(false);
              setDraft(current.content);
            }}
            role="tab"
            aria-selected={activeTab === 'current'}
          >
            当前
          </button>
        </div>

        <div className="handoff-body">
          {loading ? (
            <div className="handoff-loading">加载中...</div>
          ) : editing && activeTab === 'current' ? (
            <div className="handoff-editor">
              <textarea
                className="handoff-textarea"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                spellCheck={false}
                autoFocus
              />
              <div className="handoff-editor-actions">
                <span className="handoff-status">{statusText}</span>
                <button
                  className="handoff-editor-btn"
                  onClick={() => {
                    setEditing(false);
                    setDraft(current.content);
                    setStatusText('');
                  }}
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  className="handoff-editor-btn primary"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? '保存中' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {statusText && <div className="handoff-inline-status">{statusText}</div>}
              <div className="handoff-markdown">
                <ReactMarkdown>{shown.content}</ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
