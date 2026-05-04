import { useState, useEffect, useCallback } from 'react';
import { getConsciousnessLog, getActionTypes } from '../../api/consciousness';
import TimelineItem from './TimelineItem';
import Select from '../../components/common/Select';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './ConsciousnessPage.css';

export default function ConsciousnessPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionTypes, setActionTypes] = useState([]);
  const [filters, setFilters] = useState({
    action_type: null,
    date_from: '',
    date_to: '',
  });

  // Load action types
  useEffect(() => {
    getActionTypes()
      .then(res => setActionTypes(res.action_types))
      .catch(console.error);
  }, []);

  // Load logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getConsciousnessLog(filters);
      setLogs(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch consciousness log:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="consciousness-page">
      <div className="page-header">
        <h1 className="page-title">Consciousness Log</h1>
        <span className="page-count">{total} entries</span>
      </div>

      <div className="consciousness-filters">
        <div className="filter-item">
          <label className="filter-label">Action Type</label>
          <Select
            value={filters.action_type}
            onChange={(val) => handleFilterChange('action_type', val)}
            options={actionTypes}
            placeholder="All types"
          />
        </div>

        <div className="filter-item">
          <label className="filter-label">From</label>
          <input
            type="date"
            className="date-input"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
        </div>

        <div className="filter-item">
          <label className="filter-label">To</label>
          <input
            type="date"
            className="date-input"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : logs.length === 0 ? (
        <EmptyState message="No consciousness logs found" icon="🧠" />
      ) : (
        <div className="timeline">
          {logs.map((item, index) => (
            <TimelineItem
              key={item.id}
              item={item}
              isLast={index === logs.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
