import { useState, useEffect, useCallback } from 'react';
import { getConsciousnessLog, getActionTypes } from '../../api/consciousness';
import TimelineItem from './TimelineItem';
import SoftSelect from '../../components/SoftSelect/SoftSelect';
import DateRangePicker from '../../components/DateRangePicker/DateRangePicker';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './ConsciousnessPage.css';

const ACTION_TYPE_ICONS = {
  '巡逻': '🐾',
  '叫醒': '🐾',
  '写入': '✎',
  '记录': '📋',
  '系统': '✺',
  '对话': '💬',
};

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
  
  const [showFilters, setShowFilters] = useState(false);
  const [tempFilters, setTempFilters] = useState(filters);

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

  const handleApply = () => {
    setFilters(tempFilters);
    setShowFilters(false);
  };

  const handleReset = () => {
    const resetFilters = { action_type: null, date_from: '', date_to: '' };
    setTempFilters(resetFilters);
    setFilters(resetFilters);
    setShowFilters(false);
  };

  const getFilterSummary = () => {
    const typeStr = filters.action_type || 'All types';
    let dateStr = '';
    if (filters.date_from && filters.date_to) {
      dateStr = `${filters.date_from.replace(/-/g, '/')} – ${filters.date_to.replace(/-/g, '/')}`;
    } else if (filters.date_from) {
      dateStr = `From ${filters.date_from.replace(/-/g, '/')}`;
    } else if (filters.date_to) {
      dateStr = `Until ${filters.date_to.replace(/-/g, '/')}`;
    } else {
      dateStr = 'All time';
    }
    return `${typeStr} · ${dateStr}`;
  };

  // Build SoftSelect options with icons
  const actionTypeOptions = actionTypes.map(at => ({
    value: at,
    label: at,
    icon: ACTION_TYPE_ICONS[at] || '•',
  }));

  return (
    <div className="consciousness-page">
      <div className="page-header">
        <div className="page-title-wrap">
          <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <div>
            <h1 className="page-title">意识脉冲</h1>
            <span className="page-subtitle">PULSE LOG</span>
          </div>
        </div>
        
        <button 
          className="compact-filter-summary"
          onClick={() => {
            setTempFilters(filters);
            setShowFilters(true);
          }}
        >
          <div className="summary-text">
            {getFilterSummary()}
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {showFilters && (
        <div className="filter-popover-overlay" onClick={() => setShowFilters(false)}>
          <div className="filter-popover" onClick={(e) => e.stopPropagation()}>
            <div className="filter-popover-header">
              <h3>Filter Logs</h3>
            </div>
            
            <div className="filter-popover-body">
              <div className="filter-item">
                <label className="filter-label">Action Type</label>
                <SoftSelect
                  value={tempFilters.action_type}
                  onChange={(val) => setTempFilters(p => ({...p, action_type: val}))}
                  options={actionTypeOptions}
                  placeholder="All types"
                />
              </div>

              <div className="filter-item">
                <label className="filter-label">Date Range</label>
                <DateRangePicker 
                  startDate={tempFilters.date_from}
                  endDate={tempFilters.date_to}
                  onRangeSelect={(range) => {
                    setTempFilters(p => ({
                      ...p, 
                      date_from: range.start || '', 
                      date_to: range.end || ''
                    }));
                  }}
                />
              </div>
            </div>

            <div className="filter-popover-footer">
              <button className="filter-reset-btn" onClick={handleReset}>Reset</button>
              <button className="filter-apply-btn" onClick={handleApply}>Apply</button>
            </div>
          </div>
        </div>
      )}

      <div className="log-meta-bar">
        共 {total} 条记录
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : logs.length === 0 ? (
        <EmptyState message="No consciousness logs found" icon="💭" />
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
