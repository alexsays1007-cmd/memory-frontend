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

  const [showJumpList, setShowJumpList] = useState(false);

  const prevMonth = () => {
    setViewMonth(prev => {
      let m = prev.month - 1;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  };

  const nextMonth = () => {
    setViewMonth(prev => {
      let m = prev.month + 1;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString('zh-CN', { 
    month: 'long', 
    year: 'numeric' 
  });

  const days = useMemo(() => {
    const result = [];
    const daysInMonth = getDaysInMonth(viewMonth.year, viewMonth.month);
    const firstDay = getFirstDayOfMonth(viewMonth.year, viewMonth.month);
    
    // blanks
    for (let i = 0; i < firstDay; i++) {
      result.push(null);
    }
    
    // days
    for (let i = 1; i <= daysInMonth; i++) {
      const ds = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      result.push(ds);
    }
    return result;
  }, [viewMonth]);

  const hasEntry = (dateStr) => dates.includes(dateStr);
  const isSelected = (dateStr) => dateStr === currentDate;

  const handleDateClick = (dateStr) => {
    onDateChange(dateStr);
    onClose();
  };

  const formatMonthLabel = (ym) => {
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="diary-calendar-popover" onClick={onClose}>
      <div className="diary-calendar-panel" onClick={e => e.stopPropagation()}>
        <div className="diary-calendar-header">
          <button className="cal-nav-btn" onClick={prevMonth}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h3 className="cal-view-title">{monthName}</h3>
          <button className="cal-nav-btn" onClick={nextMonth}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

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

        <div className="cal-footer">
          <button 
            className="jump-list-toggle"
            onClick={() => setShowJumpList(!showJumpList)}
          >
            <span>{showJumpList ? '收起月份列表' : '跳转至有数据的月份...'}</span>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ transform: showJumpList ? 'rotate(180deg)' : 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showJumpList && (
            <div className="jump-list-content">
              {Object.keys(monthGroups).sort().reverse().map(mk => (
                <button
                  key={mk}
                  className={`jump-item ${viewMonth.year === parseInt(mk.split('-')[0]) && viewMonth.month === parseInt(mk.split('-')[1]) - 1 ? 'active' : ''}`}
                  onClick={() => {
                    const [y, m] = mk.split('-');
                    setViewMonth({ year: parseInt(y), month: parseInt(m) - 1 });
                  }}
                >
                  <span className="jump-month">{formatMonthLabel(mk)}</span>
                  <span className="jump-count">{monthGroups[mk].length} 天有日记</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
