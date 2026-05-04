import { useState, useMemo } from 'react';
import './DateRangePicker.css';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 days' },
  { id: '30days', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DateRangePicker({ startDate, endDate, onRangeSelect }) {
  const [currentMode, setCurrentMode] = useState('custom'); // 'today', '7days', etc.
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [selection, setSelection] = useState({ start: startDate, end: endDate });
  const [selectingStep, setSelectingStep] = useState('start'); // 'start' or 'end'

  const handlePresetClick = (presetId) => {
    setCurrentMode(presetId);
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
      setSelection({ start: dateStr, end: null });
      setSelectingStep('end');
    } else {
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
      let m = prev.month - 1;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(prev => {
      let m = prev.month + 1;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const monthName = new Date(currentMonth.year, currentMonth.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const result = [];
    const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month);
    const firstDay = getFirstDayOfMonth(currentMonth.year, currentMonth.month);
    
    // blanks
    for (let i = 0; i < firstDay; i++) {
      result.push(null);
    }
    
    // days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentMonth.year, currentMonth.month, i);
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      result.push(ds);
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
        <div className="calendar-header">
          <button onClick={prevMonth} className="cal-nav">‹</button>
          <span className="cal-month">{monthName}</span>
          <button onClick={nextMonth} className="cal-nav">›</button>
        </div>
        
        <div className="calendar-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => <span key={w}>{w}</span>)}
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
      </div>
    </div>
  );
}
