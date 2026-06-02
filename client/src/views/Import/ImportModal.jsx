import { useState, useCallback, useEffect } from 'react';
import { previewImport, executeImport } from '../../api/import';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './ImportModal.css';

const STEPS = {
  UPLOAD: 'upload',
  SELECT: 'select',
  PREVIEW: 'preview',
  DONE: 'done',
};

export default function ImportModal({ onClose, onImported }) {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [fileName, setFileName] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);
    setLoading(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        const convList = data
          .filter(c => c.mapping && Object.keys(c.mapping).length > 0)
          .map(c => ({
            title: c.title || 'Untitled',
            conversation_id: c.conversation_id || '',
            create_time: c.create_time,
            default_model_slug: c.default_model_slug || '',
            messageCount: Object.values(c.mapping).filter(n =>
              n.message?.author?.role === 'user' || n.message?.author?.role === 'assistant'
            ).length,
            _raw: c,
          }))
          .sort((a, b) => (b.create_time || 0) - (a.create_time || 0));

        setConversations(convList);
        setStep(STEPS.SELECT);
      } else if (data.mapping) {
        setConversations([]);
        setSelectedConv(data);
        await doPreview(data);
      } else {
        setError('无法识别的 JSON 格式');
      }
    } catch (err) {
      setError(`解析失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const doPreview = async (conv) => {
    setLoading(true);
    setError('');
    try {
      const result = await previewImport(conv);
      setPreview(result);
      setStep(STEPS.PREVIEW);
    } catch (err) {
      setError(`预览失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConvSelect = (conv) => {
    setSelectedConv(conv._raw);
    doPreview(conv._raw);
  };

  const handleImport = async () => {
    if (!selectedConv) return;
    setLoading(true);
    setError('');
    try {
      const result = await executeImport(selectedConv, { replace });
      setImportResult(result);
      setStep(STEPS.DONE);
    } catch (err) {
      setError(`导入失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setPreview(null);
    setError('');
    setStep(conversations.length > 0 ? STEPS.SELECT : STEPS.UPLOAD);
  };

  const handleReset = () => {
    setStep(STEPS.UPLOAD);
    setFileName('');
    setConversations([]);
    setSelectedConv(null);
    setPreview(null);
    setImportResult(null);
    setError('');
    setReplace(false);
  };

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-modal-header">
          <h2>导入对话</h2>
          <button className="import-modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="import-error">
            <span>{error}</span>
            <button onClick={() => setError('')}>&times;</button>
          </div>
        )}

        <div className="import-modal-body">
          {/* Upload */}
          {step === STEPS.UPLOAD && (
            <label className="import-dropzone">
              <input type="file" accept=".json" onChange={handleFileSelect} hidden />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="dropzone-icon">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="dropzone-title">点击选择 JSON 文件</p>
              <p className="dropzone-hint">ChatGPT 官方导出 或 第三方插件导出</p>
            </label>
          )}

          {/* Select conversation */}
          {step === STEPS.SELECT && (
            <div className="import-select-step">
              <div className="import-step-info">
                <span>{fileName}</span>
                <span className="import-step-count">{conversations.length} 个对话</span>
              </div>
              <div className="import-conv-list">
                {conversations.map((conv, idx) => (
                  <button
                    key={conv.conversation_id || idx}
                    className="import-conv-item"
                    onClick={() => handleConvSelect(conv)}
                  >
                    <div className="conv-item-title">{conv.title}</div>
                    <div className="conv-item-meta">
                      <span>{fmtDate(conv.create_time)}</span>
                      <span>{conv.messageCount} 条</span>
                      {conv.default_model_slug && (
                        <span className="conv-item-model">{conv.default_model_slug}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button className="import-text-btn" onClick={handleReset}>重选文件</button>
            </div>
          )}

          {/* Preview */}
          {step === STEPS.PREVIEW && preview && (
            <div className="import-preview-step">
              <div className="preview-info-grid">
                <div className="preview-info-item">
                  <span className="preview-label">标题</span>
                  <span className="preview-value">{preview.title}</span>
                </div>
                <div className="preview-info-item">
                  <span className="preview-label">Session</span>
                  <span className="preview-value preview-mono">{preview.session}</span>
                </div>
                <div className="preview-info-row">
                  <div className="preview-info-item">
                    <span className="preview-label">消息</span>
                    <span className="preview-value">{preview.total}</span>
                  </div>
                  <div className="preview-info-item">
                    <span className="preview-label">User</span>
                    <span className="preview-value">{preview.userCount}</span>
                  </div>
                  <div className="preview-info-item">
                    <span className="preview-label">Assistant</span>
                    <span className="preview-value">{preview.assistantCount}</span>
                  </div>
                </div>
                <div className="preview-info-item">
                  <span className="preview-label">模型</span>
                  <span className="preview-value">{preview.models?.join(', ') || '—'}</span>
                </div>
                <div className="preview-info-item">
                  <span className="preview-label">时间</span>
                  <span className="preview-value">{fmtDate(preview.earliest)} ~ {fmtDate(preview.latest)}</span>
                </div>
              </div>

              {preview.sessionExists && (
                <div className="preview-warning">
                  <span>Session 已存在（{preview.existingCount} 条）</span>
                  <label className="replace-toggle">
                    <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
                    覆盖
                  </label>
                </div>
              )}

              <div className="preview-msg-list">
                <div className="preview-msg-list-title">前 {preview.preview?.length} 条预览</div>
                {preview.preview?.map((msg, idx) => (
                  <div key={idx} className={`preview-msg preview-msg-${msg.role}`}>
                    <span className={`preview-role preview-role-${msg.role}`}>
                      {msg.role === 'user' ? 'You' : msg.agent}
                    </span>
                    <span className="preview-content">{msg.content}</span>
                  </div>
                ))}
              </div>

              <div className="import-actions">
                <button className="import-text-btn" onClick={handleBack}>返回</button>
                <button
                  className="import-primary-btn"
                  onClick={handleImport}
                  disabled={loading || (preview.sessionExists && !replace)}
                >
                  {loading ? '导入中...' : '确认导入'}
                </button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === STEPS.DONE && importResult && (
            <div className="import-done-step">
              <div className="done-check">&#10003;</div>
              <h3>导入完成</h3>
              <p className="done-summary">
                <strong>{importResult.title}</strong><br />
                {importResult.imported} 条消息 · User {importResult.userCount} · Assistant {importResult.assistantCount}
                {importResult.duplicatesHidden > 0 && (
                  <><br />{importResult.duplicatesHidden} 条重复已自动隐藏</>
                )}
              </p>
              <div className="import-actions">
                <button className="import-text-btn" onClick={handleReset}>继续导入</button>
                <button className="import-primary-btn" onClick={() => onImported?.()}>
                  查看对话流
                </button>
              </div>
            </div>
          )}

          {loading && step !== STEPS.DONE && <div className="import-loading"><LoadingSpinner /></div>}
        </div>
      </div>
    </div>
  );
}
