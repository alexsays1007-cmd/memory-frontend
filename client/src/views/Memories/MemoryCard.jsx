import { useState, useRef, useEffect } from 'react';
import { formatDateTime } from '../../utils/date';
import { parseTags } from '../../utils/tags';
import './MemoryCard.css';

export default function MemoryCard({ memory }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef(null);

  // Check if content is actually clamped
  useEffect(() => {
    if (contentRef.current) {
      setIsClamped(contentRef.current.scrollHeight > contentRef.current.clientHeight);
    }
  }, [memory.content]);

  let parsedTags = parseTags(memory.tags);

  // Deduplicate metadata from visual tags
  if (memory.agent || memory.channel) {
    parsedTags = parsedTags.filter(t => {
      const val = t.value.toLowerCase();
      if (memory.agent && val === memory.agent.toLowerCase()) return false;
      if (memory.channel && val === memory.channel.toLowerCase()) return false;
      return true;
    });
  }

  return (
    <article className="memory-card">
      <div 
        ref={contentRef}
        className={`memory-content ${!isExpanded ? 'clamped' : ''}`}
      >
        {memory.content}
      </div>
      
      {!isExpanded && isClamped && (
        <button 
          className="expand-toggle" 
          onClick={() => setIsExpanded(true)}
        >
          展开内容
        </button>
      )}

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
