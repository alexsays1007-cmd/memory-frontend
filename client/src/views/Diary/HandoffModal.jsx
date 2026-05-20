import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { getHandoff } from '../../api/diary';
import './HandoffModal.css';

function stripFrontmatter(text) {
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
      month: 'short', day: 'numeric',
    }) + ' ' + d.toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function HandoffModal({ open, onClose }) {
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getHandoff()
      .then(res => {
        setContent(stripFrontmatter(res.content || ''));
        setUpdatedAt(res.updatedAt || '');
      })
      .catch(err => {
        console.error('Failed to load handoff:', err);
        setContent('无法加载交接信');
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1600);
    } catch {
      // fallback
    }
  };

  if (!open) return null;

  const isMobile = window.innerWidth <= 600;

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
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span className="handoff-title-text">交接信</span>
          </div>
          <div className="handoff-header-right">
            {updatedAt && (
              <span className="handoff-updated">{formatUpdatedAt(updatedAt)}</span>
            )}
            <button className="handoff-action-btn" onClick={handleCopy} title="复制">
              {copyToast ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              )}
            </button>
            <button className="handoff-action-btn handoff-close" onClick={onClose} title="关闭">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="handoff-body">
          {loading ? (
            <div className="handoff-loading">加载中...</div>
          ) : (
            <div className="handoff-markdown">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
