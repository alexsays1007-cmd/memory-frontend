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
        <h1 className="page-title">Memories</h1>
        <span className="page-count">{total} entries</span>
      </div>

      <MemoryFilters
        filters={filters}
        onFilterChange={setFilters}
        {...filterOptions}
      />

      {loading ? (
        <LoadingSpinner />
      ) : memories.length === 0 ? (
        <EmptyState message="No memories found" icon="🧠" />
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
