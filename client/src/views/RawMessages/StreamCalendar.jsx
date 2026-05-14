import { useState, useMemo } from 'react';
import './StreamCalendar.css';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function compareDates(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

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
  monthGroups = {},
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const ref = selectedDate || rangeStart;
    const d = ref ? new Date(ref + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [showJumpList, setShowJumpList] = useState(false);
  const [pendingStart, setPendingStart] = useState(rangeStart || null);

  const prevMonth = () => {
    setViewMonth(prev => {
      let m = prev.month - 1, y = prev.year;
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  };

  const nextMonth = () => {
    setViewMonth(prev => {
      let m = prev.month + 1, y = prev.year;
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const monthName = new Date(viewMonth.year, viewMonth.month, 1)
    .toLocaleDateString('zh-CN', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const result = [];
    const dim = getDaysInMonth(viewMonth.year, viewMonth.month);
    const firstDay = getFirstDayOfMonth(viewMonth.year, viewMonth.month);
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let i = 1; i <= dim; i++) {
      const ds = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      result.push(ds);
    }
    return result;
  }, [viewMonth]);

  const hasData = (d) => dates.includes(d);

  const isInRange = (d) => {
    if (mode !== 'range') return false;
    const s = pendingStart || rangeStart;
    const e = rangeEnd;
    if (!s || !e) return false;
    const lo = compareDates(s, e) <= 0 ? s : e;
    const hi = compareDates(s, e) <= 0 ? e : s;
    return d >= lo && d <= hi;
  };

  const isRangeEdge = (d) => {
    if (mode !== 'range') return false;
    return d === rangeStart || d === rangeEnd || d === pendingStart;
  };

  const handleDayClick = (d) => {
    if (mode === 'single') {
      onDateSelect(d);
      onClose();
    } else {
      if (!pendingStart || (pendingStart && rangeEnd)) {
        setPendingStart(d);
        onRangeSelect(d, null);
      } else {
        const [lo, hi] = compareDates(pendingStart, d) <= 0
          ? [pendingStart, d] : [d, pendingStart];
        onRangeSelect(lo, hi);
        setPendingStart(null);
        onClose();
      }
    }
  };

  const recentDates = dates.slice(0, 7);

  const formatMonthLabel = (ym) => {
    const [y, m] = ym.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="stream-cal-overlay" onClick={onClose}>
      <div className="stream-cal-panel" onClick={e => e.stopPropagation()}>
        {/* Mode toggle */}
        <div className="stream-cal-modes">
          <button
            className={`cal-mode-tab ${mode === 'single' ? 'active' : ''}`}
            onClick={() => onModeChange('single')}
          >单日</button>
          <button
            className={`cal-mode-tab ${mode === 'range' ? 'active' : ''}`}
            onClick={() => { onModeChange('range'); setPendingStart(null); }}
          >区间</button>
        </div>

        {/* Quick chips */}
        {recentDates.length > 0 && (
          <div className="stream-cal-chips">
            {recentDates.map(d => {
              const count = dateCounts[d];
              const isActive = mode === 'single' && d === selectedDate;
              return (
                <button
                  key={d}
                  className={`stream-cal-chip ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (mode === 'single') {
                      onDateSelect(d);
                      onClose();
                    } else {
                      handleDayClick(d);
                    }
                  }}
                >
                  {d.slice(5).replace('-', '/')}
                  {count != null && <span className="chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Range hint */}
        {mode === 'range' && (
          <div className="stream-cal-range-hint">
            {!pendingStart && !rangeEnd && '点击选择起始日期'}
            {pendingStart && !rangeEnd && `起: ${pendingStart.slice(5).replace('-', '/')} → 再选结束日期`}
            {rangeStart && rangeEnd && `${rangeStart.slice(5).replace('-', '/')} ~ ${rangeEnd.slice(5).replace('-', '/')}`}
          </div>
        )}

        {/* Calendar header */}
        <div className="stream-cal-header">
          <button className="stream-cal-nav" onClick={prevMonth}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="stream-cal-title">{monthName}</span>
          <button className="stream-cal-nav" onClick={nextMonth}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Weekday labels */}
        <div className="stream-cal-weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map(w => <span key={w}>{w}</span>)}
        </div>

        {/* Day grid */}
        <div className="stream-cal-days">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="stream-day empty" />;
            const dayNum = parseInt(d.split('-')[2], 10);
            const active = hasData(d);
            const selected = mode === 'single' && d === selectedDate;
            const inRange = isInRange(d);
            const edge = isRangeEdge(d);

            return (
              <button
                key={i}
                className={[
                  'stream-day',
                  active ? 'has-data' : '',
                  selected ? 'selected' : '',
                  inRange ? 'in-range' : '',
                  edge ? 'range-edge' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleDayClick(d)}
              >
                <span className="day-num">{dayNum}</span>
                {active && <span className="data-dot" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="stream-cal-footer">
          <button className="stream-cal-clear" onClick={() => { onClear(); onClose(); }}>
            清除日期
          </button>
          <button
            className="stream-cal-jump-toggle"
            onClick={() => setShowJumpList(!showJumpList)}
          >
            <span>{showJumpList ? '收起月份' : '跳转月份...'}</span>
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: showJumpList ? 'rotate(180deg)' : 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {showJumpList && (
          <div className="stream-cal-jump-list">
            {Object.keys(monthGroups).sort().reverse().map(mk => (
              <button
                key={mk}
                className={`stream-jump-item ${viewMonth.year === parseInt(mk.split('-')[0]) && viewMonth.month === parseInt(mk.split('-')[1]) - 1 ? 'active' : ''}`}
                onClick={() => {
                  const [y, m] = mk.split('-');
                  setViewMonth({ year: parseInt(y), month: parseInt(m) - 1 });
                }}
              >
                <span>{formatMonthLabel(mk)}</span>
                <span className="jump-cnt">{monthGroups[mk].length} 天有消息</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
