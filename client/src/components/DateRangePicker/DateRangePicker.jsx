import { useState, useMemo } from 'react';
import './DateRangePicker.css';

const PRESETS = [
  { id: 'today', label: '今天' },
  { id: '7days', label: '近7天' },
  { id: '30days', label: '近30天' },
  { id: 'month', label: '本月' },
  { id: 'custom', label: '自定义' },
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DateRangePicker({ startDate, endDate, onRangeSelect }) {
  const [currentMode, setCurrentMode] = useState('custom');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [selection, setSelection] = useState({ start: startDate, end: endDate });
  const [selectingStep, setSelectingStep] = useState('start');
  const [drill, setDrill] = useState('calendar'); // 'calendar' | 'year' | 'month'

  const handlePresetClick = (presetId) => {
    setCurrentMode(presetId);
    setDrill('calendar');
    const today = new Date();
    let s = null, e = null;

    if (presetId === 'today') {
      s = e = today.toISOString().split('T')[0];
    } else if (presetId === '7days') {
      e = today.toISOString().split('T')[0];
      const d = new Date();
      d.setDate(d.getDate() - 6);
      s = d.toISOString().split('T')[0];
    } else if (presetId === '30days') {
      e = today.toISOString().split('T')[0];
      const d = new Date();
      d.setDate(d.getDate() - 29);
      s = d.toISOString().split('T')[0];
    } else if (presetId === 'month') {
      const y = today.getFullYear();
      const m = today.getMonth();
      s = new Date(y, m, 1).toISOString().split('T')[0];
      e = new Date(y, m + 1, 0).toISOString().split('T')[0];
    }

    if (s && e) {
      setSelection({ start: s, end: e });
      onRangeSelect({ start: s, end: e });
    }
  };

  const handleDateClick = (dateStr) => {
    setCurrentMode('custom');
    if (selectingStep === 'start') {
      // First click: select single day immediately
      setSelection({ start: dateStr, end: dateStr });
      setSelectingStep('end');
      onRangeSelect({ start: dateStr, end: dateStr });
    } else {
      // Second click: extend to range
      let s = selection.start;
      let e = dateStr;
      if (new Date(e) < new Date(s)) {
        s = dateStr;
        e = selection.start;
      }
      setSelection({ start: s, end: e });
      setSelectingStep('start');
      onRangeSelect({ start: s, end: e });
    }
  };

  const prevMonth = () => {
    setCurrentMonth(prev => {
      let m = prev.month - 1, y = prev.year;
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(prev => {
      let m = prev.month + 1, y = prev.year;
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const days = useMemo(() => {
    const result = [];
    const dim = getDaysInMonth(currentMonth.year, currentMonth.month);
    const first = getFirstDayOfMonth(currentMonth.year, currentMonth.month);
    for (let i = 0; i < first; i++) result.push(null);
    for (let i = 1; i <= dim; i++) {
      result.push(`${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return result;
  }, [currentMonth]);

  const isSelected = (d) => d && (d === selection.start || d === selection.end);
  const isInRange = (d) => {
    if (!d || !selection.start || !selection.end) return false;
    const date = new Date(d);
    const s = new Date(selection.start);
    const e = new Date(selection.end);
    return date > s && date < e;
  };

  /* ---- Year/month options ---- */
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now; y >= now - 5; y--) years.push(y);
    if (!years.includes(currentMonth.year)) years.push(currentMonth.year);
    return years.sort((a, b) => b - a);
  }, [currentMonth.year]);

  const handleYearClick = () => setDrill(drill === 'year' ? 'month' : 'year');
  const handleMonthClick = () => setDrill(drill === 'month' ? 'calendar' : 'month');

  const handleYearPick = (y) => {
    setCurrentMonth(p => ({ ...p, year: y }));
    setDrill('month');
  };

  const handleMonthPick = (m) => {
    setCurrentMonth(p => ({ ...p, month: m }));
    setDrill('calendar');
  };

  return (
    <div className="custom-date-picker">
      <div className="picker-presets">
        {PRESETS.map(p => (
          <button
            key={p.id}
            className={`preset-chip ${currentMode === p.id ? 'active' : ''}`}
            onClick={() => handlePresetClick(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="calendar-grid-container">
        {/* Header */}
        <div className="calendar-header">
          {drill === 'calendar' && (
            <button onClick={prevMonth} className="cal-nav">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}

          <div className="drp-title-group">
            {drill === 'calendar' && (
              <>
                <button className="drp-title-btn drp-title-year" onClick={handleYearClick}>
                  {currentMonth.year}年
                </button>
                <button className="drp-title-btn" onClick={handleMonthClick}>
                  {currentMonth.month + 1}月
                  <svg className="drp-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </>
            )}
            {drill === 'year' && (
              <span className="drp-title-label">选择年份</span>
            )}
            {drill === 'month' && (
              <>
                <button className="drp-title-btn drp-title-year" onClick={handleYearClick}>
                  {currentMonth.year}年
                  <svg className="drp-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <span className="drp-title-sep">&middot;</span>
                <span className="drp-title-label">选择月份</span>
              </>
            )}
          </div>

          {drill === 'calendar' && (
            <button onClick={nextMonth} className="cal-nav">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>

        {/* Year picker */}
        {drill === 'year' && (
          <div className="drp-picker-grid drp-year-grid">
            {yearOptions.map(y => (
              <button
                key={y}
                className={`drp-picker-cell ${y === currentMonth.year ? 'active' : ''}`}
                onClick={() => handleYearPick(y)}
              >{y}</button>
            ))}
          </div>
        )}

        {/* Month picker */}
        {drill === 'month' && (
          <div className="drp-picker-grid drp-month-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                className={`drp-picker-cell ${i === currentMonth.month ? 'active' : ''}`}
                onClick={() => handleMonthPick(i)}
              >
                {i + 1}月
              </button>
            ))}
          </div>
        )}

        {/* Calendar */}
        {drill === 'calendar' && (
          <>
            <div className="calendar-weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map(w => <span key={w}>{w}</span>)}
            </div>

            <div className="calendar-days">
              {days.map((d, i) => {
                if (!d) return <div key={i} className="cal-day empty" />;
                const dayNum = parseInt(d.split('-')[2], 10);
                const selected = isSelected(d);
                const range = isInRange(d);
                return (
                  <button
                    key={i}
                    className={`cal-day ${selected ? 'selected' : ''} ${range ? 'in-range' : ''}`}
                    onClick={() => handleDateClick(d)}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
