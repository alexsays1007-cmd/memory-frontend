import Tag from '../../components/common/Tag';
import './MemoryCard.css';

export default function MemoryCard({ memory }) {
  const tags = memory.tags
    ? memory.tags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <article className="memory-card">
      <div className="memory-content">
        {memory.content}
      </div>

      {tags.length > 0 && (
        <div className="memory-tags">
          {tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}

      <div className="memory-meta">
        {memory.agent && (
          <span className="memory-meta-item">
            <span className="meta-label">Agent:</span> {memory.agent}
          </span>
        )}
        {memory.channel && (
          <span className="memory-meta-item">
            <span className="meta-label">Channel:</span> {memory.channel}
          </span>
        )}
        <span className="memory-meta-item memory-date">
          {formatDate(memory.created)}
        </span>
      </div>
    </article>
  );
}
