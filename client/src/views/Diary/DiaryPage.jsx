import { useState, useEffect } from 'react';
import { getDiaryDates, getDiaryByDate } from '../../api/diary';
import DateNavigator from './DateNavigator';
import DiaryEntry from './DiaryEntry';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './DiaryPage.css';

export default function DiaryPage() {
  const [dates, setDates] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (dates.length === 0 && !loading) {
    return (
      <div className="diary-page">
        <div className="page-header">
          <h1 className="page-title">Diary</h1>
        </div>
        <EmptyState message="No diary entries found" icon="📔" />
      </div>
    );
  }

  return (
    <div className="diary-page">
      <div className="page-header">
        <h1 className="page-title">Diary</h1>
      </div>

      <DateNavigator
        dates={dates}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />

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
            <DiaryEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
