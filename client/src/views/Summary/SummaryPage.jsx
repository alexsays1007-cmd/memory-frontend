import { useState, useEffect, useCallback, useMemo } from 'react';
import { getRawMessageSummaries, updateRawMessageSummary, approveSummary } from '../../api/rawMessages';
import DiaryCalendar from '../Diary/DiaryCalendar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import './SummaryPage.css';

function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { start: fmt(mon), end: fmt(sun) };
}

function formatWeekLabel(start, end) {
  return `${start.slice(5).replace('-', '/')} — ${end.slice(5).replace('-', '/')}`;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
}

function parseSummaryJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function splitRecap(text) {
  if (!text) return [];
  const sentences = text.split(/(?<=。)/);
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 3) {
    const chunk = sentences.slice(i, i + 3).join('').trim();
    if (chunk) paragraphs.push(chunk);
  }
  return paragraphs;
}

export default function SummaryPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});
  const [viewOriginal, setViewOriginal] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewNoteId, setReviewNoteId] = useState(null);

  const fetchSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRawMessageSummaries({ scope: 'riven_velvy', kind: 'daily' });
      setSummaries(result.summaries || []);
    } catch (err) {
      console.error('Failed to fetch summaries:', err);
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const summaryDates = useMemo(() => {
    const dates = new Set();
    summaries.forEach(s => {
      const p = parseSummaryJson(s.original_summary);
      if (p?.date) dates.add(p.date);
    });
    return [...dates].sort();
  }, [summaries]);

  useEffect(() => {
    if (summaryDates.length > 0 && !weekStart) {
      const latest = summaryDates[summaryDates.length - 1];
      const { start, end } = getWeekRange(latest);
      setWeekStart(start);
      setWeekEnd(end);
    }
  }, [summaryDates, weekStart]);

  const weekSummaries = useMemo(() => {
    if (!weekStart || !weekEnd) return [];
    return summaries
      .filter(s => {
        const p = parseSummaryJson(s.original_summary);
        return p?.date >= weekStart && p?.date <= weekEnd;
      })
      .sort((a, b) => {
        const da = parseSummaryJson(a.original_summary)?.date || '';
        const db = parseSummaryJson(b.original_summary)?.date || '';
        return db.localeCompare(da);
      });
  }, [summaries, weekStart, weekEnd]);

  useEffect(() => {
    if (weekSummaries.length > 0) {
      setExpandedIds({ [weekSummaries[0].id]: true });
    } else {
      setExpandedIds({});
    }
  }, [weekStart, weekEnd]);

  const goWeek = (dir) => {
    const d = new Date(weekStart + 'T12:00:00');
    d.setDate(d.getDate() + dir * 7);
    const { start, end } = getWeekRange(d.toISOString().slice(0, 10));
    setWeekStart(start);
    setWeekEnd(end);
    setEditingId(null);
  };

  const handleCalendarDate = (dateStr) => {
    const { start, end } = getWeekRange(dateStr);
    setWeekStart(start);
    setWeekEnd(end);
    setShowCalendar(false);
    const match = summaries.find(s => parseSummaryJson(s.original_summary)?.date === dateStr);
    setExpandedIds(match ? { [match.id]: true } : {});
    setEditingId(null);
  };

  const handleApprove = async (summary) => {
    try {
      const result = await approveSummary(summary.id);
      setSummaries(prev => prev.map(s => s.id === summary.id ? result.summary : s));
      window.dispatchEvent(new Event('summary-status-changed'));
    } catch (err) {
      console.error('Failed to approve summary:', err);
    }
  };

  const startEdit = (summary) => {
    const content = summary.revised_summary || summary.original_summary || '';
    setEditingId(summary.id);
    setEditDraft(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  };

  const saveEdit = async (summary) => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await updateRawMessageSummary(summary.id, editDraft);
      setSummaries(prev => prev.map(s => s.id === summary.id ? result.summary : s));
      setEditingId(null);
      setEditDraft('');
      window.dispatchEvent(new Event('summary-status-changed'));
    } catch (err) {
      console.error('Failed to save summary:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
    if (editingId && editingId !== id) {
      setEditingId(null);
      setEditDraft('');
    }
  };

  const renderCard = (summary) => {
    const originalParsed = parseSummaryJson(summary.original_summary);
    const revisedParsed = parseSummaryJson(summary.revised_summary);
    const hasRevised = !!revisedParsed;
    const showOriginal = viewOriginal[summary.id];
    const parsed = (!showOriginal && hasRevised) ? revisedParsed : originalParsed;
    const previewTopics = (revisedParsed?.topics?.length > 0 ? revisedParsed.topics : originalParsed?.topics) || [];
    const dateStr = originalParsed?.date || summary.start_created?.slice(0, 10) || '';
    const dateLabel = formatDayLabel(dateStr);
    const isOpen = !!expandedIds[summary.id];
    const isEditing = editingId === summary.id;

    return (
      <article key={summary.id} className={`sd-card ${isOpen ? 'sd-card-open' : ''}`}>
        <button className="sd-card-header" onClick={() => toggleExpand(summary.id)}>
          <span className="sd-card-date">{dateLabel}</span>
          <span className="sd-card-meta">
            {!isOpen && previewTopics.length > 0 && (
              <span className="sd-card-topics-preview">
                {previewTopics.slice(0, 3).join(' · ')}
              </span>
            )}
            {summary.review_status === 'pending' && <span className="sd-status sd-status-pending">待审</span>}
            {summary.review_status === 'reviewed' && <span className="sd-status sd-status-reviewed">已审</span>}
            {summary.review_status === 'revised' && <span className="sd-status sd-status-revised">已改</span>}
            {summary.review_status === 'approved' && <span className="sd-status sd-status-approved">✓</span>}
          </span>
          <svg className={`sd-card-caret ${isOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {isOpen && !isEditing && parsed && (
          <div className="sd-card-body">
            <div className="sd-top-row">
              {hasRevised && (
                <div className="sd-version-tabs">
                  <button className={!showOriginal ? 'active' : ''} onClick={() => setViewOriginal(p => ({ ...p, [summary.id]: false }))}>
                    修改版
                  </button>
                  <button className={showOriginal ? 'active' : ''} onClick={() => setViewOriginal(p => ({ ...p, [summary.id]: true }))}>
                    原版
                  </button>
                </div>
              )}
              {summary.review_note && (
                <button className="sd-note-btn" onClick={() => setReviewNoteId(reviewNoteId === summary.id ? null : summary.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                  </svg>
                  审核记录
                </button>
              )}
            </div>
            {reviewNoteId === summary.id && (
              <div className="sd-note-popup">
                <div className="sd-note-popup-header">
                  <span>审核记录</span>
                  <button onClick={() => setReviewNoteId(null)}>✕</button>
                </div>
                <pre className="sd-review-note">{summary.review_note}</pre>
              </div>
            )}

            <div className="sd-section sd-recap">
              {splitRecap(parsed.recap).map((p, i) => <p key={i}>{p}</p>)}
            </div>

            {parsed.moments?.length > 0 && (
              <details className="sd-section sd-details" open>
                <summary className="sd-section-title">关键时刻 ({parsed.moments.length})</summary>
                <ul className="sd-moments">
                  {parsed.moments.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </details>
            )}

            {parsed.open_loops?.length > 0 && (
              <details className="sd-section sd-details">
                <summary className="sd-section-title">未关闭 ({parsed.open_loops.length})</summary>
                <ul className="sd-open-loops">
                  {parsed.open_loops.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </details>
            )}

            {parsed.topics?.length > 0 && (
              <div className="sd-section">
                <div className="sd-section-label">Topics</div>
                <div className="sd-tags">{parsed.topics.map((t, i) => <span key={i} className="sd-tag">{t}</span>)}</div>
              </div>
            )}

            {parsed.entities?.length > 0 && (
              <div className="sd-section">
                <div className="sd-section-label">Entities</div>
                <div className="sd-tags">{parsed.entities.map((e, i) => <span key={i} className="sd-tag sd-tag-entity">{e}</span>)}</div>
              </div>
            )}

            <div className="sd-actions">
              {summary.review_status === 'pending' && (
                <button className="sd-approve-btn" onClick={() => handleApprove(summary)}>✓ 通过</button>
              )}
              <button onClick={() => startEdit(summary)}>
                {summary.revised_summary ? 'Edit revision' : 'Revise'}
              </button>
            </div>
          </div>
        )}

        {isOpen && isEditing && (
          <div className="sd-card-body">
            <textarea
              className="sd-editor"
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              rows={16}
            />
            <div className="sd-actions">
              <button onClick={() => { setEditingId(null); setEditDraft(''); }}>Cancel</button>
              <button className="sd-save-btn" onClick={() => saveEdit(summary)} disabled={saving}>
                {saving ? 'Saving...' : 'Save revision'}
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="summary-page">
      <div className="page-header">
        <div className="page-title-wrap">
          <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <div>
            <h1 className="page-title">摘要</h1>
            <span className="page-subtitle">RIVEN SUMMARY</span>
          </div>
        </div>
      </div>

      <div className="sd-week-nav">
        <div className="sd-week-pill">
          <button className="sd-week-btn" onClick={() => goWeek(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="sd-week-label" onClick={() => setShowCalendar(true)}>
            {weekStart && weekEnd ? formatWeekLabel(weekStart, weekEnd) : '—'}
          </button>
          <button className="sd-week-btn" onClick={() => goWeek(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      {showCalendar && (
        <DiaryCalendar
          dates={summaryDates}
          currentDate={summaryDates[summaryDates.length - 1] || ''}
          onDateChange={handleCalendarDate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {loading ? (
        <LoadingSpinner />
      ) : weekSummaries.length === 0 ? (
        <EmptyState message="本周暂无摘要" icon="📝" />
      ) : (
        <div className="sd-card-list">
          {weekSummaries.map(s => renderCard(s))}
        </div>
      )}
    </div>
  );
}
