import { useState, useEffect, useCallback } from 'react';
import { getMemories, getMemoryTags, getMemoryAgents, getMemoryChannels } from '../../api/memories';
import MemoryCard from './MemoryCard';
import MemoryFilters from './MemoryFilters';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './MemoriesPage.css';

export default function MemoriesPage() {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: '',
    tag: null,
    agent: null,
    channel: null,
  });

  const [filterOptions, setFilterOptions] = useState({
    tags: [],
    agents: [],
    channels: [],
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Load filter options
  useEffect(() => {
    Promise.all([
      getMemoryTags(),
      getMemoryAgents(),
      getMemoryChannels(),
    ]).then(([tagsRes, agentsRes, channelsRes]) => {
      setFilterOptions({
        tags: tagsRes.tags,
        agents: agentsRes.agents,
        channels: channelsRes.channels,
      });
    }).catch(console.error);
  }, []);

  // Load memories
  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMemories(filters);
      setMemories(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return (
    <div className="memories-page">
      <div className="page-header">
        <div className="page-title-wrap">
          <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <div>
            <h1 className="page-title">记忆档案</h1>
            <span className="page-subtitle">MEMORIES</span>
          </div>
        </div>
        <button 
          className="advanced-filter-btn"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          筛选
        </button>
      </div>

      <MemoryFilters
        filters={filters}
        onFilterChange={setFilters}
        showAdvancedFilters={showAdvancedFilters}
        {...filterOptions}
      />

      {loading ? (
        <LoadingSpinner />
      ) : memories.length === 0 ? (
        <EmptyState message="No memories found" icon="🍂" />
      ) : (
        <div className="memories-list">
          {memories.map(memory => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      )}
    </div>
  );
}
