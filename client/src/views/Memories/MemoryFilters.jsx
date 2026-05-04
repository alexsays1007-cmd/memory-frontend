import SoftSelect from '../../components/SoftSelect/SoftSelect';
import { getTopTags, parseTags } from '../../utils/tags';
import './MemoryFilters.css';

const TAG_GROUPS = [
  { key: 'type', label: 'Type' },
  { key: 'topic', label: 'Topic' },
  { key: 'person', label: 'Person' },
  { key: 'project', label: 'Project' },
  { key: 'mood', label: 'Mood' },
  { key: 'source', label: 'Source' },
];

function buildGroupedTagOptions(rawTags) {
  const options = [];
  const seen = new Set();

  rawTags.forEach(rawTag => {
    const tag = typeof rawTag === 'string' ? rawTag : rawTag.tag || rawTag.name;
    if (!tag || seen.has(tag)) return;
    seen.add(tag);

    const parsed = parseTags(tag);
    parsed.forEach(p => {
      options.push({
        value: tag,
        label: p.value,
        group: p.type,
      });
    });
  });

  return options;
}

export default function MemoryFilters({
  filters,
  onFilterChange,
  showAdvancedFilters,
  tags = [],
  agents = [],
  channels = [],
}) {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleTagToggle = (tagValue) => {
    if (filters.tag === tagValue) {
      handleChange('tag', null);
    } else {
      handleChange('tag', tagValue);
    }
  };

  const popularTags = getTopTags(tags, 8);
  const groupedTagOptions = buildGroupedTagOptions(tags);

  const agentOptions = agents.map(a => {
    const name = typeof a === 'string' ? a : a.value || a.name;
    return { value: name, label: name };
  });

  const channelOptions = channels.map(c => {
    const name = typeof c === 'string' ? c : c.value || c.name;
    return { value: name, label: name };
  });

  return (
    <div className="memory-filters">
      <div className="filter-search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="soft-search-input"
          value={filters.q}
          onChange={(e) => handleChange('q', e.target.value)}
          placeholder="搜索内容或标签..."
        />
      </div>

      <div className="tags-scroller">
        <button 
          className={`tag-chip ${!filters.tag ? 'active' : ''}`}
          onClick={() => handleChange('tag', null)}
        >
          All
        </button>
        {popularTags.map(pt => (
          <button 
            key={pt}
            className={`tag-chip ${filters.tag === pt ? 'active' : ''}`}
            onClick={() => handleTagToggle(pt)}
          >
            {pt}
          </button>
        ))}
      </div>

      {showAdvancedFilters && (
        <div className="advanced-filters-panel">
          <div className="filter-item">
            <label className="filter-label">Tag</label>
            <SoftSelect
              value={filters.tag}
              onChange={(val) => handleChange('tag', val)}
              options={groupedTagOptions}
              groups={TAG_GROUPS}
              placeholder="All tags"
            />
          </div>

          <div className="filter-item">
            <label className="filter-label">Agent</label>
            <SoftSelect
              value={filters.agent}
              onChange={(val) => handleChange('agent', val)}
              options={agentOptions}
              placeholder="All agents"
            />
          </div>

          <div className="filter-item">
            <label className="filter-label">Channel</label>
            <SoftSelect
              value={filters.channel}
              onChange={(val) => handleChange('channel', val)}
              options={channelOptions}
              placeholder="All channels"
            />
          </div>
        </div>
      )}
    </div>
  );
}
