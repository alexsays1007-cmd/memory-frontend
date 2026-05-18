import { useState, useMemo } from 'react';
import './DiaryCalendar.css';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DiaryCalendar({
  dates = [],
  currentDate,
  onDateChange,
  onClose,
  monthGroups = {}
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = currentDate ? new Date(currentDate + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [drill, setDrill] = useState('calendar'); // 'calendar' | 'year' | 'month'

  /* ---- nav ---- */
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

  /* ---- derived ---- */
  const days = useMemo(() => {
    const result = [];
    const dim = getDaysInMonth(viewMonth.year, viewMonth.month);
    const first = getFirstDayOfMonth(viewMonth.year, viewMonth.month);
    for (let i = 0; i < first; i++) result.push(null);
    for (let i = 1; i <= dim; i++) {
      result.push(`${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return result;
  }, [viewMonth]);

  const hasEntry = (dateStr) => dates.includes(dateStr);
  const isSelected = (dateStr) => dateStr === currentDate;

  /* ---- year/month options ---- */
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const years = new Set();
    dates.forEach(d => years.add(parseInt(d.slice(0, 4), 10)));
    years.add(now);
    years.add(viewMonth.year);
    return Array.from(years).sort((a, b) => b - a);
  }, [dates, viewMonth.year]);

  const monthHasData = useMemo(() => {
    const set = new Set();
    dates.forEach(d => set.add(d.slice(0, 7)));
    return set;
  }, [dates]);

  /* ---- drill handlers ---- */
  const handleYearClick = () => setDrill(drill === 'year' ? 'month' : 'year');
  const handleMonthClick = () => setDrill(drill === 'month' ? 'calendar' : 'month');

  const handleYearPick = (y) => {
    setViewMonth(p => ({ ...p, year: y }));
    setDrill('month');
  };

  const handleMonthPick = (m) => {
    setViewMonth(p => ({ ...p, month: m }));
    setDrill('calendar');
  };

  const handleDateClick = (dateStr) => {
    onDateChange(dateStr);
    onClose();
  };

  return (
    <div className="diary-calendar-popover" onClick={onClose}>
      <div className="diary-calendar-panel" onClick={e => e.stopPropagation()}>

        {/* ---- Header ---- */}
        <div className="diary-calendar-header">
          {drill === 'calendar' && (
            <button className="cal-nav-btn" onClick={prevMonth}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          <div className="cal-title-group">
            {drill === 'calendar' && (
              <>
                <button className="cal-title-btn cal-title-year" onClick={handleYearClick}>
                  {viewMonth.year}年
                </button>
                <button className="cal-title-btn cal-title-month" onClick={handleMonthClick}>
                  {viewMonth.month + 1}月
                  <svg className="cal-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </>
            )}
            {drill === 'year' && (
              <span className="cal-title-label">选择年份</span>
            )}
            {drill === 'month' && (
              <>
                <button className="cal-title-btn cal-title-year" onClick={handleYearClick}>
                  {viewMonth.year}年
                  <svg className="cal-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <span className="cal-title-sep">&middot;</span>
                <span className="cal-title-label">选择月份</span>
              </>
            )}
          </div>

          {drill === 'calendar' && (
            <button className="cal-nav-btn" onClick={nextMonth}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
        </div>

        {/* ---- Year picker ---- */}
        {drill === 'year' && (
          <div className="cal-picker-grid cal-year-grid">
            {yearOptions.map(y => (
              <button
                key={y}
                className={`cal-picker-cell ${y === viewMonth.year ? 'active' : ''}`}
                onClick={() => handleYearPick(y)}
              >{y}</button>
            ))}
          </div>
        )}

        {/* ---- Month picker ---- */}
        {drill === 'month' && (
          <div className="cal-picker-grid cal-month-grid">
            {Array.from({ length: 12 }, (_, i) => {
              const ym = `${viewMonth.year}-${String(i + 1).padStart(2, '0')}`;
              const hasData = monthHasData.has(ym);
              const isCurrent = i === viewMonth.month;
              return (
                <button
                  key={i}
                  className={`cal-picker-cell ${isCurrent ? 'active' : ''} ${hasData ? 'has-data' : ''}`}
                  onClick={() => handleMonthPick(i)}
                >
                  {i + 1}月
                </button>
              );
            })}
          </div>
        )}

        {/* ---- Calendar grid ---- */}
        {drill === 'calendar' && (
          <>
            <div className="cal-grid-weekdays">
              {['日', '一', '二', '三', '四', '五', '六'].map(w => <span key={w}>{w}</span>)}
            </div>

            <div className="cal-grid-days">
              {days.map((d, i) => {
                if (!d) return <div key={i} className="cal-day-cell empty" />;
                const dayNum = parseInt(d.split('-')[2], 10);
                const active = hasEntry(d);
                const selected = isSelected(d);
                return (
                  <button
                    key={i}
                    className={`cal-day-cell ${active ? 'has-entry' : ''} ${selected ? 'selected' : ''}`}
                    onClick={() => handleDateClick(d)}
                  >
                    <span className="day-number">{dayNum}</span>
                    {active && <span className="entry-dot" />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ---- Footer ---- */}
        <div className="cal-footer">
          <button className="cal-clear-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
