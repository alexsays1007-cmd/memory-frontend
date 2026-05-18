import { useState, useEffect, useCallback } from 'react';
import { getDiaryDates, getDiaryByDate, updateDiaryEntry, hideDiaryEntry } from '../../api/diary';
import DateNavigator from './DateNavigator';
import DiaryEntry from './DiaryEntry';
import DiaryCalendar from './DiaryCalendar';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './DiaryPage.css';

export default function DiaryPage() {
  const [dates, setDates] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  // Load dates
  useEffect(() => {
    getDiaryDates()
      .then(res => {
        setDates(res.dates);
        if (res.dates.length > 0) {
          setCurrentDate(res.dates[0]);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to fetch diary dates:', err);
        setLoading(false);
      });
  }, []);

  // Load entries for current date
  useEffect(() => {
    if (!currentDate) return;

    setLoading(true);
    getDiaryByDate(currentDate)
      .then(res => {
        setEntries(res.data);
      })
      .catch(err => {
        console.error('Failed to fetch diary entries:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentDate]);

  const handleUpdateEntry = useCallback(async (id, payload) => {
    const result = await updateDiaryEntry(id, payload);
    if (result.entry) {
      setEntries(current =>
        current.map(e => e.id === id ? result.entry : e)
      );
    }
  }, []);

  const handleHideEntry = useCallback(async (id) => {
    await hideDiaryEntry(id);
    setEntries(current => current.filter(e => e.id !== id));
  }, []);

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

  // Group dates by month for the jump list
  const monthGroups = {};
  dates.forEach(d => {
    const key = d.substring(0, 7); // "2026-05"
    if (!monthGroups[key]) monthGroups[key] = [];
    monthGroups[key].push(d);
  });

  const pageHeader = (
    <div className="page-header">
      <div className="page-title-wrap">
        <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <div>
          <h1 className="page-title">日记胶囊</h1>
          <span className="page-subtitle">DIARY CAPSULE</span>
        </div>
      </div>
      <button 
        className="calendar-btn"
        onClick={() => setShowCalendar(!showCalendar)}
        aria-label="Open diary calendar"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </button>
    </div>
  );

  if (dates.length === 0 && !loading) {
    return (
      <div className="diary-page">
        {pageHeader}
        <EmptyState message="No diary entries found" icon="📔" />
      </div>
    );
  }

  return (
    <div className="diary-page">
      {pageHeader}

      {showCalendar && (
        <DiaryCalendar
          dates={dates}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onClose={() => setShowCalendar(false)}
          monthGroups={monthGroups}
        />
      )}

      <DateNavigator
        dates={dates}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />

      <div className="diary-paper-decoration" />

      {currentDate && (
        <div className="diary-date-header">
          <h2 className="diary-date-title">{formatDate(currentDate)}</h2>
          <span className="diary-entry-count">{entries.length} entries</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState message="No entries for this date" icon="📝" />
      ) : (
        <div className="diary-entries">
          {entries.map(entry => (
            <DiaryEntry
              key={entry.id}
              entry={entry}
              onUpdate={handleUpdateEntry}
              onHide={handleHideEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
