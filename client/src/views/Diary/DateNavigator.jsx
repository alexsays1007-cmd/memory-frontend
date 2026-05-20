import './DateNavigator.css';

export default function DateNavigator({ dates, currentDate, onDateChange, onCalendarOpen }) {
  const currentIndex = dates.indexOf(currentDate);

  const goToPrev = () => {
    if (currentIndex < dates.length - 1) {
      onDateChange(dates[currentIndex + 1]);
    }
  };

  const goToNext = () => {
    if (currentIndex > 0) {
      onDateChange(dates[currentIndex - 1]);
    }
  };

  const formatMonthYear = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="date-navigator">
      <div className="nav-pill">
        <button
          className="date-nav-btn"
          onClick={goToPrev}
          disabled={currentIndex >= dates.length - 1}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button className="current-month" onClick={onCalendarOpen} title="打开日历">
          {formatMonthYear(currentDate)}
        </button>

        <button
          className="date-nav-btn"
          onClick={goToNext}
          disabled={currentIndex <= 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
