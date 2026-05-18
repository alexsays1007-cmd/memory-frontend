import { useState, useEffect, useCallback } from 'react';
import {
  createMemory,
  getMemories,
  getMemoryTags,
  getMemoryAgents,
  getMemoryChannels,
  hideMemory,
  updateMemory,
  restoreMemory,
} from '../../api/memories';
import { getFilterOptionsFromMemories, getTopTags } from '../../utils/tags';
import MemoryCard from './MemoryCard';
import MemoryFilters from './MemoryFilters';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './MemoriesPage.css';

const PAGE_SIZE = 20;

const DEFAULT_NEW_MEMORY = {
  content: '',
  tags: 'source:manual,type:fact',
  agent: 'velvy',
  channel: 'frontend',
};

export default function MemoriesPage() {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'trash'
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
  const [actionError, setActionError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMemory, setNewMemory] = useState(DEFAULT_NEW_MEMORY);
  const [isCreating, setIsCreating] = useState(false);

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

  // Reset page when filters or viewMode change
  useEffect(() => {
    setPage(1);
  }, [filters, viewMode]);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page,
        pageSize: PAGE_SIZE,
      };
      if (viewMode === 'trash') {
        params.onlyDeleted = '1';
      }
      const result = await getMemories(params);
      setMemories(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages || 1);

      if (viewMode === 'active') {
        setFilterOptions(prev => {
          const computed = getFilterOptionsFromMemories(result.data);
          const newTags = prev.tags && prev.tags.length > 0 ? prev.tags : computed.tags;
          const newAgents = prev.agents && prev.agents.length > 0 ? prev.agents : computed.agents;
          const newChannels = prev.channels && prev.channels.length > 0 ? prev.channels : computed.channels;
          return { tags: newTags, agents: newAgents, channels: newChannels };
        });
      }
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page, viewMode]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleCreateFieldChange = (field, value) => {
    setNewMemory(current => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateMemory = async (event) => {
    event.preventDefault();
    setActionError('');

    if (!newMemory.content.trim()) {
      setActionError('Content is required');
      return;
    }

    setIsCreating(true);
    try {
      await createMemory(newMemory);
      setNewMemory(DEFAULT_NEW_MEMORY);
      setShowCreateForm(false);
      setPage(1);
      fetchMemories();
    } catch (err) {
      setActionError(err.message || 'Failed to create memory');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMemory = async (id, payload) => {
    setActionError('');
    const result = await updateMemory(id, payload);
    if (result.memory) {
      setMemories(current =>
        current.map(memory => memory.id === id ? result.memory : memory)
      );
    }
  };

  const handleHideMemory = async (id) => {
    setActionError('');
    try {
      await hideMemory(id);
      setMemories(current => current.filter(memory => memory.id !== id));
      setTotal(current => Math.max(0, current - 1));
    } catch (err) {
      setActionError(err.message || 'Failed to hide memory');
      throw err;
    }
  };

  const handleRestoreMemory = async (id) => {
    setActionError('');
    try {
      await restoreMemory(id);
      setMemories(current => current.filter(memory => memory.id !== id));
      setTotal(current => Math.max(0, current - 1));
    } catch (err) {
      setActionError(err.message || 'Failed to restore memory');
      throw err;
    }
  };

  const goToPage = (p) => {
    const target = Math.max(1, Math.min(p, totalPages));
    if (target !== page) {
      setPage(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="memories-page">
      <div className="page-header">
        <div className="page-title-wrap">
          <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <div>
            <h1 className="page-title">
              {viewMode === 'trash' ? '回收站' : '记忆档案'}
            </h1>
            <span className="page-subtitle">
              {viewMode === 'trash' ? 'RECYCLE BIN' : 'MEMORIES'} · {total} 条
            </span>
          </div>
        </div>
        <div className="page-actions">
          {viewMode === 'active' && (
            <>
              <button
                className="advanced-filter-btn"
                onClick={() => setShowCreateForm(value => !value)}
              >
                {showCreateForm ? '取消新增' : '新增记忆'}
              </button>
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
            </>
          )}
          <button
            className={`advanced-filter-btn ${viewMode === 'trash' ? 'active-mode-btn' : ''}`}
            onClick={() => setViewMode(viewMode === 'trash' ? 'active' : 'trash')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            {viewMode === 'trash' ? '返回档案' : '回收站'}
          </button>
        </div>
      </div>

      {showCreateForm && viewMode === 'active' && (
        <form className="new-memory-form" onSubmit={handleCreateMemory}>
          <label className="new-memory-label">
            正文
            <textarea
              value={newMemory.content}
              onChange={event => handleCreateFieldChange('content', event.target.value)}
              rows={6}
              placeholder="写一条你想让我记住的记忆..."
            />
          </label>
          <div className="new-memory-grid">
            <label className="new-memory-label">
              标签
              <input
                value={newMemory.tags}
                onChange={event => handleCreateFieldChange('tags', event.target.value)}
              />
            </label>
            <label className="new-memory-label">
              Agent
              <input
                value={newMemory.agent}
                onChange={event => handleCreateFieldChange('agent', event.target.value)}
              />
            </label>
            <label className="new-memory-label">
              Channel
              <input
                value={newMemory.channel}
                onChange={event => handleCreateFieldChange('channel', event.target.value)}
              />
            </label>
          </div>
          <div className="new-memory-actions">
            <button className="advanced-filter-btn create-submit" type="submit" disabled={isCreating}>
              {isCreating ? '保存中...' : '保存记忆'}
            </button>
          </div>
        </form>
      )}

      {viewMode === 'active' && (
        <MemoryFilters
          filters={filters}
          onFilterChange={setFilters}
          showAdvancedFilters={showAdvancedFilters}
          {...filterOptions}
        />
      )}

      {actionError && (
        <div className="memory-action-error">
          {actionError}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : memories.length === 0 ? (
        <EmptyState
          message={viewMode === 'trash' ? '回收站是空的' : '没有找到记忆'}
          icon="archive"
        />
      ) : (
        <>
          <div className="memories-list">
            {memories.map(memory => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onUpdate={viewMode === 'active' ? handleUpdateMemory : undefined}
                onHide={viewMode === 'active' ? handleHideMemory : undefined}
                onRestore={viewMode === 'trash' ? handleRestoreMemory : undefined}
                isTrash={viewMode === 'trash'}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>

              {buildPageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="pagination-dots">…</span>
                ) : (
                  <button
                    key={p}
                    className={`pagination-btn ${p === page ? 'active' : ''}`}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                className="pagination-btn"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Build a compact page number array like [1, '...', 4, 5, 6, '...', 10] */
function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}
