import { formatDateTime } from '../../utils/date';
import { parseTags } from '../../utils/tags';
import './MemoryCard.css';

export default function MemoryCard({ memory }) {
  const parsedTags = parseTags(memory.tags);

  return (
    <article className="memory-card">
      <div className="memory-content">
        {memory.content}
      </div>

      {parsedTags.length > 0 && (
        <div className="memory-tags">
          {parsedTags.map((tagObj, idx) => (
            <span 
              key={idx} 
              className={`memory-tag-chip type-${tagObj.type}`}
            >
              {tagObj.type === 'type' && <span className="tag-prefix">#</span>}
              {tagObj.type === 'person' && <span className="tag-prefix">@</span>}
              {tagObj.value}
            </span>
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
          {formatDateTime(memory.created)}
        </span>
      </div>
    </article>
  );
}
