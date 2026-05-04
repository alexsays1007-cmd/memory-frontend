import SearchInput from '../../components/common/SearchInput';
import Select from '../../components/common/Select';
import './MemoryFilters.css';

export default function MemoryFilters({
  filters,
  onFilterChange,
  tags = [],
  agents = [],
  channels = [],
}) {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="memory-filters">
      <div className="filter-row">
        <div className="filter-search">
          <SearchInput
            value={filters.q}
            onChange={(val) => handleChange('q', val)}
            placeholder="Search content or tags..."
          />
        </div>
      </div>

      <div className="filter-row filter-selects">
        <div className="filter-item">
          <label className="filter-label">Tag</label>
          <Select
            value={filters.tag}
            onChange={(val) => handleChange('tag', val)}
            options={tags}
            placeholder="All tags"
          />
        </div>

        <div className="filter-item">
          <label className="filter-label">Agent</label>
          <Select
            value={filters.agent}
            onChange={(val) => handleChange('agent', val)}
            options={agents}
            placeholder="All agents"
          />
        </div>

        <div className="filter-item">
          <label className="filter-label">Channel</label>
          <Select
            value={filters.channel}
            onChange={(val) => handleChange('channel', val)}
            options={channels}
            placeholder="All channels"
          />
        </div>
      </div>
    </div>
  );
}
