import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDialog.css';

/**
 * ConfirmDialog – 自定义确认弹窗
 *
 * Props:
 *   open       - boolean, 是否显示
 *   message    - 提示文字
 *   confirmText - 确认按钮文字 (default: '确认')
 *   cancelText  - 取消按钮文字 (default: '取消')
 *   variant     - 'default' | 'danger' (按钮颜色)
 *   icon        - 'trash' | 'restore' | null
 *   onConfirm   - 确认回调
 *   onCancel    - 取消回调
 */
export default function ConfirmDialog({
  open,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  icon = null,
  onConfirm,
  onCancel,
}) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const btnClass = variant === 'danger' ? 'confirm-danger' : 'confirm-primary';

  return createPortal(
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-panel" onClick={e => e.stopPropagation()}>
        {icon === 'trash' && (
          <svg className="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        )}
        {icon === 'restore' && (
          <svg className="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        )}
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`confirm-btn ${btnClass}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
