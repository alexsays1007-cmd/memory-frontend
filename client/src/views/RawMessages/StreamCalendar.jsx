import { useState, useMemo } from 'react';
import './StreamCalendar.css';

/* ---- helpers ---- */
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay(); }

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function heatLevel(count, max) {
  if (!count) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio >= 0.7) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}

/* ================================================ */
export default function StreamCalendar({
  dates = [],
  dateCounts = {},
  selectedDate,
  rangeStart,
  rangeEnd,
  mode = 'single',
  onModeChange,
  onDateSelect,
  onRangeSelect,
  onClear,
  onClose,
}) {
  /* ---- view state ---- */
  const [viewMonth, setViewMonth] = useState(() => {
    const ref = selectedDate || rangeStart;
    const d = ref ? new Date(ref + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [drill, setDrill] = useState('calendar');   // 'calendar' | 'year' | 'month'
  const [pendingStart, setPendingStart] = useState(rangeStart || null);

  /* ---- derived ---- */
  const maxCount = useMemo(() => {
    const vals = Object.values(dateCounts);
    return vals.length ? Math.max(...vals) : 0;
  }, [dateCounts]);

  const days = useMemo(() => {
    const result = [];
    const dim = getDaysInMonth(viewMonth.year, viewMonth.month);
    const first = getFirstDayOfMonth(viewMonth.year, viewMonth.month);
    for (let i = 0; i < first; i++) result.push(null);
    for (let i = 1; i <= dim; i++) {
      result.push(dateStr(viewMonth.year, viewMonth.month, i));
    }
    return result;
  }, [viewMonth]);

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1)
    .toLocaleDateString('zh-CN', { month: 'long', year: 'numeric' });

  /* ---- year/month options ---- */
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years = new Set();
    dates.forEach(d => years.add(parseInt(d.slice(0, 4), 10)));
    years.add(now);
    years.add(viewMonth.year);
    return Array.from(years).sort((a, b) => b - a);
  }, [dates, viewMonth.year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => i);

  /* month has data? for highlighting in month picker */
  const monthHasData = useMemo(() => {
    const set = new Set();
    dates.forEach(d => set.add(d.slice(0, 7)));
    return set;
  }, [dates]);

  /* ---- nav ---- */
  const prevMonth = () => setViewMonth(p => {
    let m = p.month - 1, y = p.year;
    if (m < 0) { m = 11; y--; }
    return { year: y, month: m };
  });

  const nextMonth = () => setViewMonth(p => {
    let m = p.month + 1, y = p.year;
    if (m > 11) { m = 0; y++; }
    return { year: y, month: m };
  });

  /* ---- drill handlers ---- */
  const handleTitleClick = () => setDrill(drill === 'month' ? 'calendar' : 'month');
  const handleYearClick = () => setDrill(drill === 'year' ? 'month' : 'year');

  const handleYearPick = (y) => {
    setViewMonth(p => ({ ...p, year: y }));
    setDrill('month');
  };

  const handleMonthPick = (m) => {
    setViewMonth(p => ({ ...p, month: m }));
    setDrill('calendar');
  };

  /* ---- day click ---- */
  const handleDayClick = (d) => {
    if (mode === 'single') {
      onDateSelect(d);
      onClose();
    } else {
      if (!pendingStart || (pendingStart && rangeEnd)) {
        // start new range
        setPendingStart(d);
        onRangeSelect(d, null);
      } else {
        // complete range
        const [lo, hi] = pendingStart <= d ? [pendingStart, d] : [d, pendingStart];
        onRangeSelect(lo, hi);
        setPendingStart(null);
        onClose();
      }
    }
  };

  /* ---- range helpers ---- */
  const isInRange = (d) => {
    if (mode !== 'range') return false;
    const s = pendingStart || rangeStart;
    const e = rangeEnd;
    if (!s || !e) return false;
    const lo = s <= e ? s : e;
    const hi = s <= e ? e : s;
    return d >= lo && d <= hi;
  };

  const isRangeEdge = (d) => {
    if (mode !== 'range') return false;
    return d === rangeStart || d === rangeEnd || d === pendingStart;
  };

  /* ---- render ---- */
  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-panel" onClick={e => e.stopPropagation()}>

        {/* Mode tabs */}
        <div className="sc-modes">
          <button
            className={`sc-mode-tab ${mode === 'single' ? 'active' : ''}`}
            onClick={() => { onModeChange('single'); setPendingStart(null); }}
          >单日</button>
          <button
            className={`sc-mode-tab ${mode === 'range' ? 'active' : ''}`}
            onClick={() => { onModeChange('range'); setPendingStart(null); }}
          >区间</button>
        </div>

        {/* Range hint */}
        {mode === 'range' && (
          <div className="sc-range-hint">
            {!pendingStart && !rangeEnd && '选择起始日期'}
            {pendingStart && !rangeEnd && (
              <>
                <span className="sc-range-tag">{pendingStart.slice(5).replace('-', '/')}</span>
                <span className="sc-range-arrow">→</span>
                <span className="sc-range-placeholder">选择结束日期</span>
              </>
            )}
            {rangeStart && rangeEnd && (
              <>
                <span className="sc-range-tag">{rangeStart.slice(5).replace('-', '/')}</span>
                <span className="sc-range-arrow">→</span>
                <span className="sc-range-tag">{rangeEnd.slice(5).replace('-', '/')}</span>
              </>
            )}
          </div>
        )}

        {/* Header with nav */}
        <div className="sc-header">
          {drill === 'calendar' && (
            <button className="sc-nav" onClick={prevMonth} aria-label="上个月">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}

          <div className="sc-title-group">
            {drill === 'calendar' && (
              <>
                <button className="sc-title-btn sc-year-btn" onClick={handleYearClick}>
                  {viewMonth.year}年
                </button>
                <button className="sc-title-btn sc-month-btn" onClick={handleTitleClick}>
                  {viewMonth.month + 1}月
                  <svg className="sc-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </>
            )}
            {drill === 'year' && (
              <span className="sc-title-label">选择年份</span>
            )}
            {drill === 'month' && (
              <>
                <button className="sc-title-btn sc-year-btn" onClick={handleYearClick}>
                  {viewMonth.year}年
                  <svg className="sc-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <span className="sc-title-sep">·</span>
                <span className="sc-title-label">选择月份</span>
              </>
            )}
          </div>

          {drill === 'calendar' && (
            <button className="sc-nav" onClick={nextMonth} aria-label="下个月">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>

        {/* ---- YEAR PICKER ---- */}
        {drill === 'year' && (
          <div className="sc-picker-grid sc-year-grid">
            {yearOptions.map(y => (
              <button
                key={y}
                className={`sc-picker-cell ${y === viewMonth.year ? 'active' : ''}`}
                onClick={() => handleYearPick(y)}
              >{y}</button>
            ))}
          </div>
        )}

        {/* ---- MONTH PICKER ---- */}
        {drill === 'month' && (
          <div className="sc-picker-grid sc-month-grid">
            {monthOptions.map(m => {
              const ym = `${viewMonth.year}-${String(m + 1).padStart(2, '0')}`;
              const hasData = monthHasData.has(ym);
              const isCurrent = m === viewMonth.month;
              return (
                <button
                  key={m}
                  className={`sc-picker-cell ${isCurrent ? 'active' : ''} ${hasData ? 'has-data' : ''}`}
                  onClick={() => handleMonthPick(m)}
                >
                  {m + 1}月
                </button>
              );
            })}
          </div>
        )}

        {/* ---- CALENDAR GRID ---- */}
        {drill === 'calendar' && (
          <>
            <div className="sc-weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map(w => <span key={w}>{w}</span>)}
            </div>

            <div className="sc-days">
              {days.map((d, i) => {
                if (!d) return <div key={i} className="sc-day empty" />;
                const dayNum = parseInt(d.split('-')[2], 10);
                const count = dateCounts[d] || 0;
                const heat = heatLevel(count, maxCount);
                const selected = mode === 'single' && d === selectedDate;
                const inRange = isInRange(d);
                const edge = isRangeEdge(d);

                return (
                  <button
                    key={i}
                    className={[
                      'sc-day',
                      heat > 0 ? `heat-${heat}` : 'no-data',
                      selected ? 'selected' : '',
                      inRange ? 'in-range' : '',
                      edge ? 'range-edge' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleDayClick(d)}
                    title={count ? `${count} 条消息` : ''}
                  >
                    <span className="sc-day-num">{dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* Heat legend */}
            <div className="sc-legend">
              <span className="sc-legend-label">少</span>
              <span className="sc-legend-box heat-1" />
              <span className="sc-legend-box heat-2" />
              <span className="sc-legend-box heat-3" />
              <span className="sc-legend-box heat-4" />
              <span className="sc-legend-label">多</span>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="sc-footer">
          <button className="sc-clear-btn" onClick={() => { onClear(); onClose(); }}>
            清除日期
          </button>
        </div>
      </div>
    </div>
  );
}
