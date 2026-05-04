import './DateNavigator.css';

export default function DateNavigator({ dates, currentDate, onDateChange }) {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="date-navigator">
      <button
        className="date-nav-btn"
        onClick={goToPrev}
        disabled={currentIndex >= dates.length - 1}
      >
        ← Prev
      </button>

      <select
        className="date-select"
        value={currentDate || ''}
        onChange={(e) => onDateChange(e.target.value)}
      >
        {dates.map(date => (
          <option key={date} value={date}>
            {formatDate(date)}
          </option>
        ))}
      </select>

      <button
        className="date-nav-btn"
        onClick={goToNext}
        disabled={currentIndex <= 0}
      >
        Next →
      </button>
    </div>
  );
}
